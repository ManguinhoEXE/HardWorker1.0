


namespace HardWorker.Model
{

    public class EmailRequestModel
    {
        public required string Email { get; set; }
        public required string Nombre { get; set; }
        public required string Asunto { get; set; }
        public required string Mensaje { get; set; }
        public string? Plantilla { get; set; }
    }
}