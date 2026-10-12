using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EcoRoute.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AreasController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public AreasController(EcoRouteDbContext context)
    {
        _context = context;
    }


[HttpPost("import")]
public async Task<IActionResult> ImportAreas(
    [FromBody] AreaImportRequest request)
{
    if (!TryGetUserId(out var userId))
        return Unauthorized();

    if (request.Areas == null || request.Areas.Count == 0)
    {
        return BadRequest(new
        {
            message = "At least one collection area is required."
        });
    }

    var errors = new List<string>();
    var seenNames = new HashSet<string>(
        StringComparer.OrdinalIgnoreCase);

    for (var i = 0; i < request.Areas.Count; i++)
    {
        var area = request.Areas[i];
        var row = i + 1;

        if (string.IsNullOrWhiteSpace(area.AreaName))
            errors.Add($"Row {row}: AreaName is required.");
        else if (area.AreaName.Trim().Length > 100)
            errors.Add($"Row {row}: AreaName cannot exceed 100 characters.");
        else if (!seenNames.Add(area.AreaName.Trim()))
            errors.Add($"Row {row}: Duplicate area name '{area.AreaName}'.");

        if (area.PopulationDensity < 0)
            errors.Add($"Row {row}: PopulationDensity cannot be negative.");

        if (area.Latitude < -90 || area.Latitude > 90)
            errors.Add($"Row {row}: Latitude must be between -90 and 90.");

        if (area.Longitude < -180 || area.Longitude > 180)
            errors.Add($"Row {row}: Longitude must be between -180 and 180.");
    }

    if (errors.Count > 0)
        return BadRequest(new { message = "Validation failed.", errors });

    var names = request.Areas
        .Select(a => a.AreaName.Trim())
        .ToList();

    var existingNames = await _context.Areas
        .Where(a => a.UserId == userId && names.Contains(a.AreaName))
        .Select(a => a.AreaName)
        .ToListAsync();

    if (existingNames.Count > 0)
    {
        return Conflict(new
        {
            message = "Some areas already exist for this account.",
            duplicates = existingNames
        });
    }

    await using var transaction =
        await _context.Database.BeginTransactionAsync();

    try
    {
        var now = DateTime.UtcNow;

        var areas = request.Areas.Select(row => new EcoRoute.API.Models.Area
        {
            UserId = userId,
            AreaName = row.AreaName.Trim(),
            PopulationDensity = row.PopulationDensity,
            Latitude = row.Latitude,
            Longitude = row.Longitude,
            IsActive = true,
            CreatedAt = now,
            ActivityLevel = null,
            CollectionFrequency = null
        }).ToList();

        _context.Areas.AddRange(areas);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new
        {
            message = "Areas imported successfully.",
            importedCount = areas.Count,
            areas = areas.Select(a => new
            {
                a.AreaId,
                a.AreaName,
                a.PopulationDensity,
                a.Latitude,
                a.Longitude,
                a.IsActive,
                a.CreatedAt
            })
        });
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}


    [HttpGet]
    public async Task<IActionResult> GetAreas()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var areas = await _context.Areas
            .Where(a => a.UserId == userId && a.IsActive)
            .OrderBy(a => a.AreaId)
            .ToListAsync();

        return Ok(areas);
    }

    [HttpGet("management")]
    public async Task<IActionResult> GetAreasForManagement()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var areas = await _context.Areas
            .Where(a => a.UserId == userId)
            .OrderBy(a => a.AreaId)
            .ToListAsync();

        return Ok(areas);
    }

    [HttpPut("{id:int}/active")]
    public async Task<IActionResult> SetAreaActive(
        int id,
        [FromBody] bool isActive)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var area = await _context.Areas
            .FirstOrDefaultAsync(a =>
                a.AreaId == id && a.UserId == userId);

        if (area == null)
        {
            return NotFound(new { message = "Place not found." });
        }

        area.IsActive = isActive;

        await _context.SaveChangesAsync();

        return Ok(area);
    }

    // Gets the logged-in user's ID from the authentication claims.
    private bool TryGetUserId(out int userId)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(userIdValue, out userId);
    }
}

public sealed class AreaImportRequest
{
    public List<AreaImportRow> Areas { get; set; } = [];
}

public sealed class AreaImportRow
{
    public string AreaName { get; set; } = string.Empty;
    public decimal PopulationDensity { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
}