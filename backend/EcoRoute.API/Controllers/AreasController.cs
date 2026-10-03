
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

    private bool TryGetUserId(out int userId)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(userIdValue, out userId);
    }
}