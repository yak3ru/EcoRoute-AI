using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcoRoute.API.Migrations
{
    /// <inheritdoc />
    public partial class AllowDuplicateVehicleNamesAndCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.CreateIndex(
                name: "IX_vehicles_UserId",
                table: "vehicles",
                column: "UserId");

            migrationBuilder.DropIndex(
                name: "UX_Vehicles_UserId_VehicleName",
                table: "vehicles");

            migrationBuilder.CreateTable(
                name: "operation_report_uploads",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    OperationDate = table.Column<DateTime>(type: "date", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_operation_report_uploads", x => new { x.UserId, x.OperationDate });
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddForeignKey(
                name: "FK_RoutingConstraints_Vehicles",
                table: "routing_constraints",
                column: "VehicleId",
                principalTable: "vehicles",
                principalColumn: "VehicleId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RoutingConstraints_Vehicles",
                table: "routing_constraints");

            migrationBuilder.DropTable(
                name: "operation_report_uploads");

            migrationBuilder.DropIndex(
                name: "IX_vehicles_UserId",
                table: "vehicles");

            migrationBuilder.CreateIndex(
                name: "IX_vehicles_UserId_VehicleName",
                table: "vehicles",
                columns: new[] { "UserId", "VehicleName" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_RoutingConstraints_Vehicles",
                table: "routing_constraints",
                column: "VehicleId",
                principalTable: "vehicles",
                principalColumn: "VehicleId",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
