using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;
using HardWorker.Model;
using Microsoft.EntityFrameworkCore;
using HardWorker.Controller;


/// ==================== 1. CONFIGURACIÓN DEL CONTROLADOR ====================

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    
    /// ==================== 2. PROPIEDADES Y DEPENDENCIAS ====================
    
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ValidateJwtToken _validateJwtToken;

    
    /// ==================== 3. CONSTRUCTOR E INICIALIZACIÓN ====================
    
    public AuthController(ApplicationDbContext context, IConfiguration configuration, ValidateJwtToken validateJwtToken)
    {
        _configuration = configuration;
        _context = context;
        _validateJwtToken = validateJwtToken;

        // Debug: Mostrar configuración JWT en consola
        var jwtSection = _configuration.GetSection("Jwt");
        Console.WriteLine($"JWT Config: {jwtSection.GetChildren().Select(c => $"{c.Key}: {c.Value}").Aggregate((a, b) => $"{a}, {b}")}");
    }


    /// ==================== 4. ENDPOINTS DE AUTENTICACIÓN ====================
    

    
    /// Registra un nuevo usuario en el sistema
    
    [HttpPost("registro")]
    public async Task<IActionResult> Register([FromBody] User user)
    {
        // Validación de entrada
        if (user == null || string.IsNullOrWhiteSpace(user.Username) || string.IsNullOrWhiteSpace(user.Password))
        {
            return BadRequest(new { message = "Datos inválidos" });
        }

        // Crear nuevo usuario con contraseña encriptada
        var newUser = new User
        {
            Username = user.Username,
            Password = BCrypt.Net.BCrypt.HashPassword(user.Password),
            FirstName = user.FirstName,
            LastName = user.LastName,
            Role = "User"
        };

        // Guardar en base de datos
        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Usuario registrado con éxito" });
    }


    /// Autentica un usuario y genera token JWT
    
    [HttpPost("iniciarsesion")]
    public async Task<IActionResult> Login([FromBody] User user)
    {
        // Buscar usuario en base de datos
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == user.Username);

        // Verificar credenciales
        if (existingUser == null || !BCrypt.Net.BCrypt.Verify(user.Password, existingUser.Password))
        {
            return Unauthorized(new { success = false, message = "Credenciales inválidas" });
        }

        // Generar token JWT
        var token = _validateJwtToken.GenerateJwtToken(existingUser.Username);

        // Configurar cookie con token
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,  // TODO: Cambiar a true en producción (HTTPS)
            SameSite = SameSiteMode.Strict, 
            Expires = DateTime.UtcNow.AddHours(1)
        };

        Response.Cookies.Append("token", token, cookieOptions);

        // Retornar respuesta exitosa con datos del usuario
        return Ok(new { 
            message = "Inicio de sesión exitoso",
            user = new {
                id = existingUser.Id,
                username = existingUser.Username,
                firstName = existingUser.FirstName,
                lastName = existingUser.LastName,
                role = existingUser.Role ?? "User"
            } 
        });
    }

    
    /// Cierra la sesión del usuario eliminando la cookie
    
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("token");
        return Ok(new { message = "Sesión cerrada" });
    }
}