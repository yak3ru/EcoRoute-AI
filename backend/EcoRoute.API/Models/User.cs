namespace EcoRoute.API.Models;

public class User
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Administrator";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAt { get; set; }
    public DateTime? PasswordResetLastSentAt { get; set; }

    // NULL FOR OLD ACCOUNTS, FALLS BACK TO CreatedAt
    public DateTime? PasswordChangedAt { get; set; }

    // OFF BY DEFAULT, USERS TURN IT ON IN SETTINGS
    public bool TwoFactorEnabled { get; set; }
}