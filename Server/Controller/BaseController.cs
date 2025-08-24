using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using HardWorker.Data;
using HardWorker.Model;
using Hardworker.Hubs;
using Microsoft.EntityFrameworkCore;

namespace HardWorker.Server.Controller
{
    public abstract class BaseController : ControllerBase
    {
        protected readonly ApplicationDbContext _context;
        protected readonly IHubContext<NotificationHub> _hubContext;

        protected BaseController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        // ==================== AUTENTICACIÓN Y VALIDACIÓN ====================

        protected (bool isValid, int userId, IActionResult? error) GetUserIdFromToken()
        {
            var token = Request.Cookies["token"];
            if (string.IsNullOrEmpty(token))
                return (false, 0, Unauthorized(new { message = "Usuario no autenticado." }));

            var userIdClaim = User.Claims.FirstOrDefault(c =>
                c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
                && int.TryParse(c.Value, out _))?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return (false, 0, Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." }));

            return (true, userId, null);
        }

        protected async Task<(User? user, IActionResult? error)> GetUserFromTokenAsync()
        {
            var (isValid, userId, error) = GetUserIdFromToken();
            if (!isValid) return (null, error);

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return (null, NotFound(new { message = "Usuario no encontrado." }));

            return (user, null);
        }

        protected async Task<IActionResult> ExecuteWithAuthenticationAsync<T>(Func<int, Task<T>> action)
        {
            var (isValid, userId, error) = GetUserIdFromToken();
            if (!isValid) return error!;

            return (IActionResult)await action(userId);
        }

        protected async Task<IActionResult> ExecuteWithUserValidationAsync(Func<User, Task<IActionResult>> action)
        {
            var (user, error) = await GetUserFromTokenAsync();
            if (user == null) return error!;

            return await action(user);
        }

        // ==================== MANEJO DE ERRORES ====================

        protected async Task<IActionResult> TryExecuteAsync(Func<Task<IActionResult>> action, string operationName = "operación")
        {
            try
            {
                return await action();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error en {operationName}: {ex.Message}");
                return StatusCode(500, new
                {
                    message = $"Ocurrió un error interno en el servidor durante {operationName}.",
                    error = ex.Message
                });
            }
        }

        protected IActionResult TryExecute(Func<IActionResult> action, string operationName = "operación")
        {
            try
            {
                return action();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error en {operationName}: {ex.Message}");
                return StatusCode(500, new
                {
                    message = $"Ocurrió un error interno en el servidor durante {operationName}.",
                    error = ex.Message
                });
            }
        }

        // ==================== VALIDACIONES COMUNES ====================

        protected IActionResult? ValidateModel()
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);
            return null;
        }

        protected IActionResult? ValidateDateRange(DateTime from, DateTime to, string context = "fecha")
        {
            if (from >= to)
                return BadRequest(new { message = $"La fecha de inicio debe ser menor a la fecha de fin en {context}." });
            return null;
        }

