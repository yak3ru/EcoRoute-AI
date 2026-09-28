namespace EcoRoute.API.Models;

public class Vehicle
{
    public int VehicleId { get; set; }

    public string VehicleName { get; set; } = string.Empty;

    public decimal CapacityKg { get; set; }

    public string Status { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}