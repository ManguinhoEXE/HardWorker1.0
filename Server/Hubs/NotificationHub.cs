
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace Hardworker.Hubs
{
    public class NotificationHub : Hub
    {
        public async Task NotifyAdmin(string message)
        {
            await Clients.Group("Admin").SendAsync("ReceiveNotification", message);
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;
            Console.WriteLine($"[Hub] Conexión {Context.ConnectionId}, userId={userId}");

            if (!string.IsNullOrEmpty(userId))
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);

            if (Context.User != null && Context.User.IsInRole("Admin"))
                await Groups.AddToGroupAsync(Context.ConnectionId, "Admin");

            await base.OnConnectedAsync();
        }

        public async Task UpdateUserHoursTotal(string userId, int newTotalHours)
        {
            await Clients.User(userId).SendAsync("UpdateHoursTotal", newTotalHours);
            Console.WriteLine($"[Hub] Actualizando horas totales de usuario {userId}: {newTotalHours}h");
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var user = Context.User;
            var userId = user?
                .FindFirst(ClaimTypes.NameIdentifier)?
                .Value;
            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            }
            if (user != null && user.IsInRole("Admin"))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, "Admin");
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task AddToGroup(string groupName)
        {
            if (groupName == "Admin" && !(Context.User?.IsInRole("Admin") ?? false))
            {
                Console.WriteLine($"[Hub] {Context.ConnectionId} NO autorizado para grupo Admin");
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            Console.WriteLine($"[Hub] {Context.ConnectionId} añadido al grupo {groupName}");
        }
    }

}