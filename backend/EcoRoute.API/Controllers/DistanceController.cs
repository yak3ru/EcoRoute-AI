using EcoRoute.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcoRoute.API.Controllers;

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
        var distances = await _context.DistanceMatrix
            .AsNoTracking()
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