namespace EcoRoute.API.Models;

public class Area
{
    public int AreaId { get; set; }

    public int UserId { get; set; }

    public string AreaName { get; set; } = string.Empty;

    public decimal? PopulationDensity { get; set; }

    public string? ActivityLevel { get; set; }

    public string? CollectionFrequency { get; set; }

    public decimal? Latitude { get; set; }

    public decimal? Longitude { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }
}