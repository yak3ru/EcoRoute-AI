
using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using EcoRoute.API.Models;

namespace EcoRoute.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class WasteController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public WasteController(EcoRouteDbContext context)
    {
        _context = context;
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
            .Where(w => w.Area != null && w.Area.UserId == userId)
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

    var alreadyUploaded = await _context.OperationReportUploads
        .AnyAsync(r =>
            r.UserId == userId &&
            r.OperationDate == operationDay);

    if (alreadyUploaded)
    {
        return Conflict(new
        {
            message = "A report has already been uploaded for this operation date."
        });
    }


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

    var validWasteTypes = new[]
    {
        "Biodegradable",
        "Non-biodegradable"
    };

    var validStatuses = new[]
    {
        "Completed",
        "Failed",
        "Pending"
    };

    // Validate every record before saving anything.

    for (int i = 0; i < records.Count; i++)
    {
        var record = records[i];
        var rowNumber = i + 2;

        if (record.AreaId <= 0)
        {
            return BadRequest(new
            {
                message = $"Row {rowNumber}: Invalid AreaId."
            });
        }

        if (record.CollectionDate == default)
        {
            return BadRequest(new
            {
                message = $"Row {rowNumber}: Invalid CollectionDate."
            });
        }

        if (string.IsNullOrWhiteSpace(record.WasteType) ||
            !validWasteTypes.Contains(
                record.WasteType.Trim(),
                StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = $"Row {rowNumber}: Invalid WasteType."
            });
        }

        if (record.WeightKg < 0 ||
            record.WeightKg > 99999999.99m)
        {
            return BadRequest(new
            {
                message = $"Row {rowNumber}: Invalid WeightKg."
            });
        }

        if (string.IsNullOrWhiteSpace(record.Status) ||
            !validStatuses.Contains(
                record.Status.Trim(),
                StringComparer.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = $"Row {rowNumber}: Invalid Status."
            });
        }
    }

    // Confirm all areas belong to the logged-in user.

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

    // Prepare records for insertion.

    var wasteRecords = records.Select(r => new WasteRecord
    {
        AreaId = r.AreaId,
        CollectionDate = r.CollectionDate,
        WasteType = r.WasteType.Trim(),
        WeightKg = r.WeightKg,
        Status = r.Status.Trim(),
        CreatedAt = DateTime.UtcNow
    }).ToList();

    
    _context.WasteRecords.AddRange(wasteRecords);

    _context.OperationReportUploads.Add(
        new OperationReportUpload
        {
            UserId = userId,
            OperationDate = operationDay,
            UploadedAt = DateTime.UtcNow
        });

    await _context.SaveChangesAsync();

    return Ok(new
    {
        message = "Waste records imported successfully.",
        importedCount = wasteRecords.Count
    });
}
}