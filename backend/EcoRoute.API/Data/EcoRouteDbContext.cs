using EcoRoute.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EcoRoute.API.Data;

public class EcoRouteDbContext : DbContext
{
    public EcoRouteDbContext(DbContextOptions<EcoRouteDbContext> options)
        : base(options)
    {
    }

    // DATABASE TABLES

    public DbSet<Area> Areas => Set<Area>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<WasteRecord> WasteRecords => Set<WasteRecord>();
    public DbSet<RoutingConstraint> RoutingConstraints => Set<RoutingConstraint>();
    public DbSet<DistanceMatrix> DistanceMatrix => Set<DistanceMatrix>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<SavedRoutePlan> SavedRoutePlans => Set<SavedRoutePlan>();
    public DbSet<OperationHistory> OperationHistories => Set<OperationHistory>();
    public DbSet<TwoFactorChallenge> TwoFactorChallenges => Set<TwoFactorChallenge>();
    public DbSet<TrustedDevice> TrustedDevices => Set<TrustedDevice>();
    public DbSet<OperationReportUpload> OperationReportUploads { get; set; } = null!;
    public DbSet<AiPredictionInsight> AiPredictionInsights
    => Set<AiPredictionInsight>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // AREAS

        modelBuilder.Entity<Area>(entity =>
        {
            entity.ToTable("areas");

            entity.HasKey(a => a.AreaId);

            entity.Property(a => a.AreaId)
                .HasColumnName("AreaId");

            entity.Property(a => a.UserId)
                .HasColumnName("UserId");

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(a => a.AreaName)
                .HasColumnName("AreaName")
                .HasMaxLength(100)
                .IsRequired();

            entity.HasIndex(a => new { a.UserId, a.AreaName })
                .IsUnique();

            entity.Property(a => a.PopulationDensity)
                .HasColumnName("PopulationDensity")
                .HasPrecision(10, 2);

            entity.Property(a => a.ActivityLevel)
                .HasColumnName("ActivityLevel")
                .HasMaxLength(50);

            entity.Property(a => a.CollectionFrequency)
                .HasColumnName("CollectionFrequency")
                .HasMaxLength(50);

            entity.Property(a => a.Latitude)
                .HasColumnName("Latitude")
                .HasPrecision(10, 7);

            entity.Property(a => a.Longitude)
                .HasColumnName("Longitude")
                .HasPrecision(10, 7);

            entity.Property(a => a.IsActive)
                .HasColumnName("IsActive");

            entity.Property(a => a.CreatedAt)
                .HasColumnName("CreatedAt");
        });

        // VEHICLES

        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.ToTable("vehicles");

            entity.HasKey(v => v.VehicleId);

            entity.Property(v => v.VehicleId)
                .HasColumnName("VehicleId");

            entity.Property(v => v.UserId)
                .HasColumnName("UserId");

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.Property(v => v.VehicleName)
                .HasColumnName("VehicleName")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(v => v.CapacityKg)
                .HasColumnName("CapacityKg")
                .HasPrecision(10, 2);

            entity.Property(v => v.Status)
                .HasColumnName("Status")
                .HasMaxLength(30);

            entity.Property(v => v.IsActive)
                .HasColumnName("IsActive");

