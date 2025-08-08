using Microsoft.EntityFrameworkCore;
using HardWorker.Data;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using HardWorker.Controller;
using Hardworker.Hubs;
using HardWorker.Server.Utils;


var builder = WebApplication.CreateBuilder(args);

// 🛠️ HABILITAR SWAGGER para documentación automática de la API
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 📦 HABILITAR SIGNALR para comunicación en tiempo real
builder.Services.AddSignalR();


// 🌐 CONFIGURAR CORS para permitir peticiones desde el frontend Angular
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy.SetIsOriginAllowed(_ => true)  // Permite cualquier origen (útil en desarrollo)
            .AllowCredentials()                         // Permite el uso de cookies
            .AllowAnyMethod()
            .AllowAnyHeader());
});

// ✅ REGISTRAR CONTROLADORES
builder.Services.AddControllers();

// 👂 Permite inyectar HttpContext en cualquier servicio
builder.Services.AddHttpContextAccessor();

// 🔐 CONFIGURAR AUTENTICACIÓN (JWT y Cookies HTTP-Only)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    // 🧁 Cookies HTTP-only para mantener sesión segura
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // Requiere HTTPS en producción
        options.Cookie.SameSite = SameSiteMode.Lax;              // Permite navegación cruzada con Angular
        options.LoginPath = "/api/auth/iniciarsesion";          // Ruta de login
    })
    // 🔐 JWT Bearer para leer el token desde la cookie
    .AddJwtBearer(options =>
    {
        options.Authority = "https://localhost:5072"; // Autoridad del token
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

        // 🎯 Interceptar token desde cookie
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies["token"];
                return Task.CompletedTask;
            }
        };
    });

// 🗄️ CONFIGURAR EF CORE con SQL Server
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});

// 🧠 INYECTAR SERVICIO personalizado para generación de JWT
builder.Services.AddScoped<ValidateJwtToken>();

// 📨 INYECTAR SERVICIO personalizado para enviar correos electrónicos
builder.Services.AddSingleton<EmailHelper>();
builder.Services.AddScoped<HardWorker.Server.Controller.EmailController>();


// ✨ CONSTRUIR APP
var app = builder.Build();



// 🛡️ CORS debe aplicarse antes del routing para permitir cookies cross-site
app.UseCors("AllowFrontend");

// 🍪 Configura política de cookies para toda la app
app.UseCookiePolicy(new CookiePolicyOptions { MinimumSameSitePolicy = SameSiteMode.Lax });

// 🚀 CONFIGURACIONES SOLO EN MODO DESARROLLO
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();          // Documentación Swagger
    app.UseSwaggerUI();        // Interfaz Swagger
    app.UseDeveloperExceptionPage(); // Página detallada de errores
}

// 📂 Habilitar archivos estáticos (ej. imágenes subidas)
app.UseStaticFiles();

// 🚏 Middleware de enrutamiento
app.UseRouting();


app.MapHub<NotificationHub>("/notificationHub");


// 🔐 Seguridad
app.UseAuthentication(); // Leer identidad del usuario desde cookie/token
app.UseAuthorization();  // Verifica permisos según roles o policies

// 🧭 Mapear rutas a controladores
app.MapControllers();

// 🏁 Iniciar la aplicación
app.Run();
