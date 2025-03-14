
using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;
using HardWorker.Model;
using Microsoft.EntityFrameworkCore;

[Route("api/auth")]
[ApiController]

public class AuthController : ControllerBase {
    
    private readonly ApplicationDbContext _context;

    public AuthController(ApplicationDbContext context) {
        _context = context;
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

    return Ok(new { success = true, message = "Sesión iniciada con éxito" });
}
}