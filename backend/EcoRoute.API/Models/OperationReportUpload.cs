
namespace EcoRoute.API.Models;

public class OperationReportUpload
{
    public int UserId { get; set; }

    public DateTime OperationDate { get; set; }

    public DateTime UploadedAt { get; set; }
        = DateTime.UtcNow;
}
