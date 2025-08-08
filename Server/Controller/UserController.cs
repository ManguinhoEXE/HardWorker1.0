using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class UserController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UserController(ApplicationDbContext context)
    {
        _context = context;
    }

    // ==================== OBTENER DATOS DEL USUARIO AUTENTICADO ====================
    [HttpGet("getdata")]
    public IActionResult GetUser()
    {
        // Extraer ID del usuario desde el token JWT
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        // Validar autenticación
        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });
        }

        // Buscar el usuario en base de datos
        var user = _context.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }

        // Devolver datos básicos del usuario
        return Ok(new
        {
            user.Id,
            user.FirstName,
            user.LastName,
            user.Profileimage,
            Role = user.Role ?? "User"
        });
    }

    // ==================== ACTUALIZAR IMAGEN DE PERFIL ====================
    [HttpPost("update-img-profile")]
    public async Task<IActionResult> UpdateProfileImage([FromForm] IFormFile file)
    {
        // Validar archivo recibido
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Archivo no válido." });
        }

        // Obtener ID del usuario desde el token JWT
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

        // Buscar el usuario en la base de datos
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }

        // Preparar directorio de subida
        var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads");
        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        // Generar nombre único para el archivo
        var fileName = $"{Guid.NewGuid()}_{file.FileName}";
        var filePath = Path.Combine(uploadsFolder, fileName);

        // Guardar el archivo en el servidor
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Actualizar URL de la imagen en la base de datos
        var baseUrl = $"{this.Request.Scheme}://{this.Request.Host.Value}";
        user.Profileimage = $"{baseUrl}/uploads/{fileName}";

        await _context.SaveChangesAsync();

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var imageUrlWithCacheBuster = $"{user.Profileimage}?v={timestamp}";

        return Ok(new
        {
            message = "Imagen de perfil actualizada con éxito.",
            profileimage = imageUrlWithCacheBuster 
        });
    }

    // ==================== OBTENER TODOS LOS USUARIOS (ADMIN) ====================
    [HttpGet("all-users")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetAllUsers()
    {
        try
        {
            var users = _context.Users
                .Select(u => new
                {
                    Id = u.Id,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Username = u.Username,
                    ProfileImage = u.Profileimage,
                    Role = u.Role ?? "User",
                    // Estadísticas básicas de cada usuario
                    TotalHoursRequests = _context.HoursUsers.Count(h => h.UserId == u.Id),
                    TotalCompensatoryRequests = _context.Compensatories.Count(c => c.UserId == u.Id),
                    PendingHoursRequests = _context.HoursUsers.Count(h => h.UserId == u.Id && h.Status == "Pendiente"),
                    PendingCompensatoryRequests = _context.Compensatories.Count(c => c.UserId == u.Id && c.Status == "Pendiente"),
                    AvailableHours = _context.HoursUsers
                        .Where(h => h.UserId == u.Id && h.Status == "Aceptada")
                        .Sum(h => h.Hours),
                    LastActivity = _context.HoursUsers
                        .Where(h => h.UserId == u.Id)
                        .OrderByDescending(h => h.CurrentHour)
                        .Select(h => h.CurrentHour)
                        .FirstOrDefault()
                })
                .OrderBy(u => u.FirstName)
                .ToList();

            return Ok(new
            {
                Message = "Lista de usuarios obtenida exitosamente.",
                TotalUsers = users.Count,
                Data = users
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Error al obtener la lista de usuarios.",
                error = ex.Message
            });
        }
    }

    // ==================== OBTENER DASHBOARD DETALLADO DE UN USUARIO (ADMIN) ====================
    [HttpGet("user-dashboard/{userId}")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetUserDashboard(int userId)
    {
        try
        {
            // Obtener información del usuario
            var user = _context.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
            {
                return NotFound(new { message = "Usuario no encontrado." });
            }

            // Obtener historial de horas del usuario
            var hourHistory = _context.HoursUsers
                .Where(h => h.UserId == userId)
                .OrderByDescending(h => h.CurrentHour)
                .Select(h => new
                {
                    Id = h.Id,
                    Hours = h.Hours,
                    Description = h.Description,
                    Status = h.Status,
                    CurrentHour = h.CurrentHour.ToString("yyyy-MM-ddTHH:mm:ss"),
                    FormattedDate = h.CurrentHour.ToString("MMMM dd, yyyy")
                })
                .ToList();

            // Obtener historial de compensatorios del usuario
            var now = DateTime.UtcNow;
            var compensatoryHistory = _context.Compensatories
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.CurrentHour)
                .ToList()
                .Select(c =>
                {
                    // Calcular estado dinámico del compensatorio
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
                        Reason = c.Reason,
                        From = c.From.ToString("yyyy-MM-ddTHH:mm:ss"),
                        To = c.To.ToString("yyyy-MM-ddTHH:mm:ss"),
                        Status = c.Status,
                        DynamicStatus = dynamicStatus,
                        CurrentHour = c.CurrentHour.ToString("yyyy-MM-ddTHH:mm:ss"),
                        HoursRequested = hoursRequested,
                        DaysFromRequest = Math.Round((now - c.CurrentHour).TotalDays, 1)
                    };
                })
                .ToList();

            // Calcular estadísticas consolidadas del usuario
            var totalHoursRegistered = hourHistory.Where(h => h.Status == "Aceptada").Sum(h => h.Hours);
            var totalHoursUsed = compensatoryHistory.Where(c => c.Status == "Aceptada").Sum(c => c.HoursRequested);
            var availableHours = totalHoursRegistered - totalHoursUsed;

            var userStatistics = new
            {
                TotalHoursRegistered = totalHoursRegistered,
                TotalHoursUsed = totalHoursUsed,
                AvailableHours = availableHours,
                TotalHourRequests = hourHistory.Count,
                AcceptedHourRequests = hourHistory.Count(h => h.Status == "Aceptada"),
                PendingHourRequests = hourHistory.Count(h => h.Status == "Pendiente"),
                RejectedHourRequests = hourHistory.Count(h => h.Status == "Rechazada"),
                TotalCompensatoryRequests = compensatoryHistory.Count,
                AcceptedCompensatoryRequests = compensatoryHistory.Count(c => c.Status == "Aceptada"),
                PendingCompensatoryRequests = compensatoryHistory.Count(c => c.Status == "Pendiente"),
                RejectedCompensatoryRequests = compensatoryHistory.Count(c => c.Status == "Rechazada"),
                ActiveCompensatories = compensatoryHistory.Count(c => c.DynamicStatus == "En curso"),
                FinishedCompensatories = compensatoryHistory.Count(c => c.DynamicStatus == "Finalizado")
            };

            return Ok(new
            {
                Message = "Dashboard del usuario obtenido exitosamente.",
                User = new
                {
                    Id = user.Id,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Username = user.Username,
                    ProfileImage = user.Profileimage,
                    Role = user.Role ?? "User"
                },
                Statistics = userStatistics,
                HourHistory = hourHistory,
                CompensatoryHistory = compensatoryHistory
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Error al obtener el dashboard del usuario.",
                error = ex.Message
            });
        }
    }
}