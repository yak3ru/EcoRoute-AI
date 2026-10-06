namespace EcoRoute.API.Models;

public class VehicleRequest
{
    public string VehicleName { get; set; } = string.Empty;

    public decimal CapacityKg { get; set; }

    public decimal MaximumRouteDistanceKm { get; set; }

    public TimeSpan CollectionStartTime { get; set; }

    public TimeSpan CollectionEndTime { get; set; }

    public string? RoadAccessibility { get; set; }

    public string? AreaRestrictions { get; set; }

    public string Status { get; set; } = "Available";
}