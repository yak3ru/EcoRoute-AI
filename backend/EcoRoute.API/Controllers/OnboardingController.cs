
using System.Security.Claims;
using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EcoRoute.API.Models;
using EcoRoute.API.Services;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OnboardingController : ControllerBase
{
    private readonly EcoRouteDbContext _context;
    private readonly MlService _mlService;

    public OnboardingController(
        EcoRouteDbContext context,
        MlService mlService)
    {
        _context = context;
        _mlService = mlService;
    }

    // GET: api/Onboarding/status
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid authenticated user."
            });
        }

        var user = await _context.Users
            .AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => new
            {
                u.IsOnboardingComplete
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "User account not found."
            });
        }

        return Ok(user);
    }

    // POST: api/Onboarding/complete
    [HttpPost("complete")]
    public async Task<IActionResult> Complete()
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid authenticated user."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "User account not found."
            });
        }

        user.IsOnboardingComplete = true;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Onboarding completed successfully.",
            isOnboardingComplete = user.IsOnboardingComplete
        });
    }


    // POST: api/Onboarding/finalize
    [HttpPost("finalize")]
    public async Task<IActionResult> Finalize(
        [FromBody] FinalizeOnboardingRequest request)
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid authenticated user."
            });
        }

        if (request == null)
        {
            return BadRequest(new
            {
                message = "Onboarding data is required."
            });
        }

        var areas = request.Areas ?? new List<OnboardingAreaRequest>();
        var wasteRecords = request.WasteRecords ?? new List<OnboardingWasteRequest>();
        var trucks = request.Trucks ?? new List<OnboardingTruckRequest>();

        // The current onboarding UI requires at least one truck.
        if (trucks.Count == 0)
        {
            return BadRequest(new
            {
                message = "Please add at least one truck before finishing setup."
            });
        }

        // Validate areas.
        foreach (var area in areas)
        {
            if (string.IsNullOrWhiteSpace(area.AreaName) ||
                area.AreaName.Trim().Length > 100)
            {
                return BadRequest(new
                {
                    message = "Every area must have a name of 1–100 characters."
                });
            }

            if (area.PopulationDensity < 0)
            {
                return BadRequest(new
                {
                    message = $"Population density cannot be negative for {area.AreaName}."
                });
            }

            if (area.Latitude < -90 || area.Latitude > 90 ||
                area.Longitude < -180 || area.Longitude > 180)
            {
                return BadRequest(new
                {
                    message = $"Invalid coordinates for {area.AreaName}."
                });
            }
        }

        var duplicateAreaName = areas
            .GroupBy(a => a.AreaName.Trim(),
                StringComparer.OrdinalIgnoreCase)
            .Any(g => g.Count() > 1);

        if (duplicateAreaName)
        {
            return BadRequest(new
            {
                message = "The areas CSV contains duplicate area names."
            });
        }

        // Validate historical waste records.
        foreach (var record in wasteRecords)
        {
            if (string.IsNullOrWhiteSpace(record.AreaName))
            {
                return BadRequest(new
                {
                    message = "Every historical waste record must specify an area."
                });
            }

            
var philippinesTimeZone =
    TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

var todayInPhilippines =
    TimeZoneInfo.ConvertTime(
        DateTimeOffset.UtcNow,
        philippinesTimeZone
    ).Date;

if (record.CollectionDate == default ||
    record.CollectionDate.Date >= todayInPhilippines)
{
    return BadRequest(new
    {
        message = $"Collection date for area '{record.AreaName}' must be earlier than today."
    });
}

if (record.WeightKg <= 0)
{
    return BadRequest(new
    {
        message = $"Waste weight must be greater than zero for area '{record.AreaName}'."
    });
}

if (!new[] { "Biodegradable", "Non-biodegradable" }
    .Contains(record.WasteType?.Trim(),
        StringComparer.OrdinalIgnoreCase))
{
    return BadRequest(new
    {
        message = "Waste type must be Biodegradable or Non-biodegradable."
    });
}

if (!new[] { "Completed", "Failed" }
    .Contains(record.Status?.Trim(),
        StringComparer.OrdinalIgnoreCase))
{
    return BadRequest(new
    {
        message = "Status must be Completed or Failed."
    });
}

        }

var duplicateWasteRecord = wasteRecords
    .GroupBy(record =>
        $"{record.AreaName.Trim()}|" +
        $"{record.CollectionDate.Date:yyyy-MM-dd}|" +
        $"{record.WasteType.Trim()}",
        StringComparer.OrdinalIgnoreCase)
    .Any(group => group.Count() > 1);

