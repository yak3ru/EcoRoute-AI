using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcoRoute.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedRoutePlans : Migration
    {
        /// <inheritdoc />
        
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.CreateTable(
        name: "saved_route_plans",
        columns: table => new
        {
            SavedRoutePlanId = table.Column<int>(type: "int", nullable: false)
                .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
            UserId = table.Column<int>(type: "int", nullable: false),
            RouteData = table.Column<string>(type: "longtext", nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4"),
            UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
        },
        constraints: table =>
        {
            table.PrimaryKey("PK_saved_route_plans", x => x.SavedRoutePlanId);
            table.ForeignKey(
                name: "FK_saved_route_plans_users_UserId",
                column: x => x.UserId,
                principalTable: "users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Cascade);
        })
        .Annotation("MySql:CharSet", "utf8mb4");

    migrationBuilder.CreateIndex(
        name: "IX_saved_route_plans_UserId",
        table: "saved_route_plans",
        column: "UserId",
        unique: true);
}

        /// <inheritdoc />
        
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "saved_route_plans");
    }
    }
}
