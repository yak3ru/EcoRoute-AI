using System.Security.Claims;
using EcoRoute.API.Data;
using EcoRoute.API.Models;
using EcoRoute.API.Models.Account;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using EcoRoute.API.Services;
namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly EcoRouteDbContext _context;

    public UsersController(EcoRouteDbContext context)
    {
        _context = context;
    }

    // GET CURRENT USER
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User identity could not be determined."
            });
        }

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "User not found."
            });
        }

        return Ok(new
        {
            userId = user.UserId,
            fullName = user.FullName,
            email = user.Email,
            username = user.Username,
            role = user.Role,
            createdAt = user.CreatedAt,
            updatedAt = user.UpdatedAt,
            twoFactorEnabled = user.TwoFactorEnabled,
            passwordChangedAt = DateTime.SpecifyKind(
                user.PasswordChangedAt ?? user.CreatedAt,
                DateTimeKind.Utc)
        });
    }

    // UPDATE ACCOUNT
    [HttpPut("account")]
    public async Task<IActionResult> UpdateAccount(
        UpdateAccountRequest request)
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User identity could not be determined."
            });
        }

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        // VALIDATE FIELDS
        if (string.IsNullOrWhiteSpace(request.FullName) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Username))
        {
            return BadRequest(new
            {
                message = "Full name, email, and username are required."
            });
        }

        // FIND USER
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "User not found."
            });
        }

        var fullName = request.FullName.Trim();
        var email = request.Email.Trim().ToLowerInvariant();
        var username = request.Username.Trim();

        var validationError =
            UserInputValidator.ValidateFullName(fullName) ??
            UserInputValidator.ValidateEmail(email) ??
            UserInputValidator.ValidateUsername(username);

        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        if (!string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var domainError = await UserInputValidator.ValidateEmailDomainAsync(email);
            if (domainError != null)
            {
                return BadRequest(new { message = domainError });
            }
        }


        // CHECK EMAIL
        var emailExists = await _context.Users
            .AnyAsync(u =>
                u.Email == email &&
                u.UserId != userId);

        if (emailExists)
        {
            return Conflict(new
            {
                message = "Email is already registered by another account."
            });
        }

        // CHECK USERNAME
        var usernameExists = await _context.Users
            .AnyAsync(u =>
                u.Username == username &&
                u.UserId != userId);

        if (usernameExists)
        {
            return Conflict(new
            {
                message = "Username is already taken by another account."
            });
        }

        // UPDATE ACCOUNT
        user.FullName = fullName;
        user.Email = email;
        user.Username = username;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Account updated successfully.",
            userId = user.UserId,
            fullName = user.FullName,
            email = user.Email,
            username = user.Username,
            role = user.Role,
            updatedAt = user.UpdatedAt
        });
    }

    // CHANGE PASSWORD
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request)
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User identity could not be determined."
            });
        }

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        // VALIDATE FIELDS
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword) ||
            string.IsNullOrWhiteSpace(request.ConfirmNewPassword))
        {
            return BadRequest(new
            {
                message = "All password fields are required."
            });
        }

        // CONFIRM PASSWORD
        if (request.NewPassword != request.ConfirmNewPassword)
        {
            return BadRequest(new
            {
                message = "New passwords do not match."
            });
        }

        // PASSWORD REQUIREMENTS
        var passwordError = UserInputValidator.ValidatePassword(request.NewPassword);
        if (passwordError != null)
        {
            return BadRequest(new { message = passwordError });
        }

        // FIND USER
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "User not found."
            });
        }

        // VERIFY PASSWORD
        var currentPasswordValid =
            BCrypt.Net.BCrypt.Verify(
                request.CurrentPassword,
                user.PasswordHash);

        if (!currentPasswordValid)
        {
            return BadRequest(new
            {
                message = "Current password is incorrect."
            });
        }

        // PREVENT PASSWORD REUSE
        if (BCrypt.Net.BCrypt.Verify(
            request.NewPassword,
            user.PasswordHash))
        {
            return BadRequest(new
            {
                message = "New password must be different from the current password."
            });
        }

        // UPDATE PASSWORD
        user.PasswordHash =
            BCrypt.Net.BCrypt.HashPassword(
                request.NewPassword);

        user.UpdatedAt = DateTime.UtcNow;
        user.PasswordChangedAt = user.UpdatedAt;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Password changed successfully."
        });
    }

    // TWO-FACTOR SETTING
    [HttpPut("two-factor")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> UpdateTwoFactor(
        UpdateTwoFactorRequest request)
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "User not found."
            });
        }

        // TURNING OFF NEEDS THE PASSWORD (400, NOT 401, SO THE USER STAYS LOGGED IN)
        if (!request.Enabled && user.TwoFactorEnabled)
        {
            if (string.IsNullOrEmpty(request.CurrentPassword))
            {
                return BadRequest(new
                {
                    message = "Please enter your password to turn off two-factor authentication."
                });
            }

            if (!BCrypt.Net.BCrypt.Verify(
                request.CurrentPassword,
                user.PasswordHash))
            {
                return BadRequest(new
                {
                    message = "Incorrect password."
                });
            }
        }

        user.TwoFactorEnabled = request.Enabled;
        user.UpdatedAt = DateTime.UtcNow;

        // TURNING ON: EVERY DEVICE HAS TO VERIFY AGAIN
        if (request.Enabled)
        {
            await _context.TrustedDevices
                .Where(d =>
                    d.UserId == userId &&
                    d.RevokedAt == null)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(
                        d => d.RevokedAt,
                        (DateTime?)DateTime.UtcNow));
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            twoFactorEnabled = user.TwoFactorEnabled,
            message = request.Enabled
                ? "Two-factor authentication enabled."
                : "Two-factor authentication disabled."
        });
    }

    // DELETE ACCOUNT
    [HttpDelete("account")]
    public async Task<IActionResult> DeleteAccount(
        [FromBody] DeleteAccountRequest request)
    {
        // VALIDATE PASSWORD
        if (request == null ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new
            {
                message = "Password is required to delete your account."
            });
        }

        // GET USER ID
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User identity could not be determined."
            });
        }

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        // FIND USER
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new
            {
                message = "User account was not found."
            });
        }

        // VERIFY PASSWORD
        var passwordValid = BCrypt.Net.BCrypt.Verify(
            request.Password,
            user.PasswordHash);

        if (!passwordValid)
        {
            return BadRequest(new
            {
                message = "Incorrect password."
            });
        }

        // INVALIDATE SESSIONS
        var activeSessions = await _context.UserSessions
            .Where(s =>
                s.UserId == user.UserId &&
                s.IsActive)
            .ToListAsync();

        foreach (var session in activeSessions)
        {
            session.IsActive = false;
        }

        // DELETE ACCOUNT
        _context.Users.Remove(user);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Your account has been deleted successfully."
        });
    }

    // LOGIN HISTORY LIMITS
    private const int SessionHistoryDays = 30;
    private const int SessionHistoryLimit = 20;

    // GET SESSIONS
    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions()
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User identity could not be determined."
            });
        }

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        var currentToken = GetCurrentToken();
        var now = DateTime.UtcNow;
        var historyStart = now.AddDays(-SessionHistoryDays);

        // ACTIVE SESSIONS + LAST 30 DAYS
        var sessions = await _context.UserSessions
            .AsNoTracking()
            .Where(s =>
                s.UserId == userId &&
                ((s.IsActive && s.ExpiresAt > now) ||
                 s.CreatedAt >= historyStart))
            .ToListAsync();

        // MAP TO RESPONSE (NO TOKEN)
        var items = sessions
            .Select(s =>
            {
                var isActive = s.IsActive && s.ExpiresAt > now;

                // STILL ACTIVE BUT PAST EXPIRY = EXPIRED
                var status = isActive
                    ? "Active"
                    : s.IsActive ? "Expired" : "LoggedOut";

                DateTime? endedAt = status switch
                {
                    "Expired" => s.ExpiresAt,
                    "LoggedOut" => s.LoggedOutAt,
                    _ => null
                };

                return new
                {
                    sessionId = s.SessionId,
                    device = s.Device,
                    browser = s.Browser,
                    ipAddress = s.IpAddress,
                    createdAt = AsUtc(s.CreatedAt),
                    lastActiveAt = AsUtc(
                        s.LastActiveAt ?? s.CreatedAt),
                    endedAt = endedAt.HasValue
                        ? AsUtc(endedAt.Value)
                        : (DateTime?)null,
                    status,
                    logoutReason = s.LogoutReason,
                    isCurrent = s.Token == currentToken
                };
            })
            .ToList();

        // CURRENT DEVICE FIRST
        var active = items
            .Where(s => s.status == "Active")
            .OrderByDescending(s => s.isCurrent)
            .ThenByDescending(s => s.lastActiveAt);

        // NEWEST FIRST
        var history = items
            .Where(s => s.status != "Active")
            .OrderByDescending(s => s.endedAt ?? s.createdAt)
            .Take(SessionHistoryLimit);

        return Ok(active.Concat(history).ToList());
    }

    // LOG OUT ONE SESSION
    [HttpPost("sessions/{sessionId:int}/logout")]
    public async Task<IActionResult> LogoutSession(int sessionId)
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User identity could not be determined."
            });
        }

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        // MUST BELONG TO THIS USER
        var session = await _context.UserSessions
            .FirstOrDefaultAsync(s =>
                s.SessionId == sessionId &&
                s.UserId == userId &&
                s.IsActive);

        if (session == null)
        {
            return NotFound(new
            {
                message = "Active session not found."
            });
        }

        // BLOCK CURRENT SESSION
        if (session.Token == GetCurrentToken())
        {
            return BadRequest(new
            {
                message = "You cannot log out your current session here. Use the Log Out button instead."
            });
        }

        session.IsActive = false;
        session.LoggedOutAt = DateTime.UtcNow;
        session.LogoutReason = SessionLogoutReasons.LoggedOutRemotely;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Session logged out successfully."
        });
    }

    // LOG OUT OTHER SESSIONS
    [HttpPost("sessions/logout-others")]
    public async Task<IActionResult> LogoutOtherSessions()
    {
        var userIdClaim = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Unauthorized(new
            {
                message = "User identity could not be determined."
            });
        }

        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new
            {
                message = "Invalid user identity."
            });
        }

        // EVERY ACTIVE SESSION EXCEPT THIS ONE
        var currentToken = GetCurrentToken();

        var otherSessions = await _context.UserSessions
            .Where(s =>
                s.UserId == userId &&
                s.IsActive &&
                s.Token != currentToken)
            .ToListAsync();

        var loggedOutAt = DateTime.UtcNow;

        foreach (var session in otherSessions)
        {
            session.IsActive = false;
            session.LoggedOutAt = loggedOutAt;
            session.LogoutReason = SessionLogoutReasons.LoggedOutRemotely;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = otherSessions.Count == 1
                ? "1 other session was logged out."
                : $"{otherSessions.Count} other sessions were logged out.",
            count = otherSessions.Count
        });
    }

    // MARK DB DATES AS UTC
    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    // GET CURRENT TOKEN
    private string GetCurrentToken()
    {
        return Request.Cookies["ecoroute_auth"] ?? string.Empty;
    }
}