using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SorterHome.Api.Rooms;
using SorterHome.Domain.Rooms;
using SorterHome.Infrastructure.Database;
using SorterHome.Tests.Api;
using SorterHome.Tests.Database;

namespace SorterHome.Tests.Rooms;

/// <summary>PUT /api/rooms/{id}.</summary>
public sealed class UpdateRoomTests(PostgresServer server) : IAsyncLifetime
{
    private SorterHomeApiFactory factory = null!;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() =>
        factory = new SorterHomeApiFactory(await server.MigratedDatabaseAsync("rooms_update"));

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task Saves_the_three_fields_and_returns_the_room_with_its_counts()
    {
        var room = TestData.Room();
        TestData.Item(TestData.Container(room));
        await RoomsApi.SeedAsync(factory.ConnectionString, room);
        var client = factory.CreateClient();

        var response = await RoomsApi.PutAsync(client, room.Id, """{"name":"Shed","widthMm":6096,"depthMm":1524}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var expected = new RoomResponse(room.Id, "Shed", 6096, 1524, 1, 1);
        Assert.Equal(expected, await RoomsApi.ReadRoomAsync(response));
        Assert.Equal(expected, await RoomsApi.ReadRoomAsync(await client.GetAsync($"{RoomsApi.Url}/{room.Id}", Token)));
    }

    [Fact]
    public async Task Trims_the_name()
    {
        var room = await SeedRoomAsync();

        var response = await RoomsApi.PutAsync(factory.CreateClient(), room.Id, """{"name":"  Shed ","widthMm":3658,"depthMm":3048}""");

        Assert.Equal("Shed", (await RoomsApi.ReadRoomAsync(response)).Name);
    }

    [Theory]
    [InlineData(1219, 30480)]
    [InlineData(30480, 1219)]
    public async Task Accepts_the_limits(int widthMm, int depthMm)
    {
        var room = await SeedRoomAsync();

        var response = await RoomsApi.PutAsync(
            factory.CreateClient(),
            room.Id,
            $$"""{"name":"Garage","widthMm":{{widthMm}},"depthMm":{{depthMm}}}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = await RoomsApi.ReadRoomAsync(response);
        Assert.Equal((widthMm, depthMm), (saved.WidthMm, saved.DepthMm));
    }

    [Theory]
    [InlineData(1218, 3048, "widthMm", Room.WidthOutOfRange)]
    [InlineData(30481, 3048, "widthMm", Room.WidthOutOfRange)]
    [InlineData(3658, 1218, "depthMm", Room.DepthOutOfRange)]
    [InlineData(3658, 30481, "depthMm", Room.DepthOutOfRange)]
    public async Task Rejects_a_size_out_of_range(int widthMm, int depthMm, string field, string message)
    {
        var room = await SeedRoomAsync();

        var response = await RoomsApi.PutAsync(
            factory.CreateClient(),
            room.Id,
            $$"""{"name":"Garage","widthMm":{{widthMm}},"depthMm":{{depthMm}}}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(new Dictionary<string, string[]> { [field] = [message] }, await RoomsApi.ReadErrorsAsync(response));
    }

    [Theory]
    [InlineData("""{"widthMm":3658,"depthMm":3048}""", "name", Room.NameRequired)]
    [InlineData("""{"name":"Garage","depthMm":3048}""", "widthMm", Room.WidthRequired)]
    [InlineData("""{"name":"Garage","widthMm":3658}""", "depthMm", Room.DepthRequired)]
    public async Task Requires_every_field(string json, string field, string message)
    {
        var room = await SeedRoomAsync();

        var response = await RoomsApi.PutAsync(factory.CreateClient(), room.Id, json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(new Dictionary<string, string[]> { [field] = [message] }, await RoomsApi.ReadErrorsAsync(response));
    }

    [Theory]
    [InlineData("1219.5")]
    [InlineData("\"abc\"")]
    [InlineData("\"3658\"")]
    [InlineData("true")]
    public async Task Rejects_a_width_that_is_not_a_whole_json_number(string width)
    {
        var room = await SeedRoomAsync();

        var response = await RoomsApi.PutAsync(
            factory.CreateClient(),
            room.Id,
            $$"""{"name":"Garage","widthMm":{{width}},"depthMm":3048}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = await RoomsApi.ReadErrorsAsync(response);
        Assert.Equal(["$.widthMm"], errors.Keys);
        // A short stable message, without the internal type names of .NET.
        Assert.DoesNotContain("System.", errors["$.widthMm"].Single());
    }

    [Fact]
    public async Task Returns_every_error_in_the_standard_shape()
    {
        var room = await SeedRoomAsync();

        var response = await RoomsApi.PutAsync(factory.CreateClient(), room.Id, """{"name":" ","widthMm":1218}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Token));
        var root = body.RootElement;
        Assert.Equal("https://tools.ietf.org/html/rfc9110#section-15.5.1", root.GetProperty("type").GetString());
        Assert.Equal("One or more validation errors occurred.", root.GetProperty("title").GetString());
        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrEmpty(root.GetProperty("traceId").GetString()));
        Assert.Equal(
            new Dictionary<string, string[]>
            {
                ["name"] = [Room.NameRequired],
                ["widthMm"] = [Room.WidthOutOfRange],
                ["depthMm"] = [Room.DepthRequired],
            },
            await RoomsApi.ReadErrorsAsync(response));
        // Nothing was saved.
        var saved = await RoomsApi.ReadRoomAsync(await factory.CreateClient().GetAsync($"{RoomsApi.Url}/{room.Id}", Token));
        Assert.Equal(("Garage", 3658), (saved.Name, saved.WidthMm));
    }

    [Fact]
    public async Task Answers_404_for_an_unknown_id()
    {
        var response = await RoomsApi.PutAsync(
            factory.CreateClient(),
            Guid.CreateVersion7(),
            """{"name":"Garage","widthMm":3658,"depthMm":3048}""");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_404_for_a_room_of_another_household_and_does_not_change_it()
    {
        var theirs = TestData.Room(Guid.CreateVersion7());
        await RoomsApi.SeedAsync(factory.ConnectionString, theirs);

        var response = await RoomsApi.PutAsync(
            factory.CreateClient(),
            theirs.Id,
            """{"name":"Mine now","widthMm":6096,"depthMm":6096}""");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await using var database = TestDatabase.Open(factory.ConnectionString, theirs.HouseholdId);
        var saved = await database.Context.Rooms.SingleAsync(room => room.Id == theirs.Id, Token);
        Assert.Equal(("Garage", 3658), (saved.Name, saved.WidthMm));
    }

    [Fact]
    public async Task Answers_404_when_the_room_is_deleted_between_the_read_and_the_save()
    {
        var room = await SeedRoomAsync();
        var client = factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
                services.ConfigureDbContext<SorterHomeDbContext>(options =>
                    options.AddInterceptors(new DeleteRoomBeforeSaving(factory.ConnectionString, room.Id)))))
            .CreateClient();

        var response = await RoomsApi.PutAsync(client, room.Id, """{"name":"Shed","widthMm":3658,"depthMm":3048}""");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.False(await RoomsApi.ExistsAsync(factory.ConnectionString, room.Id));
    }

    private async Task<Room> SeedRoomAsync()
    {
        var room = TestData.Room();
        await RoomsApi.SeedAsync(factory.ConnectionString, room);
        return room;
    }

    /// <summary>
    /// Deletes the room from another connection just before EF saves the change: the same as a
    /// DELETE that arrives while a PUT is between its read and its save.
    /// </summary>
    private sealed class DeleteRoomBeforeSaving(string connectionString, Guid roomId) : SaveChangesInterceptor
    {
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand("DELETE FROM rooms WHERE id = @id", connection);
            command.Parameters.AddWithValue("id", roomId);
            await command.ExecuteNonQueryAsync(cancellationToken);
            return result;
        }
    }
}
