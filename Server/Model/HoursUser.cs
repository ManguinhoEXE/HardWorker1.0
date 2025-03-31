


namespace HardWorker.Model {
    
    public class HoursUser {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int? Hours { get; set; }

        public DateTime CurrentHour { get; set; }

        public User? User { get; set; }
    }
}