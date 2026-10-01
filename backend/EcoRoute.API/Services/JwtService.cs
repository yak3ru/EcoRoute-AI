using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EcoRoute.API.Models;
using Microsoft.IdentityModel.Tokens;

namespace EcoRoute.API.Services;

public class JwtService
{
    private readonly IConfiguration _configuration;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(User user, bool rememberMe)
    {
        var key = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT key is missing.");

        var issuer = _configuration["Jwt:Issuer"];
        var audience = _configuration["Jwt:Audience"];

        var normalExpiryMinutes =
            int.TryParse(
                _configuration["Jwt:ExpiresMinutes"],
                out var minutes)
                ? minutes
                : 60;

        // REMEMBER ME

        var expiryMinutes = rememberMe
            ? 60 * 24 * 30
            : normalExpiryMinutes;

        // CLAIMS

        var claims = new List<Claim>
        {
            // UNIQUE ID SO EVERY TOKEN IS DIFFERENT
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("fullName", user.FullName)
        };

        // SIGNING KEY

        var securityKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(key));

        var credentials = new SigningCredentials(
            securityKey,
            SecurityAlgorithms.HmacSha256);

        // CREATE TOKEN

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public DateTime GetExpiration(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(token);

        return jwtToken.ValidTo;
    }
}