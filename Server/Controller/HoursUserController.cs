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
public class HoursUserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly EmailController _emailController;



    public HoursUserController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext, EmailController emailController)
    {
        _context = context;
        _hubContext = hubContext;
        _emailController = emailController;
    }

    [HttpPost("addhour")]
    public async Task<IActionResult> AddHours([FromBody] HoursUser hoursUser)
    {
        if (hoursUser == null)
        {
            return BadRequest(new { message = "Datos de entrada inválidos." });
        }

        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }

        // Validaciones (estas son rápidas, mantenerlas)
        if (hoursUser.Hours <= 0)
        {
            return BadRequest(new { message = "El número de horas debe ser mayor a 0." });
        }

        if (hoursUser.Hours > 8)
        {
            return BadRequest(new { message = "No se pueden registrar más de 8 horas en una sola solicitud." });
        }

        if (string.IsNullOrEmpty(hoursUser.Description))
        {
            return BadRequest(new { message = "La descripción no puede estar vacía." });
        }

        // Asignar valores automáticos
        hoursUser.CurrentHour = DateTime.Now;
        hoursUser.UserId = user.Id;
        hoursUser.User = user;
        hoursUser.Status = "Pendiente";

        await _context.HoursUsers.AddAsync(hoursUser);
        await _context.SaveChangesAsync();

        _ = Task.Run(async () =>
        {
            try
            {
                // SignalR notification
                await _hubContext.Clients.Group("Admin").SendAsync(
                    "ReceiveNotification",
                    new
                    {
                        id = hoursUser.Id,
                        firstName = user.FirstName,
                        lastName = user.LastName,
                        hours = hoursUser.Hours,
                        description = hoursUser.Description,
                        Type = "hoursRequest",
                    }
                );

                // Email notification
                string nombreCompleto = $"{user.FirstName} {user.LastName}";
                string mensaje = $"El usuario ha registrado {hoursUser.Hours} horas con la siguiente descripción: '{hoursUser.Description}'";

                await _emailController.EnviarNotificacion(
                    "jpaul1706@hotmail.com",
                    nombreCompleto,
                    $"Nueva solicitud de horas: {hoursUser.Hours}h por {nombreCompleto}",
                    mensaje,
                    "horas"
                );
            }
            catch (Exception ex)
            {
                // Log del error pero no afecta la respuesta al usuario
                Console.WriteLine($"[ERROR] Error enviando notificaciones: {ex.Message}");
            }
        });

        return Ok(new { message = "Horas añadidas." });
    }

    // Endpoint para obtener las horas registradas por el usuario autenticado
    [HttpGet("gethours")]
    public IActionResult GetHours()
    {
        // Extraer el ID del usuario desde los claims del token
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        // Verifica si el token está presente
        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

        // Validar el ID del usuario
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });
        }

        // Obtener la lista de horas registradas por el usuario
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

        // Validación si no hay registros
        if (!hours.Any())
        {
            return NotFound(new { message = "No se encontraron horas registradas." });
        }

        return Ok(hours);
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

        // Guardar estado anterior para el log
        string previousStatus = hr.Status;

        hr.Status = "Aceptada";
        await _context.SaveChangesAsync();
        Console.WriteLine($"[Ctrl] Guardado estado Aceptada para hr.Id={hr.Id}");

        // Calcular el nuevo total de horas aceptadas del usuario
        var newTotalHours = await _context.HoursUsers
            .Where(h => h.UserId == hr.UserId && h.Status == "Aceptada")
            .SumAsync(h => h.Hours);
        Console.WriteLine($"[Ctrl] Nuevo total de horas para usuario {hr.UserId}: {newTotalHours}");

        var userGroup = hr.UserId.ToString();

        Console.WriteLine($"[Ctrl] *** ENVIANDO UpdateHourStatus ***");
        var updateData = new
        {
            hourId = hr.Id,
            newStatus = hr.Status,
            previousStatus = previousStatus,
            hours = hr.Hours,
            description = hr.Description,
            userId = hr.UserId
        };
        Console.WriteLine($"[Ctrl] UpdateHourStatus data: HourId={hr.Id}, NewStatus={hr.Status}, PreviousStatus={previousStatus}");

        await _hubContext.Clients.Group(userGroup)
            .SendAsync("UpdateHourStatus", updateData);
        Console.WriteLine($"[Ctrl]  UpdateHourStatus enviado al grupo {userGroup}");

        // Enviar actualización del total de horas
        Console.WriteLine($"[Ctrl] *** ENVIANDO UpdateHoursTotal al usuario {hr.UserId} con total: {newTotalHours} ***");
        await _hubContext.Clients.Group(userGroup)
            .SendAsync("UpdateHoursTotal", newTotalHours);
        Console.WriteLine($"[Ctrl] UpdateHoursTotal enviado");

        // Enviar notificación general
        Console.WriteLine($"[Ctrl] *** ENVIANDO ReceiveNotification a grupo {userGroup} ***");
        await _hubContext.Clients.Group(userGroup)
            .SendAsync("ReceiveNotification", new
            {
                id = hr.Id,
                firstName = hr.User?.FirstName,
                lastName = hr.User?.LastName,
                hours = hr.Hours,
                description = hr.Description,
                type = "hoursAccepted",
                acceptedDate = DateTime.Now.ToString("dd/MM/yyyy")

            });
        Console.WriteLine($"[Ctrl]  ReceiveNotification enviado");

        Console.WriteLine($"[Ctrl] *** TODOS LOS EVENTOS ENVIADOS COMPLETAMENTE ***");

        return Ok(new { message = "Horas aceptadas correctamente." });
    }

    [HttpPatch("reject/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectRequest(int id)
    {
        Console.WriteLine($"[Ctrl] Llega PATCH reject/{id}");
        var hr = await _context.HoursUsers
                    .Include(h => h.User)
                    .FirstOrDefaultAsync(h => h.Id == id);
        if (hr == null) { Console.WriteLine("[Ctrl] hr es null"); return NotFound(); }

        // Guardar estado anterior
        string previousStatus = hr.Status;

        hr.Status = "Rechazada";
        await _context.SaveChangesAsync();
        Console.WriteLine($"[Ctrl] Guardado estado Rechazada para hr.Id={hr.Id}");

        var userGroup = hr.UserId.ToString();

        Console.WriteLine($"[Ctrl] *** ENVIANDO UpdateHourStatus (RECHAZO) ***");
        var updateData = new
        {
            hourId = hr.Id,
            newStatus = hr.Status,
            previousStatus = previousStatus,
            hours = hr.Hours,
            description = hr.Description,
            userId = hr.UserId
        };

        await _hubContext.Clients.Group(userGroup)
            .SendAsync("UpdateHourStatus", updateData);
        Console.WriteLine($"[Ctrl] UpdateHourStatus (rechazo) enviado al grupo {userGroup}");

        Console.WriteLine($"[Ctrl] *** ENVIANDO ReceiveNotification a grupo {userGroup} ***");
        await _hubContext.Clients.Group(userGroup)
            .SendAsync("ReceiveNotification", new
            {
                id = hr.Id,
                firstName = hr.User?.FirstName,
                lastName = hr.User?.LastName,
                hours = hr.Hours,
                description = hr.Description,
                type = "hoursRejected",
                rejectedDate = DateTime.Now.ToString("dd/MM/yyyy")

            });
        Console.WriteLine($"[Ctrl]  ReceiveNotification enviado");

        return Ok(new { message = "Horas Rechazadas." });
    }

    [HttpGet("acceptedhours")]
    [Authorize]
    public async Task<IActionResult> GetAcceptedHours()
    {
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        if (string.IsNullOrEmpty(userIdClaim)
            || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario." });
        }

        // Traer sólo las horas con Status = "Aceptada"
        var acceptedEntries = await _context.HoursUsers
            .Where(h => h.UserId == userId && h.Status == "Aceptada")
            .Select(h => new
            {
                h.Id,
                h.Hours,
                h.CurrentHour
            })
            .ToListAsync();

        // Sumar las horas aceptadas
        var totalAccepted = acceptedEntries.Sum(e => e.Hours);



        return Ok(new
        {
            totalAcceptedHours = totalAccepted,
            entries = acceptedEntries
        });
    }

}
