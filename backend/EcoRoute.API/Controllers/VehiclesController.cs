using EcoRoute.API.Data;
using EcoRoute.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

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

    // Active trucks only. Used by route planning and the optimizer.
    [HttpGet]
    public async Task<IActionResult> GetVehicles()
    {
        var vehicles = await _context.Vehicles
            .AsNoTracking()
            .Where(v => v.IsActive)
            .OrderBy(v => v.VehicleId)
            .ToListAsync();

        return Ok(vehicles);
    }

    // Includes inactive trucks for the management window.
    [HttpGet("manage")]
    public async Task<IActionResult> GetVehiclesForManagement()
    {
        var vehicles = await _context.Vehicles
            .AsNoTracking()
            .OrderByDescending(v => v.IsActive)
            .ThenBy(v => v.VehicleName)
            .ToListAsync();

        return Ok(vehicles);
    }

    [HttpPost]
    public async Task<IActionResult> CreateVehicle([FromBody] VehicleRequest request)
    {
        var name = request.VehicleName.Trim();

        if (await _context.Vehicles.AnyAsync(v => v.VehicleName == name))
        {
            return Conflict(new { message = "A truck with this name already exists." });
        }

        var vehicle = new Vehicle
        {
            VehicleName = name,
            CapacityKg = request.CapacityKg,
            Status = request.Status.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Vehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetVehiclesForManagement), new { id = vehicle.VehicleId }, vehicle);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateVehicle(int id, [FromBody] VehicleRequest request)
    {
        var vehicle = await _context.Vehicles.FindAsync(id);

        if (vehicle == null)
        {
            return NotFound(new { message = "Truck not found." });
        }

        var name = request.VehicleName.Trim();

        if (await _context.Vehicles.AnyAsync(v => v.VehicleId != id && v.VehicleName == name))
        {
            return Conflict(new { message = "A truck with this name already exists." });
        }

        vehicle.VehicleName = name;
        vehicle.CapacityKg = request.CapacityKg;
        vehicle.Status = request.Status.Trim();

        await _context.SaveChangesAsync();

        return Ok(vehicle);
    }

    [HttpPatch("{id:int}/active")]
    public async Task<IActionResult> SetVehicleActive(int id, [FromBody] ActiveStatusRequest request)
    {
        var vehicle = await _context.Vehicles.FindAsync(id);

        if (vehicle == null)
        {
            return NotFound(new { message = "Truck not found." });
        }

        vehicle.IsActive = request.IsActive;
        await _context.SaveChangesAsync();

        return Ok(vehicle);
    }

    public class VehicleRequest
    {
        [Required]
        [StringLength(100, MinimumLength = 2)]
        public string VehicleName { get; set; } = string.Empty;

        [Range(typeof(decimal), "1", "1000000")]
        public decimal CapacityKg { get; set; }

        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "Available";
    }

    public class ActiveStatusRequest
    {
        public bool IsActive { get; set; }
    }
}
