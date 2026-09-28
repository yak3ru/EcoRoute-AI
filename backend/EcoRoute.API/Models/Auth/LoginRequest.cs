namespace EcoRoute.API.Models.Auth;

public class LoginRequest
{
    public string UsernameOrEmail { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public bool RememberMe { get; set; }
}