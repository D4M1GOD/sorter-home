using System.Net;
using System.Text;
using SorterHome.Api.Rooms;
using SorterHome.Domain.Rooms;
using SorterHome.Infrastructure.Households;
using SorterHome.Tests.Api;
using SorterHome.Tests.Database;

namespace SorterHome.Tests.Rooms;

/// <summary>POST /api/rooms.</summary>
public sealed class CreateRoomTests(PostgresServer server) : IAsyncLifetime
{
    private SorterHomeApiFactory factory = null!;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync() =>
        factory = new SorterHomeApiFactory(await server.MigratedDatabaseAsync("rooms_create"));

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task Creates_a_room_with_the_default_size()
    {
        var client = factory.CreateClient();

        var response = await RoomsApi.PostAsync(client, """{"name":"Garage"}""");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var room = await RoomsApi.ReadRoomAsync(response);
        Assert.Equal(new RoomResponse(room.Id, "Garage", 3658, 3048, 0, 0), room);
        Assert.Equal(7, room.Id.Version);
        Assert.Equal($"http://localhost/api/rooms/{room.Id}", response.Headers.Location?.ToString());
        // The Location really leads to the saved room.
        var saved = await client.GetAsync(response.Headers.Location, Token);
        Assert.Equal(room, await RoomsApi.ReadRoomAsync(saved));
    }

    [Fact]
    public async Task Trims_the_name()
    {
        var response = await RoomsApi.PostAsync(factory.CreateClient(), """{"name":"  Jardín  "}""");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Jardín", (await RoomsApi.ReadRoomAsync(response)).Name);
    }

    [Theory]
    [InlineData("{}", Room.NameRequired)]
    [InlineData("""{"name":null}""", Room.NameRequired)]
    [InlineData("""{"name":"   "}""", Room.NameRequired)]
    [InlineData("""{"name":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}""", Room.NameTooLong)]
    public async Task Rejects_an_invalid_name(string json, string message)
    {
        var response = await RoomsApi.PostAsync(factory.CreateClient(), json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(new Dictionary<string, string[]> { ["name"] = [message] }, await RoomsApi.ReadErrorsAsync(response));
    }

    [Fact]
    public async Task Rejects_an_empty_body()
    {
        var response = await RoomsApi.PostAsync(factory.CreateClient(), "");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            new Dictionary<string, string[]> { [""] = ["A non-empty request body is required."] },
            await RoomsApi.ReadErrorsAsync(response));
    }

    [Fact]
    public async Task Rejects_json_that_cannot_be_read()
    {
        var response = await RoomsApi.PostAsync(factory.CreateClient(), """{"name":""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        // The key is the JSON path where reading stopped (here "$.name"), as ASP.NET writes it.
        var key = Assert.Single((await RoomsApi.ReadErrorsAsync(response)).Keys);
        Assert.StartsWith("$", key);
    }

    [Fact]
    public async Task Rejects_a_body_that_is_not_json()
    {
        var content = new StringContent("Garage", Encoding.UTF8, "text/plain");

        var response = await factory.CreateClient().PostAsync(RoomsApi.Url, content, Token);

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task Ignores_unknown_fields_and_never_takes_the_household_or_the_size_from_the_body()
    {
        var otherHousehold = Guid.CreateVersion7();
        var json = $$"""{"name":"Garage","householdId":"{{otherHousehold}}","widthMm":9999,"color":"red"}""";

        var response = await RoomsApi.PostAsync(factory.CreateClient(), json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var room = await RoomsApi.ReadRoomAsync(response);
        Assert.Equal(3658, room.WidthMm);
        await using var database = TestDatabase.Open(factory.ConnectionString);
        var saved = await database.Context.Rooms.FindAsync([room.Id], Token);
        Assert.Equal(FixedHousehold.FixedId, saved!.HouseholdId);
    }
}
