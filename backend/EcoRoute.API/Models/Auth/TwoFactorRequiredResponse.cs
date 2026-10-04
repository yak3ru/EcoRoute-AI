namespace EcoRoute.API.Models.Auth;

public class TwoFactorRequiredResponse
{
    public bool RequiresTwoFactor => true;
    public string ChallengeId { get; set; } = string.Empty;
    public string MaskedEmail { get; set; } = string.Empty;
    public int ExpiresInSeconds { get; set; }
    public int ResendAvailableInSeconds { get; set; }
}
