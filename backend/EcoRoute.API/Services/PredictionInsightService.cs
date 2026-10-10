
using System.Text.Json;
using EcoRoute.API.Data;
using EcoRoute.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EcoRoute.API.Services;

public class PredictionInsightService
{
    private readonly EcoRouteDbContext _context;
    private readonly MlService _mlService;

    public PredictionInsightService(
        EcoRouteDbContext context,
        MlService mlService)
    {
        _context = context;
        _mlService = mlService;
    }

    public async Task GenerateAndSavePredictionInsightAsync(
        int userId,
        DateTime targetDate)
    {
        targetDate = targetDate.Date;

        // Do not generate a duplicate insight for the same user and date.
        var existingInsight = await _context.AiPredictionInsights
            .AnyAsync(item =>
                item.UserId == userId &&
                item.TargetDate == targetDate);

        if (existingInsight)
            return;

        // Ask the Python ML service to predict waste for the target date.
        JsonElement predictions = await _mlService.GetPredictionsAsync(
            userId,
            targetDate.ToString("yyyy-MM-dd"));

        if (!predictions.TryGetProperty("predictions", out var rows) ||
            rows.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException(
                "The ML service returned an invalid predictions response.");
        }

        decimal predictedWaste = 0;

        foreach (var row in rows.EnumerateArray())
        {
            if (row.TryGetProperty("P50Kg", out var p50) &&
                p50.TryGetDecimal(out var value))
            {
                predictedWaste += value;
            }
        }

        predictedWaste = Math.Round(predictedWaste, 2);

        // Use the Philippine operation date.
        var manilaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");
        var today = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, manilaTimeZone).Date;
        var startDate = today.AddDays(-30);


        // Only use areas belonging to this user.
        var ownedAreaIds = await _context.Areas
            .Where(area => area.UserId == userId)
            .Select(area => area.AreaId)
            .ToListAsync();

        // Retrieve the previous 30 days of waste records, excluding today.
        var records = await _context.WasteRecords
            .AsNoTracking()
            .Where(record =>
                ownedAreaIds.Contains(record.AreaId) &&
                record.CollectionDate >= startDate &&
                record.CollectionDate < today &&
                record.WeightKg >= 0)
            .Select(record => new
            {
                record.CollectionDate,
                record.WeightKg
            })
            .ToListAsync();

        // Calculate daily totals and use the latest seven dates with records.
        var dailyTotals = records
            .GroupBy(record => record.CollectionDate.Date)
            .Select(group => new
            {
                Date = group.Key,
                Total = group.Sum(record => record.WeightKg)
            })
            .OrderByDescending(day => day.Date)
            .Take(7)
            .ToList();

        // Do not save an insight if a usable baseline is unavailable.
        if (dailyTotals.Count == 0)
            return;

        decimal normalWaste = Math.Round(
            dailyTotals.Average(day => day.Total), 2);

        if (normalWaste <= 0)
            return;

        decimal changePercent = Math.Round(
            ((predictedWaste - normalWaste) / normalWaste) * 100, 2);

        string level;
        string message;
        string action;

        if (changePercent >= 20)
        {
            level = "Much higher than normal";
            message = "High waste generation expected";
            action = "Prepare additional collection capacity";
        }
        else if (changePercent >= 5)
        {
            level = "Slightly higher";
            message = "Waste generation expected to increase";
            action = "Prepare for increased waste volume";
        }
        else if (changePercent >= -5)
        {
            level = "Around normal";
            message = "Waste generation expected to remain normal";
            action = "Proceed with the planned collection capacity";
        }
        else
        {
            level = "Lower than normal";
            message = "Waste generation expected to decrease";
            action = "Adjust collection capacity accordingly";
        }

        var insight = new AiPredictionInsight
        {
            UserId = userId,
            GeneratedAt = DateTime.UtcNow,
            TargetDate = targetDate,
            PredictedWasteKg = predictedWaste,
            NormalWasteKg = normalWaste,
            PredictionChangePercent = changePercent,
            PredictionLevel = level,
            InsightMessage = message,
            SuggestedAction = action
        };

        _context.AiPredictionInsights.Add(insight);
        await _context.SaveChangesAsync();
    }
}
