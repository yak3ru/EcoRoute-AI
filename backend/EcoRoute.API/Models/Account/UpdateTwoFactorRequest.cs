namespace EcoRoute.API.Models.Account;

public class UpdateTwoFactorRequest
{
    public bool Enabled { get; set; }

    // NEEDED TO TURN 2FA OFF
    public string? CurrentPassword { get; set; }
}
