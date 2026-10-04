using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace EcoRoute.API.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public EmailService(
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        _configuration = configuration;
        _environment = environment;
    }

    public async Task SendPasswordResetEmailAsync(
        string email,
        string fullName,
        string resetUrl)
    {
        // EMAIL SETTINGS

        var smtpHost =
            _configuration["Email:SmtpHost"]
            ?? throw new InvalidOperationException(
                "Email:SmtpHost is not configured.");

        var smtpPort =
            int.Parse(
                _configuration["Email:SmtpPort"] ?? "587");

        var username =
            _configuration["Email:Username"]
            ?? throw new InvalidOperationException(
                "Email:Username is not configured.");

        var password =
            _configuration["Email:SmtpPassword"]
            ?? throw new InvalidOperationException(
                "Email:SmtpPassword is not configured.");

        var fromAddress =
            _configuration["Email:FromAddress"]
            ?? username;

        var fromName =
            _configuration["Email:FromName"]
            ?? "EcoRoute AI";

        // EMAIL ASSETS

        var emailAssetsPath = Path.Combine(
            _environment.ContentRootPath,
            "EmailAssets");

        var logoPath = Path.Combine(
            emailAssetsPath,
            "ecoroute-logo.svg");

        var mailIconPath = Path.Combine(
            emailAssetsPath,
            "mail.svg");

        var lockShieldPath = Path.Combine(
            emailAssetsPath,
            "lock-shield.svg");

        // CREATE EMAIL

        var message = new MimeMessage();

        message.From.Add(
            new MailboxAddress(
                fromName,
                fromAddress));

        message.To.Add(
            new MailboxAddress(
                fullName,
                email));

        message.Subject =
            "Reset Your EcoRoute AI Password";

        // CREATE EMAIL BODY

        var bodyBuilder = new BodyBuilder();

        var html = $@"
<!DOCTYPE html>
<html lang=""en"">

<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport""
          content=""width=device-width, initial-scale=1.0"">

    <title>Reset Your EcoRoute AI Password</title>
</head>

<body style=""
    margin:0;
    padding:0;
    background:#f5f7f8;
    font-family:Arial, Helvetica, sans-serif;
    color:#101828;
"">

    <!-- BACKGROUND -->

    <table
        width=""100%""
        cellpadding=""0""
        cellspacing=""0""
        border=""0""
        style=""
            background:#f5f7f8;
            padding:40px 20px;
        ""
    >

        <tr>

            <td align=""center"">

                <!-- MAIN CARD -->

                <table
                    width=""100%""
                    cellpadding=""0""
                    cellspacing=""0""
                    border=""0""
                    style=""
                        max-width:720px;
                        background:#ffffff;
                        border:1px solid #e4e7ec;
                        border-radius:16px;
                        overflow:hidden;
                    ""
                >

                    <tr>

                        <td
                            style=""
                                padding:42px 40px 30px 40px;
                                text-align:center;
                            ""
                        >

                            <!-- BRAND -->

                            <table
                                cellpadding=""0""
                                cellspacing=""0""
                                border=""0""
                                align=""center""
                            >

                                <tr>

                                    <td
                                        valign=""middle""
                                        style=""
                                            padding-right:14px;
                                        ""
                                    >

                                        <img
                                            src=""cid:ecoroute-logo""
                                            alt=""EcoRoute AI""
                                            width=""78""
                                            height=""78""
                                            style=""
                                                display:block;
                                                width:78px;
                                                height:78px;
                                            ""
                                        />

                                    </td>

                                    <td
                                        valign=""middle""
                                        align=""left""
                                    >

                                        <div
                                            style=""
                                                font-family:Arial, Helvetica, sans-serif;
                                                font-size:28px;
                                                line-height:1.1;
                                                font-weight:700;
                                                color:#101828;
                                                white-space:nowrap;
                                            ""
                                        >
                                            EcoRoute AI
                                        </div>

                                        <div
                                            style=""
                                                margin-top:3px;
                                                font-family:Arial, Helvetica, sans-serif;
                                                font-size:15px;
                                                line-height:1.3;
                                                font-weight:400;
                                                color:#475467;
                                                white-space:nowrap;
                                            ""
                                        >
                                            The Developers Company
                                        </div>

                                    </td>

                                </tr>

                            </table>

                            <!-- MAIL ICON -->

                            <div
                                style=""
                                    height:35px;
                                    line-height:35px;
                                ""
                            >
                                &nbsp;
                            </div>

                            <table
                                width=""130""
                                height=""130""
                                cellpadding=""0""
                                cellspacing=""0""
                                border=""0""
                                align=""center""
                                style=""
                                    width:130px;
                                    height:130px;
                                    background:#effaf2;
                                    border-radius:50%;
                                ""
                            >

                                <tr>

                                    <td
                                        align=""center""
                                        valign=""middle""
                                    >

                                        <img
                                            src=""cid:mail-icon""
                                            alt=""Password Reset""
                                            width=""85""
                                            height=""85""
                                            style=""
                                                display:block;
                                                width:85px;
                                                height:85px;
                                            ""
                                        />

                                    </td>

                                </tr>

                            </table>

                            <!-- TITLE -->

                            <div
                                style=""
                                    height:30px;
                                    line-height:30px;
                                ""
                            >
                                &nbsp;
                            </div>

                            <h1
                                style=""
                                    margin:0;
                                    padding:0;
                                    font-size:40px;
                                    line-height:1.2;
                                    font-weight:700;
                                    color:#101828;
                                ""
                            >
                                Reset Your Password
                            </h1>

                            <div
                                style=""
                                    height:20px;
                                    line-height:20px;
                                ""
                            >
                                &nbsp;
                            </div>

                            <!-- MESSAGE -->

                            <p
                                style=""
                                    margin:0;
                                    font-size:22px;
                                    line-height:1.5;
                                    color:#475467;
                                ""
                            >
                                Hi {System.Net.WebUtility.HtmlEncode(fullName)},
                            </p>

                            <p
                                style=""
                                    margin:18px auto 0 auto;
                                    max-width:620px;
                                    font-size:19px;
                                    line-height:1.55;
                                    color:#475467;
                                ""
                            >
                                We received a request to reset your
                                EcoRoute AI account password.
                                <br>
                                Click the button below to create a
                                new password.
                            </p>

                            <!-- RESET BUTTON -->

                            <div
                                style=""
                                    height:28px;
                                    line-height:28px;
                                ""
                            >
                                &nbsp;
                            </div>

                            <table
                                cellpadding=""0""
                                cellspacing=""0""
                                border=""0""
                                align=""center""
                                width=""430""
                                style=""max-width:100%;""
                            >

                                <tr>

                                    <td
                                        align=""center""
                                        bgcolor=""#209b2a""
                                        style=""
                                            border-radius:10px;
                                        ""
                                    >

                                        <a
                                            href=""{resetUrl}""
                                            target=""_blank""
                                            style=""
                                                display:block;
                                                padding:18px 25px;
                                                font-size:20px;
                                                font-weight:700;
                                                color:#ffffff;
                                                text-decoration:none;
                                            ""
                                        >
                                            Reset Password

                                            <span
                                                style=""
                                                    font-size:25px;
                                                    margin-left:10px;
                                                ""
                                            >
                                                →
                                            </span>
                                        </a>

                                    </td>

                                </tr>

                            </table>

                            <!-- EXPIRATION -->

                            <p
                                style=""
                                    margin:16px 0 0 0;
                                    font-size:16px;
                                    line-height:1.5;
                                    color:#667085;
                                ""
                            >
                                This link will expire in
                                <strong>1 hour</strong>
                                for your security.
                            </p>

                        </td>

                    </tr>

                    <!-- DIVIDER -->

                    <tr>

                        <td
                            style=""
                                padding:0 40px;
                            ""
                        >

                            <div
                                style=""
                                    height:1px;
                                    background:#e4e7ec;
                                    width:100%;
                                ""
                            >
                            </div>

                        </td>

                    </tr>

                    <!-- SECURITY NOTICE -->

                    <tr>

                        <td
                            style=""
                                padding:24px 40px 35px 40px;
                            ""
                        >

                            <table
                                width=""100%""
                                cellpadding=""0""
                                cellspacing=""0""
                                border=""0""
                                style=""
                                    background:#effaf2;
                                    border-radius:10px;
                                ""
                            >

                                <tr>

                                    <td
                                        width=""70""
                                        valign=""middle""
                                        align=""center""
                                        style=""
                                            padding:20px 5px 20px 15px;
                                        ""
                                    >

                                        <img
                                            src=""cid:lock-shield""
                                            alt=""Security""
                                            width=""42""
                                            height=""42""
                                            style=""
                                                display:block;
                                                width:42px;
                                                height:42px;
                                            ""
                                        />

                                    </td>

                                    <td
                                        valign=""middle""
                                        style=""
                                            padding:18px 20px 18px 5px;
                                        ""
                                    >

                                        <p
                                            style=""
                                                margin:0 0 6px 0;
                                                font-size:17px;
                                                line-height:1.4;
                                                font-weight:700;
                                                color:#187727;
                                            ""
                                        >
                                            Didn't request this?
                                        </p>

                                        <p
                                            style=""
                                                margin:0;
                                                font-size:15px;
                                                line-height:1.55;
                                                color:#367c4b;
                                            ""
                                        >
                                            If you didn't request a password
                                            reset, you can safely ignore this
                                            email. Your account will remain
                                            secure.
                                        </p>

                                    </td>

                                </tr>

                            </table>

                        </td>

                    </tr>

                </table>

                <!-- FOOTER -->

                <p
                    style=""
                        margin:22px 0 0 0;
                        font-size:13px;
                        line-height:1.5;
                        color:#98a2b3;
                        text-align:center;
                    ""
                >
                    © {DateTime.UtcNow.Year} EcoRoute AI.
                    All rights reserved.
                </p>

            </td>

        </tr>

    </table>

</body>

</html>
";

        bodyBuilder.HtmlBody = html;

        // EMBED LOGO

        if (File.Exists(logoPath))
        {
            var logo = bodyBuilder.LinkedResources.Add(logoPath);

            logo.ContentId = "ecoroute-logo";
            logo.ContentType.MediaType = "image";
            logo.ContentType.MediaSubtype = "svg+xml";
            logo.ContentDisposition = new ContentDisposition(
                ContentDisposition.Inline);
            logo.ContentDisposition.FileName = null;
        }

        // EMBED MAIL ICON

        if (File.Exists(mailIconPath))
        {
            var mailIcon = bodyBuilder.LinkedResources.Add(mailIconPath);

            mailIcon.ContentId = "mail-icon";
            mailIcon.ContentType.MediaType = "image";
            mailIcon.ContentType.MediaSubtype = "svg+xml";
            mailIcon.ContentDisposition = new ContentDisposition(
                ContentDisposition.Inline);
            mailIcon.ContentDisposition.FileName = null;
        }

        // EMBED SECURITY ICON

        if (File.Exists(lockShieldPath))
        {
            var lockShield = bodyBuilder.LinkedResources.Add(
                lockShieldPath);

            lockShield.ContentId = "lock-shield";
            lockShield.ContentType.MediaType = "image";
            lockShield.ContentType.MediaSubtype = "svg+xml";
            lockShield.ContentDisposition = new ContentDisposition(
                ContentDisposition.Inline);
            lockShield.ContentDisposition.FileName = null;
        }

        message.Body = bodyBuilder.ToMessageBody();

        // SEND EMAIL

        using var smtp = new SmtpClient();

        smtp.ServerCertificateValidationCallback =
            (sender, certificate, chain, sslPolicyErrors) =>
            {
                if (sslPolicyErrors ==
                    System.Net.Security.SslPolicyErrors.None)
                {
                    return true;
                }

                if (sslPolicyErrors ==
                    System.Net.Security.SslPolicyErrors.RemoteCertificateChainErrors)
                {
                    if (chain?.ChainStatus != null)
                    {
                        foreach (var status in chain.ChainStatus)
                        {
                            if (status.Status !=
                                    System.Security.Cryptography.X509Certificates
                                        .X509ChainStatusFlags.RevocationStatusUnknown &&
                                status.Status !=
                                    System.Security.Cryptography.X509Certificates
                                        .X509ChainStatusFlags.OfflineRevocation)
                            {
                                return false;
                            }
                        }

                        return true;
                    }
                }

                return false;
            };

        await smtp.ConnectAsync(
            smtpHost,
            smtpPort,
            SecureSocketOptions.StartTls);

        await smtp.AuthenticateAsync(
            username,
            password);

        await smtp.SendAsync(message);

        await smtp.DisconnectAsync(true);
    }

    // 2FA CODE (PLAIN TEXT FOR NOW)

    public async Task SendTwoFactorCodeEmailAsync(
        string email,
        string fullName,
        string code)
    {
        var message = CreateMessage(
            email,
            fullName,
            "Your EcoRoute AI Two-Factor Authentication Code");

        message.Body = new TextPart("plain")
        {
            Text = $"Your EcoRoute AI verification code is: {code}\n\n" +
                "This code expires in 5 minutes."
        };

        await SendMessageAsync(message);
    }

    private MimeMessage CreateMessage(
        string email,
        string fullName,
        string subject)
    {
        var username =
            _configuration["Email:Username"]
            ?? throw new InvalidOperationException(
                "Email:Username is not configured.");

        var fromAddress = _configuration["Email:FromAddress"] ?? username;
        var fromName = _configuration["Email:FromName"] ?? "EcoRoute AI";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        message.To.Add(new MailboxAddress(fullName, email));
        message.Subject = subject;

        return message;
    }

    private async Task SendMessageAsync(MimeMessage message)
    {
        var smtpHost =
            _configuration["Email:SmtpHost"]
            ?? throw new InvalidOperationException(
                "Email:SmtpHost is not configured.");

        var smtpPort = int.Parse(_configuration["Email:SmtpPort"] ?? "587");

        var username =
            _configuration["Email:Username"]
            ?? throw new InvalidOperationException(
                "Email:Username is not configured.");

        var password =
            _configuration["Email:SmtpPassword"]
            ?? throw new InvalidOperationException(
                "Email:SmtpPassword is not configured.");

        using var smtp = new SmtpClient();

        smtp.ServerCertificateValidationCallback =
            (sender, certificate, chain, sslPolicyErrors) =>
            {
                if (sslPolicyErrors ==
                    System.Net.Security.SslPolicyErrors.None)
                {
                    return true;
                }

                if (sslPolicyErrors ==
                    System.Net.Security.SslPolicyErrors.RemoteCertificateChainErrors)
                {
                    if (chain?.ChainStatus != null)
                    {
                        foreach (var status in chain.ChainStatus)
                        {
                            if (status.Status !=
                                    System.Security.Cryptography.X509Certificates
                                        .X509ChainStatusFlags.RevocationStatusUnknown &&
                                status.Status !=
                                    System.Security.Cryptography.X509Certificates
                                        .X509ChainStatusFlags.OfflineRevocation)
                            {
                                return false;
                            }
                        }

                        return true;
                    }
                }

                return false;
            };

        await smtp.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
        await smtp.AuthenticateAsync(username, password);
        await smtp.SendAsync(message);
        await smtp.DisconnectAsync(true);
    }
}
