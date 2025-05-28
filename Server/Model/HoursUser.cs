


namespace HardWorker.Model
{

    public class HoursUser
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int Hours { get; set; }

        public string? Description { get; set; }

        public DateTime CurrentHour { get; set; }

        public string? Status { get; set; }

        // Objeto de navegación al usuario asociado
        public User? User { get; set; }
    }
}