namespace EcoRoute.API.Models;

public class DistanceMatrix
{
    public int DistanceMatrixId { get; set; }

    public int OriginAreaId { get; set; }

    public int DestinationAreaId { get; set; }

    public decimal DistanceKm { get; set; }

    public Area? OriginArea { get; set; }

    public Area? DestinationArea { get; set; }
}