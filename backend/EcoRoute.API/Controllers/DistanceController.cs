
using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EcoRoute.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DistanceController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public DistanceController(EcoRouteDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetDistanceMatrix()
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        var distances = await _context.DistanceMatrix
            .AsNoTracking()
            .Where(d =>
                d.OriginArea != null &&
                d.DestinationArea != null &&
                d.OriginArea.UserId == userId &&
                d.DestinationArea.UserId == userId)
            .OrderBy(d => d.OriginAreaId)
            .ThenBy(d => d.DestinationAreaId)
            .Select(d => new
            {
                d.DistanceMatrixId,
                d.OriginAreaId,
                d.DestinationAreaId,
                d.DistanceKm
            })
            .ToListAsync();

        return Ok(distances);
    }
}