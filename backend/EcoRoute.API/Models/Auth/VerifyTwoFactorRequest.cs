namespace EcoRoute.API.Models.Auth;

public class VerifyTwoFactorRequest
{
    public string ChallengeId { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}
