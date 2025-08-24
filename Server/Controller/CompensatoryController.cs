using HardWorker.Model;
using HardWorker.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Hardworker.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using HardWorker.Server.Controller;

[Route("api/[Controller]")]
[ApiController]
public class CompensatoryController : BaseController
{
    private readonly EmailController _emailController;

    public CompensatoryController(ApplicationDbContext context, IHubContext<NotificationHub> hubContext, EmailController emailController)
        : base(context, hubContext)
    {
        _emailController = emailController;
    }

    // ==================== OBTENER SOLICITUDES DEL USUARIO ====================
    [HttpGet("getrequests")]
    public async Task<IActionResult> getCompensatories()
    {
        return await ExecuteWithAuthenticationAsync<IActionResult>(async (userId) =>
        {
            var compensatoryData = await _context.Compensatories
                .Where(c => c.UserId == userId)
                .Select(c => new
                {
                    c.Id,
                    FromDateTime = c.From.DateTime,
                    ToDateTime = c.To.DateTime,
                    c.Reason,
                    c.Status,
                    CurrentHourDateTime = c.CurrentHour
                })
                .OrderByDescending(c => c.CurrentHourDateTime)
                .ToListAsync();

            if (!compensatoryData.Any())
            {
                return SuccessResponse("No se encontraron solicitudes de compensatorio.", new List<object>());
            }
            var compensatoryRequests = compensatoryData.Select(c => new
            {
                c.Id,
                From = FormatDateTime(c.FromDateTime),
                To = FormatDateTime(c.ToDateTime),
                c.Reason,
                c.Status,
                CurrentHour = FormatDateTime(c.CurrentHourDateTime)
            }).ToList();

            return SuccessResponse("Solicitudes de compensatorio obtenidas exitosamente.", compensatoryRequests);
        });
    }


    // ==================== CREAR NUEVA SOLICITUD ====================
    [HttpPost("addrequest")]
    public async Task<IActionResult> requestCompensatory([FromBody] Compensatory compensatory)
    {
        return await TryExecuteAsync(async () =>
        {
            return await ExecuteWithUserValidationAsync(async (user) =>
            {
                var modelValidation = ValidateModel();
                if (modelValidation != null) return modelValidation;

                var dateValidation = ValidateDateRange(compensatory.From.DateTime, compensatory.To.DateTime, "compensatorio");
                if (dateValidation != null) return dateValidation;

                var reasonValidation = ValidateRequired(compensatory.Reason, "La razón");
                if (reasonValidation != null) return reasonValidation;

                if (compensatory.From.Minute != compensatory.To.Minute)
                    return BadRequest(new { message = "La solicitud de compensatorio debe ser en horas completas. Los minutos de la hora de inicio y fin deben coincidir (ej. de 09:15 a 11:15)." });

                var totalAccepted = await GetUserAcceptedHoursAsync(user.Id);
                var hoursRequested = CalculateHours(compensatory.From.DateTime, compensatory.To.DateTime);

                if (hoursRequested > totalAccepted)
                {
                    return BadRequest(new
                    {
                        message = $"No tienes suficientes horas disponibles. Disponibles: {totalAccepted}, solicitadas: {hoursRequested}"
                    });
                }

                compensatory.UserId = user.Id;
                compensatory.CurrentHour = DateTime.UtcNow;
                compensatory.Status = "Pendiente";

                await _context.Compensatories.AddAsync(compensatory);
                var saveResult = await SaveChangesAsync("Solicitud de compensatorio creada exitosamente.");
                if (saveResult is not OkObjectResult) return saveResult;

                var adminUserIds = await GetUserIdsByRoleAsync("Admin");
                Console.WriteLine($" Admin IDs obtenidos: [{string.Join(", ", adminUserIds)}]");

                _ = SendCompensatoryNotificationsInBackground(compensatory, user, hoursRequested, adminUserIds);

                return SuccessResponse("Solicitud de compensatorio creada exitosamente.", new
                {
                    compensatory,
                    hoursRequested
                });
            });
        }, "crear solicitud de compensatorio");
    }

