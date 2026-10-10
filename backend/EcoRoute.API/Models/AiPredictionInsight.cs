
namespace EcoRoute.API.Models;

public class AiPredictionInsight
{
    public int InsightId { get; set; }

    public int UserId { get; set; }

    public DateTime GeneratedAt { get; set; }

    public DateTime TargetDate { get; set; }

    public decimal PredictedWasteKg { get; set; }

    public decimal NormalWasteKg { get; set; }

    public decimal PredictionChangePercent { get; set; }

    public string PredictionLevel { get; set; } = string.Empty;

    public string InsightMessage { get; set; } = string.Empty;

    public string SuggestedAction { get; set; } = string.Empty;
}
