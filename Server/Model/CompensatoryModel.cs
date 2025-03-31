

namespace HardWorker.Model {
    
    public class Compensatory {
        public int Id { get; set; }
        public int UserId { get; set; }
        public required DateTime  From { get; set; }
        public required DateTime To { get; set; }

        public DateTime CurrentHour { get; set; }

        public string? Reason { get; set; }

        public string? Status { get; set; }

        public User? User { get; set; }
    }
}