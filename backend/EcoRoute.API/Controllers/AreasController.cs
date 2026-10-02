using EcoRoute.API.Data;
using EcoRoute.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AreasController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public AreasController(EcoRouteDbContext context)
    {
        _context = context;
    }

    // Active areas only. Used by route planning and the map.
    [HttpGet]
    public async Task<IActionResult> GetAreas()
    {
        var areas = await _context.Areas
            .AsNoTracking()
            .Where(a => a.IsActive)
            .OrderBy(a => a.AreaId)
            .ToListAsync();

        return Ok(areas);
    }

    // Includes inactive areas so administrators can review the full list.
    [HttpGet("manage")]
    public async Task<IActionResult> GetAreasForManagement()
    {
        var areas = await _context.Areas
            .AsNoTracking()
            .OrderByDescending(a => a.IsActive)
            .ThenBy(a => a.AreaName)
            .ToListAsync();

        return Ok(areas);
    }

    [HttpPost]
    public async Task<IActionResult> CreateArea([FromBody] AreaRequest request)
    {
        var name = request.AreaName.Trim();

        if (await _context.Areas.AnyAsync(a => a.AreaName == name))
        {
            return Conflict(new { message = "A place with this name already exists." });
        }

        var area = new Area
        {
            AreaName = name,
            PopulationDensity = request.PopulationDensity,
            ActivityLevel = request.ActivityLevel?.Trim(),
            CollectionFrequency = request.CollectionFrequency?.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Areas.Add(area);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAreasForManagement), new { id = area.AreaId }, area);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateArea(int id, [FromBody] AreaRequest request)
    {
        var area = await _context.Areas.FindAsync(id);

        if (area == null)
        {
            return NotFound(new { message = "Place not found." });
        }

        var name = request.AreaName.Trim();

        if (await _context.Areas.AnyAsync(a => a.AreaId != id && a.AreaName == name))
        {
            return Conflict(new { message = "A place with this name already exists." });
        }

        area.AreaName = name;
        area.PopulationDensity = request.PopulationDensity;
        area.ActivityLevel = request.ActivityLevel?.Trim();
        area.CollectionFrequency = request.CollectionFrequency?.Trim();
        area.Latitude = request.Latitude;
        area.Longitude = request.Longitude;

        await _context.SaveChangesAsync();

        return Ok(area);
    }

    [HttpPatch("{id:int}/active")]
    public async Task<IActionResult> SetAreaActive(int id, [FromBody] ActiveStatusRequest request)
    {
        var area = await _context.Areas.FindAsync(id);

        if (area == null)
        {
            return NotFound(new { message = "Place not found." });
        }

        area.IsActive = request.IsActive;
        await _context.SaveChangesAsync();

        return Ok(area);
    }

    public class AreaRequest
    {
        [Required]
        [StringLength(150, MinimumLength = 2)]
        public string AreaName { get; set; } = string.Empty;

        [Range(0, 100000000)]
        public decimal? PopulationDensity { get; set; }

        [StringLength(50)]
        public string? ActivityLevel { get; set; }

        [StringLength(100)]
        public string? CollectionFrequency { get; set; }

        [Required]
        [Range(typeof(decimal), "-90", "90")]
        public decimal Latitude { get; set; }

        [Required]
        [Range(typeof(decimal), "-180", "180")]
        public decimal Longitude { get; set; }
    }

    public class ActiveStatusRequest
    {
        public bool IsActive { get; set; }
    }
}
