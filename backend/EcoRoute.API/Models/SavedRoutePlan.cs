
namespace EcoRoute.API.Models;

public class SavedRoutePlan
{
    public int SavedRoutePlanId { get; set; }

    public int UserId { get; set; }

    public string RouteData { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}