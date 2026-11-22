namespace SorterHome.Api.Rooms;

/// <summary>
/// A room as the API returns it. The counts are numbers of rows (containers of the room, items
/// of those containers), not sums of quantities. The household is never exposed.
/// </summary>
public sealed record RoomResponse(
    Guid Id,
    string Name,
    int WidthMm,
    int DepthMm,
    int ContainerCount,
    int ItemCount);
