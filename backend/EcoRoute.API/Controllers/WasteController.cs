using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using EcoRoute.API.Models;
using EcoRoute.API.Services;

namespace EcoRoute.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class WasteController : ControllerBase
{
    private readonly EcoRouteDbContext _context;
    private readonly PredictionInsightService _predictionInsightService;

    public WasteController(
        EcoRouteDbContext context,
        PredictionInsightService predictionInsightService)
    {
        _context = context;
        _predictionInsightService = predictionInsightService;
    }

    [HttpGet]
    public async Task<IActionResult> GetWaste(
        [FromQuery] int? areaId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? wasteType,
        [FromQuery] string? status)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        var query = _context.WasteRecords
            .AsNoTracking()
            .Include(w => w.Area)
            .Where(w =>
                w.Area != null &&
                w.Area.UserId == userId &&
                (
                    w.Status == "Completed" ||
                    w.Status == "Failed" ||
                    w.Status == "Cancelled"
                ))
            .AsQueryable();

        if (areaId.HasValue)
            query = query.Where(w => w.AreaId == areaId.Value);

        if (startDate.HasValue)
            query = query.Where(w => w.CollectionDate >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(w => w.CollectionDate <= endDate.Value);

        if (!string.IsNullOrWhiteSpace(wasteType))
            query = query.Where(w => w.WasteType == wasteType);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(w => w.Status == status);

        var records = await query
            .OrderByDescending(w => w.CollectionDate)
            .ThenBy(w => w.AreaId)
            .Select(w => new
            {
                w.WasteRecordId,
                w.AreaId,
                AreaName = w.Area!.AreaName,
                w.CollectionDate,
                w.WasteType,
                w.WeightKg,
                w.Status
            })
            .ToListAsync();

        return Ok(records);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetWasteRecord(int id)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        var record = await _context.WasteRecords
            .AsNoTracking()
            .Include(w => w.Area)
            .Where(w =>
                w.WasteRecordId == id &&
                w.Area != null &&
                w.Area.UserId == userId)
            .Select(w => new
            {
                w.WasteRecordId,
                w.AreaId,
                AreaName = w.Area!.AreaName,
                w.CollectionDate,
                w.WasteType,
                w.WeightKg,
                w.Status
            })
            .FirstOrDefaultAsync();

        if (record == null)
            return NotFound();

        return Ok(record);
    }

    [HttpGet("report-upload-status")]
    public async Task<IActionResult> GetReportUploadStatus(
        [FromQuery] DateTime operationDate)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        if (operationDate == default)
        {
            return BadRequest(new
            {
                message = "A valid operation date is required."
            });
        }

        var date = operationDate.Date;

        var uploaded = await _context.OperationReportUploads
            .AsNoTracking()
            .AnyAsync(r =>
                r.UserId == userId &&
                r.OperationDate == date);

