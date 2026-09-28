using EcoRoute.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoutingConstraintsController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public RoutingConstraintsController(EcoRouteDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetConstraints()
    {
        var constraints = await _context.RoutingConstraints
            .AsNoTracking()
            .OrderBy(r => r.ConstraintId)
            .ToListAsync();

        return Ok(constraints);
    }
}