using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using HardWorker.Data;

namespace HardWorker.Controller
{
    // ==================== SERVICIO DE GENERACIÓN DE TOKENS JWT ====================
    public class ValidateJwtToken
    {
        private readonly IConfiguration _configuration;
        private readonly ApplicationDbContext _context;

        public ValidateJwtToken(IConfiguration configuration, ApplicationDbContext context)
        {
            _configuration = configuration;
            _context = context;
        }

        // ==================== GENERAR TOKEN JWT ====================
        public string GenerateJwtToken(string username)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var keyString = jwtSettings["Key"];
            var issuer = jwtSettings["Issuer"];
            var audience = jwtSettings["Audience"];

            Console.WriteLine($"Issuer: {issuer}, Audience: {audience}");

            if (string.IsNullOrEmpty(keyString))
                throw new ArgumentNullException(nameof(keyString), "JWT key is not configured.");
            if (string.IsNullOrEmpty(issuer))
                throw new ArgumentNullException(nameof(issuer), "JWT issuer is not configured.");
            if (string.IsNullOrEmpty(audience))
                throw new ArgumentNullException(nameof(audience), "JWT audience is not configured.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var user = _context.Users.FirstOrDefault(u => u.Username == username);
            if (user is null)
                throw new Exception("User not found.");

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), 
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),   
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, (user.Role ?? "User").ToString()),
                            };

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.Now.AddMinutes(60),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}