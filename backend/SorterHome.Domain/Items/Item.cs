using SorterHome.Domain.Containers;

namespace SorterHome.Domain.Items;

/// <summary>
/// One physical object inside one container. The rules (trimming, categories, take out, put
/// back, used) come in step 5.4; this class only holds the data.
/// </summary>
public sealed class Item
{
    public const int NameMaxLength = 60;
    public const int DescriptionMaxLength = 500;
    public const int CategoryMaxLength = 40;
    public const int QuantityMin = 0;
    public const int QuantityMax = 9999;

    /// <summary>Created by the application, time ordered (UUID version 7).</summary>
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid ContainerId { get; set; }

    public Container? Container { get; set; }

    /// <summary>The order in which the items were added to their container (the stored order).</summary>
    public int Position { get; set; }

    public string Name { get; set; } = "";

    /// <summary>The total the user owns: the units inside plus the units out.</summary>
    public int Quantity { get; set; }

    /// <summary>The units out of the container, from 0 to <see cref="Quantity"/>.</summary>
    public int QuantityOut { get; set; }

    /// <summary>Empty when the item has no description.</summary>
    public string Description { get; set; } = "";

    /// <summary>Empty when the item has no category.</summary>
    public string Category { get; set; } = "";

    /// <summary>The photo of the item, or null when it has none.</summary>
    public Guid? PhotoId { get; set; }
}
