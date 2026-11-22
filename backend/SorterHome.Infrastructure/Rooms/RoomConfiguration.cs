using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SorterHome.Domain.Rooms;

namespace SorterHome.Infrastructure.Rooms;

/// <summary>
/// The table <c>rooms</c>. Names become snake_case by convention. The CHECK constraints only
/// cover rules of a single row; the other rules live in Domain.
/// </summary>
internal sealed class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> room)
    {
        room.ToTable(table =>
        {
            table.HasCheckConstraint("ck_rooms_name_not_blank", "btrim(name) <> ''");
            table.HasCheckConstraint(
                "ck_rooms_width_mm",
                $"width_mm BETWEEN {Room.MinSizeMm} AND {Room.MaxSizeMm}");
            table.HasCheckConstraint(
                "ck_rooms_depth_mm",
                $"depth_mm BETWEEN {Room.MinSizeMm} AND {Room.MaxSizeMm}");
        });

        room.HasKey(r => r.Id);
        // The application creates the ids (UUID version 7), not the database or EF.
        room.Property(r => r.Id).ValueGeneratedNever();

        // No foreign key yet: the households table does not exist (see FixedHousehold).
        room.HasIndex(r => r.HouseholdId);

        room.Property(r => r.Name).HasMaxLength(Room.NameMaxLength);

        room.HasMany(r => r.Containers)
            .WithOne(c => c.Room)
            .HasForeignKey(c => c.RoomId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
