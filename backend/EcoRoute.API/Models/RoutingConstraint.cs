namespace EcoRoute.API.Models;

public class RoutingConstraint
{
    public int ConstraintId { get; set; }

    public int VehicleId { get; set; }

    public decimal VehicleCapacityKg { get; set; }

    public decimal MaximumRouteDistanceKm { get; set; }

    public TimeSpan CollectionStartTime { get; set; }

    public TimeSpan CollectionEndTime { get; set; }

    public string? RoadAccessibility { get; set; }

    public string? AreaRestrictions { get; set; }

    public DateTime CreatedAt { get; set; }

    public Vehicle? Vehicle { get; set; }
}