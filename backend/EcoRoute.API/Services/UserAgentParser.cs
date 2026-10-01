namespace EcoRoute.API.Services;

public static class UserAgentParser
{
    // GET DEVICE NAME

    public static string GetDevice(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return "Unknown Device";
        }

        var ua = userAgent.ToLowerInvariant();

        if (ua.Contains("ipad"))
        {
            return "iPad";
        }

        if (ua.Contains("iphone"))
        {
            return "iPhone";
        }

        if (ua.Contains("android"))
        {
            return ua.Contains("mobile")
                ? "Android Phone"
                : "Android Tablet";
        }

        if (ua.Contains("windows"))
        {
            return "Windows PC";
        }

        if (ua.Contains("cros"))
        {
            return "Chromebook";
        }

        if (ua.Contains("macintosh") || ua.Contains("mac os"))
        {
            return "Mac";
        }

        if (ua.Contains("linux"))
        {
            return "Linux PC";
        }

        return "Unknown Device";
    }

    // GET BROWSER NAME

    public static string GetBrowser(string? userAgent, string? clientHints = null)
    {
        // BRAVE LOOKS LIKE CHROME, CHECK CLIENT HINTS

        if (!string.IsNullOrWhiteSpace(clientHints) &&
            clientHints.Contains("\"brave\"", StringComparison.OrdinalIgnoreCase))
        {
            return "Brave";
        }

        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return "Unknown Browser";
        }

        var ua = userAgent.ToLowerInvariant();

        // CHECK EDGE/OPERA BEFORE CHROME, CHROME BEFORE SAFARI

        if (ua.Contains("edg/") || ua.Contains("edga/") || ua.Contains("edgios/"))
        {
            return "Microsoft Edge";
        }

        if (ua.Contains("opr/") || ua.Contains("opera"))
        {
            return "Opera";
        }

        if (ua.Contains("samsungbrowser/"))
        {
            return "Samsung Internet";
        }

        if (ua.Contains("firefox/") || ua.Contains("fxios/"))
        {
            return "Firefox";
        }

        if (ua.Contains("chrome/") || ua.Contains("crios/"))
        {
            return "Google Chrome";
        }

        if (ua.Contains("safari/"))
        {
            return "Safari";
        }

        if (ua.Contains("postman"))
        {
            return "Postman";
        }

        return "Unknown Browser";
    }
}
