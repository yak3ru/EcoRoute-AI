namespace EcoRoute.API.Models;

// REASONS SAVED IN user_sessions.LogoutReason

public static class SessionLogoutReasons
{
    public const string SignedOut = "SignedOut";                 // CLICKED LOG OUT
    public const string LoggedOutRemotely = "LoggedOutRemotely"; // FROM ANOTHER DEVICE
    public const string PasswordReset = "PasswordReset";         // AFTER PASSWORD RESET
}
