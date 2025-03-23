
using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;
using HardWorker.Model;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;


[Route("api/auth")]
[ApiController]

public class AuthController : ControllerBase {
    
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;


    public AuthController(ApplicationDbContext context, IConfiguration configuration) {
        _configuration = configuration;
        _context = context;

        var jwtSection = _configuration.GetSection("Jwt");
    Console.WriteLine($"JWT Config: {jwtSection.GetChildren().Select(c => $"{c.Key}: {c.Value}").Aggregate((a, b) => $"{a}, {b}")}");
    }

    [HttpPost("registro")]
public async Task<IActionResult> register([FromBody] User user) {
        if (user == null || string.IsNullOrWhiteSpace(user.Username) || string.IsNullOrWhiteSpace(user.Password)) {
            return BadRequest(new { message = "Datos inválidos" });
        }

        var newUser = new User {
            Username = user.Username,
            Password = BCrypt.Net.BCrypt.HashPassword(user.Password) 
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Usuario registrado con éxito" });
    }

    [HttpPost("iniciarsesion")]

    public async Task<IActionResult> Login([FromBody] User user) {
    var existingUser = await _context.Users
        .FirstOrDefaultAsync(u => u.Username == user.Username);

    if (existingUser == null || !BCrypt.Net.BCrypt.Verify(user.Password, existingUser.Password)) {
        return Unauthorized(new { success = false, message = "Credenciales inválidas" });
    }

    var token = GeneratedJwtToken(user.Username);

    //guarda el token en la abse de datos
    existingUser.Token = token;
    _context.Users.Update(existingUser);
    await _context.SaveChangesAsync();

    return Ok(new { success = true, message = "Sesión iniciada con éxito, Token = ", token = token });
}

private string GeneratedJwtToken(string username)
{
    var JwtSettings = _configuration.GetSection("Jwt");
    var keyString = JwtSettings["Key"];

    var issuer = JwtSettings["Issuer"];
    var audience = JwtSettings["Audience"];

    Console.WriteLine($"Issuer: {issuer}, Audience: {audience}"); 
    if (string.IsNullOrEmpty(keyString))
    {
        throw new ArgumentNullException("JwtSettings:Key", "JWT key is not configured.");
    }
    if (string.IsNullOrEmpty(issuer))
    {
        throw new ArgumentNullException("JwtSettings:Issuer", "JWT issuer is not configured.");
    }
    if (string.IsNullOrEmpty(audience))
    {
        throw new ArgumentNullException("JwtSettings:Audience", "JWT audience is not configured.");
    }

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    // Obtén el usuario desde la base de datos para incluir su ID en el token
    var user = _context.Users.FirstOrDefault(u => u.Username == username);
    if (user == null)
    {
        throw new Exception("Usuario no encontrado.");
    }

    var claims = new[] {
        new Claim(JwtRegisteredClaimNames.Sub, username),
        new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())
    };

    var token = new JwtSecurityToken(
        issuer: issuer,
        audience: audience,
        claims: claims,
        expires: DateTime.Now.AddMinutes(30),
        signingCredentials: creds);

    return new JwtSecurityTokenHandler().WriteToken(token);
}
}