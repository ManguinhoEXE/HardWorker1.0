using Microsoft.AspNetCore.Mvc;
using HardWorker.Data;
using HardWorker.Model;
using Microsoft.EntityFrameworkCore;
using HardWorker.Controller;
using HardWorker.Server.Controller;
using Microsoft.AspNetCore.SignalR;
using Hardworker.Hubs;
using Microsoft.AspNetCore.Authorization;

[Route("api/auth")]
[ApiController]
public class AuthController : BaseController
{
    private readonly IConfiguration _configuration;
    private readonly ValidateJwtToken _validateJwtToken;
    private static readonly string[] ValidRoles = { "User", "Admin", "Super" };

    public AuthController(ApplicationDbContext context, IConfiguration configuration, ValidateJwtToken validateJwtToken, IHubContext<NotificationHub> hubContext)
        : base(context, hubContext)
    {
        _configuration = configuration;
        _validateJwtToken = validateJwtToken;
    }

    [HttpPost("registro")]
    [Authorize(Roles = "Super")]
    public async Task<IActionResult> Register([FromBody] User user)
    {
        return await TryExecuteAsync(async () =>
        {
            var modelValidation = ValidateModel();
            if (modelValidation != null) return modelValidation;

            var usernameValidation = ValidateRequired(user?.Username, "Username");
            if (usernameValidation != null) return usernameValidation;

            var passwordValidation = ValidateRequired(user?.Password, "Password");
            if (passwordValidation != null) return passwordValidation;

            if (await UserExistsAsync(user.Username))
                return ErrorResponse("El nombre de usuario ya existe");

            var newUser = new User
            {
                Username = user.Username,
                Password = BCrypt.Net.BCrypt.HashPassword(user.Password),
                FirstName = user.FirstName,
                LastName = user.LastName,
                Role = "User"
            };

            _context.Users.Add(newUser);
            var saveResult = await SaveChangesAsync("Usuario registrado con éxito");
            
            if (saveResult is OkObjectResult)
            {
                _ = Task.Run(async () => await SendUserCreationNotification(newUser));
            }
            
            return saveResult;

        }, "registro de usuario");
    }

    [HttpPost("iniciarsesion")]
    public async Task<IActionResult> Login([FromBody] User user)
    {
        return await TryExecuteAsync(async () =>
        {
            var usernameValidation = ValidateRequired(user?.Username, "Username");
            if (usernameValidation != null) return usernameValidation;

            var passwordValidation = ValidateRequired(user?.Password, "Password");
            if (passwordValidation != null) return passwordValidation;

            // Buscar usuario
            var existingUser = await FindUserByUsernameAsync(user.Username);
            if (existingUser == null || !BCrypt.Net.BCrypt.Verify(user.Password, existingUser.Password))
            {
                return Unauthorized(new { success = false, message = "Credenciales inválidas" });
            }

            var token = _validateJwtToken.GenerateJwtToken(existingUser.Username);
            SetAuthCookie(token);

            return SuccessResponse("Inicio de sesión exitoso", new
            {
                user = new
                {
                    id = existingUser.Id,
                    username = existingUser.Username,
                    firstName = existingUser.FirstName,
                    lastName = existingUser.LastName,
                    role = existingUser.Role ?? "User"
                }
            });

        }, "inicio de sesión");
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        return TryExecute(() =>
        {
            Response.Cookies.Delete("token");
            return SuccessResponse("Sesión cerrada");
        }, "cerrar sesión");
    }

    [HttpDelete("eliminar/{id}")]
    [Authorize(Roles = "Super")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        return await TryExecuteAsync(async () =>
        {
            var (currentUser, error) = await GetUserFromTokenAsync();
            if (currentUser == null) return error!;

            var userToDelete = await _context.Users.FindAsync(id);
            if (userToDelete == null)
                return ErrorResponse("Usuario no encontrado", 404);

            var validationError = await ValidateUserDeletionAsync(currentUser.Id, userToDelete);
            if (validationError != null) return validationError;

            var deletedUserData = new
            {
                id = userToDelete.Id,
                username = userToDelete.Username,
                firstName = userToDelete.FirstName,
                lastName = userToDelete.LastName,
                role = userToDelete.Role
            };

            _context.Users.Remove(userToDelete);
            var saveResult = await SaveChangesAsync($"Usuario '{userToDelete.Username}' eliminado exitosamente");

            if (saveResult is OkObjectResult)
            {
                _ = Task.Run(async () => await SendUserDeletionNotification(deletedUserData));
            }

            return saveResult;

        }, "eliminación de usuario");
    }

    [HttpPut("editar/{id}")]
    [Authorize(Roles = "Super")]
    public async Task<IActionResult> EditUser(int id, [FromBody] EditUserRequest editRequest)
    {
        return await TryExecuteAsync(async () =>
        {
            var usernameValidation = ValidateRequired(editRequest?.Username, "Username");
            if (usernameValidation != null) return usernameValidation;

            var firstNameValidation = ValidateRequired(editRequest?.FirstName, "FirstName");
            if (firstNameValidation != null) return firstNameValidation;

            var lastNameValidation = ValidateRequired(editRequest?.LastName, "LastName");
            if (lastNameValidation != null) return lastNameValidation;

            var roleValidation = ValidateRole(editRequest?.Role);
            if (roleValidation != null) return roleValidation;

            var userToEdit = await _context.Users.FindAsync(id);
            if (userToEdit == null)
                return ErrorResponse("Usuario no encontrado", 404);

            var validationError = await ValidateUserEditAsync(userToEdit, editRequest, id);
            if (validationError != null) return validationError;

            UpdateUserFields(userToEdit, editRequest);

            _context.Entry(userToEdit).State = EntityState.Modified;
            var saveResult = await SaveChangesAsync($"Usuario '{userToEdit.Username}' editado exitosamente");

            if (saveResult is OkObjectResult)
            {
                _ = Task.Run(async () => await SendUserUpdateNotification(userToEdit));
            }

            return saveResult;

        }, "edición de usuario");
    }

