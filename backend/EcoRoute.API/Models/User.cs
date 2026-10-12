
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

    public DateTime? PasswordChangedAt { get; set; }

    public bool TwoFactorEnabled { get; set; }

    // False until the user finishes onboarding or chooses Start from Scratch.
    public bool IsOnboardingComplete { get; set; } = false;
}
