using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SorterHome.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class CreateRoomsContainersItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "rooms",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    household_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    width_mm = table.Column<int>(type: "integer", nullable: false),
                    depth_mm = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rooms", x => x.id);
                    table.CheckConstraint("ck_rooms_depth_mm", "depth_mm BETWEEN 1219 AND 30480");
                    table.CheckConstraint("ck_rooms_name_not_blank", "btrim(name) <> ''");
                    table.CheckConstraint("ck_rooms_width_mm", "width_mm BETWEEN 1219 AND 30480");
                });

            migrationBuilder.CreateTable(
                name: "containers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    room_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    x_mm = table.Column<int>(type: "integer", nullable: false),
                    y_mm = table.Column<int>(type: "integer", nullable: false),
                    rotation = table.Column<int>(type: "integer", nullable: false),
                    stack_position = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_containers", x => x.id);
                    table.CheckConstraint("ck_containers_name_not_blank", "btrim(name) <> ''");
                    table.CheckConstraint("ck_containers_rotation", "rotation IN (0, 90)");
                    table.CheckConstraint("ck_containers_stack_position", "stack_position >= 0");
                    table.CheckConstraint("ck_containers_type_id_not_blank", "btrim(type_id) <> ''");
                    table.CheckConstraint("ck_containers_x_mm", "x_mm >= 0");
                    table.CheckConstraint("ck_containers_y_mm", "y_mm >= 0");
                    table.ForeignKey(
                        name: "fk_containers_rooms_room_id",
                        column: x => x.room_id,
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    container_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    quantity_out = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    category = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    photo_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_items", x => x.id);
                    table.CheckConstraint("ck_items_name_not_blank", "btrim(name) <> ''");
                    table.CheckConstraint("ck_items_position", "position >= 0");
                    table.CheckConstraint("ck_items_quantity", "quantity BETWEEN 0 AND 9999");
                    table.CheckConstraint("ck_items_quantity_out", "quantity_out >= 0 AND quantity_out <= quantity");
                    table.ForeignKey(
                        name: "fk_items_containers_container_id",
                        column: x => x.container_id,
                        principalTable: "containers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_containers_room_id",
                table: "containers",
                column: "room_id");

            migrationBuilder.CreateIndex(
                name: "ix_items_container_id_position",
                table: "items",
                columns: new[] { "container_id", "position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_rooms_household_id",
                table: "rooms",
                column: "household_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "items");

            migrationBuilder.DropTable(
                name: "containers");

            migrationBuilder.DropTable(
                name: "rooms");
        }
    }
}
