

using Microsoft.EntityFrameworkCore;
using HardWorker.Model;


namespace HardWorker.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<HoursUser> HoursUsers { get; set; }
        public DbSet<Compensatory> Compensatories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<HoursUser>()
                .HasKey(h => h.Id);

            modelBuilder.Entity<HoursUser>()
                .HasOne(h => h.User)
                .WithMany(u => u.Hours)
                .HasForeignKey(h => h.UserId);
        }
    }
}
