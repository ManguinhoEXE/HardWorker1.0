
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

        var jwtSection = _configuration.GetSection("Jwt");
        Console.WriteLine($"JWT Config: {jwtSection.GetChildren().Select(c => $"{c.Key}: {c.Value}").Aggregate((a, b) => $"{a}, {b}")}");
    }

    [HttpPost("registro")]
    public async Task<IActionResult> register([FromBody] User user)
    {
        if (user == null || string.IsNullOrWhiteSpace(user.Username) || string.IsNullOrWhiteSpace(user.Password))
        {
            return BadRequest(new { message = "Datos inválidos" });
        }

        var newUser = new User
        {
            Username = user.Username,
            Password = BCrypt.Net.BCrypt.HashPassword(user.Password)
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Usuario registrado con éxito" });
    }

    [HttpPost("iniciarsesion")]
    public async Task<IActionResult> Login([FromBody] User user)
    {
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == user.Username);

        if (existingUser == null || !BCrypt.Net.BCrypt.Verify(user.Password, existingUser.Password))
        {
            return Unauthorized(new { success = false, message = "Credenciales inválidas" });
        }

        var token = _validateJwtToken.GenerateJwtToken(existingUser.Username);

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,  // Evita que el token sea accesible desde JavaScript
            Secure = false,     // Solo se envía en HTTPS (para producción)
            SameSite = SameSiteMode.Strict, // Evita ataques CSRF
            Expires = DateTime.UtcNow.AddHours(1) // Expira en 1 hora
        };

        Response.Cookies.Append("token", token, cookieOptions);

        return Ok(new { message = "Inicio de sesión exitoso" });
    }


}