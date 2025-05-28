using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;


[Route("api/[controller]")]
[ApiController]
[Authorize] // Requiere que el usuario esté autenticado para acceder
public class UserController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    // Constructor que inyecta el contexto de base de datos
    public UserController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("getdata")]
    public IActionResult GetUser()
    {
        // Obtener UserID desde el token JWT
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        // Validar si el token está presente
        var token = Request.Cookies["token"];
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized(new { message = "Usuario no autenticado." });
        }

        // Validar si el ID es válido
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
            user.Profileimage
        });
    }

    [HttpPost("update-img-profile")]
    public async Task<IActionResult> UpdateProfileImage([FromForm] IFormFile file)
    {
        // Validar archivo recibido
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Archivo no válido." });
        }

        // Obtener el ID de usuario desde el token JWT
        var userIdClaim = User.Claims.FirstOrDefault(c =>
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            && int.TryParse(c.Value, out _))?.Value;

        // Validar el ID
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

        // Asegurar que el directorio de subida existe
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

        // Generar URL absoluta de la imagen
        var baseUrl = $"{this.Request.Scheme}://{this.Request.Host.Value}";
        user.Profileimage = $"{baseUrl}/uploads/{fileName}";

        // Guardar cambios en la base de datos
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Imagen de perfil actualizada con éxito.",
            profileImage = user.Profileimage
        });
    }
}
