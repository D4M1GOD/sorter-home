namespace SorterHome.Api.Rooms;

/// <summary>
/// The body of PUT /api/rooms/{id}: always the three fields. They may be null so that a missing
/// field gets its "is required" message from the Domain instead of a misleading 0.
/// </summary>
public sealed record UpdateRoomRequest(string? Name, int? WidthMm, int? DepthMm);
