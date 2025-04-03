using Microsoft.EntityFrameworkCore;
using HardWorker.Data;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using HardWorker.Controller;

var builder = WebApplication.CreateBuilder(args);

// Habilitar Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configurar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy.SetIsOriginAllowed(_ => true)  // Permite cualquier localhost
            .AllowCredentials()  // Habilitar cookies
            .AllowAnyMethod()
            .AllowAnyHeader());
});

// Registrar Controladores
builder.Services.AddControllers();

builder.Services.AddHttpContextAccessor();


// Configurar Autenticación con JWT y Cookies HTTP-Only
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;  // Habilitar cookies HTTP-Only
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;  // Asegurar que las cookies se envíen solo a través de HTTPS
        options.Cookie.SameSite = SameSiteMode.Lax;  // Permitir el envío de cookies en solicitudes de terceros
        options.LoginPath = "/api/auth/iniciarsesion";  // Ruta para iniciar sesión
    })
    // Configurar JWT Bearer Authentication
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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] 
                ?? throw new InvalidOperationException("Jwt:Key is not configured")))
        };

        // Leer el Token desde la Cookie
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies["token"];  // Obtener token desde la cookie
                return Task.CompletedTask;
            }
        };
    });

// Configurar Base de Datos
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddScoped<ValidateJwtToken>();
var app = builder.Build();

app.UseCors("AllowFrontend");  // ✅ Asegurar que CORS se aplique antes de Routing
app.UseCookiePolicy(new CookiePolicyOptions { MinimumSameSitePolicy = SameSiteMode.Lax });  // ✅ Permitir Cookies



if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
