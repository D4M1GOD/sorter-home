using SorterHome.Domain.Items;
using SorterHome.Domain.Rooms;

namespace SorterHome.Domain.Containers;

/// <summary>
/// A physical box placed on the plan of a room. All lengths are whole millimeters. The rules
/// (inside the room, names, stacks) come in step 5.4; this class only holds the data.
/// </summary>
public sealed class Container
{
    public const int NameMaxLength = 60;
    public const int TypeIdMaxLength = 40;

    /// <summary>Created by the application, time ordered (UUID version 7).</summary>
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid RoomId { get; set; }

    public Room? Room { get; set; }

    /// <summary>The kind of container, for example "tough-box-27-gal".</summary>
    public string TypeId { get; set; } = "";

    public string Name { get; set; } = "";

    /// <summary>Top-left corner of the footprint; the room's top-left corner is 0,0.</summary>
    public int XMm { get; set; }

    public int YMm { get; set; }

    /// <summary>Degrees: 0 or 90. 90 swaps the length and width of the footprint.</summary>
    public int Rotation { get; set; }

    /// <summary>Place in its stack, counted from the bottom: 0 is the bottom container.</summary>
    public int StackPosition { get; set; }

    public List<Item> Items { get; } = [];
}
