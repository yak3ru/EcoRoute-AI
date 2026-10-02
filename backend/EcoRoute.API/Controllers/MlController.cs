using EcoRoute.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/ml")]
[Authorize]
public class MlController : ControllerBase
{
    private readonly MlService _mlService;

    public MlController(MlService mlService)
    {
        _mlService = mlService;
    }

    [HttpGet("predictions")]
    public async Task<IActionResult> GetPredictions()
    {
        try
        {
            var result =
                await _mlService.GetPredictionsAsync();

            return Ok(result);
        }
        catch (HttpRequestException error)
        {
            return StatusCode(
                503,
                new
                {
                    message = "Python ML service is unavailable.",
                    error = error.Message
                }
            );
        }
    }

    [HttpGet("routes")]
    public async Task<IActionResult> GetRoutes()
    {
        try
        {
            var result =
                await _mlService.GetRoutesAsync();

            return Ok(result);
        }
        catch (HttpRequestException error)
        {
            return StatusCode(
                503,
                new
                {
                    message = "Python ML service is unavailable.",
                    error = error.Message
                }
            );
        }
    }

    [HttpGet("routes/p90")]
    public async Task<IActionResult> GetP90Routes()
    {
        try
        {
            var result =
                await _mlService.GetP90RoutesAsync();

            return Ok(result);
        }
        catch (HttpRequestException error)
        {
            return StatusCode(
                503,
                new
                {
                    message = "Python ML service is unavailable.",
                    error = error.Message
                }
            );
        }
    }

    [HttpGet("routes/p90/reroute/{vehicleId:int}")]
    public async Task<IActionResult> GetP90Reroute(
        int vehicleId
    )
    {
        try
        {
            var result =
                await _mlService.GetP90RerouteAsync(
                    vehicleId
                );

            return Ok(result);
        }
        catch (HttpRequestException error)
        {
            return StatusCode(
                503,
                new
                {
                    message =
                        "Python ML service is unavailable.",
                    error = error.Message
                }
            );
        }
    }
}