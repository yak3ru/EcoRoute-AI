namespace EcoRoute.API.Models.Auth;

public class ResendTwoFactorCodeRequest
{
    public string ChallengeId { get; set; } = string.Empty;
}
