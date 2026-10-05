using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcoRoute.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPasswordChangedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordChangedAt",
                table: "users",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordChangedAt",
                table: "users");
        }
    }
}
