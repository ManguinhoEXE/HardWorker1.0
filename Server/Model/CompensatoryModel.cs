

namespace HardWorker.Model {
    
    public class Compensatory {
        public int Id { get; set; }
        public int UserId { get; set; }
        public required DateTimeOffset From { get; set; }
        public required DateTimeOffset To { get; set; }

        public DateTime CurrentHour { get; set; }

        public string? Reason { get; set; }

        public string? Status { get; set; }

        // Objeto de navegación al usuario asociado
        public User? User { get; set; }
    }
}