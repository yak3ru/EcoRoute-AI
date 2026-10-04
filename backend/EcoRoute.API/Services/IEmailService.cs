namespace EcoRoute.API.Services;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(
        string recipientEmail,
        string recipientName,
        string resetUrl);

    Task SendTwoFactorCodeEmailAsync(
        string recipientEmail,
        string recipientName,
        string twoFactorCode);
}