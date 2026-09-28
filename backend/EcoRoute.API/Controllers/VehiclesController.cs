using EcoRoute.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehiclesController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public VehiclesController(EcoRouteDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetVehicles()
    {
        var vehicles = await _context.Vehicles
            .Where(v => v.IsActive)
            .OrderBy(v => v.VehicleId)
            .ToListAsync();

        return Ok(vehicles);
    }
}