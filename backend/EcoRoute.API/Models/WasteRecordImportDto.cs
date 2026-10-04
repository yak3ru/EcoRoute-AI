
namespace EcoRoute.API.Models;

public class WasteRecordImportDto
{
    public int AreaId { get; set; }

    public DateTime CollectionDate { get; set; }

    public string WasteType { get; set; } = string.Empty;

    public decimal WeightKg { get; set; }

    public string Status { get; set; } = string.Empty;
}