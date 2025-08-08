// BaseController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using HardWorker.Data;
using HardWorker.Model;
using Hardworker.Hubs;


/// Controlador base que centraliza funcionalidades comunes para evitar redundancia de código.

public abstract class BaseController : ControllerBase
{
    protected readonly ApplicationDbContext _context;
    
    protected readonly IHubContext<NotificationHub> _hubContext;
    protected BaseController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext = null)
    {
        _context = context;
        _hubContext = hubContext;
    }

    // ==================== AUTENTICACIÓN Y VALIDACIÓN ====================

    protected (bool isValid, int userId, IActionResult error) GetAuthenticatedUser()
    {
        // Extrae el ID del usuario desde los claims del token JWT
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        // Verifica que exista el token en las cookies
        var token = Request.Cookies["token"];
        
        if (string.IsNullOrEmpty(token))
            return (false, 0, Unauthorized(new { message = "Usuario no autenticado." }));

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            return (false, 0, Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." }));

        return (true, userId, null);
    }

    
    protected async Task<(User user, IActionResult error)> ValidateUserAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return (null, NotFound(new { message = "Usuario no encontrado." }));
        
        return (user, null);
    }

    // ==================== NOTIFICACIONES SIGNALR ====================

    protected async Task SendUserNotificationAsync(int userId, string eventType, object data)
    {
        if (_hubContext != null)
        {
            // Convertir el ID del usuario a string para usarlo como nombre del grupo
            var userGroup = userId.ToString();
            await _hubContext.Clients.Group(userGroup).SendAsync("ReceiveNotification", data);
        }
    }


    protected async Task SendAdminNotificationAsync(object data)
    {
        if (_hubContext != null)
        {
            await _hubContext.Clients.Group("Admin").SendAsync("ReceiveNotification", data);
        }
    }

    // ==================== CÁLCULOS Y FORMATEO ====================

    protected string CalculateDynamicStatus(string status, DateTime from, DateTime to)
    {
        var now = DateTime.UtcNow;
        
        // Solo calcular estado dinámico para compensatorios aceptados
        if (status == "Aceptada")
        {
            if (now >= from && now < to)
                return "En curso";
            else if (now >= to)
                return "Finalizado";
            else if (now < from)
                return "Programado";
        }
            
        return status ?? string.Empty;
    }

    protected string FormatDateTime(DateTime dateTime)
    {
        return dateTime.ToString("yyyy-MM-ddTHH:mm:ss");
    }

    // ==================== RESPUESTAS ESTÁNDAR ====================

    protected IActionResult SuccessResponse(string message, object data = null)
    {
        var response = new { success = true, message };
        return data != null ? Ok(new { success = true, message, data }) : Ok(response);
    }
    protected IActionResult ErrorResponse(string message, int statusCode = 500)
    {
        return StatusCode(statusCode, new { success = false, message });
    }

    // ==================== MANEJO DE EXCEPCIONES ====================

    protected IActionResult HandleException(Exception ex, string context)
    {
        // Registra el error en la consola para debugging
        Console.WriteLine($"[ERROR] {context}: {ex.Message}");
        
        return StatusCode(500, new { 
            message = $"Ocurrió un error interno en el servidor en {context}.", 
            error = ex.Message 
        });
    }
}