            entity.Property(v => v.CreatedAt)
                .HasColumnName("CreatedAt");
        });

        // WASTE RECORDS

        modelBuilder.Entity<WasteRecord>(entity =>
        {
            entity.ToTable("waste_records");

            entity.HasKey(w => w.WasteRecordId);

            entity.Property(w => w.WasteRecordId)
                .HasColumnName("WasteRecordId");

            entity.Property(w => w.AreaId)
                .HasColumnName("AreaId");

            entity.Property(w => w.CollectionDate)
                .HasColumnName("CollectionDate");

            entity.Property(w => w.WasteType)
                .HasColumnName("WasteType")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(w => w.WeightKg)
                .HasColumnName("WeightKg")
                .HasPrecision(10, 2);

            entity.Property(w => w.Status)
                .HasColumnName("Status")
                .HasMaxLength(50);

            entity.Property(w => w.CreatedAt)
                .HasColumnName("CreatedAt");

            // LINK WASTE RECORD TO AREA

            entity.HasOne(w => w.Area)
                .WithMany()
                .HasForeignKey(w => w.AreaId)
                .OnDelete(DeleteBehavior.Restrict);

            // SPEED UP AREA AND DATE SEARCHES

            entity.HasIndex(w => new
            {
                w.AreaId,
                w.CollectionDate
            });
        });

        // ROUTING CONSTRAINTS

        modelBuilder.Entity<RoutingConstraint>(entity =>
        {
            entity.ToTable("routing_constraints");

            entity.HasKey(r => r.ConstraintId);

            entity.Property(r => r.ConstraintId)
                .HasColumnName("ConstraintId");

            entity.Property(r => r.VehicleId)
                .HasColumnName("VehicleId");

            entity.HasOne(r => r.Vehicle)
                .WithMany()
                .HasForeignKey(r => r.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(r => r.VehicleId)
                .IsUnique();

            entity.Property(r => r.VehicleCapacityKg)
                .HasColumnName("VehicleCapacityKg")
                .HasPrecision(10, 2);

            entity.Property(r => r.MaximumRouteDistanceKm)
                .HasColumnName("MaximumRouteDistanceKm")
                .HasPrecision(10, 2);

            entity.Property(r => r.CollectionStartTime)
                .HasColumnName("CollectionStartTime");

            entity.Property(r => r.CollectionEndTime)
                .HasColumnName("CollectionEndTime");

            entity.Property(r => r.RoadAccessibility)
                .HasColumnName("RoadAccessibility")
                .HasMaxLength(255);

            entity.Property(r => r.AreaRestrictions)
                .HasColumnName("AreaRestrictions")
                .HasMaxLength(500);

            entity.Property(r => r.CreatedAt)
                .HasColumnName("CreatedAt");
        });

        // DISTANCE MATRIX

        modelBuilder.Entity<DistanceMatrix>(entity =>
        {
            entity.ToTable("distance_matrix");

            entity.HasKey(d => d.DistanceMatrixId);

            entity.Property(d => d.DistanceMatrixId)
                .HasColumnName("DistanceMatrixId");

            entity.Property(d => d.OriginAreaId)
                .HasColumnName("OriginAreaId");

            entity.Property(d => d.DestinationAreaId)
                .HasColumnName("DestinationAreaId");

            entity.Property(d => d.DistanceKm)
                .HasColumnName("DistanceKm")
                .HasPrecision(10, 2);

            // LINK ORIGIN AREA

            entity.HasOne(d => d.OriginArea)
                .WithMany()
                .HasForeignKey(d => d.OriginAreaId)
                .OnDelete(DeleteBehavior.Restrict);

            // LINK DESTINATION AREA

            entity.HasOne(d => d.DestinationArea)
                .WithMany()
                .HasForeignKey(d => d.DestinationAreaId)
                .OnDelete(DeleteBehavior.Restrict);

            // PREVENT DUPLICATE AREA PAIRS

            entity.HasIndex(d => new
            {
                d.OriginAreaId,
                d.DestinationAreaId
            })
            .IsUnique();
        });

        // USERS

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");

            entity.HasKey(u => u.UserId);

            entity.Property(u => u.UserId)
                .HasColumnName("UserId");

            entity.Property(u => u.FullName)
                .HasColumnName("FullName")
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(u => u.Email)
                .HasColumnName("Email")
                .HasMaxLength(150)
                .IsRequired();

            entity.HasIndex(u => u.Email)
                .IsUnique();

            entity.Property(u => u.Username)
                .HasColumnName("Username")
                .HasMaxLength(50)
                .IsRequired();

            entity.HasIndex(u => u.Username)
                .IsUnique();

            entity.Property(u => u.PasswordHash)
                .HasColumnName("PasswordHash")
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(u => u.Role)
                .HasColumnName("Role")
                .HasMaxLength(50)
                .HasDefaultValue("Administrator");

            entity.Property(u => u.CreatedAt)
                .HasColumnName("CreatedAt");

            entity.Property(u => u.UpdatedAt)
                .HasColumnName("UpdatedAt");

            entity.Property(u => u.PasswordResetToken)
                .HasColumnName("PasswordResetToken")
                .HasMaxLength(255);

            entity.Property(u => u.PasswordResetTokenExpiresAt)
                .HasColumnName("PasswordResetTokenExpiresAt");

            entity.Property(u => u.TwoFactorEnabled)
                .HasColumnName("TwoFactorEnabled");

            entity.Property(u => u.PasswordChangedAt)
                .HasColumnName("PasswordChangedAt");
        });

        // USER SESSIONS

        modelBuilder.Entity<UserSession>(entity =>
        {
            entity.ToTable("user_sessions");

            entity.HasKey(s => s.SessionId);

            entity.Property(s => s.SessionId)
                .HasColumnName("SessionId");

            entity.Property(s => s.UserId)
                .HasColumnName("UserId");

            entity.Property(s => s.Token)
                .HasColumnName("Token")
                .HasColumnType("TEXT")
                .IsRequired();

            entity.Property(s => s.CreatedAt)
                .HasColumnName("CreatedAt");

            entity.Property(s => s.ExpiresAt)
                .HasColumnName("ExpiresAt");

            entity.Property(s => s.IsActive)
                .HasColumnName("IsActive");

            // DEVICE AND ACTIVITY COLUMNS

            entity.Property(s => s.Device)
                .HasColumnName("Device")
                .HasMaxLength(100);

            entity.Property(s => s.Browser)
                .HasColumnName("Browser")
                .HasMaxLength(100);

            entity.Property(s => s.IpAddress)
                .HasColumnName("IpAddress")
                .HasMaxLength(45);

            entity.Property(s => s.LastActiveAt)
                .HasColumnName("LastActiveAt");

            entity.Property(s => s.LoggedOutAt)
                .HasColumnName("LoggedOutAt");

            entity.Property(s => s.LogoutReason)
                .HasColumnName("LogoutReason")
                .HasMaxLength(30);

            // LINK SESSION TO USER

            entity.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(s => s.UserId);
        });

        // SAVED ROUTE PLANS

        modelBuilder.Entity<SavedRoutePlan>(entity =>
        {
            entity.ToTable("saved_route_plans");

            entity.HasKey(r => r.SavedRoutePlanId);

            entity.Property(r => r.SavedRoutePlanId)
                .HasColumnName("SavedRoutePlanId")
                .ValueGeneratedOnAdd();

            entity.Property(r => r.UserId)
                .HasColumnName("UserId")
                .IsRequired();

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(r => r.UserId)
                .IsUnique();

            entity.Property(r => r.RouteData)
                .HasColumnName("RouteData")
                .HasColumnType("longtext")
                .IsRequired();

            entity.Property(r => r.UpdatedAt)
                .HasColumnName("UpdatedAt")
                .IsRequired();
        });

        // OPERATIONS HISTORY

        modelBuilder.Entity<OperationHistory>(entity =>
        {
            entity.ToTable("operation_history");

            entity.HasKey(e => e.OperationHistoryId);

            entity.Property(e => e.RouteData)
                .HasColumnType("longtext")
                .IsRequired();

            entity.HasIndex(e => new { e.UserId, e.OperationDate });

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // OPERATION REPORT UPLOADS

        modelBuilder.Entity<OperationReportUpload>(entity =>
        {
            entity.ToTable("operation_report_uploads");

            entity.HasKey(e => new
            {
                e.UserId,
                e.OperationDate
            });

            entity.Property(e => e.UserId)
                .HasColumnName("UserId");

            entity.Property(e => e.OperationDate)
                .HasColumnName("OperationDate")
                .HasColumnType("date");

            entity.Property(e => e.UploadedAt)
                .HasColumnName("UploadedAt");
        });

        // TWO-FACTOR CHALLENGES

        modelBuilder.Entity<TwoFactorChallenge>(entity =>
        {
            entity.ToTable("two_factor_challenges");

            entity.HasKey(c => c.TwoFactorChallengeId);

            entity.Property(c => c.ChallengeId)
                .HasColumnName("ChallengeId")
                .HasMaxLength(64)
                .IsRequired();

            entity.HasIndex(c => c.ChallengeId)
                .IsUnique();

            entity.Property(c => c.CodeHash)
                .HasColumnName("CodeHash")
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(c => c.Status)
                .HasColumnName("Status")
                .HasMaxLength(20)
                .IsRequired();

            entity.HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(c => new { c.UserId, c.Status });
        });

        // TRUSTED DEVICES

        modelBuilder.Entity<TrustedDevice>(entity =>
        {
            entity.ToTable("trusted_devices");

            entity.HasKey(d => d.TrustedDeviceId);

            entity.Property(d => d.TokenHash)
                .HasColumnName("TokenHash")
                .HasMaxLength(64)
                .IsRequired();

            entity.HasIndex(d => d.TokenHash)
                .IsUnique();

            entity.Property(d => d.Device)
                .HasColumnName("Device")
                .HasMaxLength(100);

            entity.Property(d => d.Browser)
                .HasColumnName("Browser")
                .HasMaxLength(100);

            entity.HasOne(d => d.User)
                .WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(d => d.UserId);
        });


        // AI PREDICTION INSIGHTS

        modelBuilder.Entity<AiPredictionInsight>(entity =>
        {
            entity.ToTable("ai_prediction_insights");

            entity.HasKey(i => i.InsightId);

            entity.Property(i => i.InsightId)
                .HasColumnName("InsightId")
                .ValueGeneratedOnAdd();

            entity.Property(i => i.UserId)
                .HasColumnName("UserId")
                .IsRequired();

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(i => i.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Property(i => i.GeneratedAt)
                .HasColumnName("GeneratedAt")
                .IsRequired();

            entity.Property(i => i.TargetDate)
                .HasColumnName("TargetDate")
                .HasColumnType("date")
                .IsRequired();

            entity.Property(i => i.PredictedWasteKg)
                .HasColumnName("PredictedWasteKg")
                .HasPrecision(12, 2);

            entity.Property(i => i.NormalWasteKg)
                .HasColumnName("NormalWasteKg")
                .HasPrecision(12, 2);

            entity.Property(i => i.PredictionChangePercent)
                .HasColumnName("PredictionChangePercent")
                .HasPrecision(10, 2);

            entity.Property(i => i.PredictionLevel)
                .HasColumnName("PredictionLevel")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(i => i.InsightMessage)
                .HasColumnName("InsightMessage")
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(i => i.SuggestedAction)
                .HasColumnName("SuggestedAction")
                .HasMaxLength(255)
                .IsRequired();

            entity.HasIndex(i => new
            {
                i.UserId,
                i.TargetDate
            });
        });

    }
}