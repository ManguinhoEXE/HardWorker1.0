using HardWorker.Model;
using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Hardworker.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using HardWorker.Server.Controller;

[Route("api/[Controller]")]
[ApiController]
public class CompensatoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly EmailController _emailController;

    public CompensatoryController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext, EmailController emailController)
    {
        _context = context;
        _hubContext = hubContext;
        _emailController = emailController;
    }

    // ==================== OBTENER SOLICITUDES DEL USUARIO ====================
    [HttpGet("getrequests")]
    public IActionResult getCompensatories()
    {
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
            return Unauthorized(new { message = "Usuario no autenticado." });

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });

        var compensatoryRequests = _context.Compensatories
            .Where(c => c.UserId == userId)
            .Select(c => new
            {
                c.Id,
                From = c.From.ToString("yyyy-MM-ddTHH:mm:ss"),
                To = c.To.ToString("yyyy-MM-ddTHH:mm:ss"),
                c.Reason,
                c.Status,
                CurrentHour = c.CurrentHour.ToString("yyyy-MM-ddTHH:mm:ss")
            })
            .ToList();

        if (!compensatoryRequests.Any())
            return NotFound(new { message = "No se encontraron solicitudes de compensatorio." });

        return Ok(compensatoryRequests);
    }

    // ==================== CREAR NUEVA SOLICITUD ====================
    [HttpPost("addrequest")]
    public async Task<IActionResult> requestCompensatory([FromBody] Compensatory compensatory)
    {
        try
        {
            var userIdClaim = User.Claims.FirstOrDefault(c =>
                c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
                && int.TryParse(c.Value, out _))?.Value;

            var token = Request.Cookies["token"];
            if (string.IsNullOrEmpty(token))
                return Unauthorized(new { message = "Usuario no autenticado." });

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });

            // Validaciones básicas
            if (compensatory.From >= compensatory.To)
                return BadRequest(new { message = "La fecha de inicio debe ser menor a la fecha de fin." });

            if (string.IsNullOrWhiteSpace(compensatory.Reason))
                return BadRequest(new { message = "La razón es requerida." });

            if (compensatory.From.Minute != compensatory.To.Minute)
                return BadRequest(new { message = "La solicitud de compensatorio debe ser en horas completas. Los minutos de la hora de inicio y fin deben coincidir (ej. de 09:15 a 11:15)." });

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound(new { message = "Usuario no encontrado." });

            var totalAccepted = await _context.HoursUsers
                .Where(h => h.UserId == userId && h.Status == "Aceptada")
                .SumAsync(h => h.Hours);

            // Calcular horas solicitadas
            var duration = compensatory.To - compensatory.From;
            var hoursRequested = Math.Round(duration.TotalHours, 2);

            // Validar horas disponibles
            if (hoursRequested > totalAccepted)
            {
                return BadRequest(new
                {
                    message = $"No tienes suficientes horas disponibles. Disponibles: {totalAccepted}, solicitadas: {hoursRequested}"
                });
            }

            compensatory.UserId = userId;
            compensatory.CurrentHour = DateTime.Now;
            compensatory.Status = "Pendiente";

            await _context.Compensatories.AddAsync(compensatory);
            await _context.SaveChangesAsync();

            _ = SendCompensatoryNotificationsInBackground(compensatory, user, hoursRequested);

            return Ok(new
            {
                message = "Solicitud de compensatorio creada exitosamente.",
                compensatory = compensatory,
                hoursRequested
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Ocurrió un error interno en el servidor.", error = ex.Message });
        }
    }



    private async Task SendCompensatoryNotificationsInBackground(Compensatory compensatory, User user, double hoursRequested)
    {
        try
        {
            string nombreCompleto = $"{user.FirstName} {user.LastName}";
            string fechaInicio = compensatory.From.ToString("dd/MM/yyyy HH:mm");
            string fechaFin = compensatory.To.ToString("dd/MM/yyyy HH:mm");

            string mensaje = $"El usuario {nombreCompleto} ha solicitado un compensatorio " +
                             $"de {hoursRequested} horas ({fechaInicio} a {fechaFin}).\n\n" +
                             $"Motivo: {compensatory.Reason}\n\n" +
                             $"Esta solicitud requiere su aprobación en el panel de administración.";

            // 🚀 EJECUTAR EMAIL Y SIGNALR EN PARALELO
            var emailTask = _emailController.EnviarNotificacion(
                "jpaul1706@hotmail.com",
                nombreCompleto,
                $"Nueva solicitud de compensatorio: {nombreCompleto}",
                mensaje,
                "compensatorio"
            );

            var signalRTask = _hubContext.Clients.Group("Admin").SendAsync(
                "ReceiveNotification",
                new
                {
                    id = compensatory.Id,
                    firstName = user.FirstName,
                    lastName = user.LastName,
                    from = compensatory.From,
                    to = compensatory.To,
                    reason = compensatory.Reason,
                    type = "compRequest"
                }
            );

            // Esperar que ambas notificaciones se completen
            await Task.WhenAll(emailTask, signalRTask);

            Console.WriteLine($"[SUCCESS] Notificaciones de compensatorio enviadas para ID: {compensatory.Id}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Fallo enviando notificaciones para compensatorio ID: {compensatory.Id} - {ex.Message}");
        }
    }

    // ==================== OBTENER TODAS LAS SOLICITUDES (ADMIN) ====================
    [HttpGet("getallrequests")]
    public IActionResult GetCompensatoryRequests()
    {
        var now = DateTime.UtcNow;

        var compensatoryRequests = _context.Compensatories
            .Include(c => c.User)
            .ToList()
            .Select(c =>
            {
                string dynamicStatus = c.Status ?? string.Empty;
                if (c.Status == "Aceptada")
                {
                    if (now >= c.From && now < c.To)
                        dynamicStatus = "En curso";
                    else if (now >= c.To)
                        dynamicStatus = "Finalizado";
                }
                return new
                {
                    c.Id,
                    FirstName = c.User?.FirstName,
                    LastName = c.User?.LastName,
                    c.Reason,
                    From = c.From,
                    To = c.To,
                    Status = dynamicStatus,
                    c.UserId
                };
            })
            .Where(c => c.Status != "Finalizado")
            .OrderByDescending(c => c.From)
            .ToList();

        return Ok(compensatoryRequests);
    }

    // ==================== HISTORIAL COMPLETO (ADMIN) ====================
    [HttpGet("getallhistory")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetAllCompensatoryHistory()
    {
        try
        {
            var now = DateTime.UtcNow;

            var allCompensatoryHistory = _context.Compensatories
                .Include(c => c.User)
                .OrderByDescending(c => c.CurrentHour)
                .ToList()
                .Select(c =>
                {
                    // Calcular estado dinámico
                    string dynamicStatus = c.Status ?? string.Empty;
                    if (c.Status == "Aceptada")
                    {
                        if (now >= c.From && now < c.To)
                            dynamicStatus = "En curso";
                        else if (now >= c.To)
                            dynamicStatus = "Finalizado";
                        else if (now < c.From)
                            dynamicStatus = "Programado";
                    }

                    var duration = c.To - c.From;
                    var hoursRequested = Math.Round(duration.TotalHours, 2);

                    return new
                    {
                        Id = c.Id,
                        FirstName = c.User?.FirstName ?? "N/A",
                        LastName = c.User?.LastName ?? "N/A",
                        Reason = c.Reason,
                        From = c.From.ToString("yyyy-MM-ddTHH:mm:ss"),
                        To = c.To.ToString("yyyy-MM-ddTHH:mm:ss"),
                        Status = c.Status,
                        DynamicStatus = dynamicStatus,
                        CurrentHour = c.CurrentHour.ToString("yyyy-MM-ddTHH:mm:ss"),
                        UserId = c.UserId,
                        HoursRequested = hoursRequested,
                        UserFullName = $"{c.User?.FirstName ?? "N/A"} {c.User?.LastName ?? "N/A"}",
                        DaysFromRequest = Math.Round((now - c.CurrentHour).TotalDays, 1),
                        IsActive = dynamicStatus == "En curso",
                        IsPending = c.Status == "Pendiente",
                        IsExpired = c.Status == "Aceptada" && now >= c.To
                    };
                })
                .ToList();

            // Estadísticas del historial
            var statistics = new
            {
                TotalRequests = allCompensatoryHistory.Count,
                PendingRequests = allCompensatoryHistory.Count(r => r.Status == "Pendiente"),
                AcceptedRequests = allCompensatoryHistory.Count(r => r.Status == "Aceptada"),
                RejectedRequests = allCompensatoryHistory.Count(r => r.Status == "Rechazada"),
                ActiveRequests = allCompensatoryHistory.Count(r => r.DynamicStatus == "En curso"),
                FinishedRequests = allCompensatoryHistory.Count(r => r.DynamicStatus == "Finalizado"),
                TotalHoursRequested = allCompensatoryHistory.Sum(r => r.HoursRequested),
                TotalActiveHours = allCompensatoryHistory
                    .Where(r => r.DynamicStatus == "En curso")
                    .Sum(r => r.HoursRequested)
            };

            return Ok(new
            {
                Message = "Historial completo de compensatorios cargado exitosamente.",
                Statistics = statistics,
                Data = allCompensatoryHistory
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Error al cargar el historial de compensatorios.",
                error = ex.Message
            });
        }
    }

    // ==================== ACEPTAR SOLICITUD (ADMIN) ====================
    [HttpPatch("accept/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AcceptRequest(int id)
    {
        var request = await _context.Compensatories
            .Include(request => request.User)
            .FirstOrDefaultAsync(request => request.Id == id);

        if (request == null) return NotFound();

        request.Status = "Aceptada";
        await _context.SaveChangesAsync();

        // Descontar horas del usuario
        var duration = request.To - request.From;
        var hoursRequested = Math.Round(duration.TotalHours, 2);

        var hoursEntry = new HoursUser
        {
            UserId = request.UserId,
            Hours = (int)-hoursRequested,
            Status = "Aceptada",
            CurrentHour = DateTime.Now,
        };

        _context.HoursUsers.Add(hoursEntry);
        await _context.SaveChangesAsync();

        // Enviar notificación
        var userGroup = request.UserId.ToString();
        await _hubContext.Clients.Group(userGroup)
            .SendAsync("ReceiveNotification", new
            {
                id = request.Id,
                firstName = request.User?.FirstName,
                lastName = request.User?.LastName,
                to = request.To,
                from = request.From,
                reason = request.Reason,
                type = "compAccepted"
            });

        return Ok(new { message = "Compensatorio aceptado y horas descontadas correctamente." });
    }

    // ==================== RECHAZAR SOLICITUD (ADMIN) ====================
    [HttpPatch("reject/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectRequest(int id)
    {
        var request = await _context.Compensatories
            .Include(request => request.User)
            .FirstOrDefaultAsync(request => request.Id == id);

        if (request == null) return NotFound();

        request.Status = "Rechazada";
        await _context.SaveChangesAsync();

        // Enviar notificación
        var userGroup = request.UserId.ToString();
        await _hubContext.Clients.Group(userGroup)
            .SendAsync("ReceiveNotification", new
            {
                id = request.Id,
                firstName = request.User?.FirstName,
                lastName = request.User?.LastName,
                to = request.To,
                from = request.From,
                reason = request.Reason,
                type = "compRejected"
            });

        return Ok(new { message = "Compensatorio Rechazado" });
    }

    // ==================== ESTADÍSTICAS GLOBALES (ADMIN) ====================
    [HttpGet("global-statistics")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetGlobalStatistics()
    {
        try
        {
            // Estadísticas de usuarios
            var totalUsers = _context.Users.Count();
            var adminUsers = _context.Users.Count(u => u.Role == "Admin");
            var regularUsers = totalUsers - adminUsers;

            // Estadísticas de horas
            var totalHoursRegistered = _context.HoursUsers
                .Where(h => h.Status == "Aceptada")
                .Sum(h => h.Hours);

            var totalHoursRequested = _context.HoursUsers.Count();
            var acceptedHoursRequests = _context.HoursUsers.Count(h => h.Status == "Aceptada");
            var pendingHoursRequests = _context.HoursUsers.Count(h => h.Status == "Pendiente");
            var rejectedHoursRequests = _context.HoursUsers.Count(h => h.Status == "Rechazada");

            // Estadísticas de compensatorios
            var now = DateTime.UtcNow;
            var allCompensatories = _context.Compensatories.ToList();

            var totalCompensatoryRequests = allCompensatories.Count;
            var acceptedCompensatories = allCompensatories.Count(c => c.Status == "Aceptada");
            var pendingCompensatories = allCompensatories.Count(c => c.Status == "Pendiente");
            var rejectedCompensatories = allCompensatories.Count(c => c.Status == "Rechazada");

            var activeCompensatories = allCompensatories.Count(c =>
                c.Status == "Aceptada" && now >= c.From && now < c.To);

            var finishedCompensatories = allCompensatories.Count(c =>
                c.Status == "Aceptada" && now >= c.To);

            var totalHoursInCompensatories = allCompensatories
                .Where(c => c.Status == "Aceptada")
                .Sum(c => Math.Round((c.To - c.From).TotalHours, 2));

            var activeHours = allCompensatories
                .Where(c => c.Status == "Aceptada" && now >= c.From && now < c.To)
                .Sum(c => Math.Round((c.To - c.From).TotalHours, 2));

            return Ok(new
            {
                Message = "Estadísticas globales obtenidas exitosamente.",
                UserStatistics = new
                {
                    TotalUsers = totalUsers,
                    AdminUsers = adminUsers,
                    RegularUsers = regularUsers
                },
                HourStatistics = new
                {
                    TotalHoursAvailable = totalHoursRegistered,
                    TotalHourRequests = totalHoursRequested,
                    AcceptedHourRequests = acceptedHoursRequests,
                    PendingHourRequests = pendingHoursRequests,
                    RejectedHourRequests = rejectedHoursRequests
                },
                CompensatoryStatistics = new
                {
                    TotalCompensatoryRequests = totalCompensatoryRequests,
                    AcceptedCompensatories = acceptedCompensatories,
                    PendingCompensatories = pendingCompensatories,
                    RejectedCompensatories = rejectedCompensatories,
                    ActiveCompensatories = activeCompensatories,
                    FinishedCompensatories = finishedCompensatories,
                    TotalHoursInCompensatories = totalHoursInCompensatories,
                    ActiveHours = activeHours
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Error al obtener las estadísticas globales.",
                error = ex.Message
            });
        }
    }
}