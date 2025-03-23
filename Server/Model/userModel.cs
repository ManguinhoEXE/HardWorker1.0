
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace HardWorker.Model {
    public class User {

        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public required string Username { get; set; }
        public required string Password { get; set; }
        
        public string? Token { get; set; }

    public ICollection<HoursUser> Hours { get; set; } = new List<HoursUser>(); 
    } 
}