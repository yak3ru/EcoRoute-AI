using EcoRoute.API.Data;
using EcoRoute.API.Models;
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

    // GET: api/RoutingConstraints
    [HttpGet]
    public async Task<IActionResult> GetConstraints()
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var constraints = await _context.RoutingConstraints
            .Include(r => r.Vehicle)
            .Where(r =>
                r.Vehicle != null &&
                r.Vehicle.UserId == userId.Value &&
                r.Vehicle.IsActive)
            .OrderBy(r => r.ConstraintId)
            .ToListAsync();

        return Ok(constraints);
    }

    // GET: api/RoutingConstraints/5
    [HttpGet("{id}")]
    public async Task<IActionResult> GetConstraint(int id)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var constraint = await _context.RoutingConstraints
            .Include(r => r.Vehicle)
            .FirstOrDefaultAsync(r =>
                r.ConstraintId == id &&
                r.Vehicle != null &&
                r.Vehicle.UserId == userId.Value &&
                r.Vehicle.IsActive);

        if (constraint == null)
        {
            return NotFound(new
            {
                message = "Routing constraint not found."
            });
        }

        return Ok(constraint);
    }

    // POST: api/RoutingConstraints
    [HttpPost]
    public async Task<IActionResult> CreateConstraint(
        [FromBody] RoutingConstraint constraint)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v =>
                v.VehicleId == constraint.VehicleId &&
                v.UserId == userId.Value &&
                v.IsActive);

        if (vehicle == null)
        {
            return NotFound(new
            {
                message = "Vehicle not found."
            });
        }

        var existingConstraint = await _context.RoutingConstraints
            .AnyAsync(r => r.VehicleId == constraint.VehicleId);

        if (existingConstraint)
        {
            return Conflict(new
            {
                message = "This vehicle already has a routing constraint."
            });
        }

        if (constraint.VehicleCapacityKg <= 0)
        {
            return BadRequest(new
            {
                message = "Vehicle capacity must be greater than 0."
            });
        }

        if (constraint.MaximumRouteDistanceKm <= 0)
        {
            return BadRequest(new
            {
                message = "Maximum route distance must be greater than 0."
            });
        }

        constraint.CreatedAt = DateTime.UtcNow;

        _context.RoutingConstraints.Add(constraint);

        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetConstraint),
            new { id = constraint.ConstraintId },
            constraint);
    }

    // PUT: api/RoutingConstraints/5
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateConstraint(
        int id,
        [FromBody] RoutingConstraint updatedConstraint)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var constraint = await _context.RoutingConstraints
            .Include(r => r.Vehicle)
            .FirstOrDefaultAsync(r =>
                r.ConstraintId == id &&
                r.Vehicle != null &&
                r.Vehicle.UserId == userId.Value &&
                r.Vehicle.IsActive);

        if (constraint == null)
        {
            return NotFound(new
            {
                message = "Routing constraint not found."
            });
        }

        if (updatedConstraint.VehicleCapacityKg <= 0)
        {
            return BadRequest(new
            {
                message = "Vehicle capacity must be greater than 0."
            });
        }

        if (updatedConstraint.MaximumRouteDistanceKm <= 0)
        {
            return BadRequest(new
            {
                message = "Maximum route distance must be greater than 0."
            });
        }

        constraint.VehicleCapacityKg =
            updatedConstraint.VehicleCapacityKg;

        constraint.MaximumRouteDistanceKm =
            updatedConstraint.MaximumRouteDistanceKm;

        constraint.CollectionStartTime =
            updatedConstraint.CollectionStartTime;

        constraint.CollectionEndTime =
            updatedConstraint.CollectionEndTime;

        constraint.RoadAccessibility =
            updatedConstraint.RoadAccessibility;

        constraint.AreaRestrictions =
            updatedConstraint.AreaRestrictions;

        await _context.SaveChangesAsync();

        return Ok(constraint);
    }

    // DELETE: api/RoutingConstraints/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteConstraint(int id)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var constraint = await _context.RoutingConstraints
            .Include(r => r.Vehicle)
            .FirstOrDefaultAsync(r =>
                r.ConstraintId == id &&
                r.Vehicle != null &&
                r.Vehicle.UserId == userId.Value &&
                r.Vehicle.IsActive);

        if (constraint == null)
        {
            return NotFound(new
            {
                message = "Routing constraint not found."
            });
        }

        _context.RoutingConstraints.Remove(constraint);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Routing constraint deleted successfully."
        });
    }

    private int? GetUserId()
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (int.TryParse(userIdValue, out var userId))
        {
            return userId;
        }

        return null;
    }
}