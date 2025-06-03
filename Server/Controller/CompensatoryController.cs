using HardWorker.Model;
using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

using Hardworker.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;


[Route("api/[Controller]")]
[ApiController]

public class CompensatoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<NotificationHub> _hubContext;

    // Inyección del contexto de base de datos
    public CompensatoryController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext)

    {
        _context = context;
        _hubContext = hubContext;
    }

    // Retorna todas las solicitudes de compensatorio del usuario autenticado.
    [HttpGet("getrequests")]
    public IActionResult getCompensatories()
    {
        // Extraer el ID de usuario desde el JWT
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        // Validar presencia del token
        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
            return Unauthorized(new { message = "Usuario no autenticado." });

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });

        // Consultar solicitudes de compensatorio asociadas al usuario
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

    // Crea una nueva solicitud de compensatorio para el usuario autenticado.

    [HttpPost("addrequest")]
    public async Task<IActionResult> requestCompensatory([FromBody] Compensatory compensatory)
    {
        try
        {
            // Obtener el ID del usuario autenticado
            var userIdClaim = User.Claims.FirstOrDefault(c =>
                c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
                && int.TryParse(c.Value, out _))?.Value;

            // Validar token
            var token = Request.Cookies["token"];
            if (string.IsNullOrEmpty(token))
                return Unauthorized(new { message = "Usuario no autenticado." });

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });

            // Validaciones de datos
            if (compensatory.From >= compensatory.To)
                return BadRequest(new { message = "La fecha de inicio debe ser menor a la fecha de fin." });

            if (string.IsNullOrWhiteSpace(compensatory.Reason))
                return BadRequest(new { message = "La razón es requerida." });

            // Buscar el usuario en la base de datos
            var user = _context.Users.Find(userId);
            if (user == null)
            {
                return NotFound(new { message = "Usuario no encontrado." });
            }

            if (compensatory.From.Minute != compensatory.To.Minute)
            {
                return BadRequest(new { message = "La solicitud de compensatorio debe ser en horas completas. Los minutos de la hora de inicio y fin deben coincidir (ej. de 09:15 a 11:15)." });
            }

            var duration = compensatory.To - compensatory.From;
            var hoursRequested = Math.Round(duration.TotalHours, 2);

            var totalAccepted = await _context.HoursUsers
        .Where(h => h.UserId == userId && h.Status == "Aceptada")
        .SumAsync(h => h.Hours);

            if (hoursRequested > totalAccepted)
            {
                return BadRequest(new
                {
                    message = $"No tienes suficientes horas disponibles. " +
                                $"Disponibles: {totalAccepted}, solicitadas: {hoursRequested}"
                });
            }

            // Asignar valores predeterminados y asociar al usuario autenticado
            compensatory.UserId = userId;
            compensatory.CurrentHour = DateTime.Now;
            compensatory.Status = "Pendiente";

            // Guardar en base de datos|
            _context.Compensatories.Add(compensatory);
            await _context.SaveChangesAsync();


            await _hubContext.Clients.Group("Admin").SendAsync(
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

            return Ok(new
            {
                message = "Solicitud de compensatorio creada exitosamente.",
                compensatory = compensatory,
                hoursRequested
            });
        }
        catch (Exception ex)
        {
            // Manejo de error inesperado
            return StatusCode(500, new { message = "Ocurrió un error interno en el servidor.", error = ex.Message });
        }
    }

    // Obtiene todas las solicitudes de compensatorio de todos los usuarios, con nombre completo.
    [HttpGet("getallrequests")]
    public IActionResult GetCompensatoryRequests()
    {
        var now = DateTime.UtcNow;

        var compensatoryRequests = _context.Compensatories
            .Include(c => c.User) // Incluir datos del usuario
            .ToList() // Traer a memoria para calcular estado dinámico
            .Select(c =>
            {
                string dynamicStatus = c.Status;
                if (c.Status == "Aceptada")
                {
                    if (now >= c.From && now < c.To)
                    {
                        dynamicStatus = "En curso";
                    }
                    else if (now >= c.To)
                    {
                        dynamicStatus = "Finalizado";
                    }
                }
                return new
                {
                    c.Id,
                    FirstName = c.User?.FirstName, // Acceso seguro por si User es null
                    LastName = c.User?.LastName,
                    c.Reason,
                    From = c.From, // Enviar como DateTime
                    To = c.To,     // Enviar como DateTime
                    Status = dynamicStatus,
                    c.UserId
                };
            })
            .Where(c => c.Status != "Finalizado") // No mostrar los finalizados
            .OrderByDescending(c => c.From) // Opcional: ordenar
            .ToList();

        return Ok(compensatoryRequests);
    }

    [HttpPatch("accept/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AcceptRequest(int id)
    {
        var request = await _context.Compensatories
                    .Include(request => request.User)
                    .FirstOrDefaultAsync(request => request.Id == id);
        if (request == null) { Console.WriteLine("[Ctrl] hr es null"); return NotFound(); }

        request.Status = "Aceptada";
        await _context.SaveChangesAsync();

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

        var totalAccepted = await _context.HoursUsers
        .Where(h => h.UserId == request.UserId && h.Status == "Aceptada")
        .SumAsync(h => h.Hours);



        Console.WriteLine($"[Ctrl] Guardado estado Aceptada para request.Id{request.Id}");

        var userGroup = request.UserId.ToString();
        Console.WriteLine($"[Ctrl] Enviando ReceiveNotification a grupo {userGroup}");
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
        Console.WriteLine($"[Ctrl] SendAsync completado");

        return Ok(new { message = "Compensatorio aceptado y horas descontadas correctamente." });
    }

    [HttpPatch("reject/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectRequest(int id)
    {
        var request = await _context.Compensatories
                .Include(request => request.User)
                .FirstOrDefaultAsync(request => request.Id == id);
        if (request == null) { Console.WriteLine("[Ctrl] hr es null"); return NotFound(); }

        request.Status = "Rechazada";
        await _context.SaveChangesAsync();

        Console.WriteLine($"[Ctrl] Guardado estado Rechazada para request.Id{request.Id}");

        var userGroup = request.UserId.ToString();
        Console.WriteLine($"[Ctrl] Enviando ReceiveNotification a grupo {userGroup}");
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
        Console.WriteLine($"[Ctrl] SendAsync completado");

        return Ok(new { message = "Compensatorio Rechazado" });
    }
}
