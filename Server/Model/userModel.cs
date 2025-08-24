
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace HardWorker.Model
{
    public class User
    {

        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public required string Username { get; set; }
        public required string Password { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Profileimage { get; set; }

        public string? Role { get; set; }

        // Lista de registros de horas asociadas a este usuario (relación 1 a muchos).
        public ICollection<HoursUser> Hours { get; set; } = new List<HoursUser>();
    }


public class EditUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? Password { get; set; } // Opcional - solo si se quiere cambiar
}
}