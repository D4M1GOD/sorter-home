using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SorterHome.Domain.Containers;

namespace SorterHome.Infrastructure.Containers;

/// <summary>
/// The table <c>containers</c>. "Inside its room", overlaps and stacks need other rows or the
/// sizes of the container types, so they are not CHECK constraints.
/// </summary>
internal sealed class ContainerConfiguration : IEntityTypeConfiguration<Container>
{
    public void Configure(EntityTypeBuilder<Container> container)
    {
        container.ToTable(table =>
        {
            table.HasCheckConstraint("ck_containers_name_not_blank", "btrim(name) <> ''");
            table.HasCheckConstraint("ck_containers_type_id_not_blank", "btrim(type_id) <> ''");
            table.HasCheckConstraint("ck_containers_x_mm", "x_mm >= 0");
            table.HasCheckConstraint("ck_containers_y_mm", "y_mm >= 0");
            table.HasCheckConstraint("ck_containers_rotation", "rotation IN (0, 90)");
            table.HasCheckConstraint("ck_containers_stack_position", "stack_position >= 0");
        });

        container.HasKey(c => c.Id);
        container.Property(c => c.Id).ValueGeneratedNever();

        // Free text: the known types and their sizes live in the code.
        container.Property(c => c.TypeId).HasMaxLength(Container.TypeIdMaxLength);
        container.Property(c => c.Name).HasMaxLength(Container.NameMaxLength);

        container.HasMany(c => c.Items)
            .WithOne(i => i.Container)
            .HasForeignKey(i => i.ContainerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
