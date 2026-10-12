
using System.Security.Claims;
using EcoRoute.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OnboardingController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public OnboardingController(EcoRouteDbContext context)
    {
        _context = context;
    }

    // GET: api/Onboarding/status
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid authenticated user."
            });
        }

        var user = await _context.Users
            .AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => new
            {
                u.IsOnboardingComplete
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "User account not found."
            });
        }

        return Ok(user);
    }

    // POST: api/Onboarding/complete
    [HttpPost("complete")]
    public async Task<IActionResult> Complete()
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid authenticated user."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "User account not found."
            });
        }

        user.IsOnboardingComplete = true;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Onboarding completed successfully.",
            isOnboardingComplete = user.IsOnboardingComplete
        });
    }
}
