using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcoRoute.API.Migrations
{
    public partial class AddSavedRoutePlans : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "saved_route_plans",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RouteJson = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_saved_route_plans", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_saved_route_plans_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "saved_route_plans");
        }
    }
}
