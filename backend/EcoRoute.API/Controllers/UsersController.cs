using System.Security.Claims;
using EcoRoute.API.Data;
using EcoRoute.API.Models.Account;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
            updatedAt = user.UpdatedAt
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
        var email = request.Email.Trim();
        var username = request.Username.Trim();

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

        // PASSWORD LENGTH

        if (request.NewPassword.Length < 8)
        {
            return BadRequest(new
            {
                message = "New password must be at least 8 characters long."
            });
        }

        // UPPERCASE

        if (!request.NewPassword.Any(char.IsUpper))
        {
            return BadRequest(new
            {
                message = "New password must include at least one uppercase letter."
            });
        }

        // LOWERCASE

        if (!request.NewPassword.Any(char.IsLower))
        {
            return BadRequest(new
            {
                message = "New password must include at least one lowercase letter."
            });
        }

        // NUMBER

        if (!request.NewPassword.Any(char.IsDigit))
        {
            return BadRequest(new
            {
                message = "New password must include at least one number."
            });
        }

        // SPECIAL CHARACTER

        if (!request.NewPassword.Any(
            ch => !char.IsLetterOrDigit(ch)))
        {
            return BadRequest(new
            {
                message = "New password must include at least one special character."
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

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Password changed successfully."
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
}