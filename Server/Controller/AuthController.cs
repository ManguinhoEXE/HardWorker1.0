using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;
using HardWorker.Model;
using Microsoft.EntityFrameworkCore;
using HardWorker.Controller;

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ValidateJwtToken _validateJwtToken;

    public AuthController(ApplicationDbContext context, IConfiguration configuration, ValidateJwtToken validateJwtToken)
    {
        _configuration = configuration;
        _context = context;
        _validateJwtToken = validateJwtToken;

        // (Debug) Imprime la configuración JWT al iniciar
        var jwtSection = _configuration.GetSection("Jwt");
        Console.WriteLine($"JWT Config: {jwtSection.GetChildren().Select(c => $"{c.Key}: {c.Value}").Aggregate((a, b) => $"{a}, {b}")}");
    }

    // Registra un nuevo usuario en el sistema.
    [HttpPost("registro")]
    public async Task<IActionResult> register([FromBody] User user)
    {
        // Validación básica de entrada
        if (user == null || string.IsNullOrWhiteSpace(user.Username) || string.IsNullOrWhiteSpace(user.Password))
        {
            return BadRequest(new { message = "Datos inválidos" });
        }

        // Crear nuevo usuario con contraseña hasheada
        var newUser = new User
        {
            Username = user.Username,
            Password = BCrypt.Net.BCrypt.HashPassword(user.Password), // Hashea la contraseña
            FirstName = user.FirstName,
            LastName = user.LastName,
            Profileimage = "wwwroot/uploads/descarga.png",
            Role = "User"
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Usuario registrado con éxito" });
    }

    // Autentica al usuario, genera un JWT y lo guarda en una cookie segura.  /// </summary>
    [HttpPost("iniciarsesion")]
    public async Task<IActionResult> Login([FromBody] User user)
    {
        // Verificar existencia del usuario
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == user.Username);

        // Verificar credenciales
        if (existingUser == null || !BCrypt.Net.BCrypt.Verify(user.Password, existingUser.Password))
        {
            return Unauthorized(new { success = false, message = "Credenciales inválidas" });
        }

        // Generar token JWT
        var token = _validateJwtToken.GenerateJwtToken(existingUser.Username);

        // Configuración de cookie segura
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true, // Protege contra ataques XSS
            Secure = false,  // En producción, usar true para HTTPS
            SameSite = SameSiteMode.Strict, // Evita CSRF
            Expires = DateTime.UtcNow.AddHours(1) // Expira en 1 hora
        };

        // Guardar token en cookie
        Response.Cookies.Append("token", token, cookieOptions);

        return Ok(new { message = "Inicio de sesión exitoso" });
    }

    // Cierra la sesión del usuario eliminando la cookie del token.
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // Elimina la cookie de autenticación
        Response.Cookies.Delete("token");
        return Ok(new { message = "Sesión cerrada" });
    }
}
