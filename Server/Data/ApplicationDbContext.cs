using Microsoft.EntityFrameworkCore;
using HardWorker.Model;

namespace HardWorker.Data
{
    public class ApplicationDbContext : DbContext
    {
        // Constructor que recibe opciones de configuración para el contexto.
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        // Representa la tabla de usuarios
        public DbSet<User> Users { get; set; }

        // Representa la tabla de registros de horas trabajadas
        public DbSet<HoursUser> HoursUsers { get; set; }

        // Representa la tabla de solicitudes de compensatorio
        public DbSet<Compensatory> Compensatories { get; set; }

        // Configura las relaciones y restricciones entre entidades al crear el modelo.
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Definición de clave primaria para HoursUser
            modelBuilder.Entity<HoursUser>()
                .HasKey(h => h.Id);

            // Relación uno-a-muchos: un usuario puede tener muchas horas registradas
            modelBuilder.Entity<HoursUser>()
                .HasOne(h => h.User)
                .WithMany(u => u.Hours)
                .HasForeignKey(h => h.UserId);
        }
    }
}
