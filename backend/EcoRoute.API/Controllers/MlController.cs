
using EcoRoute.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using EcoRoute.API.Data;
using EcoRoute.API.Models;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/ml")]
[Authorize]
public class MlController : ControllerBase
{
    private readonly MlService _mlService;
    private readonly EcoRouteDbContext _context;

    public MlController(
        MlService mlService,
        EcoRouteDbContext context)
    {
        _mlService = mlService;
        _context = context;
    }

    private bool TryGetUserId(out int userId)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(userIdValue, out userId);
    }

    [HttpGet("predictions")]
    public async Task<IActionResult> GetPredictions()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetPredictionsAsync(userId);
            return Ok(result);
        }    
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    [HttpGet("routes")]
    public async Task<IActionResult> GetRoutes()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetRoutesAsync(userId);
            return Ok(result);
        }
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    [HttpGet("routes/p90")]
    public async Task<IActionResult> GetP90Routes()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetP90RoutesAsync(userId);
            return Ok(result);
        }
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    [HttpGet("routes/p90/reroute/{vehicleId:int}")]
    public async Task<IActionResult> GetP90Reroute(int vehicleId)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetP90RerouteAsync(
                userId, vehicleId);

            return Ok(result);
        }
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    [HttpGet("routes/p90/saved")]
    public async Task<IActionResult> GetSavedP90Routes()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var savedPlan = await _context.SavedRoutePlans
            .AsNoTracking()
            .FirstOrDefaultAsync(plan => plan.UserId == userId);

        if (savedPlan == null)
            return NotFound(new
            {
                message = "No saved route plan exists for this user."
            });

        return Content(
            savedPlan.RouteData,
            "application/json");
    }

    [HttpGet("routes/history/dates")]
    public async Task<IActionResult> GetOperationHistoryDates()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var dates = await _context.OperationHistories
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .Select(item => item.OperationDate.Date)
            .Distinct()
            .OrderByDescending(date => date)
            .ToListAsync();

        return Ok(dates.Select(date => date.ToString("yyyy-MM-dd")));
    }

    
