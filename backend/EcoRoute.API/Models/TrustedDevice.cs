namespace EcoRoute.API.Models;

public class TrustedDevice
{
    public int TrustedDeviceId { get; set; }
    public int UserId { get; set; }

    // SHA-256 HASH OF THE COOKIE TOKEN
    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    // DISPLAY ONLY
    public string? Device { get; set; }
    public string? Browser { get; set; }

    public User? User { get; set; }
}
