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
    public async Task<IActionResult> GetPredictions(
        [FromQuery] string? targetDate = null)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetPredictionsAsync(
                userId,
                targetDate
            );

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


[HttpGet("insights")]
public async Task<IActionResult> GetPredictionInsight(
    [FromQuery] string? targetDate = null)
{
    if (!TryGetUserId(out var userId))
        return Unauthorized();

    var target = GetPhilippineOperationDate();

    if (!string.IsNullOrWhiteSpace(targetDate))
    {
        if (!DateTime.TryParseExact(
            targetDate,
            "yyyy-MM-dd",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None,
            out var parsedDate))
        {
            return BadRequest(new
            {
                message = "targetDate must use yyyy-MM-dd format."
            });
        }

        target = parsedDate.Date;
    }

    var insight = await _context.AiPredictionInsights
        .AsNoTracking()
        .Where(item =>
            item.UserId == userId &&
            item.TargetDate == target)
        .OrderByDescending(item => item.GeneratedAt)
        .Select(item => new
        {
            item.TargetDate,
            item.PredictedWasteKg,
            item.NormalWasteKg,
            item.PredictionChangePercent,
            item.PredictionLevel,
            item.InsightMessage,
            item.SuggestedAction
        })
        .FirstOrDefaultAsync();

    if (insight == null)
    {
        return NotFound(new
        {
            message = "No saved prediction insight exists for this date."
        });
    }

    return Ok(insight);
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
        // Starts today's collection operation and saves its generated route plan.
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var operationDate = GetPhilippineOperationDate();

        var availableVehicleCount = await _context.Vehicles
            .CountAsync(vehicle =>
                vehicle.UserId == userId &&
                vehicle.IsActive &&
                vehicle.Status == "Available");

        if (availableVehicleCount == 0)
        {
            return BadRequest(new
            {
                message = "No available trucks are currently configured. Add or enable at least one available truck before starting an operation."
            });
        }

        var existing = await _context.OperationHistories
            .Where(item =>
                item.UserId == userId &&
                item.OperationDate >= operationDate &&
                item.OperationDate < operationDate.AddDays(1))
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            if (existing.Status == "Completed")
            {
                return Conflict(new
                {
                    message = "Today's operation is already completed."
                });
            }

            if (existing.Status == "Active")
            {
                return Conflict(new
                {
                    message = "An operation is already active for today."
                });
            }
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

        if (operation.Status == "Cancelled")
        {
            return Conflict(new
            {
                message = "This operation is already cancelled."
            });
        }

        operation.Status = "Cancelled";

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Operation cancelled successfully.",
            status = operation.Status
        });
    }

    [HttpPost("routes/operation/cancel-truck")]
    public async Task<IActionResult> CancelTruck(
        [FromBody] JsonElement request)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (
            request.ValueKind != JsonValueKind.Object ||
            !request.TryGetProperty(
                "vehicleId",
                out var vehicleIdElement) ||
            !vehicleIdElement.TryGetInt32(out var vehicleId) ||
            vehicleId <= 0
        )
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
        {
            return NotFound(new
            {
                message = "No operation exists for today."
            });
        }

        if (operation.Status != "Active")
        {
            return Conflict(new
            {
                message = "Only an active operation can cancel a truck."
            });
        }

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
        {
            return BadRequest(new
            {
                message = "No routes were found in the saved operation."
            });
        }

        JsonNode? targetRoute = null;

        foreach (var route in routes)
        {
            if (route == null)
                continue;

            var savedVehicleId =
                route["vehicle_id"]?.ToString() ??
                route["vehicleId"]?.ToString();

            if (
                int.TryParse(
                    savedVehicleId,
                    out var parsedVehicleId) &&
                parsedVehicleId == vehicleId
            )
            {
                targetRoute = route;
                break;
            }
        }

        if (targetRoute == null)
        {
            return NotFound(new
            {
                message =
                    "The specified truck was not found in this operation."
            });
        }

        var currentStatus =
            targetRoute["status"]?.ToString();

        if (
            string.Equals(
                currentStatus,
                "Completed",
                StringComparison.OrdinalIgnoreCase)
        )
        {
            return Conflict(new
            {
                message =
                    "A completed truck route cannot be cancelled."
            });
        }

        if (
            string.Equals(
                currentStatus,
                "Cancelled",
                StringComparison.OrdinalIgnoreCase)
        )
        {
            return Conflict(new
            {
                message =
                    "This truck route is already cancelled."
            });
        }

        targetRoute["status"] = "Cancelled";

        var allRoutesFinished =
            routes.Count > 0 &&
            routes.All(route =>
                route != null &&
                (
                    string.Equals(
                        route["status"]?.ToString(),
                        "Completed",
                        StringComparison.OrdinalIgnoreCase
                    )
                    ||
                    string.Equals(
                        route["status"]?.ToString(),
                        "Cancelled",
                        StringComparison.OrdinalIgnoreCase
                    )
                ));

        operation.Status =
            allRoutesFinished
                ? "Completed"
                : "Active";

        operation.RouteData =
            root!.ToJsonString();

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = allRoutesFinished
                ? "Truck route cancelled. All routes are now completed or cancelled."
                : "Truck route cancelled. The operation is still active.",

            status = operation.Status,

            routeData =
                JsonSerializer.Deserialize<JsonElement>(
                    operation.RouteData)
        });
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

        var allRoutesFinished = routes.Count > 0 &&
        routes.All(route =>
            route != null &&
            (
                string.Equals(
                    route["status"]?.ToString(),
                    "Completed",
                    StringComparison.OrdinalIgnoreCase)
                ||
                string.Equals(
                    route["status"]?.ToString(),
                    "Cancelled",
                    StringComparison.OrdinalIgnoreCase)
            ));

        operation.Status = allRoutesFinished ? "Completed" : "Active";
        operation.RouteData = root!.ToJsonString();

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = allRoutesFinished
                ? "All truck routes are finished. The operation is complete."
                : "Truck route marked as finished.",
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
        return BadRequest(new
        {
            message = "Date must use yyyy-MM-dd format."
        });
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
    {
        return NotFound(new
        {
            message = "No operation exists for this date."
        });
    }

    var ownedAreaIds = await _context.Areas
        .AsNoTracking()
        .Where(area => area.UserId == userId)
        .Select(area => area.AreaId)
        .ToListAsync();

    var hasWasteData = await _context.WasteRecords
        .AsNoTracking()
        .AnyAsync(record =>
            ownedAreaIds.Contains(record.AreaId) &&
            record.CollectionDate >= startDate &&
            record.CollectionDate < endDate);

    return Ok(new
    {
        status = operation.Status,
        hasWasteData
    });
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

        var operationDate = GetPhilippineOperationDate();

        var activeOperation = await _context.OperationHistories
            .FirstOrDefaultAsync(item =>
                item.UserId == userId &&
                item.OperationDate >= operationDate &&
                item.OperationDate < operationDate.AddDays(1) &&
                item.Status == "Active");

        if (activeOperation != null)
        {
            activeOperation.RouteData = routeData.GetRawText();
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Route plan saved successfully.",
            updatedAt = savedPlan.UpdatedAt
        });
    }