        return Ok(new
        {
            operationDate = date.ToString("yyyy-MM-dd"),
            uploaded
        });
    }

    [HttpPost("import")]
    public async Task<IActionResult> ImportWasteRecords(
        [FromBody] List<WasteRecordImportDto> records,
        [FromQuery] DateTime operationDate)
    {
        // Imports and validates waste records for a completed collection operation.
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        if (operationDate == default)
        {
            return BadRequest(new
            {
                message = "A valid operation date is required."
            });
        }

        var operationDay = operationDate.Date;

        if (records == null || records.Count == 0)
        {
            return BadRequest(new
            {
                message = "No waste records were provided."
            });
        }

        if (records.Count > 10000)
        {
            return BadRequest(new
            {
                message = "Maximum of 10,000 records per import."
            });
        }

        // ------------------------------------------------------------
        // GET TODAY'S OPERATION
        // ------------------------------------------------------------

        var operation = await _context.OperationHistories
            .Where(item =>
                item.UserId == userId &&
                item.OperationDate >= operationDay &&
                item.OperationDate < operationDay.AddDays(1))
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync();

        if (operation == null)
        {
            return BadRequest(new
            {
                message =
                    "No operation exists for the selected operation date."
            });
        }

        // The operation must be completely finished
        if (!string.Equals(
            operation.Status,
            "Completed",
            StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new
            {
                message =
                    "The operation must be completed before uploading a report."
            });
        }

        // ------------------------------------------------------------
        // PREVENT DUPLICATE REPORT UPLOAD
        // ------------------------------------------------------------

        var alreadyUploaded = await _context.OperationReportUploads
            .AnyAsync(r =>
                r.UserId == userId &&
                r.OperationDate == operationDay);

        if (alreadyUploaded)
        {
            return Conflict(new
            {
                message =
                    "A report has already been uploaded for this operation date."
            });
        }

        // ------------------------------------------------------------
        // READ OPERATION ROUTES
        // ------------------------------------------------------------

        JsonNode? root;

        try
        {
            root = JsonNode.Parse(operation.RouteData);
        }
        catch (JsonException)
        {
            return StatusCode(500, new
            {
                message =
                    "The saved operation route data is invalid."
            });
        }

        var routes = root?["routes"]?.AsArray();

        if (routes == null || routes.Count == 0)
        {
            return BadRequest(new
            {
                message =
                    "No routes were found for this operation."
            });
        }

        var cancelledAreaIds = new HashSet<int>();
        var operationAreaIds = new HashSet<int>();

        foreach (var route in routes)
        {
            if (route == null)
                continue;

            var routeStatus =
                route["status"]?.ToString();

            var areas = route["areas"]?.AsArray();

            if (areas == null)
                continue;

            foreach (var area in areas)
            {
                if (area == null)
                    continue;

                var areaIdText =
                    area["area_id"]?.ToString() ??
                    area["areaId"]?.ToString();

                if (
                    !int.TryParse(
                        areaIdText,
                        out var areaId) ||
                    areaId <= 0
                )
                {
                    continue;
                }

                // Every area in this operation
                operationAreaIds.Add(areaId);

                // Areas belonging to cancelled trucks
                if (string.Equals(
                    routeStatus,
                    "Cancelled",
                    StringComparison.OrdinalIgnoreCase))
                {
                    cancelledAreaIds.Add(areaId);
                }
            }
        }

        // ------------------------------------------------------------
        // VALID CSV VALUES
        // ------------------------------------------------------------

        var validWasteTypes = new[]
        {
            "Biodegradable",
            "Non-biodegradable"
        };

        var validStatuses = new[]
        {
            "Completed",
            "Failed"
        };

        // ------------------------------------------------------------
        // VALIDATE EVERY CSV ROW
        // ------------------------------------------------------------

        for (int i = 0; i < records.Count; i++)
        {
            var record = records[i];
            var rowNumber = i + 2;

            if (record.AreaId <= 0)
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: Invalid AreaId."
                });
            }

            if (record.CollectionDate == default)
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: Invalid CollectionDate."
                });
            }

            // CSV date must match operation date
            if (record.CollectionDate.Date != operationDay)
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: Collection date " +
                        $"{record.CollectionDate:yyyy-MM-dd} " +
                        $"does not match the operation date " +
                        $"{operationDay:yyyy-MM-dd}."
                });
            }

            // IMPORTANT:
            // DO NOT FILTER THIS ROW OUT.
            // REJECT THE ENTIRE CSV.
            if (cancelledAreaIds.Contains(record.AreaId))
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: AreaId {record.AreaId} " +
                        "belongs to a cancelled truck route. " +
                        "Remove this record from the CSV before uploading."
                });
            }

            if (!operationAreaIds.Contains(record.AreaId))
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: AreaId {record.AreaId} " +
                        "does not belong to this operation."
                });
            }

            if (
                string.IsNullOrWhiteSpace(record.WasteType) ||
                !validWasteTypes.Contains(
                    record.WasteType.Trim(),
                    StringComparer.OrdinalIgnoreCase)
            )
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: Invalid WasteType."
                });
            }

            if (
                record.WeightKg < 0 ||
                record.WeightKg > 99999999.99m
            )
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: Invalid WeightKg."
                });
            }

            if (
                string.IsNullOrWhiteSpace(record.Status) ||
                !validStatuses.Contains(
                    record.Status.Trim(),
                    StringComparer.OrdinalIgnoreCase)
            )
            {
                return BadRequest(new
                {
                    message =
                        $"Row {rowNumber}: Invalid Status."
                });
            }
        }

        // ------------------------------------------------------------
        // CHECK THAT CSV AREAS BELONG TO USER
        // ------------------------------------------------------------

        var requestedAreaIds = records
            .Select(r => r.AreaId)
            .Distinct()
            .ToList();

        var ownedAreaIds = await _context.Areas
            .Where(a =>
                a.UserId == userId &&
                requestedAreaIds.Contains(a.AreaId))
            .Select(a => a.AreaId)
            .ToListAsync();

        var invalidAreaIds = requestedAreaIds
            .Except(ownedAreaIds)
            .ToList();

        if (invalidAreaIds.Count > 0)
        {
            return BadRequest(new
            {
                message =
                    "One or more AreaIds do not exist or do not belong to your account.",
                areaIds = invalidAreaIds
            });
        }

        // ------------------------------------------------------------
        // CREATE REAL CSV RECORDS
        // ------------------------------------------------------------

        var wasteRecords = records
            .Select(r => new WasteRecord
            {
                AreaId = r.AreaId,
                CollectionDate = operationDay,
                WasteType = r.WasteType.Trim(),
                WeightKg = r.WeightKg,
                Status = r.Status.Trim(),
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        // ------------------------------------------------------------
        // CREATE 0 KG RECORDS FOR CANCELLED AREAS
        // ------------------------------------------------------------

        var cancelledWasteRecords =
            new List<WasteRecord>();

        if (cancelledAreaIds.Count > 0)
        {
            var cancelledAreas = await _context.Areas
                .Where(a =>
                    a.UserId == userId &&
                    cancelledAreaIds.Contains(a.AreaId))
                .Select(a => a.AreaId)
                .ToListAsync();

            foreach (var areaId in cancelledAreas)
            {
                cancelledWasteRecords.Add(
                    new WasteRecord
                    {
                        AreaId = areaId,
                        CollectionDate = operationDay,
                        WasteType = "Biodegradable",
                        WeightKg = 0,
                        Status = "Cancelled",
                        CreatedAt = DateTime.UtcNow
                    });

                cancelledWasteRecords.Add(
                    new WasteRecord
                    {
                        AreaId = areaId,
                        CollectionDate = operationDay,
                        WasteType = "Non-biodegradable",
                        WeightKg = 0,
                        Status = "Cancelled",
                        CreatedAt = DateTime.UtcNow
                    });
            }
        }

        // ------------------------------------------------------------
        // SAVE EVERYTHING AS ONE TRANSACTION
        // ------------------------------------------------------------

        using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            // 1. Save actual CSV records FIRST
            _context.WasteRecords.AddRange(wasteRecords);

            await _context.SaveChangesAsync();

            // 2. Save cancelled areas SECOND
            if (cancelledWasteRecords.Count > 0)
            {
                _context.WasteRecords.AddRange(
                    cancelledWasteRecords);

                await _context.SaveChangesAsync();
            }

            // 3. Mark report as uploaded
            _context.OperationReportUploads.Add(
                new OperationReportUpload
                {
                    UserId = userId,
                    OperationDate = operationDay,
                    UploadedAt = DateTime.UtcNow
                });

            await _context.SaveChangesAsync();

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();

            return StatusCode(500, new
            {
                message =
                    "The report could not be saved. No waste records were imported."
            });
        }

        Console.WriteLine(
    $"CSV committed. Generating insight for user {userId}, target date {operationDay.AddDays(1):yyyy-MM-dd}");

        try
        {
            var targetDate = operationDay.AddDays(1);

            await _predictionInsightService.GenerateAndSavePredictionInsightAsync(
                userId,
                targetDate);
        }
        catch (Exception ex)
        {
            // The CSV upload has already committed.
            // Log the error without failing the successful upload.
            Console.WriteLine(
                $"Prediction insight generation failed for user {userId}: {ex.Message}");
        }

        return Ok(new
        {
            message =
                "Waste records imported successfully.",

            importedCount =
                wasteRecords.Count +
                cancelledWasteRecords.Count,

            csvRecordsImported =
                wasteRecords.Count,

            cancelledRecordsCreated =
                cancelledWasteRecords.Count
        });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetWasteSummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        // Get ALL completed records for comparison purposes.
        var query = _context.WasteRecords
            .AsNoTracking()
            .Include(w => w.Area)
            .Where(w =>
                w.Area != null &&
                w.Area.UserId == userId &&
                w.Status == "Completed")
            .AsQueryable();

        var records = await query
            .Select(w => new
            {
                w.AreaId,
                AreaName = w.Area!.AreaName,
                w.CollectionDate,
                w.WeightKg
            })
            .ToListAsync();

        // Filter records for the selected date range.
        var selectedRecords = records.AsEnumerable();

        if (startDate.HasValue)
        {
            selectedRecords = selectedRecords.Where(w =>
                w.CollectionDate.Date >= startDate.Value.Date);
        }

        if (endDate.HasValue)
        {
            selectedRecords = selectedRecords.Where(w =>
                w.CollectionDate.Date <= endDate.Value.Date);
        }

        var selectedRecordsList = selectedRecords.ToList();

        var totalWaste = selectedRecordsList
            .Sum(w => w.WeightKg);

        // Compare the latest 7 days against the previous 7 days.
        var totalWasteChangePercent = 0m;
        var averageDailyWasteChangePercent = 0m;

        if (startDate.HasValue && endDate.HasValue)
        {
            var currentStart = startDate.Value.Date;
            var currentEnd = endDate.Value.Date;

            var periodDays =
                (currentEnd - currentStart).Days + 1;

            var previousEnd = currentStart.AddDays(-1);

            var previousStart =
                previousEnd.AddDays(-(periodDays - 1));

            var currentPeriodWaste = records
                .Where(w =>
                    w.CollectionDate.Date >= currentStart &&
                    w.CollectionDate.Date <= currentEnd)
                .Sum(w => w.WeightKg);

            var previousPeriodWaste = records
                .Where(w =>
                    w.CollectionDate.Date >= previousStart &&
                    w.CollectionDate.Date <= previousEnd)
                .Sum(w => w.WeightKg);

            if (previousPeriodWaste > 0)
            {
                totalWasteChangePercent =
                    ((currentPeriodWaste - previousPeriodWaste)
                    / previousPeriodWaste) * 100;

                var currentAverageDailyWaste =
                    currentPeriodWaste / periodDays;

                var previousAverageDailyWaste =
                    previousPeriodWaste / periodDays;

                averageDailyWasteChangePercent =
                    ((currentAverageDailyWaste -
                     previousAverageDailyWaste)
                    / previousAverageDailyWaste) * 100;
            }
        }

        if (records.Count > 0)
        {
            var latestDate = records
                .Max(w => w.CollectionDate)
                .Date;

            // Determine the selected period length
            var periodDays = 30;

            if (startDate.HasValue && endDate.HasValue)
            {
                periodDays =
                    Math.Max(
                        1,
                        (endDate.Value.Date -
                         startDate.Value.Date).Days + 1
                    );
            }

            // Current period
            var currentPeriodEnd = latestDate;

            var currentPeriodStart =
                latestDate.AddDays(-(periodDays - 1));

            // Previous period
            var previousPeriodEnd =
                currentPeriodStart.AddDays(-1);

            var previousPeriodStart =
                previousPeriodEnd.AddDays(-(periodDays - 1));

            var currentPeriodWaste = records
                .Where(w =>
                    w.CollectionDate.Date >= currentPeriodStart &&
                    w.CollectionDate.Date <= currentPeriodEnd)
                .Sum(w => w.WeightKg);

            var previousPeriodWaste = records
                .Where(w =>
                    w.CollectionDate.Date >= previousPeriodStart &&
                    w.CollectionDate.Date <= previousPeriodEnd)
                .Sum(w => w.WeightKg);

            if (previousPeriodWaste > 0)
            {
                totalWasteChangePercent =
                    ((currentPeriodWaste - previousPeriodWaste)
                    / previousPeriodWaste) * 100;

                var currentAverageDailyWaste =
                    currentPeriodWaste / periodDays;

                var previousAverageDailyWaste =
                    previousPeriodWaste / periodDays;

                averageDailyWasteChangePercent =
                    ((currentAverageDailyWaste -
                     previousAverageDailyWaste)
                    / previousAverageDailyWaste) * 100;
            }
        }

        // Calculate average based on selected date range.
        var numberOfDays = 1;

        if (startDate.HasValue && endDate.HasValue)
        {
            numberOfDays =
                Math.Max(
                    1,
                    (endDate.Value.Date -
                     startDate.Value.Date).Days + 1
                );
        }
        else if (selectedRecordsList.Count > 0)
        {
            var firstDate = selectedRecordsList
                .Min(w => w.CollectionDate)
                .Date;

            var lastDate = selectedRecordsList
                .Max(w => w.CollectionDate)
                .Date;

            numberOfDays =
                Math.Max(
                    1,
                    (lastDate - firstDate).Days + 1
                );
        }

        var averageDailyWaste =
            totalWaste / numberOfDays;

        // Find highest waste area within the selected range.
        var highestWasteArea = selectedRecordsList
            .GroupBy(w => new
            {
                w.AreaId,
                w.AreaName
            })
            .Select(g => new
            {
                areaId = g.Key.AreaId,
                areaName = g.Key.AreaName,
                totalWaste = g.Sum(w => w.WeightKg)
            })
            .OrderByDescending(x => x.totalWaste)
            .FirstOrDefault();

        var collectionAreas = await _context.Areas
            .CountAsync(a =>
                a.UserId == userId &&
                a.IsActive);

        return Ok(new
        {
            totalWasteCollected = totalWaste,
            averageDailyWaste,
            totalWasteChangePercent,
            averageDailyWasteChangePercent,
            highestWasteArea = highestWasteArea?.areaName,
            highestWasteAreaWeight =
                highestWasteArea?.totalWaste ?? 0,
            collectionAreas
        });
    }

    [HttpGet("area-summary")]
    public async Task<IActionResult> GetAreaWasteSummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] bool allTime = false)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        // Temporary default:
        // Last 30 days based on today.
        var end = endDate?.Date ?? DateTime.Today;
        var start = startDate?.Date ?? end.AddDays(-29);

        var areaSummary = await _context.WasteRecords
            .AsNoTracking()
            .Include(w => w.Area)
            .Where(w =>
                w.Area != null &&
                w.Area.UserId == userId &&
                w.Status == "Completed" &&
                (allTime ||
                (w.CollectionDate.Date >= start &&
                 w.CollectionDate.Date <= end)))
            .GroupBy(w => new
            {
                w.AreaId,
                AreaName = w.Area!.AreaName
            })
            .Select(g => new
            {
                areaId = g.Key.AreaId,
                areaName = g.Key.AreaName,
                totalWaste = g.Sum(w => w.WeightKg)
            })
            .OrderByDescending(x => x.totalWaste)
            .ToListAsync();

        return Ok(areaSummary);
    }

    [HttpGet("area-parameters")]
    public async Task<IActionResult> GetAreaParameters(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        // Default to the last 30 days
        var end = endDate?.Date ?? DateTime.Today;
        var start = startDate?.Date ?? end.AddDays(-29);

        // Get all active areas belonging to the user
        var areas = await _context.Areas
            .AsNoTracking()
            .Where(a =>
                a.UserId == userId &&
                a.IsActive)
            .Select(a => new
            {
                a.AreaId,
                a.AreaName,
                a.PopulationDensity
            })
            .ToListAsync();

        // Get completed waste collected during the selected period
        var wasteByArea = await _context.WasteRecords
            .AsNoTracking()
            .Where(w =>
                w.Area != null &&
                w.Area.UserId == userId &&
                w.Status == "Completed" &&
                w.CollectionDate.Date >= start &&
                w.CollectionDate.Date <= end)
            .GroupBy(w => w.AreaId)
            .Select(g => new
            {
                AreaId = g.Key,
                TotalWaste = g.Sum(w => w.WeightKg)
            })
            .ToListAsync();

        var results = areas
            .Select(area =>
            {
                var totalWaste = wasteByArea
                    .FirstOrDefault(w =>
                        w.AreaId == area.AreaId)
                    ?.TotalWaste ?? 0;

                return new
                {
                    area.AreaId,
                    area.AreaName,
                    area.PopulationDensity,
                    TotalWaste = totalWaste,
                    AverageDailyWaste =
                        totalWaste / 30m
                };
            })
            .OrderByDescending(x => x.AverageDailyWaste)
            .ToList();

        // Determine activity based on ranking
        var count = results.Count;

        for (int i = 0; i < count; i++)
        {
            var activity = i < Math.Ceiling(count * 0.3)
                ? "High"
                : i < Math.Ceiling(count * 0.7)
                    ? "Medium"
                    : "Low";

            results[i] = new
            {
                results[i].AreaId,
                results[i].AreaName,
                results[i].PopulationDensity,
                results[i].TotalWaste,
                results[i].AverageDailyWaste
            };
        }

        var areaParameters = results
            .Select((area, index) =>
            {
                var density =
                    area.PopulationDensity >= 6000
                        ? "High"
                        : area.PopulationDensity >= 4000
                            ? "Medium"
                            : "Low";

                var activity =
                    index < Math.Ceiling(count * 0.3)
                        ? "High"
                        : index < Math.Ceiling(count * 0.7)
                            ? "Medium"
                            : "Low";

                var frequency =
                    density == "High" && activity == "High"
                        ? "Daily"
                        : density == "High" && activity == "Medium"
                            ? "Every 2 Days"
                            : density == "Medium" && activity == "High"
                                ? "Daily"
                                : density == "Medium" && activity == "Medium"
                                    ? "Every 2 Days"
                                    : density == "Low" && activity == "High"
                                        ? "Every 2 Days"
                                        : "Every 3 Days";

                return new
                {
                    area = area.AreaName,
                    density,
                    activity,
                    frequency,
                    totalWaste = area.TotalWaste,
                    averageDailyWaste = area.AverageDailyWaste
                };
            })
            .ToList();

        return Ok(areaParameters);
    }
}