using BCrypt.Net;
using EcoRoute.API.Data;
using EcoRoute.API.Models;
using EcoRoute.API.Models.Auth;
using EcoRoute.API.Models.Account;
using EcoRoute.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.CookiePolicy;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly EcoRouteDbContext _context;
    private readonly JwtService _jwtService;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;

    // 2FA SETTINGS
    private const string TrustedDeviceCookieName = "ecoroute_trusted_device";
    private const int CodeExpiryMinutes = 5;
    private const int MaxVerifyAttempts = 5;
    private const int ResendCooldownSeconds = 60;
    private const int MaxResends = 5;
    private const int ChallengeLifetimeMinutes = 15;
    private const int TrustedDeviceDays = 30;

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
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UsernameOrEmail) ||
            string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new
            {
                message = "Username/email and password are required."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Username == request.UsernameOrEmail ||
                u.Email == request.UsernameOrEmail);

        if (user == null ||
            !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new
            {
                message = "Invalid username/email or password."
            });
        }

        if (!user.TwoFactorEnabled)
        {
            return Ok(await CreateSessionAsync(user, request.RememberMe));
        }

        // TRUSTED DEVICE: SKIP 2FA
        var trustedDevice = await FindTrustedDeviceAsync(user.UserId);

        if (trustedDevice != null)
        {
            trustedDevice.LastUsedAt = DateTime.UtcNow;
            return Ok(await CreateSessionAsync(user, request.RememberMe));
        }

        var now = DateTime.UtcNow;

        // REUSE A CODE SENT IN THE LAST 60s
        var recentChallenge = await _context.TwoFactorChallenges
            .Where(c =>
                c.UserId == user.UserId &&
                c.Status == TwoFactorChallengeStatuses.Pending &&
                c.ExpiresAt > now &&
                c.LastSentAt > now.AddSeconds(-ResendCooldownSeconds))
            .OrderByDescending(c => c.LastSentAt)
            .FirstOrDefaultAsync();

        if (recentChallenge != null)
        {
            recentChallenge.RememberMe = request.RememberMe;
            await _context.SaveChangesAsync();

            return Ok(BuildTwoFactorResponse(recentChallenge, user, now));
        }

        // NEW CODE: CANCEL OLDER ONES
        await _context.TwoFactorChallenges
            .Where(c =>
                c.UserId == user.UserId &&
                c.Status == TwoFactorChallengeStatuses.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, TwoFactorChallengeStatuses.Replaced));

        var code = GenerateCode();

        var challenge = new TwoFactorChallenge
        {
            ChallengeId = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
            UserId = user.UserId,
            CodeHash = BCrypt.Net.BCrypt.HashPassword(code),
            RememberMe = request.RememberMe,
            Status = TwoFactorChallengeStatuses.Pending,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(CodeExpiryMinutes),
            LastSentAt = now
        };

        // SEND FIRST, SAVE AFTER
        try
        {
            await _emailService.SendTwoFactorCodeEmailAsync(
                user.Email,
                user.FullName,
                code);
        }
        catch (Exception)
        {
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    message = "We could not send your verification code. Please try again later."
                });
        }

        _context.TwoFactorChallenges.Add(challenge);
        await _context.SaveChangesAsync();

        // NO JWT UNTIL THE CODE IS VERIFIED
        return Ok(BuildTwoFactorResponse(challenge, user, now));
    }

    // VERIFY 2FA CODE
    [HttpPost("verify-two-factor")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> VerifyTwoFactor(VerifyTwoFactorRequest request)
    {
        // Validates the 2FA challenge before creating an authenticated session.
        if (string.IsNullOrWhiteSpace(request.ChallengeId))
        {
            return TwoFactorError(
                "INVALID_CHALLENGE",
                "This verification session is invalid. Please log in again.");
        }

        var code = request.Code?.Trim() ?? string.Empty;

        if (code.Length != 4 || !code.All(char.IsAsciiDigit))
        {
            return TwoFactorError("INVALID_CODE", "Please enter the 4-digit code.");
        }

        var challenge = await _context.TwoFactorChallenges
            .AsNoTracking()
            .Include(c => c.User)
            .FirstOrDefaultAsync(c =>
                c.ChallengeId == request.ChallengeId);

        if (challenge?.User == null)
        {
            return TwoFactorError(
                "INVALID_CHALLENGE",
                "This verification session is invalid. Please log in again.");
        }

        switch (challenge.Status)
        {
            case TwoFactorChallengeStatuses.Verified:
                return TwoFactorError(
                    "CODE_USED",
                    "This code has already been used. Please log in again.");

            case TwoFactorChallengeStatuses.Locked:
                return TwoFactorError(
                    "TOO_MANY_ATTEMPTS",
                    "Too many incorrect attempts. Please log in again.");

            case TwoFactorChallengeStatuses.Replaced:
                return TwoFactorError(
                    "INVALID_CHALLENGE",
                    "A newer code was requested. Please log in again.");
        }

        var now = DateTime.UtcNow;

        if (challenge.ExpiresAt <= now)
        {
            return TwoFactorError(
                "CODE_EXPIRED",
                "This code has expired. Please log in again.");
        }

        // COUNT THE ATTEMPT IN THE DB FIRST (BLOCKS PARALLEL GUESSES)
        var reserved = await _context.TwoFactorChallenges
            .Where(c =>
                c.TwoFactorChallengeId == challenge.TwoFactorChallengeId &&
                c.Status == TwoFactorChallengeStatuses.Pending &&
                c.FailedAttempts < MaxVerifyAttempts)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.FailedAttempts, c => c.FailedAttempts + 1));

        if (reserved == 0)
        {
            return TwoFactorError(
                "TOO_MANY_ATTEMPTS",
                "Too many incorrect attempts. Please log in again.");
        }

        // WRONG CODE
        if (!BCrypt.Net.BCrypt.Verify(code, challenge.CodeHash))
        {
            var attemptsRemaining =
                MaxVerifyAttempts - (challenge.FailedAttempts + 1);

            if (attemptsRemaining <= 0)
            {
                await _context.TwoFactorChallenges
                    .Where(c => c.TwoFactorChallengeId == challenge.TwoFactorChallengeId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(c => c.Status, TwoFactorChallengeStatuses.Locked));

                return TwoFactorError(
                    "TOO_MANY_ATTEMPTS",
                    "Too many incorrect attempts. Please log in again.");
            }

            return BadRequest(new
            {
                errorCode = "INVALID_CODE",
                message = $"Incorrect code. {attemptsRemaining} attempt(s) remaining.",
                attemptsRemaining
            });
        }

        // CORRECT CODE: MARK AS USED AND GIVE THE ATTEMPT BACK
        var verified = await _context.TwoFactorChallenges
            .Where(c =>
                c.TwoFactorChallengeId == challenge.TwoFactorChallengeId &&
                c.Status == TwoFactorChallengeStatuses.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, TwoFactorChallengeStatuses.Verified)
                .SetProperty(c => c.VerifiedAt, (DateTime?)now)
                .SetProperty(c => c.FailedAttempts, c => c.FailedAttempts - 1));

        if (verified == 0)
        {
            return TwoFactorError(
                "CODE_USED",
                "This code has already been used. Please log in again.");
        }

        // ONLY TRUST THE DEVICE WHEN REMEMBER ME IS CHECKED
        if (challenge.RememberMe)
        {
            IssueTrustedDevice(challenge.UserId, now);
        }

        return Ok(await CreateSessionAsync(challenge.User, challenge.RememberMe));
    }

    // RESEND 2FA CODE
    [HttpPost("resend-two-factor-code")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResendTwoFactorCode(
        ResendTwoFactorCodeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ChallengeId))
        {
            return TwoFactorError(
                "INVALID_CHALLENGE",
                "This verification session is invalid. Please log in again.");
        }

        var challenge = await _context.TwoFactorChallenges
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.ChallengeId == request.ChallengeId);

        if (challenge?.User == null ||
            challenge.Status != TwoFactorChallengeStatuses.Pending)
        {
            return TwoFactorError(
                "INVALID_CHALLENGE",
                "This verification session is no longer valid. Please log in again.");
        }

        var now = DateTime.UtcNow;

        if (challenge.CreatedAt.AddMinutes(ChallengeLifetimeMinutes) <= now)
        {
            return TwoFactorError(
                "CHALLENGE_EXPIRED",
                "This verification session has expired. Please log in again.");
        }

        // 60 SECOND COOLDOWN
        var secondsSinceLastSend = (now - challenge.LastSentAt).TotalSeconds;

        if (secondsSinceLastSend < ResendCooldownSeconds)
        {
            var retryAfterSeconds =
                (int)Math.Ceiling(ResendCooldownSeconds - secondsSinceLastSend);

            return StatusCode(
                StatusCodes.Status429TooManyRequests,
                new
                {
                    errorCode = "RESEND_COOLDOWN",
                    message = $"Please wait {retryAfterSeconds} seconds before requesting a new code.",
                    retryAfterSeconds
                });
        }

        if (challenge.ResendCount >= MaxResends)
        {
            return StatusCode(
                StatusCodes.Status429TooManyRequests,
                new
                {
                    errorCode = "TOO_MANY_RESENDS",
                    message = "Too many codes requested. Please log in again."
                });
        }

        var code = GenerateCode();

        try
        {
            await _emailService.SendTwoFactorCodeEmailAsync(
                challenge.User.Email,
                challenge.User.FullName,
                code);
        }
        catch (Exception)
        {
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    message = "We could not send your verification code. Please try again later."
                });
        }

        // FAILED ATTEMPTS ARE NOT RESET
        challenge.CodeHash = BCrypt.Net.BCrypt.HashPassword(code);
        challenge.ExpiresAt = now.AddMinutes(CodeExpiryMinutes);
        challenge.LastSentAt = now;
        challenge.ResendCount++;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "A new verification code has been sent.",
            expiresInSeconds = CodeExpiryMinutes * 60,
            resendAvailableInSeconds = ResendCooldownSeconds
        });
    }

    // LOGOUT
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var token = Request.Cookies["ecoroute_auth"];
        if(string.IsNullOrWhiteSpace(token))
            return Unauthorized (new { message = "Authorization token is required"});

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
        session.LoggedOutAt = DateTime.UtcNow;
        session.LogoutReason = SessionLogoutReasons.SignedOut;

        await _context.SaveChangesAsync();

        Response.Cookies.Delete("ecoroute_auth", new CookieOptions { Path = "/api", Secure = true, SameSite = SameSiteMode.Lax});
        
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
            _configuration["FrontendUrl"];

        if (string.IsNullOrWhiteSpace(frontendUrl))
        {
            return StatusCode(
                500,
                new
                {
                    message = "FrontendUrl is not configured."
                }
            );
        }

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
        user.PasswordChangedAt = user.UpdatedAt;

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

        var loggedOutAt = DateTime.UtcNow;

        foreach (var session in activeSessions)
        {
            session.IsActive = false;
            session.LoggedOutAt = loggedOutAt;
            session.LogoutReason = SessionLogoutReasons.PasswordReset;
        }

        // REVOKE TRUSTED DEVICES
        await _context.TrustedDevices
            .Where(d =>
                d.UserId == user.UserId &&
                d.RevokedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.RevokedAt, (DateTime?)loggedOutAt));

        // SAVE
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Your password has been reset successfully."
        });
    }

    // HELPERS
    private async Task<AuthResponse> CreateSessionAsync(User user, bool rememberMe)
    {
        var token = _jwtService.GenerateToken(user, rememberMe);
        var expiration = _jwtService.GetExpiration(token);

        var userAgent = Request.Headers.UserAgent.ToString();
        var clientHints = Request.Headers["Sec-CH-UA"].ToString();

        var now = DateTime.UtcNow;

        _context.UserSessions.Add(new UserSession
        {
            UserId = user.UserId,
            Token = token,
            CreatedAt = now,
            LastActiveAt = now,
            ExpiresAt = expiration,
            IsActive = true,
            Device = UserAgentParser.GetDevice(userAgent),
            Browser = UserAgentParser.GetBrowser(userAgent, clientHints),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();
        
        //set the cookie when a session is created
        Response.Cookies.Append("ecoroute_auth", token, new CookieOptions
        {
            HttpOnly=true,
            Secure=true,
            SameSite = SameSiteMode.Lax,
            Path="/api",
            Expires=rememberMe ? expiration : null, // null = cookie ends when browser closes
            IsEssential = true

        });
        
        return new AuthResponse
        {
            UserId = user.UserId,
            FullName = user.FullName,
            Email = user.Email,
            Username = user.Username,
            Role = user.Role
        };

    
       
    }

    private async Task<TrustedDevice?> FindTrustedDeviceAsync(int userId)
    {
        if (!Request.Cookies.TryGetValue(TrustedDeviceCookieName, out var deviceToken) ||
            string.IsNullOrWhiteSpace(deviceToken))
        {
            return null;
        }

        var tokenHash = HashToken(deviceToken);
        var now = DateTime.UtcNow;

        // ONLY THE COOKIE DECIDES TRUST, NOT IP OR BROWSER
        return await _context.TrustedDevices
            .FirstOrDefaultAsync(d =>
                d.UserId == userId &&
                d.TokenHash == tokenHash &&
                d.RevokedAt == null &&
                d.ExpiresAt > now);
    }

    private void IssueTrustedDevice(int userId, DateTime now)
    {
        var deviceToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiresAt = now.AddDays(TrustedDeviceDays);
        var userAgent = Request.Headers.UserAgent.ToString();

        _context.TrustedDevices.Add(new TrustedDevice
        {
            UserId = userId,
            TokenHash = HashToken(deviceToken),
            CreatedAt = now,
            ExpiresAt = expiresAt,
            LastUsedAt = now,
            Device = UserAgentParser.GetDevice(userAgent),
            Browser = UserAgentParser.GetBrowser(
                userAgent,
                Request.Headers["Sec-CH-UA"].ToString())
        });

        Response.Cookies.Append(
            TrustedDeviceCookieName,
            deviceToken,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Expires = expiresAt,
                Path = "/api/Auth",
                IsEssential = true
            });
    }

    private static TwoFactorRequiredResponse BuildTwoFactorResponse(
        TwoFactorChallenge challenge,
        User user,
        DateTime now)
    {
        return new TwoFactorRequiredResponse
        {
            ChallengeId = challenge.ChallengeId,
            MaskedEmail = MaskEmail(user.Email),
            ExpiresInSeconds =
                (int)Math.Max(0, (challenge.ExpiresAt - now).TotalSeconds),
            ResendAvailableInSeconds =
                (int)Math.Max(0, Math.Ceiling(
                    ResendCooldownSeconds - (now - challenge.LastSentAt).TotalSeconds))
        };
    }

    private BadRequestObjectResult TwoFactorError(string errorCode, string message)
    {
        return BadRequest(new { errorCode, message });
    }

    private static string GenerateCode()
    {
        return RandomNumberGenerator.GetInt32(0, 10000).ToString("D4");
    }

    private static string HashToken(string token)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }

    // r••••••@gmail.com
    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');

        if (at <= 1)
        {
            return email;
        }

        return email[0] + new string('•', at - 1) + email[at..];
    }
}