if (duplicateWasteRecord)
{
    return BadRequest(new
    {
        message = "The historical waste CSV contains duplicate records for the same area, date, and waste type."
    });
}

        if (wasteRecords.Count > 0 && areas.Count == 0)
        {
            return BadRequest(new
            {
                message = "Import areas before importing historical waste records."
            });
        }

        // Every waste record must reference an area in this submission.
        var submittedAreaNames = new HashSet<string>(
            areas.Select(a => a.AreaName.Trim()),
            StringComparer.OrdinalIgnoreCase);

        var unmatchedWasteArea = wasteRecords.FirstOrDefault(
            w => !submittedAreaNames.Contains(w.AreaName.Trim()));

        if (unmatchedWasteArea != null)
        {
            return BadRequest(new
            {
                message = $"Waste record area '{unmatchedWasteArea.AreaName}' was not found in the submitted areas."
            });
        }

        // Validate trucks.
        foreach (var truck in trucks)
        {
            if (string.IsNullOrWhiteSpace(truck.VehicleName) ||
                truck.VehicleName.Trim().Length > 100)
            {
                return BadRequest(new
                {
                    message = "Every truck must have a name of 1–100 characters."
                });
            }

            if (truck.CapacityKg <= 0 ||
                truck.MaximumRouteDistanceKm <= 0)
            {
                return BadRequest(new
                {
                    message = $"Capacity and maximum route distance must be greater than zero for {truck.VehicleName}."
                });
            }

            if (truck.CollectionStartTime < TimeSpan.Zero ||
                truck.CollectionStartTime >= TimeSpan.FromDays(1) ||
                truck.CollectionEndTime < TimeSpan.Zero ||
                truck.CollectionEndTime >= TimeSpan.FromDays(1) ||
                truck.CollectionStartTime >= truck.CollectionEndTime)
            {
                return BadRequest(new
                {
                    message = $"Invalid collection time range for {truck.VehicleName}."
                });
            }
        }

        var duplicateTruckName = trucks
            .GroupBy(t => t.VehicleName.Trim(),
                StringComparer.OrdinalIgnoreCase)
            .Any(g => g.Count() > 1);

        if (duplicateTruckName)
        {
            return BadRequest(new
            {
                message = "Truck names must be unique."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "User account not found."
            });
        }

        // Do not silently create duplicate areas or trucks.
        var existingAreaNames = await _context.Areas
            .Where(a => a.UserId == userId)
            .Select(a => a.AreaName)
            .ToListAsync();

        if (areas.Any(a => existingAreaNames.Contains(
            a.AreaName.Trim(), StringComparer.OrdinalIgnoreCase)))
        {
            return Conflict(new
            {
                message = "One or more area names already exist in your account."
            });
        }

        var existingTruckNames = await _context.Vehicles
            .Where(v => v.UserId == userId && v.IsActive)
            .Select(v => v.VehicleName)
            .ToListAsync();

        if (trucks.Any(t => existingTruckNames.Contains(
            t.VehicleName.Trim(), StringComparer.OrdinalIgnoreCase)))
        {
            return Conflict(new
            {
                message = "One or more truck names already exist in your account."
            });
        }

        // All onboarding inserts and the completion flag succeed or fail together.
        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            var now = DateTime.UtcNow;

            var areaEntities = areas.Select(area => new Area
            {
                UserId = userId,
                AreaName = area.AreaName.Trim(),
                PopulationDensity = area.PopulationDensity,
                Latitude = area.Latitude,
                Longitude = area.Longitude,
                ActivityLevel = null,
                CollectionFrequency = null,
                IsActive = true,
                CreatedAt = now
            }).ToList();

            if (areaEntities.Count > 0)
            {
                _context.Areas.AddRange(areaEntities);
                await _context.SaveChangesAsync();
            }

            var areaIdsByName = areaEntities.ToDictionary(
                a => a.AreaName,
                a => a.AreaId,
                StringComparer.OrdinalIgnoreCase);

            if (wasteRecords.Count > 0)
            {
                var wasteEntities = wasteRecords.Select(record =>
                    new WasteRecord
                    {
                        AreaId = areaIdsByName[record.AreaName.Trim()],
                        CollectionDate = record.CollectionDate.Date,
                        WasteType = record.WasteType.Trim()
                            .Equals("Biodegradable",
                                StringComparison.OrdinalIgnoreCase)
                            ? "Biodegradable"
                            : "Non-biodegradable",
                        WeightKg = record.WeightKg,
                        Status = record.Status.Trim().Equals(
                            "Completed",
                            StringComparison.OrdinalIgnoreCase)
                                ? "Completed"
                                : "Failed",
                        CreatedAt = now
                    }).ToList();

                _context.WasteRecords.AddRange(wasteEntities);
                await _context.SaveChangesAsync();
            }

            foreach (var truck in trucks)
            {
                var vehicle = new Vehicle
                {
                    UserId = userId,
                    VehicleName = truck.VehicleName.Trim(),
                    CapacityKg = truck.CapacityKg,
                    Status = "Available",
                    IsActive = true,
                    CreatedAt = now
                };

                _context.Vehicles.Add(vehicle);
                await _context.SaveChangesAsync();

                var constraint = new RoutingConstraint
                {
                    VehicleId = vehicle.VehicleId,
                    VehicleCapacityKg = truck.CapacityKg,
                    MaximumRouteDistanceKm =
                        truck.MaximumRouteDistanceKm,
                    CollectionStartTime = truck.CollectionStartTime,
                    CollectionEndTime = truck.CollectionEndTime,
                    RoadAccessibility = null,
                    AreaRestrictions = null,
                    CreatedAt = now
                };

                _context.RoutingConstraints.Add(constraint);
                await _context.SaveChangesAsync();
            }

            // Import rows first. The Python ML service uses its own DB connection,
            // so it must run only after this transaction commits. Do not mark
            // onboarding complete until distance and prediction processing succeeds.
            user.IsOnboardingComplete = false;
            user.UpdatedAt = now;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            try
            {
                await ProcessImportedDataAsync(userId);
                user.IsOnboardingComplete = true;
                user.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Import completed. Distance data and waste predictions are ready.",
                    isOnboardingComplete = true,
                    processingComplete = true,
                    importedAreas = areaEntities.Count,
                    importedWasteRecords = wasteRecords.Count,
                    importedTrucks = trucks.Count
                });
            }
            catch (Exception)
            {
                // Data is already committed. The client must use /process to retry;
                // it must not submit the same imports a second time.
                return StatusCode(503, new
                {
                    message = "Your data was imported, but distance preparation or prediction generation did not finish. Retry processing; do not upload the same files again.",
                    dataSaved = true,
                    processingComplete = false,
                    isOnboardingComplete = false
                });
            }
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();

            // Log the actual exception server-side if logging is configured.
            return StatusCode(500, new
            {
                message = "Unable to save onboarding data. No onboarding changes were committed."
            });
        }
    }


    // POST: api/Onboarding/process
    // Retry processing after import data has already been committed.
    [HttpPost("process")]
    public async Task<IActionResult> ProcessImportedData()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Invalid authenticated user." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
        if (user == null)
        {
            return Unauthorized(new { message = "User account not found." });
        }

        var hasAreas = await _context.Areas.AnyAsync(a => a.UserId == userId && a.IsActive);
        var hasWaste = await _context.WasteRecords
            .AnyAsync(w => _context.Areas.Any(a => a.AreaId == w.AreaId && a.UserId == userId));
        if (!hasAreas || !hasWaste)
        {
            return Conflict(new
            {
                message = "Import collection areas and historical waste records before processing.",
                dataSaved = false,
                processingComplete = false
            });
        }

        try
        {
            await ProcessImportedDataAsync(userId);
            user.IsOnboardingComplete = true;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Distance data and waste predictions are ready.",
                dataSaved = true,
                processingComplete = true,
                isOnboardingComplete = true
            });
        }
        catch (Exception)
        {
            user.IsOnboardingComplete = false;
            user.UpdatedAt = DateTime.UtcNow;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception saveException)
            {
                // Processing is already reported as failed; leave the DB error to server logs.
                // Avoid exposing database details to the client.
            }
            return StatusCode(503, new
            {
                message = "Processing is still unavailable. Your imported data is safe; please retry.",
                dataSaved = true,
                processingComplete = false,
                isOnboardingComplete = false
            });
        }
    }

    private async Task ProcessImportedDataAsync(int userId)
    {
        // Facility 1 is the configured default disposal destination in this prototype.
        await _mlService.RebuildDistanceMatrixAsync(userId, facilityId: 1);

        var predictionResult = await _mlService.GetPredictionsAsync(userId);
        if (!predictionResult.TryGetProperty("status", out var status) ||
            !string.Equals(status.GetString(), "success", StringComparison.OrdinalIgnoreCase) ||
            !predictionResult.TryGetProperty("predictions", out var predictions) ||
            predictions.ValueKind != System.Text.Json.JsonValueKind.Array ||
            predictions.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("The prediction service did not return usable predictions.");
        }
    }
}


public class FinalizeOnboardingRequest
{
    public List<OnboardingAreaRequest> Areas { get; set; } = new();
    public List<OnboardingWasteRequest> WasteRecords { get; set; } = new();
    public List<OnboardingTruckRequest> Trucks { get; set; } = new();
}

public class OnboardingAreaRequest
{
    public string AreaName { get; set; } = string.Empty;
    public decimal PopulationDensity { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
}

public class OnboardingWasteRequest
{
    public string AreaName { get; set; } = string.Empty;
    public DateTime CollectionDate { get; set; }
    public string WasteType { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class OnboardingTruckRequest
{
    public string VehicleName { get; set; } = string.Empty;
    public decimal CapacityKg { get; set; }
    public decimal MaximumRouteDistanceKm { get; set; }
    public TimeSpan CollectionStartTime { get; set; }
    public TimeSpan CollectionEndTime { get; set; }
}
