using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using SorterHome.Api.Rooms;
using SorterHome.Domain.Rooms;
using SorterHome.Tests.Api;
using SorterHome.Tests.Database;

namespace SorterHome.Tests.Rooms;

/// <summary>GET /api/rooms and GET /api/rooms/{id}.</summary>
public sealed class GetRoomsTests(PostgresServer server) : IAsyncLifetime
{
    private SorterHomeApiFactory factory = null!;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() =>
        factory = new SorterHomeApiFactory(await server.MigratedDatabaseAsync("rooms_get"));

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task Lists_the_rooms_in_creation_order_with_their_counts()
    {
        var household = Guid.CreateVersion7();
        // Ids of three different milliseconds, so their order is the order of creation (two ids
        // of the same millisecond have no defined order between them).
        var createdAt = DateTimeOffset.UtcNow;
        var full = new Room { Id = Guid.CreateVersion7(createdAt), HouseholdId = household, Name = "Garage", WidthMm = 3658, DepthMm = 3048 };
        var first = TestData.Container(full);
        // Large quantities: the count is of rows, not a sum of quantities.
        TestData.Item(first, position: 0).Quantity = 500;
        TestData.Item(first, position: 1).Quantity = 900;
        var second = TestData.Container(full);
        second.XMm = 1000;
        TestData.Item(second);
        var empty = new Room { Id = Guid.CreateVersion7(createdAt.AddMilliseconds(1)), HouseholdId = household, Name = "Attic", WidthMm = 3658, DepthMm = 3048 };
        var oneBox = new Room { Id = Guid.CreateVersion7(createdAt.AddMilliseconds(2)), HouseholdId = household, Name = "Shed", WidthMm = 3658, DepthMm = 3048 };
        TestData.Container(oneBox);
        // Saved in another order: the list follows the ids, not the order of insertion.
        await RoomsApi.SeedAsync(factory.ConnectionString, oneBox, full, empty);

        var rooms = await factory.ForHousehold(household).CreateClient()
            .GetFromJsonAsync<RoomResponse[]>(RoomsApi.Url, JsonSerializerOptions.Web, Token);

        Assert.NotNull(rooms);
        Assert.Equal(
            [
                new RoomResponse(full.Id, "Garage", 3658, 3048, 2, 3),
                new RoomResponse(empty.Id, "Attic", 3658, 3048, 0, 0),
                new RoomResponse(oneBox.Id, "Shed", 3658, 3048, 1, 0),
            ],
            rooms);
    }

    [Fact]
    public async Task Lists_nothing_for_a_household_without_rooms()
    {
        var client = factory.ForHousehold(Guid.CreateVersion7()).CreateClient();

        var response = await client.GetAsync(RoomsApi.Url, Token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync(Token));
    }

    [Fact]
    public async Task Does_not_list_the_rooms_of_another_household()
    {
        var household = Guid.CreateVersion7();
        var mine = TestData.Room(household);
        var theirs = TestData.Room(Guid.CreateVersion7());
        await RoomsApi.SeedAsync(factory.ConnectionString, mine, theirs);

        var rooms = await factory.ForHousehold(household).CreateClient()
            .GetFromJsonAsync<RoomResponse[]>(RoomsApi.Url, JsonSerializerOptions.Web, Token);

        Assert.Equal([mine.Id], rooms!.Select(room => room.Id));
    }

    [Fact]
    public async Task Gets_one_room_with_its_counts()
    {
        var room = TestData.Room();
        var container = TestData.Container(room);
        TestData.Item(container, position: 0);
        TestData.Item(container, position: 1);
        await RoomsApi.SeedAsync(factory.ConnectionString, room);

        var response = await factory.CreateClient().GetAsync($"{RoomsApi.Url}/{room.Id}", Token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            new RoomResponse(room.Id, "Garage", 3658, 3048, 1, 2),
            await RoomsApi.ReadRoomAsync(response));
    }

    [Fact]
    public async Task Answers_404_for_an_unknown_id()
    {
        var response = await factory.CreateClient().GetAsync($"{RoomsApi.Url}/{Guid.CreateVersion7()}", Token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Answers_404_for_a_room_of_another_household()
    {
        var theirs = TestData.Room(Guid.CreateVersion7());
        await RoomsApi.SeedAsync(factory.ConnectionString, theirs);

        var response = await factory.CreateClient().GetAsync($"{RoomsApi.Url}/{theirs.Id}", Token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Answers_404_when_the_id_is_not_a_uuid()
    {
        var response = await factory.CreateClient().GetAsync($"{RoomsApi.Url}/garage", Token);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Lists_with_one_query_that_counts_in_the_database()
    {
        var household = Guid.CreateVersion7();
        var room = TestData.Room(household);
        TestData.Item(TestData.Container(room));
        await RoomsApi.SeedAsync(factory.ConnectionString, room);
        var sql = new SqlCapture();
        var client = factory.ForHousehold(household)
            .WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.AddProvider(sql)))
            .CreateClient();

        var response = await client.GetAsync(RoomsApi.Url, Token);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var command = Assert.Single(sql.Commands);
        TestContext.Current.TestOutputHelper?.WriteLine(command);
        Assert.Equal(2, command.Split("count(*)").Length - 1);
        Assert.Contains("household_id", command);
        Assert.Contains("ORDER BY r.id", command);
    }
}
