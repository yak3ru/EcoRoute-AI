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

            entity.Property(a => a.AreaName)
                .HasColumnName("AreaName")
                .HasMaxLength(150)
                .IsRequired();

            entity.HasIndex(a => a.AreaName)
                .IsUnique();

            entity.Property(a => a.PopulationDensity)
                .HasColumnName("PopulationDensity")
                .HasPrecision(12, 2);

            entity.Property(a => a.ActivityLevel)
                .HasColumnName("ActivityLevel")
                .HasMaxLength(50);

            entity.Property(a => a.CollectionFrequency)
                .HasColumnName("CollectionFrequency")
                .HasMaxLength(100);

            entity.Property(a => a.Latitude)
                .HasColumnName("Latitude")
                .HasPrecision(10, 6);

            entity.Property(a => a.Longitude)
                .HasColumnName("Longitude")
                .HasPrecision(10, 6);

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

            entity.Property(v => v.VehicleName)
                .HasColumnName("VehicleName")
                .HasMaxLength(100)
                .IsRequired();

            entity.HasIndex(v => v.VehicleName)
                .IsUnique();

            entity.Property(v => v.CapacityKg)
                .HasColumnName("CapacityKg")
                .HasPrecision(10, 2);

            entity.Property(v => v.Status)
                .HasColumnName("Status")
                .HasMaxLength(50);

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
                .HasMaxLength(255);

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
    }
}