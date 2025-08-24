using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;
using HardWorker.Server.Controller;
using Microsoft.AspNetCore.SignalR;
using Hardworker.Hubs;
using Microsoft.EntityFrameworkCore;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class UserController : BaseController
{
    public UserController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext)
        : base(context, hubContext)
    {
    }

    // ==================== OBTENER DATOS DEL USUARIO AUTENTICADO ====================
    [HttpGet("getdata")]
    public async Task<IActionResult> GetUser()
    {
        return await ExecuteWithUserValidationAsync(async (user) =>
        {
            return Ok(new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Profileimage,
                Role = user.Role ?? "User"
            });
        });
    }

    // ==================== ACTUALIZAR IMAGEN DE PERFIL ====================
    [HttpPost("update-img-profile")]
    public async Task<IActionResult> UpdateProfileImage([FromForm] IFormFile file)
    {
        return await TryExecuteAsync(async () =>
        {
            return await ExecuteWithUserValidationAsync(async (user) =>
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { message = "Archivo no válido." });
                }

                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var fileName = $"{Guid.NewGuid()}_{file.FileName}";
                var filePath = Path.Combine(uploadsFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var baseUrl = $"{this.Request.Scheme}://{this.Request.Host.Value}";
                user.Profileimage = $"{baseUrl}/uploads/{fileName}";

                var saveResult = await SaveChangesAsync("Imagen de perfil actualizada con éxito.");
                if (saveResult is not OkObjectResult) return saveResult;

                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var imageUrlWithCacheBuster = $"{user.Profileimage}?v={timestamp}";

                return Ok(new
                {
                    message = "Imagen de perfil actualizada con éxito.",
                    profileimage = imageUrlWithCacheBuster 
                });
            });
        }, "actualizar imagen de perfil");
    }

    // ==================== OBTENER TODOS LOS USUARIOS (ADMIN) ====================
    [HttpGet("all-users")]
    [Authorize(Roles = "Admin,Super")]
    public async Task<IActionResult> GetAllUsers()
    {
        return await TryExecuteAsync(async () =>
        {
            var users = await _context.Users
                .Select(u => new
                {
                    Id = u.Id,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Username = u.Username,
                    ProfileImage = u.Profileimage,
                    Role = u.Role ?? "User",
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
                .ToListAsync();

            return Ok(new
            {
                Message = "Lista de usuarios obtenida exitosamente.",
                TotalUsers = users.Count,
                Data = users
            });
        }, "obtener lista de usuarios");
    }

    // ==================== OBTENER DASHBOARD DETALLADO DE UN USUARIO (ADMIN) ====================
    [HttpGet("user-dashboard/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUserDashboard(int userId)
    {
        return await TryExecuteAsync(async () =>
        {
            if (!await UserExistsAsync(userId))
            {
                return NotFound(new { message = "Usuario no encontrado." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            var hourHistory = await _context.HoursUsers
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
                .ToListAsync();

            var now = DateTime.UtcNow;
            var compensatoryData = await _context.Compensatories
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.CurrentHour)
                .ToListAsync();

            var compensatoryHistory = compensatoryData
                .Select(c =>
                {
                    string dynamicStatus = CalculateDynamicStatus(c.Status ?? string.Empty, c.From.DateTime, c.To.DateTime);
                    var hoursRequested = CalculateHours(c.From.DateTime, c.To.DateTime);

                    return new
                    {
                        Id = c.Id,
                        Reason = c.Reason,
                        From = FormatDateTime(c.From.DateTime),
                        To = FormatDateTime(c.To.DateTime),
                        Status = c.Status,
                        DynamicStatus = dynamicStatus,
                        CurrentHour = FormatDateTime(c.CurrentHour),
                        HoursRequested = hoursRequested,
                        DaysFromRequest = Math.Round((now - c.CurrentHour).TotalDays, 1)
                    };
                })
                .ToList();

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
                    Id = user!.Id,
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
        }, "obtener dashboard del usuario");
    }
}