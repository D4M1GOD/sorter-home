using System.Linq.Expressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SorterHome.Api.Validation;
using SorterHome.Domain.Households;
using SorterHome.Domain.Rooms;
using SorterHome.Infrastructure.Database;

namespace SorterHome.Api.Rooms;

/// <summary>
/// The rooms of the current household. The rules live in <see cref="Room"/>; this controller only
/// reads and writes. Every query goes through the household filter of the DbContext, so a room
/// of another household answers 404, like one that does not exist.
/// </summary>
[ApiController]
[Route("api/rooms")]
public sealed class RoomsController(SorterHomeDbContext db, ICurrentHousehold household) : ControllerBase
{
    /// <summary>
    /// A room with its counts, computed by the database in the same query (no rows are loaded).
    /// </summary>
    private static readonly Expression<Func<Room, RoomResponse>> ToResponse = room => new RoomResponse(
        room.Id,
        room.Name,
        room.WidthMm,
        room.DepthMm,
        room.Containers.Count,
        room.Containers.SelectMany(container => container.Items).Count());

    /// <summary>Every room, in the order they were created (the ids are time ordered).</summary>
    [HttpGet]
    [ProducesResponseType<IEnumerable<RoomResponse>>(StatusCodes.Status200OK)]
    public async Task<IEnumerable<RoomResponse>> GetAll(CancellationToken cancellationToken) =>
        await db.Rooms.OrderBy(room => room.Id).Select(ToResponse).ToListAsync(cancellationToken);

    [HttpGet("{id:guid}")]
    [ProducesResponseType<RoomResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var room = await FindResponseAsync(id, cancellationToken);
        return room is null ? NotFound() : room;
    }

    /// <summary>Creates a room with the default size (FR-1b).</summary>
    [HttpPost]
    [Consumes("application/json")]
    [ProducesResponseType<RoomResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<RoomResponse>> Create(
        CreateRoomRequest request,
        CancellationToken cancellationToken)
    {
        var result = Room.Create(request.Name, household.Id);
        if (result.Value is not { } room)
        {
            return this.ValidationProblem(result.Errors);
        }

        db.Rooms.Add(room);
        await db.SaveChangesAsync(cancellationToken);

        // A new room has no containers and no items yet.
        var response = new RoomResponse(room.Id, room.Name, room.WidthMm, room.DepthMm, 0, 0);
        return CreatedAtAction(nameof(Get), new { id = room.Id }, response);
    }

    /// <summary>Changes the name and the size: always the three fields.</summary>
    [HttpPut("{id:guid}")]
    [Consumes("application/json")]
    [ProducesResponseType<RoomResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomResponse>> Update(
        Guid id,
        UpdateRoomRequest request,
        CancellationToken cancellationToken)
    {
        var room = await db.Rooms.SingleOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (room is null)
        {
            return NotFound();
        }

        var errors = room.Update(request.Name, request.WidthMm, request.DepthMm);
        if (errors.Count > 0)
        {
            return this.ValidationProblem(errors);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The room was deleted after it was read and before it was saved.
            return NotFound();
        }

        var response = await FindResponseAsync(id, cancellationToken);
        return response is null ? NotFound() : response;
    }

    /// <summary>
    /// Deletes a room. The database deletes its containers and their items (cascade). The photos
    /// of those items are cleaned in step 5.5.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await db.Rooms.Where(room => room.Id == id).ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? NotFound() : NoContent();
    }

    private Task<RoomResponse?> FindResponseAsync(Guid id, CancellationToken cancellationToken) =>
        db.Rooms.Where(room => room.Id == id).Select(ToResponse).SingleOrDefaultAsync(cancellationToken);
}
