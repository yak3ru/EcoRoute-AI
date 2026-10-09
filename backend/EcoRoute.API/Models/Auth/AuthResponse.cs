namespace EcoRoute.API.Models.Auth;

public class AuthResponse
{
    public int UserId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Username { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    // ALWAYS FALSE HERE, SEE TwoFactorRequiredResponse
    public bool RequiresTwoFactor => false;
}