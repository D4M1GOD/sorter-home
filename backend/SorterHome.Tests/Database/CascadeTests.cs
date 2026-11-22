using Microsoft.EntityFrameworkCore;

namespace SorterHome.Tests.Database;

/// <summary>
/// Deleting a room deletes its containers and items, and deleting a container deletes its items
/// (FR-1 and FR-8). The rows are deleted with plain SQL, so this is the cascade of the database
/// itself, not something EF does in memory.
/// </summary>
public sealed class CascadeTests(PostgresServer server)
{
    [Fact]
    public async Task Deleting_a_room_deletes_its_containers_and_their_items()
    {
        var token = TestContext.Current.CancellationToken;
        await using var database = TestDatabase.Open(await server.MigratedDatabaseAsync("cascade"));
        var room = TestData.Room();
        var first = TestData.Container(room);
        TestData.Item(first, position: 0);
        TestData.Item(first, position: 1);
        var second = TestData.Container(room);
        second.XMm = 1000;
        TestData.Item(second);
        var otherRoom = TestData.Room();
        TestData.Item(TestData.Container(otherRoom));
        database.Context.Rooms.AddRange(room, otherRoom);
        await database.Context.SaveChangesAsync(token);

        await database.Context.Database.ExecuteSqlAsync($"DELETE FROM rooms WHERE id = {room.Id}", token);

        Assert.Equal(0, await CountAsync(database, $"SELECT count(*)::int AS \"Value\" FROM containers WHERE room_id = {room.Id}"));
        Assert.Equal(0, await CountAsync(database, $"SELECT count(*)::int AS \"Value\" FROM items WHERE container_id = {first.Id}"));
        Assert.Equal(0, await CountAsync(database, $"SELECT count(*)::int AS \"Value\" FROM items WHERE container_id = {second.Id}"));
        Assert.Equal(1, await CountAsync(database, $"SELECT count(*)::int AS \"Value\" FROM containers WHERE room_id = {otherRoom.Id}"));
    }

    [Fact]
    public async Task Deleting_a_container_deletes_its_items_only()
    {
        var token = TestContext.Current.CancellationToken;
        await using var database = TestDatabase.Open(await server.MigratedDatabaseAsync("cascade"));
        var room = TestData.Room();
        var deleted = TestData.Container(room);
        TestData.Item(deleted, position: 0);
        TestData.Item(deleted, position: 1);
        var kept = TestData.Container(room);
        kept.XMm = 1000;
        TestData.Item(kept);
        database.Context.Rooms.Add(room);
        await database.Context.SaveChangesAsync(token);

        await database.Context.Database.ExecuteSqlAsync($"DELETE FROM containers WHERE id = {deleted.Id}", token);

        Assert.Equal(0, await CountAsync(database, $"SELECT count(*)::int AS \"Value\" FROM items WHERE container_id = {deleted.Id}"));
        Assert.Equal(1, await CountAsync(database, $"SELECT count(*)::int AS \"Value\" FROM items WHERE container_id = {kept.Id}"));
        Assert.Equal(1, await CountAsync(database, $"SELECT count(*)::int AS \"Value\" FROM rooms WHERE id = {room.Id}"));
    }

    /// <summary>
    /// Counts rows with plain SQL, without the household filter of EF. The ids become SQL
    /// parameters, not text.
    /// </summary>
    private static Task<int> CountAsync(TestDatabase database, FormattableString countQuery) =>
        database.Context.Database
            .SqlQuery<int>(countQuery)
            .SingleAsync(TestContext.Current.CancellationToken);
}
