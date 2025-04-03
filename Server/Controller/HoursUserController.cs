using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Model;
using Microsoft.AspNetCore.Authorization;
using HardWorker.Controller;
using System.Security.Claims;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class HoursUserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ValidateJwtToken _validateJwtToken;

    public HoursUserController(ApplicationDbContext context, ValidateJwtToken validateJwtToken)
    {
        _context = context;
        _validateJwtToken = validateJwtToken;
    }

    [HttpPost("addhour")]
    public IActionResult AddHours([FromBody] HoursUser hoursUser)
    {
        if (hoursUser == null)
        {
            return BadRequest(new { message = "Datos de entrada inválidos." });
        }

        // Obtener el token desde la cookie
        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

    
        // Extraer UserId desde el token
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" && int.TryParse(c.Value, out _))?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });
        }

        // Buscar usuario en la base de datos
        var user = _context.Users.Find(userId);
        if (user == null)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }

        // Validar entrada
        if (hoursUser.Hours <= 0)
        {
            return BadRequest(new { message = "El número de horas debe ser mayor a 0." });
        }

        // Asignar valores y guardar en la BD
        hoursUser.CurrentHour = DateTime.Now;
        hoursUser.UserId = user.Id;
        hoursUser.User = user;

        _context.HoursUsers.Add(hoursUser);
        _context.SaveChanges();

        return Ok(new { message = "Horas añadidas correctamente." });
    }

    [HttpGet("gethours")]
    public IActionResult GetHours()
    {
        // Obetenr UserID desde el token
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type ==
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" && int.TryParse(c.Value, out _))?.Value;

        // Obtener el token desde la cookie
        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });
        }

        // Buscar las horas registradas para el usario
        var hours = _context.HoursUsers.Where(h => h.UserId == userId)
        .Select(h => new
        {
            h.Id,
            h.Hours,
            CurrentHour = h.CurrentHour.ToString("MMMM dd, yyyy")
        })
        .ToList();

        if (!hours.Any())
        {
            return NotFound(new { message = "No se encontraron horas registradas." });
        }

        return Ok(hours);
    }
}