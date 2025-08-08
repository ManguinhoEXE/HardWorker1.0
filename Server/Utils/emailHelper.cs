using System.Net;
using System.Net.Mail;

namespace HardWorker.Server.Utils
{
    public class EmailHelper
    {
        private readonly string _smtpHost;
        private readonly int _smtpPort;
        private readonly bool _enableSsl = true;
        private readonly string _fromName;
        private readonly string _fromEmail;
        private readonly string _password;

        private List<string> _destinatarios = new List<string>();

        /// Constructor que inicializa EmailHelper con la configuración desde appsettings.json
        public EmailHelper(IConfiguration configuration)
        {
            var emailSettings = configuration.GetSection("EmailSettings");
            _fromName = emailSettings["FromName"] ?? throw new InvalidOperationException("FromName no está configurado");
            _fromEmail = emailSettings["FromEmail"] ?? throw new InvalidOperationException("FromEmail no está configurado");
            _password = emailSettings["password_email"] ?? throw new InvalidOperationException("password_email no está configurado");
            _smtpHost = emailSettings["SmtpServer"] ?? throw new InvalidOperationException("SmtpServer no está configurado");

            if (!int.TryParse(emailSettings["SmtpPort"], out _smtpPort))
            {
                _smtpPort = 587;
            }

        }

        /// Agrega un destinatario al correo.
        public void AddDestinatario(string email)
        {
            if (!string.IsNullOrWhiteSpace(email) && !_destinatarios.Contains(email))
                _destinatarios.Add(email);
        }

        /// Agrega múltiples destinatarios al correo.
        public void AddDestinatarios(IEnumerable<string> emails)
        {
            foreach (var email in emails)
                AddDestinatario(email);
        }

        /// Limpia la lista de destinatarios.
        public void ClearDestinatarios()
        {
            _destinatarios.Clear();
        }

        /// Construye un HTML personalizado para el cuerpo del correo.
        public string BuildHtmlBody(string nombre, string? contenido = null)
        {
            string content = contenido ?? "Este es un correo enviado desde la aplicación HardWorker.";

            return $@"
                <html>
                    <head>
                        <style>
                            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
                            .container {{ max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 5px; }}
                            h1 {{ color: #4a0072; margin-bottom: 20px; }}
                            p {{ line-height: 1.5; }}
                            .footer {{ margin-top: 30px; font-size: 12px; color: #666; text-align: center; }}
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <h1>{nombre}</h1>
                            <p>{content}</p>
                            <div class='footer'>
                                Este correo fue enviado desde la aplicación HardWorker.<br>
                                © {DateTime.Now.Year} HardWorker
                            </div>
                        </div>
                    </body>
                </html>";
        }

        /// Envía el correo a los destinatarios configurados, con asunto y cuerpo HTML.
        public async Task<bool> SendEmailAsync(string subject, string htmlBody)
        {
            if (string.IsNullOrEmpty(_fromEmail) || string.IsNullOrEmpty(_password))
                throw new InvalidOperationException("Las credenciales de correo no están configuradas correctamente.");

            if (_destinatarios.Count == 0)
                throw new InvalidOperationException("Debe agregar al menos un destinatario.");

            try
            {
                using (var message = new MailMessage())
                {
                    // Configurar remitente con nombre de visualización
                    message.From = new MailAddress(_fromEmail, _fromName);

                    // Agregar destinatarios
                    foreach (var dest in _destinatarios)
                        message.To.Add(dest);

                    message.Subject = subject;
                    message.Body = htmlBody;
                    message.IsBodyHtml = true;

                    using (var client = new SmtpClient(_smtpHost, _smtpPort))
                    {
                        client.Credentials = new NetworkCredential(_fromEmail, _password);
                        client.EnableSsl = _enableSsl;

                        await client.SendMailAsync(message);
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al enviar el correo electrónico: {ex.Message}");
                return false;
            }
        }
    }
}