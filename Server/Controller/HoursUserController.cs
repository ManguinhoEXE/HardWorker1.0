using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Hardworker.Hubs;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Server.Migrations;


[Route("api/[controller]")]
[ApiController]
[Authorize]
public class HoursUserController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<NotificationHub> _hubContext;



    // Constructor que recibe el contexto de base de datos
    public HoursUserController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext)
    // Inicializa el contexto de base de datos
    {
        _context = context;
        _hubContext = hubContext;
    }

    // Endpoint para registrar nuevas horas trabajadas por el usuario autenticado
    [HttpPost("addhour")]
    public async Task<IActionResult> AddHours([FromBody] HoursUser hoursUser)
    {


        // Validación de datos nulos
        if (hoursUser == null)
        {
            return BadRequest(new { message = "Datos de entrada inválidos." });
        }

        // Verifica si el token JWT está presente en las cookies
        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

        // Extraer el ID del usuario desde los claims del token
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        // Validación del ID del usuario
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "No se pudo obtener el ID del usuario desde el token." });
        }

        // Buscar el usuario en la base de datos
        var user = _context.Users.Find(userId);
        if (user == null)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }

        // Validar que se haya ingresado una cantidad de horas mayor a 0
        if (hoursUser.Hours <= 0)
        {
            return BadRequest(new { message = "El número de horas debe ser mayor a 0." });
        }

        if (hoursUser.Hours > 8)
        {
            return BadRequest(new { message = "No se pueden registrar más de 8 horas en una sola solicitud." });
        }

        if (hoursUser.Description == "")
        {
            return BadRequest(new { message = "La descripción no puede estar vacía." });
        }


        // Asignar valores automáticos
            hoursUser.CurrentHour = DateTime.Now;
        hoursUser.UserId = user.Id;
        hoursUser.User = user;
        hoursUser.Status = "Pendiente";


        // Guardar en base de datos
        _context.HoursUsers.Add(hoursUser);
        _context.SaveChanges();

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
                CurrentHour = h.CurrentHour.ToString("MMMM dd, yyyy"), // Formato amigable de fecha
                h.Status
            })
            .ToList();

        // Validación si no hay registros
        if (!hours.Any())
        {
            return NotFound(new { message = "No se encontraron horas registradas." });
        }

        // Retorna la lista de horas encontradas
        return Ok(hours);
    }

    // filepath: Server/Controller/HoursUserController.cs
    [HttpPatch("accept/{id}")]
    public async Task<IActionResult> AcceptRequest(int id)
    {
        Console.WriteLine($"[Ctrl] Llega PATCH accept/{id}");
        var hr = await _context.HoursUsers
                    .Include(h => h.User)
                    .FirstOrDefaultAsync(h => h.Id == id);
        if (hr == null) { Console.WriteLine("[Ctrl] hr es null"); return NotFound(); }

        hr.Status = "Aceptada";
        await _context.SaveChangesAsync();
        Console.WriteLine($"[Ctrl] Guardado estado Aceptada para hr.Id={hr.Id}");

        var userGroup = hr.UserId.ToString();
        Console.WriteLine($"[Ctrl] Enviando ReceiveNotification a grupo {userGroup}");
        await _hubContext.Clients.Group(userGroup)
            .SendAsync("ReceiveNotification", new
            {
                id = hr.Id,
                firstName = hr.User?.FirstName,
                lastName = hr.User?.LastName,
                hours = hr.Hours,
                description = hr.Description,
                type = "hoursAccepted"
            });

        Console.WriteLine($"[Ctrl] SendAsync completado");

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

        hr.Status = "Rechazada";
        await _context.SaveChangesAsync();
        Console.WriteLine($"[Ctrl] Guardado estado Rechazada para hr.Id={hr.Id}");

        var userGroup = hr.UserId.ToString();
        Console.WriteLine($"[Ctrl] Enviando ReceiveNotification a grupo {userGroup}");
        await _hubContext.Clients.Group(userGroup)
            .SendAsync("ReceiveNotification", new
            {
                id = hr.Id,
                firstName = hr.User?.FirstName,
                lastName = hr.User?.LastName,
                hours = hr.Hours,
                description = hr.Description,
                type = "hoursRejected"
            });
        Console.WriteLine($"[Ctrl] SendAsync completado");

        return Ok(new { message = "Horas Rechazadas." });
    }

    [HttpGet("acceptedhours")]
    [Authorize]
    public async Task<IActionResult> GetAcceptedHours()
    {
        // Extraer el ID del usuario desde los claims del token
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
