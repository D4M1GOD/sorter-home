using SorterHome.Domain.Containers;

namespace SorterHome.Domain.Rooms;

/// <summary>
/// A named area drawn as a floor plan with real dimensions. All lengths are whole millimeters.
/// The rules (trimming, limits, resizing) come in step 5.3; this class only holds the data.
/// </summary>
public sealed class Room
{
    public const int NameMaxLength = 60;

    /// <summary>4 ft, rounded to whole millimeters.</summary>
    public const int MinSizeMm = 1219;

    /// <summary>100 ft.</summary>
    public const int MaxSizeMm = 30480;

    /// <summary>Created by the application, time ordered (UUID version 7).</summary>
    public Guid Id { get; init; } = Guid.CreateVersion7();

    /// <summary>The household that owns the room. Its containers and items belong to it too.</summary>
    public Guid HouseholdId { get; set; }

    public string Name { get; set; } = "";

    /// <summary>Left-to-right size of the plan.</summary>
    public int WidthMm { get; set; }

    /// <summary>Front-to-back size of the plan.</summary>
    public int DepthMm { get; set; }

    public List<Container> Containers { get; } = [];
}
