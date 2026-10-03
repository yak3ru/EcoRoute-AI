namespace EcoRoute.API.Models;

public class SavedRoutePlan
{
    public int UserId { get; set; }
    public string RouteJson { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
