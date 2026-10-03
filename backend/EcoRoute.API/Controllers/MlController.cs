
using EcoRoute.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

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

    private bool TryGetUserId(out int userId)
    {
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        return int.TryParse(userIdValue, out userId);
    }

    [HttpGet("predictions")]
    public async Task<IActionResult> GetPredictions()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetPredictionsAsync(userId);
            return Ok(result);
        }    
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    [HttpGet("routes")]
    public async Task<IActionResult> GetRoutes()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetRoutesAsync(userId);
            return Ok(result);
        }
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    [HttpGet("routes/p90")]
    public async Task<IActionResult> GetP90Routes()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetP90RoutesAsync(userId);
            return Ok(result);
        }
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }

    [HttpGet("routes/p90/reroute/{vehicleId:int}")]
    public async Task<IActionResult> GetP90Reroute(int vehicleId)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        try
        {
            var result = await _mlService.GetP90RerouteAsync(
                userId, vehicleId);

            return Ok(result);
        }
        catch (MlServiceException ex)
        {
            return new ContentResult
            {
                StatusCode = (int)ex.StatusCode,
                Content = ex.ResponseBody,
                ContentType = "application/json"
            };
        }
    }
}