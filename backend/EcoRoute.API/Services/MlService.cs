using System.Net;
using System.Text.Json;

namespace EcoRoute.API.Services;

public sealed class MlServiceException : Exception
{
    public HttpStatusCode StatusCode { get; }
    public string ResponseBody { get; }

    public MlServiceException(HttpStatusCode statusCode, string responseBody)
        : base($"Python ML service returned {(int)statusCode}.")
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }
}

public class MlService
{
    private readonly IHttpClientFactory _httpClientFactory;

    public MlService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public Task<JsonElement> GetPredictionsAsync(int userId, string? targetDate = null)
    {
        var url = $"/predictions?user_id={userId}";
        if (!string.IsNullOrWhiteSpace(targetDate))
            url += $"&target_date={Uri.EscapeDataString(targetDate)}";
        return GetAsync(url);
    }

    public Task<JsonElement> GetRoutesAsync(int userId) => GetAsync($"/routes?user_id={userId}");
    public Task<JsonElement> GetP90RoutesAsync(int userId) => GetAsync($"/routes/p90?user_id={userId}");
    public Task<JsonElement> GetP90RerouteAsync(int userId, int vehicleId) =>
        GetAsync($"/routes/p90/reroute/{vehicleId}?user_id={userId}");

    public Task<JsonElement> RebuildDistanceMatrixAsync(int userId, int facilityId = 1) =>
        PostAsync($"/distances/rebuild?user_id={userId}&facility_id={facilityId}");

    private async Task<JsonElement> GetAsync(string url)
    {
        var client = _httpClientFactory.CreateClient("PythonML");
        using var response = await client.GetAsync(url);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new MlServiceException(response.StatusCode, responseBody);
        return JsonSerializer.Deserialize<JsonElement>(responseBody);
    }

    private async Task<JsonElement> PostAsync(string url)
    {
        var client = _httpClientFactory.CreateClient("PythonML");
        using var response = await client.PostAsync(url, content: null);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new MlServiceException(response.StatusCode, responseBody);
        return JsonSerializer.Deserialize<JsonElement>(responseBody);
    }
}