    // ==================== OBTENER TODAS LAS SOLICITUDES ====================
    [HttpGet("getallrequests")]
    public IActionResult GetCompensatoryRequests()
    {
        var now = DateTime.UtcNow;

        var compensatoryRequests = _context.Compensatories
            .Include(c => c.User)
            .ToList()
            .Select(c =>
            {
                string dynamicStatus = c.Status ?? string.Empty;
                if (c.Status == "Aceptada")
                {
                    if (now >= c.From && now < c.To)
                        dynamicStatus = "En curso";
                    else if (now >= c.To)
                        dynamicStatus = "Finalizado";
                }
                return new
                {
                    c.Id,
                    FirstName = c.User?.FirstName,
                    LastName = c.User?.LastName,
                    c.Reason,
                    From = c.From,
                    To = c.To,
                    Status = dynamicStatus,
                    c.UserId
                };
            })
            .Where(c => c.Status != "Finalizado")
            .OrderByDescending(c => c.From)
            .ToList();

        return Ok(compensatoryRequests);
    }

    // ==================== HISTORIAL COMPLETO (ADMIN) ====================
    [HttpGet("getallhistory")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetAllCompensatoryHistory()
    {
        try
        {
            var now = DateTime.UtcNow;

            var allCompensatoryHistory = _context.Compensatories
                .Include(c => c.User)
                .OrderByDescending(c => c.CurrentHour)
                .ToList()
                .Select(c =>
                {
                    string dynamicStatus = c.Status ?? string.Empty;
                    if (c.Status == "Aceptada")
                    {
                        if (now >= c.From && now < c.To)
                            dynamicStatus = "En curso";
                        else if (now >= c.To)
                            dynamicStatus = "Finalizado";
                        else if (now < c.From)
                            dynamicStatus = "Programado";
                    }

                    var duration = c.To - c.From;
                    var hoursRequested = Math.Round(duration.TotalHours, 2);

                    return new
                    {
                        Id = c.Id,
                        FirstName = c.User?.FirstName ?? "N/A",
                        LastName = c.User?.LastName ?? "N/A",
                        Reason = c.Reason,
                        From = c.From.ToString("yyyy-MM-ddTHH:mm:ss"),
                        To = c.To.ToString("yyyy-MM-ddTHH:mm:ss"),
                        Status = c.Status,
                        DynamicStatus = dynamicStatus,
                        CurrentHour = c.CurrentHour.ToString("yyyy-MM-ddTHH:mm:ss"),
                        UserId = c.UserId,
                        HoursRequested = hoursRequested,
                        UserFullName = $"{c.User?.FirstName ?? "N/A"} {c.User?.LastName ?? "N/A"}",
                        DaysFromRequest = Math.Round((now - c.CurrentHour).TotalDays, 1),
                        IsActive = dynamicStatus == "En curso",
                        IsPending = c.Status == "Pendiente",
                        IsExpired = c.Status == "Aceptada" && now >= c.To
                    };
                })
                .ToList();

            var statistics = new
            {
                TotalRequests = allCompensatoryHistory.Count,
                PendingRequests = allCompensatoryHistory.Count(r => r.Status == "Pendiente"),
                AcceptedRequests = allCompensatoryHistory.Count(r => r.Status == "Aceptada"),
                RejectedRequests = allCompensatoryHistory.Count(r => r.Status == "Rechazada"),
                ActiveRequests = allCompensatoryHistory.Count(r => r.DynamicStatus == "En curso"),
                FinishedRequests = allCompensatoryHistory.Count(r => r.DynamicStatus == "Finalizado"),
                TotalHoursRequested = allCompensatoryHistory.Sum(r => r.HoursRequested),
                TotalActiveHours = allCompensatoryHistory
                    .Where(r => r.DynamicStatus == "En curso")
                    .Sum(r => r.HoursRequested)
            };

            return Ok(new
            {
                Message = "Historial completo de compensatorios cargado exitosamente.",
                Statistics = statistics,
                Data = allCompensatoryHistory
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Error al cargar el historial de compensatorios.",
                error = ex.Message
            });
        }
    }

    // ==================== HISTORIAL DEL USUARIO ACTUAL ====================
    [HttpGet("user-history")]
    [Authorize]
    public async Task<IActionResult> GetUserCompensatoryHistory()
    {
        return await ExecuteWithAuthenticationAsync<IActionResult>(async (userId) =>
        {
            var userCompensatoryData = await _context.Compensatories
                .Where(c => c.UserId == userId)
                .Select(c => new
                {
                    c.Id,
                    c.Reason,
                    FromDateTime = c.From.DateTime,
                    ToDateTime = c.To.DateTime,
                    c.Status,
                    CurrentHourDateTime = c.CurrentHour,
                    c.UserId
                })
                .OrderByDescending(c => c.CurrentHourDateTime)
                .ToListAsync();
            if (!userCompensatoryData.Any())
            {
                return SuccessResponse("No se encontraron solicitudes de compensatorio.", new
                {
                    Statistics = new { TotalRequests = 0 },
                    Data = new List<object>()
                });
            }

            var tempCompensatories = userCompensatoryData.Select(c => new Compensatory
            {
                Id = c.Id,
                Reason = c.Reason,
                From = c.FromDateTime,
                To = c.ToDateTime,
                Status = c.Status,
                CurrentHour = c.CurrentHourDateTime,
                UserId = c.UserId
            }).ToList();

            var formattedHistory = CreateFormattedHistoryList(tempCompensatories, includeUserInfo: false);
            var statistics = CalculateStatistics(formattedHistory);

            return SuccessResponse("Historial de compensatorios del usuario cargado exitosamente.", new
            {
                Statistics = statistics,
                Data = formattedHistory
            });
        });
    }

    // ==================== ACEPTAR SOLICITUD (ADMIN) ====================
    [HttpPatch("accept/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AcceptRequest(int id)
    {
        return await TryExecuteAsync(async () =>
        {
            var request = await _context.Compensatories
                .Include(c => c.User)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (request == null) return NotFound();

            if (request.Status != "Pendiente")
                return BadRequest(new { message = "Solo se pueden aceptar solicitudes pendientes" });

            // Usar método del BaseController
            var hoursRequested = CalculateHours(request.From.DateTime, request.To.DateTime);
            var availableHours = await GetUserAcceptedHoursAsync(request.UserId);

            if (hoursRequested > availableHours)
            {
                return BadRequest(new
                {
                    message = $"El usuario no tiene suficientes horas disponibles. Disponibles: {availableHours}, solicitadas: {hoursRequested}"
                });
            }

            string previousStatus = request.Status;
            request.Status = "Aceptada";

            var saveResult = await SaveChangesAsync("Compensatorio aceptado correctamente.");
            if (saveResult is not OkObjectResult) return saveResult;

            await SendAcceptanceNotifications(request, previousStatus, hoursRequested, availableHours);

            return SuccessResponse("Compensatorio aceptado correctamente.");
        }, "aceptar solicitud de compensatorio");
    }

    // ==================== RECHAZAR SOLICITUD (ADMIN) ====================
    [HttpPatch("reject/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectRequest(int id)
    {
        return await TryExecuteAsync(async () =>
        {
            var request = await _context.Compensatories
                .Include(request => request.User)
                .FirstOrDefaultAsync(request => request.Id == id);

            if (request == null) return NotFound();

            request.Status = "Rechazada";
            var saveResult = await SaveChangesAsync("Compensatorio Rechazado");
            if (saveResult is not OkObjectResult) return saveResult;

            var notificationData = new
            {
                id = request.Id,
                firstName = request.User?.FirstName,
                lastName = request.User?.LastName,
                to = request.To,
                from = request.From,
                reason = request.Reason,
                type = "compRejected",
                rejectedDate = DateTime.Now.ToString("dd/MM/yyyy"),
                userId = request.UserId,
                timestamp = DateTime.UtcNow,
                targetRole = "User",
                targetUserIds = new List<int> { request.UserId }, // Solo al usuario específico
                fromUserId = request.UserId // El usuario que recibe la respuesta
            };

            await _hubContext.Clients.All.SendAsync("DistributeNotification", notificationData);

            await SendUserNotificationAsync(request.UserId, "ReceiveNotification", new
            {
                id = request.Id,
                firstName = request.User?.FirstName,
                lastName = request.User?.LastName,
                to = request.To,
                from = request.From,
                reason = request.Reason,
                type = "compRejected",
                rejectedDate = DateTime.Now.ToString("dd/MM/yyyy")
            });

            Console.WriteLine(" Notificación de compensatorio rechazado enviada con distribución automática");

            return SuccessResponse("Compensatorio Rechazado");
        }, "rechazar solicitud de compensatorio");
    }
    // ==================== ESTADÍSTICAS GLOBALES (ADMIN) ====================
    [HttpGet("global-statistics")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetGlobalStatistics()
    {
        try
        {
            var totalUsers = _context.Users.Count();
            var adminUsers = _context.Users.Count(u => u.Role == "Admin");
            var regularUsers = totalUsers - adminUsers;

            var totalHoursRegistered = _context.HoursUsers
                .Where(h => h.Status == "Aceptada")
                .Sum(h => h.Hours);

            var totalHoursRequested = _context.HoursUsers.Count();
            var acceptedHoursRequests = _context.HoursUsers.Count(h => h.Status == "Aceptada");
            var pendingHoursRequests = _context.HoursUsers.Count(h => h.Status == "Pendiente");
            var rejectedHoursRequests = _context.HoursUsers.Count(h => h.Status == "Rechazada");

            var now = DateTime.UtcNow;
            var allCompensatories = _context.Compensatories.ToList();

            var totalCompensatoryRequests = allCompensatories.Count;
            var acceptedCompensatories = allCompensatories.Count(c => c.Status == "Aceptada");
            var pendingCompensatories = allCompensatories.Count(c => c.Status == "Pendiente");
            var rejectedCompensatories = allCompensatories.Count(c => c.Status == "Rechazada");

            var activeCompensatories = allCompensatories.Count(c =>
                c.Status == "Aceptada" && now >= c.From && now < c.To);

            var finishedCompensatories = allCompensatories.Count(c =>
                c.Status == "Aceptada" && now >= c.To);

            var totalHoursInCompensatories = allCompensatories
                .Where(c => c.Status == "Aceptada")
                .Sum(c => Math.Round((c.To - c.From).TotalHours, 2));

            var activeHours = allCompensatories
                .Where(c => c.Status == "Aceptada" && now >= c.From && now < c.To)
                .Sum(c => Math.Round((c.To - c.From).TotalHours, 2));

            return Ok(new
            {
                Message = "Estadísticas globales obtenidas exitosamente.",
                UserStatistics = new
                {
                    TotalUsers = totalUsers,
                    AdminUsers = adminUsers,
                    RegularUsers = regularUsers
                },
                HourStatistics = new
                {
                    TotalHoursAvailable = totalHoursRegistered,
                    TotalHourRequests = totalHoursRequested,
                    AcceptedHourRequests = acceptedHoursRequests,
                    PendingHourRequests = pendingHoursRequests,
                    RejectedHourRequests = rejectedHoursRequests
                },
                CompensatoryStatistics = new
                {
                    TotalCompensatoryRequests = totalCompensatoryRequests,
                    AcceptedCompensatories = acceptedCompensatories,
                    PendingCompensatories = pendingCompensatories,
                    RejectedCompensatories = rejectedCompensatories,
                    ActiveCompensatories = activeCompensatories,
                    FinishedCompensatories = finishedCompensatories,
                    TotalHoursInCompensatories = totalHoursInCompensatories,
                    ActiveHours = activeHours
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Error al obtener las estadísticas globales.",
                error = ex.Message
            });
        }
    }

    // ==================== HORAS DISPONIBLES ====================
    [HttpGet("available-hours")]
    [Authorize]
    public async Task<IActionResult> GetAvailableHours()
    {
        return await ExecuteWithAuthenticationAsync<IActionResult>(async (userId) =>
        {
            var availableHours = await GetUserAcceptedHoursAsync(userId);

            var totalEarned = await _context.HoursUsers
                .Where(h => h.UserId == userId && h.Status == "Aceptada")
                .SumAsync(h => h.Hours);

            var acceptedCompensatories = await _context.Compensatories
                .Where(c => c.UserId == userId && c.Status == "Aceptada")
                .Select(c => new { c.From, c.To })
                .ToListAsync();

            var totalUsed = acceptedCompensatories
                .Sum(c => CalculateHours(c.From.DateTime, c.To.DateTime));

            return SuccessResponse("Horas disponibles calculadas.", new
            {
                availableHours,
                totalEarned,
                totalUsed
            });
        });
    }

    // ==================== MÉTODOS HELPER PRIVADOS ====================

    private async Task SendCompensatoryNotificationsInBackground(Compensatory compensatory, User user, double hoursRequested, List<int> adminUserIds)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                Console.WriteLine($" Iniciando envío de notificaciones para compensatorio ID: {compensatory.Id}");
                Console.WriteLine($" Admin IDs recibidos: [{string.Join(", ", adminUserIds)}]");

                var notificationData = new
                {
                    id = compensatory.Id,
                    firstName = user.FirstName,
                    lastName = user.LastName,
                    from = compensatory.From,
                    to = compensatory.To,
                    reason = compensatory.Reason,
                    type = "compRequest",
                    hoursRequested = hoursRequested,
                    userId = user.Id,
                    timestamp = DateTime.UtcNow,
                    targetRole = "Admin",
                    targetUserIds = adminUserIds,
                    fromUserId = user.Id
                };

                Console.WriteLine($" Datos de notificación: {System.Text.Json.JsonSerializer.Serialize(notificationData)}");

                await SendNotificationToAllAdminsAsync(notificationData);

                await _emailController.SendEmail(
                    "hardworker.umg@gmail.com",
                    "Nueva Solicitud de Compensatorio",
                    $@"<h3>Nueva Solicitud de Compensatorio</h3>
                   <p><strong>Empleado:</strong> {user.FirstName} {user.LastName}</p>
                   <p><strong>Desde:</strong> {compensatory.From:dd/MM/yyyy HH:mm}</p>
                   <p><strong>Hasta:</strong> {compensatory.To:dd/MM/yyyy HH:mm}</p>
                   <p><strong>Horas solicitadas:</strong> {hoursRequested}</p>
                   <p><strong>Razón:</strong> {compensatory.Reason}</p>"
                );

                Console.WriteLine(" Notificaciones de compensatorio enviadas correctamente");
            }
            catch (Exception ex)
            {
                Console.WriteLine($" Error enviando notificaciones: {ex.Message}");
                Console.WriteLine($" Stack trace: {ex.StackTrace}");
            }
        });
    }

    private async Task SendAcceptanceNotifications(Compensatory request, string previousStatus, double hoursRequested, double availableHours)
    {
        var newAvailableHours = Math.Round(availableHours - hoursRequested, 2);
        var userGroup = request.UserId.ToString();

        var updateData = new
        {
            compensatoryId = request.Id,
            newStatus = request.Status,
            previousStatus,
            hoursRequested,
            reason = request.Reason,
            userId = request.UserId,
            from = request.From,
            to = request.To
        };

        await _hubContext.Clients.Group(userGroup).SendAsync("UpdateCompensatoryStatus", updateData);
        await _hubContext.Clients.Group(userGroup).SendAsync("UpdateAvailableHours", newAvailableHours);

        var notificationData = new
        {
            id = request.Id,
            firstName = request.User?.FirstName,
            lastName = request.User?.LastName,
            from = request.From,
            to = request.To,
            reason = request.Reason,
            hoursUsed = hoursRequested,
            availableHours = newAvailableHours,
            type = "compAccepted",
            acceptedDate = DateTime.Now.ToString("dd/MM/yyyy"),
            userId = request.UserId,
            timestamp = DateTime.UtcNow,
            targetRole = "User",
            targetUserIds = new List<int> { request.UserId }, // Solo al usuario específico
            fromUserId = request.UserId // El usuario que recibe la respuesta
        };

        await _hubContext.Clients.All.SendAsync("DistributeNotification", notificationData);

        await SendUserNotificationAsync(request.UserId, "ReceiveNotification", new
        {
            id = request.Id,
            firstName = request.User?.FirstName,
            lastName = request.User?.LastName,
            from = request.From,
            to = request.To,
            reason = request.Reason,
            hoursUsed = hoursRequested,
            availableHours = newAvailableHours,
            type = "compAccepted",
            acceptedDate = DateTime.Now.ToString("dd/MM/yyyy")
        });

        Console.WriteLine(" Notificación de compensatorio aceptado enviada con distribución automática");
    }

    private List<object> CreateFormattedHistoryList(List<Compensatory> compensatories, bool includeUserInfo)
    {
        var now = DateTime.UtcNow;

        return compensatories.Select(c =>
        {
            var dynamicStatus = CalculateDynamicStatus(c.Status ?? string.Empty, c.From.DateTime, c.To.DateTime);
            var hoursRequested = CalculateHours(c.From.DateTime, c.To.DateTime);

            var baseObject = new
            {
                Id = c.Id,
                Reason = c.Reason,
                From = FormatDateTime(c.From.DateTime),
                To = FormatDateTime(c.To.DateTime),
                Status = c.Status,
                DynamicStatus = dynamicStatus,
                CurrentHour = FormatDateTime(c.CurrentHour),
                HoursRequested = hoursRequested,
                DaysFromRequest = Math.Round((now - c.CurrentHour).TotalDays, 1),
                IsActive = dynamicStatus == "En curso",
                IsPending = c.Status == "Pendiente",
                IsFinished = dynamicStatus == "Finalizado",
                IsExpired = c.Status == "Aceptada" && now >= c.To.DateTime,
                RequestDate = c.CurrentHour.ToString("dd/MM/yyyy"),
                TimeRange = $"{c.From.ToString("dd/MM/yyyy HH:mm")} - {c.To.ToString("dd/MM/yyyy HH:mm")}"
            };

            if (includeUserInfo)
            {
                return new
                {
                    baseObject.Id,
                    FirstName = c.User?.FirstName ?? "N/A",
                    LastName = c.User?.LastName ?? "N/A",
                    baseObject.Reason,
                    baseObject.From,
                    baseObject.To,
                    baseObject.Status,
                    baseObject.DynamicStatus,
                    baseObject.CurrentHour,
                    UserId = c.UserId,
                    baseObject.HoursRequested,
                    UserFullName = $"{c.User?.FirstName ?? "N/A"} {c.User?.LastName ?? "N/A"}",
                    baseObject.DaysFromRequest,
                    baseObject.IsActive,
                    baseObject.IsPending,
                    baseObject.IsExpired
                };
            }

            return (object)baseObject;
        }).ToList();
    }

    private object CalculateStatistics(List<object> formattedHistory)
    {
        return new
        {
            TotalRequests = formattedHistory.Count,
            PendingRequests = formattedHistory.Count(r => GetPropertyValue(r, "Status")?.ToString() == "Pendiente"),
            AcceptedRequests = formattedHistory.Count(r => GetPropertyValue(r, "Status")?.ToString() == "Aceptada"),
            RejectedRequests = formattedHistory.Count(r => GetPropertyValue(r, "Status")?.ToString() == "Rechazada"),
            ActiveRequests = formattedHistory.Count(r => GetPropertyValue(r, "DynamicStatus")?.ToString() == "En curso"),
            FinishedRequests = formattedHistory.Count(r => GetPropertyValue(r, "DynamicStatus")?.ToString() == "Finalizado"),
            TotalHoursRequested = formattedHistory.Sum(r => Convert.ToDouble(GetPropertyValue(r, "HoursRequested") ?? 0)),
            TotalActiveHours = formattedHistory
                .Where(r => GetPropertyValue(r, "DynamicStatus")?.ToString() == "En curso")
                .Sum(r => Convert.ToDouble(GetPropertyValue(r, "HoursRequested") ?? 0))
        };
    }
    private static object? GetPropertyValue(object obj, string propertyName)
    {
        return obj.GetType().GetProperty(propertyName)?.GetValue(obj);
    }

}