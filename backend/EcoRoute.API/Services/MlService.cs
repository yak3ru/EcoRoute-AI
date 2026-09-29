using System.Text.Json;

namespace EcoRoute.API.Services;

public class MlService
{
    private readonly IHttpClientFactory _httpClientFactory;

    public MlService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<JsonElement> GetPredictionsAsync()
    {
        var client = _httpClientFactory.CreateClient("PythonML");

        var response = await client.GetAsync("/predictions");

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();

        return JsonSerializer.Deserialize<JsonElement>(json);
    }

    public async Task<JsonElement> GetRoutesAsync()
    {
        var client = _httpClientFactory.CreateClient("PythonML");

        var response = await client.GetAsync("/routes");

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();

        return JsonSerializer.Deserialize<JsonElement>(json);
    }

    public async Task<JsonElement> GetP90RoutesAsync()
    {
        var client = _httpClientFactory.CreateClient("PythonML");

        var response = await client.GetAsync("/routes/p90");

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();

        return JsonSerializer.Deserialize<JsonElement>(json);
    }
}