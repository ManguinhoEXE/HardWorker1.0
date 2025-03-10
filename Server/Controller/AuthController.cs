
using Microsoft.AspNetCore.Mvc;
using HardWorker.Model;

[ApiController]
[Route("[controller]")]

public class AuthController : ControllerBase {
    [HttpPost("register")]
    public IActionResult Register([FromBody] RegisterModel model) {

        return Ok( new { message = "User registered successfully" });
    }
}