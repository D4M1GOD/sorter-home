namespace SorterHome.Api.Rooms;

/// <summary>
/// The body of POST /api/rooms. Only the name: the size is the default one. The field may be
/// null so that a missing name gets the Domain message "Room name is required.".
/// </summary>
public sealed record CreateRoomRequest(string? Name);
