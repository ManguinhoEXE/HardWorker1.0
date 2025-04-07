
using HardWorker.Model;
using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;



[Route("api/[Controller]")]
[ApiController]

public class CompensatoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CompensatoryController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("getrequests")]
    public IActionResult getCompensatories()
    {


        // Obtener el userId desde el token
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" && int.TryParse(c.Value, out _))?.Value;


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

        // Obtener las solicitudes de compensatorio del usuario
        var compensatoryRequests = _context.Compensatories
        .Where(c => c.UserId == userId)
            .Select(c => new
            {
                c.Id,
                 From = c.From.ToString("yyyy-MM-ddTHH:mm:ss"), // Enviar la fecha en el formato deseado
                To = c.To.ToString("yyyy-MM-ddTHH:mm:ss"),
                c.Reason,
                c.Status,
                CurrentHour = c.CurrentHour.ToString("yyyy-MM-ddTHH:mm:ss")
            })
            .ToList();

        if (!compensatoryRequests.Any())
        {
            return NotFound(new { message = "No se encontraron solicitudes de compensatorio." });
        }

        return Ok(compensatoryRequests);
    }


    [HttpPost("addrequest")]
    public async Task<IActionResult> requestCompensatory([FromBody] Compensatory compensatory)
    {
        try
        {
            // Obtener el userId desde el token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" && int.TryParse(c.Value, out _))?.Value;


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

            // Validar los datos recibidos
            if (compensatory.From >= compensatory.To)
            {
                return BadRequest(new { message = "La fecha de inicio debe ser menor a la fecha de fin." });
            }

            if (string.IsNullOrWhiteSpace(compensatory.Reason))
            {
                return BadRequest(new { message = "La razón es requerida." });
            }

            // Asignar valores predeterminados
            compensatory.UserId = userId; // Asignar el userId desde el token
            compensatory.CurrentHour = DateTime.Now;
            compensatory.Status = "Pendiente";

            // Guardar en la base de datos
            _context.Compensatories.Add(compensatory);
            await _context.SaveChangesAsync();

            // Devolver una respuesta con los datos creados
            return Ok(new
            {
                message = "Solicitud de compensatorio creada exitosamente.",
                compensatory = compensatory
            });
        }
        catch (Exception ex)
        {
            // Manejar cualquier excepción inesperada
            return StatusCode(500, new { message = "Ocurrió un error interno en el servidor.", error = ex.Message });
        }
    }
}