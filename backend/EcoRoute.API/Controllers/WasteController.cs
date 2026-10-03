
using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

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
}