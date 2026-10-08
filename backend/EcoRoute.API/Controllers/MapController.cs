using Microsoft.AspNetCore.Mvc;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MapController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public MapController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _httpClient = httpClientFactory.CreateClient();
        _configuration = configuration;

        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
            "EcoRouteAI/1.0"
        );
    }

    [HttpGet("route")]
    public async Task<IActionResult> GetRoute(
        [FromQuery] string coordinates)
    {
        if (string.IsNullOrWhiteSpace(coordinates))
        {
            return BadRequest(
                new
                {
                    message = "Coordinates are required."
                }
            );
        }

        var osrmBaseUrl =
            _configuration["Routing:OsrmBaseUrl"];

        if (string.IsNullOrWhiteSpace(osrmBaseUrl))
        {
            return StatusCode(
                500,
                new
                {
                    message = "Routing:OsrmBaseUrl is not configured."
                }
            );
        }

        var url =
            $"{osrmBaseUrl}/route/v1/driving/" +
            $"{coordinates}" +
            "?overview=full&geometries=geojson";

        try
        {
            var response =
                await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody =
                    await response.Content.ReadAsStringAsync();

                return StatusCode(
                    (int)response.StatusCode,
                    new
                    {
                        message = "Road routing service failed.",
                        statusCode = (int)response.StatusCode,
                        response = errorBody
                    }
                );
            }

            var json =
                await response.Content.ReadAsStringAsync();

            return Content(
                json,
                "application/json"
            );
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new
                {
                    message = "Unable to retrieve road route.",
                    error = ex.ToString()
                }
            );
        }
    }
}