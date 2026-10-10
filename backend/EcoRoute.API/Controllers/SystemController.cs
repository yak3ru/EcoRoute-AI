
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcoRoute.API.Controllers;

[ApiController]
[Route("api/system")]
[Authorize]
public class SystemController : ControllerBase
{
    [HttpGet("time")]
    public IActionResult GetSystemTime()
    {
        var philippinesTimeZone =
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

        var currentPhilippineTime =
            TimeZoneInfo.ConvertTime(
                DateTimeOffset.UtcNow,
                philippinesTimeZone
            );

        return Ok(new
        {
            timeZone = "Asia/Manila",
            currentDate = currentPhilippineTime.ToString("yyyy-MM-dd"),
            currentDateTime = currentPhilippineTime.ToString(
                "yyyy-MM-dd'T'HH:mm:sszzz"
            )
        });
    }
}
