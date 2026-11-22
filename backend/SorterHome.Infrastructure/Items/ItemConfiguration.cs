using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SorterHome.Domain.Items;

namespace SorterHome.Infrastructure.Items;

/// <summary>The table <c>items</c>.</summary>
internal sealed class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> item)
    {
        item.ToTable(table =>
        {
            table.HasCheckConstraint("ck_items_name_not_blank", "btrim(name) <> ''");
            table.HasCheckConstraint("ck_items_position", "position >= 0");
            table.HasCheckConstraint(
                "ck_items_quantity",
                $"quantity BETWEEN {Item.QuantityMin} AND {Item.QuantityMax}");
            table.HasCheckConstraint(
                "ck_items_quantity_out",
                "quantity_out >= 0 AND quantity_out <= quantity");
        });

        item.HasKey(i => i.Id);
        item.Property(i => i.Id).ValueGeneratedNever();

        // One place per item in its container: the order in which the items were added. This
        // index also serves the foreign key to containers.
        item.HasIndex(i => new { i.ContainerId, i.Position }).IsUnique();

        item.Property(i => i.Name).HasMaxLength(Item.NameMaxLength);
        // Empty text (never null) when the item has no description or no category.
        item.Property(i => i.Description).HasMaxLength(Item.DescriptionMaxLength);
        item.Property(i => i.Category).HasMaxLength(Item.CategoryMaxLength);
        // No foreign key: the photos are not in the database (Azure Blob Storage from step 5.5).
        item.Property(i => i.PhotoId);
    }
}
