using System.Net.Mail;
using System.Text.RegularExpressions;
using DnsClient;

namespace EcoRoute.API.Services;

public static class UserInputValidator
{
        private static readonly LookupClient DnsLookup = new(new LookupClientOptions
    {
        Timeout = TimeSpan.FromSeconds(3),
        Retries = 1,
        UseCache = true
    });

    // EMAIL DOMAIN (MUST BE ABLE TO RECEIVE EMAIL)
    public static async Task<string?> ValidateEmailDomainAsync(string email)
    {
        var domain = email[(email.LastIndexOf('@') + 1)..];

        try
        {
            var result = await DnsLookup.QueryAsync(domain, QueryType.MX);

            if (result.Header.ResponseCode == DnsHeaderResponseCode.NotExistentDomain)
                return "This email domain doesn't exist. Please check for typos.";

            if (!result.Answers.MxRecords().Any())
                return "This email domain can't receive emails. Please use a different email.";

            return null;
        }
        catch (DnsResponseException)
        {
            return null; // DNS UNAVAILABLE: DON'T BLOCK SIGNUP
        }
    }

    // FULL NAME
    public static string? ValidateFullName(string fullName)
    {
        if (fullName.Length < 2)
            return "Full name is too short.";
        if (fullName.Length > 150)
            return "Full name can't be longer than 150 characters.";
        if (fullName.Any(char.IsDigit))
            return "Full name can't contain numbers.";
        if (fullName.Any(ch => !char.IsLetter(ch) && ch != ' ' && ch != '.' && ch != '\'' && ch != '-'))
            return "Full name can't contain special characters (only . ' - are allowed).";
        if (!char.IsLetter(fullName[0]))
            return "Full name must start with a letter.";
        if (!fullName.Contains(' '))
            return "Please enter both your first and last name.";
        return null;
    }

    // EMAIL
    public static string? ValidateEmail(string email)
    {
        if (email.Length > 150)
            return "Email can't be longer than 150 characters.";
        if (email.Any(char.IsWhiteSpace))
            return "Email can't contain spaces.";
        if (!email.Contains('@'))
            return "Email must contain an @ symbol.";
        if (email.Count(ch => ch == '@') > 1)
            return "Email can only contain one @ symbol.";

        var parts = email.Split('@');
        if (parts[0].Length == 0)
            return "Please enter the part before the @ (e.g. juan@gmail.com).";
        if (parts[1].Length == 0)
            return "Please enter the domain after the @ (e.g. gmail.com).";
             if (!Regex.IsMatch(parts[1], @"^(?!-)[a-zA-Z0-9-]+(?<!-)(\.(?!-)[a-zA-Z0-9-]+(?<!-))*\.[a-zA-Z]{2,}$"))
            return "Email domain is invalid (e.g. gmail.com).";
        if (!MailAddress.TryCreate(email, out _))
            return "Please enter a valid email address.";
        return null;
    }

    // USERNAME
    public static string? ValidateUsername(string username)
    {
        if (username.Length < 3)
            return "Username must be at least 3 characters.";
        if (username.Length > 30)
            return "Username can't be longer than 30 characters.";
        if (username.Any(char.IsWhiteSpace))
            return "Username can't contain spaces.";
        if (username.Contains('@'))
            return "Username can't contain @.";
        if (!Regex.IsMatch(username, @"^[a-zA-Z0-9._-]+$"))
            return "Username can't contain special characters (only . _ - are allowed).";
        return null;
    }

    // PASSWORD
    public static string? ValidatePassword(string password)
    {
        if (password.Length < 8)
            return "Password must be at least 8 characters long.";
        if (password.Length > 64)
            return "Password can't be longer than 64 characters.";
        if (password.Any(char.IsWhiteSpace))
            return "Password can't contain spaces.";
        if (!password.Any(char.IsUpper))
            return "Password must include at least one uppercase letter.";
        if (!password.Any(char.IsLower))
            return "Password must include at least one lowercase letter.";
        if (!password.Any(char.IsDigit))
            return "Password must include at least one number.";
        if (!password.Any(ch => !char.IsLetterOrDigit(ch)))
            return "Password must include at least one special character.";
        return null;
    }
}
