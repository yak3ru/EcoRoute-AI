namespace EcoRoute.API.Models;

public class UserSession
{
    public int SessionId { get; set; }
    public int UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsActive { get; set; }

    // DEVICE INFO

    public string? Device { get; set; }
    public string? Browser { get; set; }
    public string? IpAddress { get; set; }

    // ACTIVITY

    public DateTime? LastActiveAt { get; set; }
    public DateTime? LoggedOutAt { get; set; }
    public string? LogoutReason { get; set; }

    public User? User { get; set; }
}