private async Task GenerateAndSavePredictionInsightAsync(
    int userId,
    DateTime targetDate)
{
    // Do not call ML again if this date already has a saved insight.
    var existingInsight = await _context.AiPredictionInsights
        .AnyAsync(item =>
            item.UserId == userId &&
            item.TargetDate == targetDate.Date);

    if (existingInsight)
        return;

    var predictions = await _mlService.GetPredictionsAsync(
        userId,
        targetDate.ToString("yyyy-MM-dd"));

    if (!predictions.TryGetProperty("predictions", out var rows) ||
        rows.ValueKind != JsonValueKind.Array)
    {
        throw new InvalidOperationException(
            "The ML service returned an invalid predictions response.");
    }

    decimal predictedWaste = 0;

    foreach (var row in rows.EnumerateArray())
    {
        if (row.TryGetProperty("P50Kg", out var p50) &&
            p50.TryGetDecimal(out var value))
        {
            predictedWaste += value;
        }
    }

    predictedWaste = Math.Round(predictedWaste, 2);

    var today = GetPhilippineOperationDate();

    // Find areas belonging to this user.
    var ownedAreaIds = await _context.Areas
        .Where(area => area.UserId == userId)
        .Select(area => area.AreaId)
        .ToListAsync();

    // Get daily totals from dates before today.
    var dailyTotals = await _context.WasteRecords
        .AsNoTracking()
        .Where(record =>
            ownedAreaIds.Contains(record.AreaId) &&
            record.CollectionDate < today &&
            record.WeightKg >= 0)
        .GroupBy(record => record.CollectionDate.Date)
        .Select(group => new
        {
            Date = group.Key,
            Total = group.Sum(record => record.WeightKg)
        })
        .OrderByDescending(day => day.Date)
        .Take(7)
        .ToListAsync();

    if (dailyTotals.Count == 0)
    {
        throw new InvalidOperationException(
            "There is not enough historical waste data to calculate a baseline.");
    }

    decimal normalWaste = Math.Round(
        dailyTotals.Average(day => day.Total), 2);

    decimal changePercent = normalWaste > 0
        ? Math.Round(
            ((predictedWaste - normalWaste) / normalWaste) * 100, 2)
        : 0;

    string level;
    string message;
    string action;

    if (changePercent >= 20)
    {
        level = "Much higher than normal";
        message = "High waste generation expected";
        action = "Prepare additional collection capacity";
    }
    else if (changePercent >= 5)
    {
        level = "Slightly higher";
        message = "Waste generation expected to increase";
        action = "Prepare for increased waste volume";
    }
    else if (changePercent >= -5)
    {
        level = "Around normal";
        message = "Waste generation expected to remain normal";
        action = "Proceed with the planned collection capacity";
    }
    else
    {
        level = "Lower than normal";
        message = "Waste generation expected to decrease";
        action = "Adjust collection capacity accordingly";
    }

    _context.AiPredictionInsights.Add(new AiPredictionInsight
    {
        UserId = userId,
        GeneratedAt = DateTime.UtcNow,
        TargetDate = targetDate.Date,
        PredictedWasteKg = predictedWaste,
        NormalWasteKg = normalWaste,
        PredictionChangePercent = changePercent,
        PredictionLevel = level,
        InsightMessage = message,
        SuggestedAction = action
    });

    await _context.SaveChangesAsync();
}

}