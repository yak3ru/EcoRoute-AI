
using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EcoRoute.API.Controllers;

[Authorize]
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
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized();
        }

        var constraints = await _context.RoutingConstraints
            .AsNoTracking()
            .Where(r => r.Vehicle != null && r.Vehicle.UserId == userId)
            .OrderBy(r => r.ConstraintId)
            .ToListAsync();

        return Ok(constraints);
    }
}