using Microsoft.EntityFrameworkCore;
using HardWorker.Data;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using HardWorker.Controller;
using Hardworker.Hubs;
using HardWorker.Server.Utils;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSignalR();


builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy.SetIsOriginAllowed(_ => true)  // Permite cualquier origen (útil en desarrollo)
            .AllowCredentials()                         
            .AllowAnyMethod()
            .AllowAnyHeader());
});

builder.Services.AddControllers();

builder.Services.AddHttpContextAccessor();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // Requiere HTTPS en producción
        options.Cookie.SameSite = SameSiteMode.Lax;              
        options.LoginPath = "/api/auth/iniciarsesion";         
    })
    .AddJwtBearer(options =>
    {
        options.Authority = "https://localhost:5072";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] 
                ?? throw new InvalidOperationException("Jwt:Key is not configured"))
            )
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies["token"];
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddScoped<ValidateJwtToken>();

builder.Services.AddSingleton<EmailHelper>();
builder.Services.AddScoped<HardWorker.Server.Controller.EmailController>();


var app = builder.Build();



app.UseCors("AllowFrontend");

app.UseCookiePolicy(new CookiePolicyOptions { MinimumSameSitePolicy = SameSiteMode.Lax });

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();          
    app.UseSwaggerUI();        
    app.UseDeveloperExceptionPage();
}

app.UseStaticFiles();

app.UseRouting();


app.MapHub<NotificationHub>("/notificationHub");


app.UseAuthentication(); 
app.UseAuthorization();  

app.MapControllers();

app.Run();
