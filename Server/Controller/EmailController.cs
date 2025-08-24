using HardWorker.Server.Utils;
using Microsoft.AspNetCore.Mvc;
using HardWorker.Model;
using HardWorker.Server.Controller;
using HardWorker.Data;
using Microsoft.AspNetCore.SignalR;
using Hardworker.Hubs;

namespace HardWorker.Server.Controller
{
    [Route("api/[controller]")]
    [ApiController]
    public class EmailController : BaseController
    {
        private readonly EmailHelper _emailHelper;
        private readonly ILogger<EmailController> _logger;

        public EmailController(EmailHelper emailHelper, ILogger<EmailController> logger, ApplicationDbContext context, IHubContext<NotificationHub> hubContext)
            : base(context, hubContext)
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
                // Validación de parámetros usando BaseController
                var emailValidation = ValidateRequired(email, "Email");
                if (emailValidation != null)
                    return (false, "El correo electrónico del destinatario es requerido");

                // Valores por defecto
                if (string.IsNullOrEmpty(nombre))
                    nombre = "Usuario";

                if (string.IsNullOrEmpty(asunto))
                    asunto = "Notificación de HardWorker";

                // Configuración del destinatario
                _emailHelper.ClearDestinatarios();
                _emailHelper.AddDestinatario(email);

                // Selección de plantilla HTML
                string htmlBody = GetEmailTemplate(plantilla, nombre, mensaje);

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

        public async Task SendEmail(string toEmail, string subject, string body)
        {
            try
            {
                var (success, message) = await EnviarNotificacion(
                    email: toEmail,
                    nombre: "Usuario", 
                    asunto: subject,
                    mensaje: body,
                    plantilla: "compensatorio" 
                );

                if (!success)
                {
                    Console.WriteLine($" Error enviando email: {message}");
                }
                else
                {
                    Console.WriteLine($" Email enviado exitosamente a: {toEmail}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($" Error en SendEmail: {ex.Message}");
            }
        }

        // ==================== ENDPOINT HTTP PARA ENVÍO DE CORREOS ====================
        [HttpPost("enviar")]
        public async Task<IActionResult> EnviarCorreo([FromBody] EmailRequestModel request)
        {
            return await TryExecuteAsync(async () =>
            {
                // Validación usando BaseController
                var modelValidation = ValidateModel();
                if (modelValidation != null) return modelValidation;

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
            }, "envío de correo");
        }

        // ==================== MÉTODO HELPER PARA SELECCIONAR PLANTILLA ====================
        private string GetEmailTemplate(string? plantilla, string nombre, string mensaje)
        {
            return plantilla?.ToLower() switch
            {
                "registro" => BuildRegistroTemplate(nombre, mensaje),
                "compensatorio" => BuildCompensatorioTemplate(nombre, mensaje),
                "horas" => BuildHorasTemplate(nombre, mensaje),
                _ => _emailHelper.BuildHtmlBody(nombre, mensaje)
            };
        }

        // ==================== PLANTILLA PARA NOTIFICACIONES DE REGISTRO ====================
        private string BuildRegistroTemplate(string nombre, string mensaje)
        {
            return BuildEmailTemplate(
                "¡Bienvenido a HardWorker!",
                $"Hola, {nombre}",
                "#4a0072",
                $@"<p>Tu cuenta ha sido creada exitosamente.</p>
                   <p>{mensaje}</p>
                   <p>Ahora puedes comenzar a usar nuestra plataforma para gestionar tus horas y compensatorios.</p>",
                "Iniciar Sesión",
                "https://hardworker.app/login"
            );
        }

        // ==================== PLANTILLA PARA NOTIFICACIONES DE COMPENSATORIOS ====================
        private string BuildCompensatorioTemplate(string nombre, string mensaje)
        {
            return BuildEmailTemplate(
                "Notificación de Compensatorio",
                $"Hola, {nombre}",
                "#10b981",
                $"<p>{mensaje}</p>",
                "Ver Detalles",
                "https://hardworker.app/dashboard"
            );
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

        // ==================== PLANTILLA BASE REUTILIZABLE ====================
        private string BuildEmailTemplate(string titulo, string saludo, string color, string contenido, string textoBoton, string linkBoton)
        {
            return $@"
                <html>
                    <head>
                        <style>
                            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
                            .container {{ max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 5px; }}
                            h1 {{ color: {color}; margin-bottom: 20px; }}
                            .welcome {{ font-size: 24px; color: {color}; font-weight: bold; }}
                            .alert {{ font-size: 18px; color: {color}; font-weight: bold; }}
                            .button {{ display: inline-block; background-color: {color}; color: white; padding: 10px 20px; 
                                       text-decoration: none; border-radius: 4px; margin-top: 20px; }}
                            p {{ line-height: 1.5; }}
                            .footer {{ margin-top: 30px; font-size: 12px; color: #666; text-align: center; }}
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <h1>{titulo}</h1>
                            <p class='welcome'>{saludo}</p>
                            {contenido}
                            <a href='{linkBoton}' class='button'>{textoBoton}</a>
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