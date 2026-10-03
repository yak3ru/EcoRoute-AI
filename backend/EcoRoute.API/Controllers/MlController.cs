
using EcoRoute.API.Services;
using EcoRoute.API.Data;
using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
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
    private readonly EcoRouteDbContext _context;

    public MlController(MlService mlService, EcoRouteDbContext context)
    {
        _mlService = mlService;
        _context = context;
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

    // Return the last route plan explicitly saved by this account.
    [HttpGet("routes/saved")]
    public async Task<IActionResult> GetSavedRoutes()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var connection = _context.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT RouteJson FROM saved_route_plans WHERE UserId = @userId LIMIT 1";

        var parameter = command.CreateParameter();
        parameter.ParameterName = "@userId";
        parameter.Value = userId;
        command.Parameters.Add(parameter);

        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        if (result == null || result == DBNull.Value)
            return NoContent();

        return Content(Convert.ToString(result)!, "application/json");
    }

    // Save the route plan for the authenticated account only.
    [HttpPut("routes/saved")]
    public async Task<IActionResult> SaveRoutes([FromBody] JsonElement routePlan)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (routePlan.ValueKind != JsonValueKind.Object ||
            !routePlan.TryGetProperty("routes", out var routes) ||
            routes.ValueKind != JsonValueKind.Array)
        {
            return BadRequest(new { message = "A route plan with a routes array is required." });
        }

        var json = routePlan.GetRawText();
        var connection = _context.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = @"
            INSERT INTO saved_route_plans (UserId, RouteJson, UpdatedAt)
            VALUES (@userId, @routeJson, UTC_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE
                RouteJson = @routeJson,
                UpdatedAt = UTC_TIMESTAMP(6)";

        var userParameter = command.CreateParameter();
        userParameter.ParameterName = "@userId";
        userParameter.Value = userId;
        command.Parameters.Add(userParameter);

        var jsonParameter = command.CreateParameter();
        jsonParameter.ParameterName = "@routeJson";
        jsonParameter.Value = json;
        command.Parameters.Add(jsonParameter);

        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        await command.ExecuteNonQueryAsync();
        return Ok(new { status = "success", message = "Route plan saved." });
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