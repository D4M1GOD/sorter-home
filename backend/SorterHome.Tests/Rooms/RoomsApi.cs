using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SorterHome.Api.Rooms;
using SorterHome.Domain.Rooms;
using SorterHome.Tests.Database;

namespace SorterHome.Tests.Rooms;

/// <summary>Small helpers to call /api/rooms with exact JSON and to read its answers.</summary>
internal static class RoomsApi
{
    public const string Url = "/api/rooms";

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    /// <summary>The body exactly as written, so a test can send JSON that a C# type cannot.</summary>
    public static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    public static Task<HttpResponseMessage> PostAsync(HttpClient client, string json) =>
        client.PostAsync(Url, Json(json), Token);

    public static Task<HttpResponseMessage> PutAsync(HttpClient client, Guid id, string json) =>
        client.PutAsync($"{Url}/{id}", Json(json), Token);

    public static async Task<RoomResponse> ReadRoomAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<RoomResponse>(JsonSerializerOptions.Web, Token)
        ?? throw new InvalidOperationException("The body has no room.");

    /// <summary>The "errors" of a ValidationProblemDetails: field to messages.</summary>
    public static async Task<Dictionary<string, string[]>> ReadErrorsAsync(HttpResponseMessage response)
    {
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Token));
        return body.RootElement.GetProperty("errors")
            .EnumerateObject()
            .ToDictionary(
                field => field.Name,
                field => field.Value.EnumerateArray().Select(message => message.GetString()!).ToArray());
    }

    /// <summary>Saves rooms (with their containers and items) directly in the database.</summary>
    public static async Task SeedAsync(string connectionString, params Room[] rooms)
    {
        await using var database = TestDatabase.Open(connectionString);
        database.Context.Rooms.AddRange(rooms);
        await database.Context.SaveChangesAsync(Token);
    }

    /// <summary>Whether the room is still in the database, whatever its household.</summary>
    public static async Task<bool> ExistsAsync(string connectionString, Guid id)
    {
        await using var database = TestDatabase.Open(connectionString);
        var count = await database.Context.Database
            .SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM rooms WHERE id = {id}")
            .SingleAsync(Token);
        return count == 1;
    }
}
