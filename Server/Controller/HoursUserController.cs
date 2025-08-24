using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Hardworker.Hubs;
using Microsoft.EntityFrameworkCore;
using HardWorker.Server.Controller;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class HoursUserController : BaseController
{
    private readonly EmailController _emailController;

    public HoursUserController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext, EmailController emailController)
        : base(context, hubContext)
    {
        _emailController = emailController;
    }

    [HttpPost("addhour")]
    public async Task<IActionResult> AddHours([FromBody] HoursUser hoursUser)
    {
        return await TryExecuteAsync(async () =>
        {
            return await ExecuteWithUserValidationAsync(async (user) =>
            {
                var modelValidation = ValidateModel();
                if (modelValidation != null) return modelValidation;

                if (hoursUser == null)
                    return BadRequest(new { message = "Datos de entrada inválidos." });

                if (hoursUser.Hours <= 0)
                    return BadRequest(new { message = "El número de horas debe ser mayor a 0." });

                if (hoursUser.Hours > 8)
                    return BadRequest(new { message = "No se pueden registrar más de 8 horas en una sola solicitud." });

                var descriptionValidation = ValidateRequired(hoursUser.Description, "La descripción");
                if (descriptionValidation != null) return descriptionValidation;

                hoursUser.CurrentHour = DateTime.Now;
                hoursUser.UserId = user.Id;
                hoursUser.User = user;
                hoursUser.Status = "Pendiente";

                await _context.HoursUsers.AddAsync(hoursUser);
                var saveResult = await SaveChangesAsync("Horas añadidas.");
                if (saveResult is not OkObjectResult) return saveResult;

                var adminUserIds = await GetUserIdsByRoleAsync("Admin");
                Console.WriteLine($" Admin IDs obtenidos para solicitud de horas: [{string.Join(", ", adminUserIds)}]");

                _ = SendHoursNotificationsInBackground(hoursUser, user, adminUserIds);

                return Ok(new { message = "Horas añadidas." });
            });
        }, "añadir horas");
    }

    [HttpGet("gethours")]
    public IActionResult GetHours()
    {
        return TryExecute(() =>
        {
            var (isValid, userId, error) = GetUserIdFromToken();
            if (!isValid) return error!;

            var hours = _context.HoursUsers
                .Where(h => h.UserId == userId)
                .Select(h => new
                {
                    h.Id,
                    h.Hours,
                    CurrentHour = h.CurrentHour.ToString("MMMM dd, yyyy"),
                    h.Status
                })
                .ToList();

            if (!hours.Any())
            {
                return NotFound(new { message = "No se encontraron horas registradas." });
            }

            return Ok(hours);
        }, "obtener horas");
    }

    [HttpPatch("accept/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AcceptRequest(int id)
    {
        Console.WriteLine($"[Ctrl] Llega PATCH accept/{id}");
        var hr = await _context.HoursUsers
                    .Include(h => h.User)
                    .FirstOrDefaultAsync(h => h.Id == id);
        if (hr == null) { Console.WriteLine("[Ctrl] hr es null"); return NotFound(); }

        string previousStatus = hr.Status;

        hr.Status = "Aceptada";
        await _context.SaveChangesAsync();
        Console.WriteLine($"[Ctrl] Guardado estado Aceptada para hr.Id={hr.Id}");

        var newTotalHours = await _context.HoursUsers
            .Where(h => h.UserId == hr.UserId && h.Status == "Aceptada")
            .SumAsync(h => h.Hours);
        Console.WriteLine($"[Ctrl] Nuevo total de horas para usuario {hr.UserId}: {newTotalHours}");

        var acceptedCompensatories = await _context.Compensatories
            .Where(c => c.UserId == hr.UserId && c.Status == "Aceptada")
            .Select(c => new { c.From, c.To })
            .ToListAsync();

        var totalUsed = acceptedCompensatories
            .Sum(c => Math.Round((c.To - c.From).TotalHours, 2));

        var newAvailableHours = Math.Max(0, newTotalHours - totalUsed);
        Console.WriteLine($"[Ctrl] Nuevas horas disponibles para usuario {hr.UserId}: {newAvailableHours}");

        var userGroup = hr.UserId.ToString();

        var updateData = new
        {
            hourId = hr.Id,
            newStatus = hr.Status,
            previousStatus = previousStatus,
            hours = hr.Hours,
            description = hr.Description,
            userId = hr.UserId
        };

        await _hubContext.Clients.Group(userGroup).SendAsync("UpdateHourStatus", updateData);
        await _hubContext.Clients.Group(userGroup).SendAsync("UpdateHoursTotal", newTotalHours);
        await _hubContext.Clients.Group(userGroup).SendAsync("UpdateAvailableHours", newAvailableHours);

        var notificationData = new
        {
            id = hr.Id,
            firstName = hr.User?.FirstName,
            lastName = hr.User?.LastName,
            hours = hr.Hours,
            description = hr.Description,
            type = "hoursAccepted",
            acceptedDate = DateTime.Now.ToString("dd/MM/yyyy"),
            userId = hr.UserId,
            timestamp = DateTime.UtcNow,
            targetRole = "User",
            targetUserIds = new List<int> { hr.UserId },
            fromUserId = hr.UserId
        };

        await _hubContext.Clients.All.SendAsync("DistributeNotification", notificationData);

        await _hubContext.Clients.Group(userGroup).SendAsync("ReceiveNotification", new
        {
            id = hr.Id,
            firstName = hr.User?.FirstName,
            lastName = hr.User?.LastName,
            hours = hr.Hours,
            description = hr.Description,
            type = "hoursAccepted",
            acceptedDate = DateTime.Now.ToString("dd/MM/yyyy")
        });

        Console.WriteLine($"[Ctrl] *** NOTIFICACIÓN DE ACEPTACIÓN ENVIADA CON DISTRIBUCIÓN AUTOMÁTICA ***");

        return Ok(new { message = "Horas aceptadas correctamente." });
    }

    [HttpPatch("reject/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectRequest(int id)
    {
        return await TryExecuteAsync(async () =>
        {
            Console.WriteLine($"[Ctrl] Llega PATCH reject/{id}");
            var hr = await _context.HoursUsers
                        .Include(h => h.User)
                        .FirstOrDefaultAsync(h => h.Id == id);
            if (hr == null) { Console.WriteLine("[Ctrl] hr es null"); return NotFound(); }

            string previousStatus = hr.Status;

            hr.Status = "Rechazada";
            var saveResult = await SaveChangesAsync("Horas Rechazadas.");
            if (saveResult is not OkObjectResult) return saveResult;

            Console.WriteLine($"[Ctrl] Guardado estado Rechazada para hr.Id={hr.Id}");

            var userGroup = hr.UserId.ToString();

            var updateData = new
            {
                hourId = hr.Id,
                newStatus = hr.Status,
                previousStatus = previousStatus,
                hours = hr.Hours,
                description = hr.Description,
                userId = hr.UserId
            };

            await SendUserNotificationAsync(hr.UserId, "UpdateHourStatus", updateData);

            var notificationData = new
            {
                id = hr.Id,
                firstName = hr.User?.FirstName,
                lastName = hr.User?.LastName,
                hours = hr.Hours,
                description = hr.Description,
                type = "hoursRejected",
                rejectedDate = DateTime.Now.ToString("dd/MM/yyyy"),
                userId = hr.UserId,
                timestamp = DateTime.UtcNow,
                targetRole = "User",
                targetUserIds = new List<int> { hr.UserId },
                fromUserId = hr.UserId 
            };

            await _hubContext.Clients.All.SendAsync("DistributeNotification", notificationData);

            await SendUserNotificationAsync(hr.UserId, "ReceiveNotification", new
            {
                id = hr.Id,
                firstName = hr.User?.FirstName,
                lastName = hr.User?.LastName,
                hours = hr.Hours,
                description = hr.Description,
                type = "hoursRejected",
                rejectedDate = DateTime.Now.ToString("dd/MM/yyyy")
            });

            Console.WriteLine($"[Ctrl] *** NOTIFICACIÓN DE RECHAZO ENVIADA CON DISTRIBUCIÓN AUTOMÁTICA ***");

            return Ok(new { message = "Horas Rechazadas." });
        }, "rechazar solicitud de horas");
    }

    [HttpGet("available-hours")]
    [Authorize]
    public async Task<IActionResult> GetAvailableHours()
    {
        return await ExecuteWithAuthenticationAsync<IActionResult>(async (userId) =>
        {
            Console.WriteLine($"[DEBUG] Calculando horas disponibles para usuario {userId}");

            var totalEarned = await _context.HoursUsers
                .Where(h => h.UserId == userId && h.Status == "Aceptada")
                .SumAsync(h => h.Hours);

            var acceptedCompensatories = await _context.Compensatories
                .Where(c => c.UserId == userId && c.Status == "Aceptada")
                .Select(c => new { c.From, c.To })
                .ToListAsync();

            var totalUsed = acceptedCompensatories
                .Sum(c => Math.Round((c.To - c.From).TotalHours, 2));

            var availableHours = Math.Max(0, totalEarned - totalUsed);

            Console.WriteLine($"[DEBUG] Usuario {userId}: Ganadas={totalEarned}, Usadas={totalUsed}, Disponibles={availableHours}");

            return Ok(new
            {
                availableHours = availableHours,
                totalEarned = totalEarned,
                totalUsed = totalUsed
            });
        });
    }

    private async Task SendHoursNotificationsInBackground(HoursUser hoursUser, User user, List<int> adminUserIds)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                Console.WriteLine($" Iniciando envío de notificaciones para horas ID: {hoursUser.Id}");
                Console.WriteLine($" Admin IDs recibidos: [{string.Join(", ", adminUserIds)}]");

                var notificationData = new
                {
                    id = hoursUser.Id,
                    firstName = user.FirstName,
                    lastName = user.LastName,
                    hours = hoursUser.Hours,
                    description = hoursUser.Description,
                    type = "hoursRequest",
                    userId = user.Id,
                    timestamp = DateTime.UtcNow,
                    targetRole = "Admin",
                    targetUserIds = adminUserIds,
                    fromUserId = user.Id
                };

                Console.WriteLine($" Datos de notificación para horas: {System.Text.Json.JsonSerializer.Serialize(notificationData)}");

                await SendNotificationToAllAdminsAsync(notificationData);

                string nombreCompleto = $"{user.FirstName} {user.LastName}";
                string mensaje = $"El usuario ha registrado {hoursUser.Hours} horas con la siguiente descripción: '{hoursUser.Description}'";

                await _emailController.EnviarNotificacion(
                    "jpaul1706@hotmail.com",
                    nombreCompleto,
                    $"Nueva solicitud de horas: {hoursUser.Hours}h por {nombreCompleto}",
                    mensaje,
                    "horas"
                );

                Console.WriteLine(" Notificaciones de horas enviadas correctamente");
            }
            catch (Exception ex)
            {
                Console.WriteLine($" Error enviando notificaciones de horas: {ex.Message}");
                Console.WriteLine($" Stack trace: {ex.StackTrace}");
            }
        });
    }
}