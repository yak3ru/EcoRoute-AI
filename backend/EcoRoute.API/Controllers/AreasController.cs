using EcoRoute.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

    [HttpGet]
    public async Task<IActionResult> GetAreas()
    {
        var areas = await _context.Areas
            .Where(a => a.IsActive)
            .OrderBy(a => a.AreaId)
            .ToListAsync();

        return Ok(areas);
    }
}