using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Model;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

[Route("api/[controller]")]
[ApiController]
[Authorize]

public class HoursUserController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public HoursUserController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost("addhour")]
public IActionResult AddHours([FromBody] HoursUser hoursUser)
{
    // Depuración: Imprime todos los claims disponibles
    Console.WriteLine("Claims disponibles:");
    foreach (var claim in User.Claims)
    {
        Console.WriteLine($"Tipo: {claim.Type}, Valor: {claim.Value}");
    }

    // Busca "nameid"
    var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"&& int.TryParse(c.Value, out _))?.Value;

    // validacion del claim UserId
    if (string.IsNullOrEmpty(userIdClaim))
    {
        return Unauthorized(new { message = "Usuario no autenticado." });
    }

    // convierte el claim a int
    if (!int.TryParse(userIdClaim, out var userId))
    {
        return BadRequest(new { message = "El ID de usuario en el token no es válido." });
    }

    var user = _context.Users.Find(userId);
    if (user == null)
    {
        return NotFound(new { message = "Usuario no encontrado." });
    }

    // Asigna el UserId y el User en el backend
    hoursUser.UserId = user.Id;
    hoursUser.User = user;

    if (hoursUser.Hours == null || hoursUser.Hours <= 0)
    {
        return BadRequest(new { message = "El número de horas debe ser mayor a 0." });
    }

    _context.HoursUsers.Add(hoursUser);
    _context.SaveChanges();

    return Ok(new { message = "Horas añadidas correctamente." });
}


}