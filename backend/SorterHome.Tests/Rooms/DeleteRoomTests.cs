using System.Net;
using Microsoft.EntityFrameworkCore;
using SorterHome.Tests.Api;
using SorterHome.Tests.Database;

namespace SorterHome.Tests.Rooms;

/// <summary>DELETE /api/rooms/{id}.</summary>
public sealed class DeleteRoomTests(PostgresServer server) : IAsyncLifetime
{
    private SorterHomeApiFactory factory = null!;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() =>
        factory = new SorterHomeApiFactory(await server.MigratedDatabaseAsync("rooms_delete"));

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task Deletes_the_room_and_answers_204_with_no_body()
    {
        var room = TestData.Room();
        await RoomsApi.SeedAsync(factory.ConnectionString, room);
        var client = factory.CreateClient();

        var response = await client.DeleteAsync($"{RoomsApi.Url}/{room.Id}", Token);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("", await response.Content.ReadAsStringAsync(Token));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{RoomsApi.Url}/{room.Id}", Token)).StatusCode);
    }

    [Fact]
    public async Task Deletes_its_containers_and_their_items()
    {
        var room = TestData.Room();
        var container = TestData.Container(room);
        TestData.Item(container, position: 0);
        TestData.Item(container, position: 1);
        await RoomsApi.SeedAsync(factory.ConnectionString, room);

        var response = await factory.CreateClient().DeleteAsync($"{RoomsApi.Url}/{room.Id}", Token);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await using var database = TestDatabase.Open(factory.ConnectionString);
        Assert.Equal(0, await database.Context.Database
            .SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM containers WHERE room_id = {room.Id}")
            .SingleAsync(Token));
        Assert.Equal(0, await database.Context.Database
            .SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM items WHERE container_id = {container.Id}")
            .SingleAsync(Token));
    }

    [Fact]
    public async Task Answers_404_for_an_unknown_id()
    {
        var response = await factory.CreateClient().DeleteAsync($"{RoomsApi.Url}/{Guid.CreateVersion7()}", Token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_404_for_a_room_of_another_household_and_keeps_it()
    {
        var theirs = TestData.Room(Guid.CreateVersion7());
        await RoomsApi.SeedAsync(factory.ConnectionString, theirs);

        var response = await factory.CreateClient().DeleteAsync($"{RoomsApi.Url}/{theirs.Id}", Token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.True(await RoomsApi.ExistsAsync(factory.ConnectionString, theirs.Id));
    }

    [Fact]
    public async Task A_second_delete_answers_404()
    {
        var room = TestData.Room();
        await RoomsApi.SeedAsync(factory.ConnectionString, room);
        var client = factory.CreateClient();
        await client.DeleteAsync($"{RoomsApi.Url}/{room.Id}", Token);

        var response = await client.DeleteAsync($"{RoomsApi.Url}/{room.Id}", Token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
