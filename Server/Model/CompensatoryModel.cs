

using System.ComponentModel.DataAnnotations;

namespace HardWorker.Model {
    
    public class Compensatory {
        public int Id { get; set; }
        public int UserId { get; set; }
        public required TimestampAttribute  From { get; set; }
        public required TimestampAttribute To { get; set; }

        public required TimestampAttribute CurrentHour { get; set; }

        public string? Reason { get; set; }

        public required string Status { get; set; }

        public User? User { get; set; }
    }
}