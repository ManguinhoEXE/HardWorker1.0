using HardWorker.Server.Utils;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Model;


namespace HardWorker.Server.Controller
{
    [Route("api/[controller]")]
    [ApiController]
    public class EmailController : ControllerBase
    {
        private readonly EmailHelper _emailHelper;
        private readonly ILogger<EmailController> _logger;

        public EmailController(EmailHelper emailHelper, ILogger<EmailController> logger)
        {
            _emailHelper = emailHelper;
            _logger = logger;
        }

        // ==================== MÉTODO PRINCIPAL DE ENVÍO DE CORREOS ====================
        public async Task<(bool Success, string Message)> EnviarNotificacion(
            string email,
            string nombre,
            string asunto,
            string mensaje,
            string? plantilla = null)
        {
            try
            {
                // Validación de parámetros
                if (string.IsNullOrEmpty(email))
                    return (false, "El correo electrónico del destinatario es requerido");

                if (string.IsNullOrEmpty(nombre))
                    nombre = "Usuario";

                if (string.IsNullOrEmpty(asunto))
                    asunto = "Notificación de HardWorker";

                // Configuración del destinatario
                _emailHelper.ClearDestinatarios();
                _emailHelper.AddDestinatario(email);

                // Selección de plantilla HTML
                string htmlBody;

                switch (plantilla?.ToLower())
                {
                    case "registro":
                        htmlBody = BuildRegistroTemplate(nombre, mensaje);
                        break;
                    case "compensatorio":
                        htmlBody = BuildCompensatorioTemplate(nombre, mensaje);
                        break;
                    case "horas":
                        htmlBody = BuildHorasTemplate(nombre, mensaje);
                        break;
                    default:
                        htmlBody = _emailHelper.BuildHtmlBody(nombre, mensaje);
                        break;
                }

                // Envío del correo
                bool resultado = await _emailHelper.SendEmailAsync(asunto, htmlBody);

                if (resultado)
                {
                    _logger.LogInformation($"Correo enviado exitosamente a {email}");
                    return (true, "Correo enviado correctamente");
                }
                else
                {
                    _logger.LogWarning($"No se pudo enviar el correo a {email}");
                    return (false, "No se pudo enviar el correo");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al enviar correo a {email}");
                return (false, $"Error: {ex.Message}");
            }
        }

        // ==================== ENDPOINT HTTP PARA ENVÍO DE CORREOS ====================
        [HttpPost("enviar")]
        public async Task<IActionResult> EnviarCorreo([FromBody] EmailRequestModel request)
        {
            var (success, message) = await EnviarNotificacion(
                request.Email,
                request.Nombre,
                request.Asunto,
                request.Mensaje,
                request.Plantilla
            );

            if (success)
                return Ok(new { mensaje = message });
            else
                return BadRequest(new { error = message });
        }

        // ==================== PLANTILLA PARA NOTIFICACIONES DE REGISTRO ====================
        private string BuildRegistroTemplate(string nombre, string mensaje)
        {
            return $@"
                <html>
                    <head>
                        <style>
                            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
                            .container {{ max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 5px; }}
                            h1 {{ color: #4a0072; margin-bottom: 20px; }}
                            .welcome {{ font-size: 24px; color: #4a0072; font-weight: bold; }}
                            .button {{ display: inline-block; background-color: #4a0072; color: white; padding: 10px 20px; 
                                       text-decoration: none; border-radius: 4px; margin-top: 20px; }}
                            p {{ line-height: 1.5; }}
                            .footer {{ margin-top: 30px; font-size: 12px; color: #666; text-align: center; }}
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <h1>¡Bienvenido a HardWorker!</h1>
                            <p class='welcome'>Hola, {nombre}</p>
                            <p>Tu cuenta ha sido creada exitosamente.</p>
                            <p>{mensaje}</p>
                            <p>Ahora puedes comenzar a usar nuestra plataforma para gestionar tus horas y compensatorios.</p>
                            <a href='https://hardworker.app/login' class='button'>Iniciar Sesión</a>
                            <div class='footer'>
                                Este correo fue enviado desde la aplicación HardWorker.<br>
                                © {DateTime.Now.Year} HardWorker
                            </div>
                        </div>
                    </body>
                </html>";
        }

        // ==================== PLANTILLA PARA NOTIFICACIONES DE COMPENSATORIOS ====================
        private string BuildCompensatorioTemplate(string nombre, string mensaje)
        {
            return $@"
                <html>
                    <head>
                        <style>
                            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
                            .container {{ max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 5px; }}
                            h1 {{ color: #10b981; margin-bottom: 20px; }}
                            .alert {{ font-size: 18px; color: #10b981; font-weight: bold; }}
                            .button {{ display: inline-block; background-color: #10b981; color: white; padding: 10px 20px; 
                                       text-decoration: none; border-radius: 4px; margin-top: 20px; }}
                            p {{ line-height: 1.5; }}
                            .footer {{ margin-top: 30px; font-size: 12px; color: #666; text-align: center; }}
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <h1>Notificación de Compensatorio</h1>
                            <p class='alert'>Hola, {nombre}</p>
                            <p>{mensaje}</p>
                            <a href='https://hardworker.app/dashboard' class='button'>Ver Detalles</a>
                            <div class='footer'>
                                Este correo fue enviado desde la aplicación HardWorker.<br>
                                © {DateTime.Now.Year} HardWorker
                            </div>
                        </div>
                    </body>
                </html>";
        }

        // ==================== PLANTILLA PARA NOTIFICACIONES DE HORAS ====================
        private string BuildHorasTemplate(string nombre, string mensaje)
        {
            return $@"
        <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 5px; }}
                    h1 {{ color: #10b981; margin-bottom: 20px; }}
                    .alert {{ font-size: 18px; color: #4a0072; font-weight: bold; }}
                    .hours-badge {{ display: inline-block; background-color: #4a0072; color: white; padding: 8px 15px; 
                                   border-radius: 20px; font-weight: bold; margin-top: 10px; }}
                    .button {{ display: inline-block; background-color: #4a0072; color: white; padding: 10px 20px; 
                               text-decoration: none; border-radius: 4px; margin-top: 20px; }}
                    p {{ line-height: 1.5; }}
                    .footer {{ margin-top: 30px; font-size: 12px; color: #666; text-align: center; }}
                </style>
            </head>
            <body>
                <div class='container'>
                    <h1>Notificación de Registro de Horas</h1>
                    <p class='alert'>El usuario {nombre} ha registrado horas</p>
                    <div class='hours-badge'>{mensaje}</div>
                    <p>Esta solicitud requiere su revisión para ser aprobada o rechazada.</p>
                    <a href='https://hardworker.app/admin/hours' class='button'>Revisar Solicitud</a>
                    <div class='footer'>
                        Este correo fue enviado desde la aplicación HardWorker.<br>
                        © {DateTime.Now.Year} HardWorker
                    </div>
                </div>
            </body>
        </html>";
        }
    }
}

