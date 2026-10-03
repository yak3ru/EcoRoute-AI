
namespace EcoRoute.API.Models;

public class OperationHistory
{
    public int OperationHistoryId { get; set; }

    public int UserId { get; set; }

    public DateTime OperationDate { get; set; }

    public string RouteData { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string Status { get; set; } = "Active";
}