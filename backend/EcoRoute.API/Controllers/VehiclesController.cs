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
public class VehiclesController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public VehiclesController(EcoRouteDbContext context)
    {
        _context = context;
    }

    // Checks if the user currently has an active collection operation.
    private async Task<bool> HasActiveOperationAsync(int userId)
    {
        var manilaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");
        var operationDate = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, manilaTimeZone).Date;

        return await _context.OperationHistories
            .AnyAsync(operation =>
                operation.UserId == userId &&
                operation.OperationDate >= operationDate &&
                operation.OperationDate < operationDate.AddDays(1) &&
                operation.Status == "Active");
    }


    // GET: api/Vehicles
    [HttpGet]
    public async Task<IActionResult> GetVehicles()
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var vehicles = await _context.Vehicles
            .Where(v => v.UserId == userId.Value && v.IsActive)
            .OrderBy(v => v.VehicleId)
            .Select(v => new
            {
                v.VehicleId,
                v.UserId,
                v.VehicleName,
                v.CapacityKg,
                v.Status,
                v.IsActive,
                v.CreatedAt,

                MaximumRouteDistanceKm = _context.RoutingConstraints
                    .Where(r => r.VehicleId == v.VehicleId)
                    .Select(r => r.MaximumRouteDistanceKm)
                    .FirstOrDefault(),

                CollectionStartTime = _context.RoutingConstraints
                    .Where(r => r.VehicleId == v.VehicleId)
                    .Select(r => r.CollectionStartTime)
                    .FirstOrDefault(),

                CollectionEndTime = _context.RoutingConstraints
                    .Where(r => r.VehicleId == v.VehicleId)
                    .Select(r => r.CollectionEndTime)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(vehicles);
    }

    // GET: api/Vehicles/5
    [HttpGet("{id}")]
    public async Task<IActionResult> GetVehicle(int id)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v =>
                v.VehicleId == id &&
                v.UserId == userId.Value &&
                v.IsActive);

        if (vehicle == null)
        {
            return NotFound(new
            {
                message = "Vehicle not found."
            });
        }

        return Ok(vehicle);
    }

    // POST: api/Vehicles
    [HttpPost]
    public async Task<IActionResult> CreateVehicle([FromBody] Vehicle vehicle)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        if (await HasActiveOperationAsync(userId.Value))
        {
            return Conflict(new
            {
                message = "Truck management is locked while an operation is active."
            });
        }

        if (string.IsNullOrWhiteSpace(vehicle.VehicleName))
        {
            return BadRequest(new
            {
                message = "Vehicle name is required."
            });
        }

        if (vehicle.CapacityKg <= 0)
        {
            return BadRequest(new
            {
                message = "Vehicle capacity must be greater than 0."
            });
        }

        var vehicleNameExists = await _context.Vehicles
            .AnyAsync(v =>
                v.UserId == userId.Value &&
                v.VehicleName == vehicle.VehicleName &&
                v.IsActive);

        if (vehicleNameExists)
        {
            return Conflict(new
            {
                message = "A vehicle with this name already exists."
            });
        }

        vehicle.UserId = userId.Value;
        vehicle.IsActive = true;
        vehicle.Status = string.IsNullOrWhiteSpace(vehicle.Status)
            ? "Available"
            : vehicle.Status;
        vehicle.CreatedAt = DateTime.UtcNow;

        _context.Vehicles.Add(vehicle);

        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetVehicle),
            new { id = vehicle.VehicleId },
            vehicle);
    }

    // PUT: api/Vehicles/5
    [HttpPut("{id}/with-constraints")]
    public async Task<IActionResult> UpdateVehicleWithConstraints(
        int id,
        [FromBody] VehicleRequest request)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        if (await HasActiveOperationAsync(userId.Value))
        {
            return Conflict(new
            {
                message = "Truck management is locked while an operation is active."
            });
        }

        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v =>
                v.VehicleId == id &&
                v.UserId == userId.Value &&
                v.IsActive);

        if (vehicle == null)
        {
            return NotFound(new
            {
                message = "Vehicle not found."
            });
        }

        if (string.IsNullOrWhiteSpace(request.VehicleName))
        {
            return BadRequest(new
            {
                message = "Vehicle name is required."
            });
        }

        if (request.CapacityKg <= 0)
        {
            return BadRequest(new
            {
                message = "Vehicle capacity must be greater than 0."
            });
        }

        if (request.MaximumRouteDistanceKm <= 0)
        {
            return BadRequest(new
            {
                message = "Maximum route distance must be greater than 0."
            });
        }

        if (request.CollectionStartTime >= request.CollectionEndTime)
        {
            return BadRequest(new
            {
                message = "Collection start time must be earlier than collection end time."
            });
        }

        var duplicateName = await _context.Vehicles
            .AnyAsync(v =>
                v.VehicleId != id &&
                v.UserId == userId.Value &&
                v.VehicleName == request.VehicleName &&
                v.IsActive);

        if (duplicateName)
        {
            return Conflict(new
            {
                message = "A vehicle with this name already exists."
            });
        }

        var constraint = await _context.RoutingConstraints
            .FirstOrDefaultAsync(r =>
                r.VehicleId == vehicle.VehicleId);

        vehicle.VehicleName = request.VehicleName.Trim();
        vehicle.CapacityKg = request.CapacityKg;
        vehicle.Status = string.IsNullOrWhiteSpace(request.Status)
            ? vehicle.Status
            : request.Status;

        if (constraint == null)
        {
            constraint = new RoutingConstraint
            {
                VehicleId = vehicle.VehicleId,
                CreatedAt = DateTime.UtcNow
            };

            _context.RoutingConstraints.Add(constraint);
        }

        constraint.VehicleCapacityKg = request.CapacityKg;
        constraint.MaximumRouteDistanceKm =
            request.MaximumRouteDistanceKm;
        constraint.CollectionStartTime =
            request.CollectionStartTime;
        constraint.CollectionEndTime =
            request.CollectionEndTime;
        constraint.RoadAccessibility =
            request.RoadAccessibility;
        constraint.AreaRestrictions =
            request.AreaRestrictions;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            vehicle,
            routingConstraint = constraint
        });
    }

    // DELETE: api/Vehicles/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteVehicle(int id)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        if (await HasActiveOperationAsync(userId.Value))
        {
            return Conflict(new
            {
                message = "Truck management is locked while an operation is active."
            });
        }

        var vehicle = await _context.Vehicles
            .FirstOrDefaultAsync(v =>
                v.VehicleId == id &&
                v.UserId == userId.Value &&
                v.IsActive);

        if (vehicle == null)
        {
            return NotFound(new
            {
                message = "Vehicle not found."
            });
        }

        _context.Vehicles.Remove(vehicle);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Vehicle deleted successfully."
        });
    }

    // POST: api/Vehicles/with-constraints
    [HttpPost("with-constraints")]
    public async Task<IActionResult> CreateVehicleWithConstraints(
        [FromBody] VehicleRequest request)
    {
        var userId = GetUserId();

        if (userId == null)
        {
            return Unauthorized();
        }

        if (await HasActiveOperationAsync(userId.Value))
        {
            return Conflict(new
            {
                message = "Truck management is locked while an operation is active."
            });
        }

        if (string.IsNullOrWhiteSpace(request.VehicleName))
        {
            return BadRequest(new
            {
                message = "Vehicle name is required."
            });
        }

        if (request.CapacityKg <= 0)
        {
            return BadRequest(new
            {
                message = "Vehicle capacity must be greater than 0."
            });
        }

        if (request.MaximumRouteDistanceKm <= 0)
        {
            return BadRequest(new
            {
                message = "Maximum route distance must be greater than 0."
            });
        }

        if (request.CollectionStartTime >= request.CollectionEndTime)
        {
            return BadRequest(new
            {
                message = "Collection start time must be earlier than collection end time."
            });
        }

        var vehicleNameExists = await _context.Vehicles
            .AnyAsync(v =>
                v.UserId == userId.Value &&
                v.VehicleName == request.VehicleName &&
                v.IsActive);

        if (vehicleNameExists)
        {
            return Conflict(new
            {
                message = "A vehicle with this name already exists."
            });
        }

        var vehicle = new Vehicle
        {
            UserId = userId.Value,
            VehicleName = request.VehicleName.Trim(),
            CapacityKg = request.CapacityKg,
            Status = string.IsNullOrWhiteSpace(request.Status)
                ? "Available"
                : request.Status,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Vehicles.Add(vehicle);

        await _context.SaveChangesAsync();

        var constraint = new RoutingConstraint
        {
            VehicleId = vehicle.VehicleId,
            VehicleCapacityKg = request.CapacityKg,
            MaximumRouteDistanceKm = request.MaximumRouteDistanceKm,
            CollectionStartTime = request.CollectionStartTime,
            CollectionEndTime = request.CollectionEndTime,
            RoadAccessibility = request.RoadAccessibility,
            AreaRestrictions = request.AreaRestrictions,
            CreatedAt = DateTime.UtcNow
        };

        _context.RoutingConstraints.Add(constraint);

        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetVehicle),
            new { id = vehicle.VehicleId },
            new
            {
                vehicle,
                routingConstraint = constraint
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