    // ==================== MÉTODOS HELPER PRIVADOS (EXISTENTES) ====================

    private async Task<User?> FindUserByUsernameAsync(string username)
    {
        return await _context.Users.FirstOrDefaultAsync(u => u.Username == username);
    }

    private async Task<bool> UserExistsAsync(string username)
    {
        return await _context.Users.AnyAsync(u => u.Username == username);
    }

    private void SetAuthCookie(string token)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,  // TODO: Cambiar a true en producción (HTTPS)
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddHours(1)
        };
        Response.Cookies.Append("token", token, cookieOptions);
    }

    private IActionResult? ValidateRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
            return ErrorResponse("Role es requerido");

        if (!ValidRoles.Contains(role))
            return ErrorResponse($"Rol inválido. Los roles válidos son: {string.Join(", ", ValidRoles)}");

        return null;
    }

    private async Task<IActionResult?> ValidateUserDeletionAsync(int currentUserId, User userToDelete)
    {
        if (currentUserId == userToDelete.Id)
            return ErrorResponse("No puedes eliminar tu propia cuenta");

        if (userToDelete.Role == "Super")
        {
            var superAdminCount = await _context.Users.CountAsync(u => u.Role == "Super");
            if (superAdminCount <= 1)
                return ErrorResponse("No se puede eliminar el último Super Administrador del sistema");
        }

        return null;
    }

    private async Task<IActionResult?> ValidateUserEditAsync(User userToEdit, EditUserRequest editRequest, int id)
    {
        if (editRequest.Username != userToEdit.Username)
        {
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == editRequest.Username && u.Id != id);
            
            if (existingUser != null)
                return ErrorResponse("El nombre de usuario ya existe");
        }

        if (userToEdit.Role == "Super" && editRequest.Role != "Super")
        {
            var superAdminCount = await _context.Users.CountAsync(u => u.Role == "Super");
            if (superAdminCount <= 1)
                return ErrorResponse("No se puede cambiar el rol del último Super Administrador del sistema");
        }

        return null;
    }

    private static void UpdateUserFields(User userToEdit, EditUserRequest editRequest)
    {
        userToEdit.Username = editRequest.Username.Trim();
        userToEdit.FirstName = editRequest.FirstName.Trim();
        userToEdit.LastName = editRequest.LastName.Trim();
        userToEdit.Role = editRequest.Role;

        if (!string.IsNullOrWhiteSpace(editRequest.Password))
        {
            userToEdit.Password = BCrypt.Net.BCrypt.HashPassword(editRequest.Password);
        }
    }

    // ==================== NUEVOS MÉTODOS SIGNALR (SOLO AGREGADOS) ====================

    private async Task SendUserCreationNotification(User newUser)
    {
        try
        {
            var userData = new
            {
                id = newUser.Id,
                username = newUser.Username,
                firstName = newUser.FirstName,
                lastName = newUser.LastName,
                role = newUser.Role,
                profileImage = newUser.Profileimage
            };

            await _hubContext.Clients.Group("Super")
                .SendAsync("UserCreated", new
                {
                    type = "userCreated",
                    userId = newUser.Id,
                    username = newUser.Username,
                    userData = userData,
                    message = $"Usuario '{newUser.Username}' creado exitosamente",
                    timestamp = DateTime.UtcNow
                });

            Console.WriteLine($" Notificación UserCreated enviada para usuario: {newUser.Username}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Error enviando notificación UserCreated: {ex.Message}");
        }
    }

    private async Task SendUserDeletionNotification(object deletedUserData)
    {
        try
        {
            await _hubContext.Clients.Group("Super")
                .SendAsync("UserDeleted", new
                {
                    type = "userDeleted",
                    userId = ((dynamic)deletedUserData).id,
                    username = ((dynamic)deletedUserData).username,
                    userData = deletedUserData,
                    message = $"Usuario '{((dynamic)deletedUserData).username}' eliminado exitosamente",
                    timestamp = DateTime.UtcNow
                });

            Console.WriteLine($" Notificación UserDeleted enviada para usuario: {((dynamic)deletedUserData).username}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Error enviando notificación UserDeleted: {ex.Message}");
        }
    }

    private async Task SendUserUpdateNotification(User updatedUser)
    {
        try
        {
            var userData = new
            {
                id = updatedUser.Id,
                username = updatedUser.Username,
                firstName = updatedUser.FirstName,
                lastName = updatedUser.LastName,
                role = updatedUser.Role,
                profileImage = updatedUser.Profileimage
            };

            await _hubContext.Clients.Group("Super")
                .SendAsync("UserUpdated", new
                {
                    type = "userUpdated",
                    userId = updatedUser.Id,
                    username = updatedUser.Username,
                    userData = userData,
                    message = $"Usuario '{updatedUser.Username}' actualizado exitosamente",
                    timestamp = DateTime.UtcNow
                });

            Console.WriteLine($"Notificación UserUpdated enviada para usuario: {updatedUser.Username}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Error enviando notificación UserUpdated: {ex.Message}");
        }
    }
}