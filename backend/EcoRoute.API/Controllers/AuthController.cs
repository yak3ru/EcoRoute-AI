using BCrypt.Net;
using EcoRoute.API.Data;
using EcoRoute.API.Models;
using EcoRoute.API.Models.Auth;
using EcoRoute.API.Models.Account;
using EcoRoute.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly EcoRouteDbContext _context;
    private readonly JwtService _jwtService;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;

    public AuthController(
        EcoRouteDbContext context,
        JwtService jwtService,
        IEmailService emailService,
        IConfiguration configuration)
    {
        _context = context;
        _jwtService = jwtService;
        _emailService = emailService;
        _configuration = configuration;
    }

    // REGISTER

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new
            {
                message = "All required fields must be provided."
            });
        }

        if (request.Password != request.ConfirmPassword)
        {
            return BadRequest(new
            {
                message = "Passwords do not match."
            });
        }

        if (!request.AgreeToTerms)
        {
            return BadRequest(new
            {
                message = "You must agree to the terms."
            });
        }

        // PASSWORD REQUIREMENTS

        if (request.Password.Length < 8)
        {
            return BadRequest(new
            {
                message = "Password must be at least 8 characters long."
            });
        }

        if (!request.Password.Any(char.IsUpper))
        {
            return BadRequest(new
            {
                message = "Password must include at least one uppercase letter."
            });
        }

        if (!request.Password.Any(char.IsLower))
        {
            return BadRequest(new
            {
                message = "Password must include at least one lowercase letter."
            });
        }

        if (!request.Password.Any(char.IsDigit))
        {
            return BadRequest(new
            {
                message = "Password must include at least one number."
            });
        }

        if (!request.Password.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            return BadRequest(new
            {
                message = "Password must include at least one special character."
            });
        }

        var emailExists = await _context.Users
            .AnyAsync(u => u.Email == request.Email);

        if (emailExists)
        {
            return Conflict(new
            {
                message = "Email is already registered."
            });
        }

        var usernameExists = await _context.Users
            .AnyAsync(u => u.Username == request.Username);

        if (usernameExists)
        {
            return Conflict(new
            {
                message = "Username is already taken."
            });
        }

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
            Username = request.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "User",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Account created successfully.",
            userId = user.UserId
        });
    }

    // LOGIN

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Username == request.UsernameOrEmail ||
                u.Email == request.UsernameOrEmail);

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "Invalid username/email or password."
            });
        }

        var passwordValid = BCrypt.Net.BCrypt.Verify(
            request.Password,
            user.PasswordHash);

        if (!passwordValid)
        {
            return Unauthorized(new
            {
                message = "Invalid username/email or password."
            });
        }

        // GENERATE TOKEN

        var token = _jwtService.GenerateToken(
            user,
            request.RememberMe);

        // GET EXPIRATION

        var expiration = _jwtService.GetExpiration(token);

        // CREATE SESSION

        var session = new UserSession
        {
            UserId = user.UserId,
            Token = token,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiration,
            IsActive = true
        };

        _context.UserSessions.Add(session);
        await _context.SaveChangesAsync();

        return Ok(new AuthResponse
        {
            Token = token,
            UserId = user.UserId,
            FullName = user.FullName,
            Email = user.Email,
            Username = user.Username,
            Role = user.Role
        });
    }

    // LOGOUT

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        if (!Request.Headers.TryGetValue(
            "Authorization",
            out var authorizationHeader))
        {
            return Unauthorized(new
            {
                message = "Authorization token is required."
            });
        }

        var token = authorizationHeader
            .ToString()
            .Replace("Bearer ", "", StringComparison.OrdinalIgnoreCase)
            .Trim();

        if (string.IsNullOrWhiteSpace(token))
        {
            return Unauthorized(new
            {
                message = "Authorization token is required."
            });
        }

        var session = await _context.UserSessions
            .FirstOrDefaultAsync(s =>
                s.Token == token &&
                s.IsActive);

        if (session == null)
        {
            return NotFound(new
            {
                message = "Active session not found."
            });
        }

        session.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Logged out successfully."
        });
    }

    // FORGOT PASSWORD

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(
        ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new
            {
                message = "Email is required."
            });
        }

        var email = request.Email.Trim().ToLower();

        var user = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Email.ToLower() == email);

        if (user == null)
        {
            return Ok(new
            {
                message =
                    "If an account exists for that email, " +
                    "a password reset link has been sent."
            });
        }

        // RESEND COOLDOWN

        if (user.PasswordResetLastSentAt.HasValue)
        {
            var secondsSinceLastEmail =
                (DateTime.UtcNow -
                user.PasswordResetLastSentAt.Value)
                .TotalSeconds;

            if (secondsSinceLastEmail < 60)
            {
                var remainingSeconds =
                    Math.Ceiling(60 - secondsSinceLastEmail);

                return StatusCode(
                    StatusCodes.Status429TooManyRequests,
                    new
                    {
                        message =
                            $"Please wait {remainingSeconds} seconds before requesting another password reset email."
                    });
            }
        }

        // GENERATE RESET TOKEN

        var resetToken = Convert.ToHexString(
            System.Security.Cryptography.RandomNumberGenerator
                .GetBytes(32));

        user.PasswordResetToken = resetToken;

        user.PasswordResetTokenExpiresAt =
            DateTime.UtcNow.AddHours(1);

        user.PasswordResetLastSentAt =
            DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // BUILD RESET URL

        var frontendUrl =
            _configuration["FrontendUrl"]
            ?? "http://localhost:4200";

        var encodedToken =
            Uri.EscapeDataString(resetToken);

        var resetUrl =
            $"{frontendUrl}/reset-password?token={encodedToken}";

        // SEND EMAIL

        try
        {
            await _emailService.SendPasswordResetEmailAsync(
                user.Email,
                user.FullName,
                resetUrl);
        }
        catch (Exception)
        {
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiresAt = null;
            user.PasswordResetLastSentAt = null;

            await _context.SaveChangesAsync();

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    message =
                        "We could not send the password reset email. " +
                        "Please try again later."
                });
        }

        return Ok(new
        {
            message =
                "If an account exists for that email, " +
                "a password reset link has been sent."
        });
    }

    // RESET PASSWORD

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request)
    {
        // VALIDATE TOKEN

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new
            {
                message = "This password reset link is invalid or incomplete."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.PasswordResetToken == request.Token);

        if (user == null)
        {
            return BadRequest(new
            {
                message = "This password reset link is invalid or has expired."
            });
        }

        // CHECK EXPIRATION

        if (!user.PasswordResetTokenExpiresAt.HasValue ||
            user.PasswordResetTokenExpiresAt.Value <= DateTime.UtcNow)
        {
            return BadRequest(new
            {
                message = "This password reset link has expired. Please request a new one."
            });
        }

        // PASSWORD VALIDATION

        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new
            {
                message = "New password is required."
            });
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmNewPassword))
        {
            return BadRequest(new
            {
                message = "Please confirm your new password."
            });
        }

        if (request.NewPassword != request.ConfirmNewPassword)
        {
            return BadRequest(new
            {
                message = "Passwords do not match."
            });
        }

        if (request.NewPassword.Length < 8)
        {
            return BadRequest(new
            {
                message = "Password must be at least 8 characters long."
            });
        }

        if (!request.NewPassword.Any(char.IsUpper))
        {
            return BadRequest(new
            {
                message = "Password must include at least one uppercase letter."
            });
        }

        if (!request.NewPassword.Any(char.IsLower))
        {
            return BadRequest(new
            {
                message = "Password must include at least one lowercase letter."
            });
        }

        if (!request.NewPassword.Any(char.IsDigit))
        {
            return BadRequest(new
            {
                message = "Password must include at least one number."
            });
        }

        if (!request.NewPassword.Any(
            ch => !char.IsLetterOrDigit(ch)))
        {
            return BadRequest(new
            {
                message = "Password must include at least one special character."
            });
        }

        // PREVENT PASSWORD REUSE

        if (BCrypt.Net.BCrypt.Verify(
            request.NewPassword,
            user.PasswordHash))
        {
            return BadRequest(new
            {
                message = "Your new password must be different from your current password."
            });
        }

        // UPDATE PASSWORD

        user.PasswordHash =
            BCrypt.Net.BCrypt.HashPassword(
                request.NewPassword);

        user.UpdatedAt = DateTime.UtcNow;

        // INVALIDATE RESET TOKEN

        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        user.PasswordResetLastSentAt = null;

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

        // SAVE

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Your password has been reset successfully."
        });
    }
}