namespace EcoRoute.API.Models;

public class WasteRecord
{
    public int WasteRecordId { get; set; }

    public int AreaId { get; set; }

    public DateTime CollectionDate { get; set; }

    public string WasteType { get; set; } = string.Empty;

    public decimal WeightKg { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public Area? Area { get; set; }
}