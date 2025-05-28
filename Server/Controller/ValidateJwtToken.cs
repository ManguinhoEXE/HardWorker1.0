using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using HardWorker.Data;

namespace HardWorker.Controller
{
    // Servicio encargado de generar tokens JWT para usuarios autenticados.
    public class ValidateJwtToken
    {
        private readonly IConfiguration _configuration;
        private readonly ApplicationDbContext _context;

        // Constructor que recibe las configuraciones del sistema y el contexto de base de datos.
        public ValidateJwtToken(IConfiguration configuration, ApplicationDbContext context)
        {
            _configuration = configuration;
            _context = context;
        }

        // Genera un token JWT válido para el usuario especificado.
        public string GenerateJwtToken(string username)
        {
            // Obtener configuración JWT desde appsettings.json
            var jwtSettings = _configuration.GetSection("Jwt");
            var keyString = jwtSettings["Key"];
            var issuer = jwtSettings["Issuer"];
            var audience = jwtSettings["Audience"];

            Console.WriteLine($"Issuer: {issuer}, Audience: {audience}");

            // Validar configuración obligatoria
            if (string.IsNullOrEmpty(keyString))
                throw new ArgumentNullException(nameof(keyString), "JWT key is not configured.");
            if (string.IsNullOrEmpty(issuer))
                throw new ArgumentNullException(nameof(issuer), "JWT issuer is not configured.");
            if (string.IsNullOrEmpty(audience))
                throw new ArgumentNullException(nameof(audience), "JWT audience is not configured.");

            // Crear clave simétrica y credenciales de firma
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // Obtener el usuario de la base de datos
            var user = _context.Users.FirstOrDefault(u => u.Username == username);
            if (user is null)
                throw new Exception("User not found.");

            // Crear claims (información codificada en el token)
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, username),                 // Sujeto del token
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), // ID único del token
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),        // ID del usuario                     //guardar el rol del usuario
                new Claim(ClaimTypes.Role, (user.Role ?? "User").ToString()),
                            };

            // Crear el token con todos los parámetros requeridos
            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.Now.AddMinutes(60), // Tiempo de expiración del token
                signingCredentials: creds
            );

            // Serializar y devolver el token como string
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