[HttpGet("routes/history/{date}")]
public async Task<IActionResult> GetOperationHistory(string date)
{
    if (!TryGetUserId(out var userId))
        return Unauthorized();

    if (!DateTime.TryParseExact(
        date,
        "yyyy-MM-dd",
        System.Globalization.CultureInfo.InvariantCulture,
        System.Globalization.DateTimeStyles.None,
        out var parsedDate))
    {
        return BadRequest(new
        {
            message = "Date must use yyyy-MM-dd format."
        });
    }

    var startDate = parsedDate.Date;
    var endDate = startDate.AddDays(1);

    var history = await _context.OperationHistories
        .AsNoTracking()
        .Where(item =>
            item.UserId == userId &&
            item.OperationDate >= startDate &&
            item.OperationDate < endDate)
        .OrderByDescending(item => item.CreatedAt)
        .FirstOrDefaultAsync();

    if (history == null)
    {
        return NotFound(new
        {
            message = "No operation history exists for this date."
        });
    }

    try
    {
        var routeData = JsonNode.Parse(history.RouteData);

        if (routeData is not JsonObject routeObject)
        {
            return StatusCode(500, new
            {
                message = "The saved route data is invalid."
            });
        }

        var today = GetPhilippineOperationDate();

        var displayedStatus = history.Status;

        // A paused operation becomes officially cancelled
        // only when its operation date has passed.
        if (
            history.Status == "Paused" &&
            history.OperationDate.Date < today
        )
        {
            displayedStatus = "Cancelled";
        }

        routeObject["operation_status"] = displayedStatus;

        return Content(
            routeObject.ToJsonString(),
            "application/json");
    }
    catch (JsonException)
    {
        return StatusCode(500, new
        {
            message = "The saved route data is invalid."
        });
    }
}


    private DateTime GetPhilippineOperationDate()
    {
        return DateTime.UtcNow.AddHours(8).Date;
    }

    [HttpPost("routes/operation/start")]
    public async Task<IActionResult> StartOperation()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var operationDate = GetPhilippineOperationDate();

        var existing = await _context.OperationHistories
            .FirstOrDefaultAsync(item =>
                item.UserId == userId &&
                item.OperationDate >= operationDate &&
                item.OperationDate < operationDate.AddDays(1));

        if (existing != null)
        {
            if (existing.Status == "Completed")
            {
                return Conflict(new
                {
                    message = "Today's operation is already completed."
                });
            }

            return Conflict(new
            {
                message = "An operation already exists for today. Resume it instead."
            });
        }

        try
        {
            var result = await _mlService.GetP90RoutesAsync(userId);
            var routeData = JsonSerializer.Serialize(result);

            var history = new OperationHistory
            {
                UserId = userId,
                OperationDate = operationDate,
                RouteData = routeData,
                CreatedAt = DateTime.UtcNow,
                Status = "Active"
            };

            _context.OperationHistories.Add(history);

            var savedPlan = await _context.SavedRoutePlans
                .FirstOrDefaultAsync(plan => plan.UserId == userId);

            if (savedPlan == null)
            {
                _context.SavedRoutePlans.Add(new SavedRoutePlan
                {
                    UserId = userId,
                    RouteData = routeData,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                savedPlan.RouteData = routeData;
                savedPlan.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Content(routeData, "application/json");
        }
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    


[HttpPost("routes/operation/cancel")]
public async Task<IActionResult> CancelOperation()
{
    if (!TryGetUserId(out var userId))
        return Unauthorized();

    var operationDate = GetPhilippineOperationDate();

    var operation = await _context.OperationHistories
        .Where(item =>
            item.UserId == userId &&
            item.OperationDate >= operationDate &&
            item.OperationDate < operationDate.AddDays(1))
        .OrderByDescending(item => item.CreatedAt)
        .FirstOrDefaultAsync();

    if (operation == null)
    {
        return NotFound(new
        {
            message = "No operation exists for today."
        });
    }

    if (operation.Status == "Completed")
    {
        return Conflict(new
        {
            message = "This operation is already completed."
        });
    }

    if (operation.Status == "Paused")
    {
        return Ok(new
        {
            message = "Operation is already paused.",
            status = operation.Status
        });
    }

    operation.Status = "Paused";

    await _context.SaveChangesAsync();

    return Ok(new
    {
        message = "Operation paused. You can resume it today.",
        status = operation.Status
    });
}

    
[HttpPost("routes/operation/resume")]
public async Task<IActionResult> ResumeOperation()
{
    if (!TryGetUserId(out var userId))
        return Unauthorized();

    var operationDate = GetPhilippineOperationDate();

    var operation = await _context.OperationHistories
        .Where(item =>
            item.UserId == userId &&
            item.OperationDate >= operationDate &&
            item.OperationDate < operationDate.AddDays(1))
        .OrderByDescending(item => item.CreatedAt)
        .FirstOrDefaultAsync();

    if (operation == null)
    {
        return NotFound(new
        {
            message = "No operation exists to resume."
        });
    }

    if (operation.Status == "Completed")
    {
        return Conflict(new
        {
            message = "This operation is already completed."
        });
    }

    if (operation.Status != "Paused" &&
        operation.Status != "Cancelled")
    {
        return Conflict(new
        {
            message = "Only a paused or cancelled operation can be resumed."
        });
    }

    operation.Status = "Active";

    await _context.SaveChangesAsync();

    return Content(operation.RouteData, "application/json");
}

    
[HttpPost("routes/operation/finish-truck")]
public async Task<IActionResult> FinishTruck(
    [FromBody] JsonElement request)
{
    if (!TryGetUserId(out var userId))
        return Unauthorized();

    if (request.ValueKind != JsonValueKind.Object ||
        !request.TryGetProperty("vehicleId", out var vehicleIdElement) ||
        !vehicleIdElement.TryGetInt32(out var vehicleId) ||
        vehicleId <= 0)
    {
        return BadRequest(new
        {
            message = "A valid vehicleId is required."
        });
    }

    var operationDate = GetPhilippineOperationDate();

    var operation = await _context.OperationHistories
        .Where(item =>
            item.UserId == userId &&
            item.OperationDate >= operationDate &&
            item.OperationDate < operationDate.AddDays(1))
        .OrderByDescending(item => item.CreatedAt)
        .FirstOrDefaultAsync();

    if (operation == null)
        return NotFound(new
        {
            message = "No operation exists for today."
        });

    if (operation.Status != "Active")
        return Conflict(new
        {
            message = "Only an active operation can finish a truck."
        });

    JsonNode? root;

    try
    {
        root = JsonNode.Parse(operation.RouteData);
    }
    catch (JsonException)
    {
        return StatusCode(500, new
        {
            message = "The saved route data is invalid."
        });
    }

    var routes = root?["routes"]?.AsArray();

    if (routes == null)
        return BadRequest(new
        {
            message = "No routes were found in the saved operation."
        });

    foreach (var route in routes)
{
    if (route == null || route["status"] != null)
        continue;

    var distanceExceeded =
        string.Equals(
            route["distance_exceeded"]?.ToString(),
            "true",
            StringComparison.OrdinalIgnoreCase);

    route["status"] = distanceExceeded ? "Pending" : "Active";
}

    JsonNode? targetRoute = null;

    foreach (var route in routes)
    {
        if (route == null)
            continue;

        var savedVehicleId =
            route["vehicle_id"]?.ToString() ??
            route["vehicleId"]?.ToString();

        if (int.TryParse(savedVehicleId, out var parsedVehicleId) &&
            parsedVehicleId == vehicleId)
        {
            targetRoute = route;
            break;
        }
    }

    if (targetRoute == null)
        return NotFound(new
        {
            message = "The specified truck was not found in this operation."
        });

    if (string.Equals(
        targetRoute["status"]?.ToString(),
        "Completed",
        StringComparison.OrdinalIgnoreCase))
    {
        return Conflict(new
        {
            message = "This truck's route is already completed."
        });
    }

    targetRoute["status"] = "Completed";

    var allRoutesCompleted = routes.Count > 0 &&
        routes.All(route =>
            route != null &&
            string.Equals(
                route["status"]?.ToString(),
                "Completed",
                StringComparison.OrdinalIgnoreCase));

    operation.Status = allRoutesCompleted ? "Completed" : "Active";
    operation.RouteData = root!.ToJsonString();

    await _context.SaveChangesAsync();

    return Ok(new
    {
        message = allRoutesCompleted
            ? "All truck routes are completed. The operation is complete."
            : "Truck route marked as completed.",
        status = operation.Status,
        routeData = JsonSerializer.Deserialize<JsonElement>(
            operation.RouteData)
    });
}


[HttpGet("routes/operation/status/{date}")]
public async Task<IActionResult> GetOperationStatus(string date)
{
    if (!TryGetUserId(out var userId))
        return Unauthorized();

    if (!DateTime.TryParseExact(
        date,
        "yyyy-MM-dd",
        System.Globalization.CultureInfo.InvariantCulture,
        System.Globalization.DateTimeStyles.None,
        out var parsedDate))
    {
        return BadRequest(new { message = "Date must use yyyy-MM-dd format." });
    }

    var startDate = parsedDate.Date;
    var endDate = startDate.AddDays(1);

    var operation = await _context.OperationHistories
        .AsNoTracking()
        .Where(item =>
            item.UserId == userId &&
            item.OperationDate >= startDate &&
            item.OperationDate < endDate)
        .OrderByDescending(item => item.CreatedAt)
        .FirstOrDefaultAsync();

    if (operation == null)
        return NotFound(new { message = "No operation exists for this date." });

    return Ok(new { status = operation.Status });
}

    [HttpPut("routes/p90/save")]
    public async Task<IActionResult> SaveP90Routes(
        [FromBody] JsonElement routeData)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (routeData.ValueKind != JsonValueKind.Object)
        {
            return BadRequest(new
            {
                message = "Invalid route plan data."
            });
        }

        var savedPlan = await _context.SavedRoutePlans
            .FirstOrDefaultAsync(plan => plan.UserId == userId);

        if (savedPlan == null)
        {
            savedPlan = new SavedRoutePlan
            {
                UserId = userId,
                RouteData = routeData.GetRawText(),
                UpdatedAt = DateTime.UtcNow
            };

            _context.SavedRoutePlans.Add(savedPlan);
        }
        else
        {
            savedPlan.RouteData = routeData.GetRawText();
            savedPlan.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Route plan saved successfully.",
            updatedAt = savedPlan.UpdatedAt
        });
    }
}