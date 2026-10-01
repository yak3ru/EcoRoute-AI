using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcoRoute.API.Migrations
{
    // BASELINE NOTE:
    // The existing tables were created from database/ecoroute_ai.sql,
    // so this first migration only adds the new session columns.
    // The model snapshot still describes the full schema for future migrations.

    /// <inheritdoc />
    public partial class AddSessionDeviceInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Device",
                table: "user_sessions",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Browser",
                table: "user_sessions",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "user_sessions",
                type: "varchar(45)",
                maxLength: 45,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Device",
                table: "user_sessions");

            migrationBuilder.DropColumn(
                name: "Browser",
                table: "user_sessions");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "user_sessions");
        }
    }
}
