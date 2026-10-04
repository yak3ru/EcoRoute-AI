namespace EcoRoute.API.Models;

public class TwoFactorChallenge
{
    public int TwoFactorChallengeId { get; set; }

    // RANDOM ID SENT TO THE FRONTEND
    public string ChallengeId { get; set; } = string.Empty;

    public int UserId { get; set; }

    // BCRYPT HASH OF THE CODE
    public string CodeHash { get; set; } = string.Empty;

    public bool RememberMe { get; set; }
    public int FailedAttempts { get; set; }
    public int ResendCount { get; set; }
    public string Status { get; set; } = TwoFactorChallengeStatuses.Pending;

    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime LastSentAt { get; set; }
    public DateTime? VerifiedAt { get; set; }

    public User? User { get; set; }
}