        protected IActionResult? ValidateRequired(string? value, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(value))
                return BadRequest(new { message = $"{fieldName} es requerido." });
            return null;
        }

        // ==================== GUARDADO SEGURO ====================

        protected async Task<IActionResult> SaveChangesAsync(string successMessage = "Operación completada exitosamente.")
        {
            try
            {
                await _context.SaveChangesAsync();
                return Ok(new { message = successMessage });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error guardando en base de datos: {ex.Message}");
                return StatusCode(500, new
                {
                    message = "Error al guardar en la base de datos.",
                    error = ex.Message
                });
            }
        }

        // ==================== NOTIFICACIONES SIGNALR ====================

        protected async Task SendUserNotificationAsync(int userId, string method, object data)
        {
            try
            {
                var userGroup = userId.ToString();
                await _hubContext.Clients.Group(userGroup).SendAsync(method, data);
                Console.WriteLine($"[SignalR] Notificación '{method}' enviada al usuario {userId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error enviando notificación SignalR al usuario {userId}: {ex.Message}");
            }
        }

        protected async Task SendAdminNotificationAsync(string method, object data)
        {
            try
            {
                await _hubContext.Clients.Group("Admin").SendAsync(method, data);
                Console.WriteLine($"[SignalR] Notificación '{method}' enviada a administradores");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error enviando notificación SignalR a administradores: {ex.Message}");
            }
        }

        // ==================== UTILIDADES DE CÁLCULO ====================

        protected double CalculateHours(DateTime from, DateTime to)
        {
            var duration = to - from;
            return Math.Round(duration.TotalHours, 2);
        }

        protected string CalculateDynamicStatus(string currentStatus, DateTime from, DateTime to)
        {
            if (currentStatus != "Aceptada")
                return currentStatus ?? "Pendiente";

            var now = DateTime.UtcNow;

            if (now >= from && now < to)
                return "En curso";
            else if (now >= to)
                return "Finalizado";
            else if (now < from)
                return "Programado";

            return currentStatus;
        }

        protected string FormatDateTime(DateTime dateTime)
        {
            return dateTime.ToString("yyyy-MM-ddTHH:mm:ss");
        }

        // ==================== RESPUESTAS ESTANDARIZADAS ====================

        protected IActionResult SuccessResponse(string message, object? data = null)
        {
            var response = new { message };

            if (data != null)
            {
                return Ok(new { message, data });
            }

            return Ok(response);
        }

        protected IActionResult ErrorResponse(string message, int statusCode = 400)
        {
            return StatusCode(statusCode, new { message });
        }

        // ==================== CONSULTAS COMUNES ====================

        protected async Task<double> GetUserAcceptedHoursAsync(int userId)
        {
            Console.WriteLine($"[DEBUG] Calculando horas para usuario {userId}");

            var totalEarned = await _context.HoursUsers
                .Where(h => h.UserId == userId && h.Status == "Aceptada" && h.Hours > 0) 
                .SumAsync(h => h.Hours);

            Console.WriteLine($"[DEBUG] Horas ganadas (positivas): {totalEarned}");

            var acceptedCompensatories = await _context.Compensatories
                .Where(c => c.UserId == userId && c.Status == "Aceptada")
                .Select(c => new { c.From, c.To })
                .ToListAsync();

            var totalUsedInCompensatories = acceptedCompensatories
                .Sum(c => Math.Round((c.To - c.From).TotalHours, 2));

            Console.WriteLine($"[DEBUG] Horas usadas en compensatorios: {totalUsedInCompensatories}");

            var negativeHours = await _context.HoursUsers
                .Where(h => h.UserId == userId && h.Hours < 0)
                .SumAsync(h => h.Hours);

            Console.WriteLine($"[DEBUG] Registros negativos encontrados: {negativeHours}");

            if (negativeHours < 0)
            {
                Console.WriteLine($"[WARNING] Usuario {userId} tiene registros negativos: {negativeHours}. Esto puede causar problemas.");
            }

            var availableHours = Math.Max(0, totalEarned - totalUsedInCompensatories);
            Console.WriteLine($"[DEBUG] Horas disponibles calculadas: {availableHours}");

            return availableHours;
        }
        protected async Task<bool> UserExistsAsync(int userId)
        {
            return await _context.Users.AnyAsync(u => u.Id == userId);
        }

        protected async Task<List<int>> GetUserIdsByRoleAsync(string role)
        {
            try
            {
                return await _context.Users
                    .Where(u => u.Role == role)
                    .Select(u => u.Id)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error obteniendo usuarios con rol {role}: {ex.Message}");
                return new List<int>();
            }
        }

        protected async Task SendNotificationToAllAdminsAsync(object notificationData)
        {
            try
            {
                await _hubContext.Clients.Group("Admin").SendAsync("ReceiveNotification", notificationData);

                await _hubContext.Clients.All.SendAsync("DistributeNotification", notificationData);

                Console.WriteLine("Notificación enviada a admins conectados y distribuida globalmente");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error enviando notificación: {ex.Message}");
            }
        }
    }
}