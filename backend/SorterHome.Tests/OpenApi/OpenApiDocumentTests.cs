using System.Net;
using Microsoft.AspNetCore.Hosting;
using SorterHome.Tests.Api;

namespace SorterHome.Tests.OpenApi;

/// <summary>The OpenAPI document that .NET generates exists only in Development.</summary>
public sealed class OpenApiDocumentTests : IAsyncDisposable
{
    // The document never touches the database, but the API needs a connection string to start.
    private readonly SorterHomeApiFactory factory = new(SorterHomeApiFactory.Unused);

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task Describes_the_health_endpoint_in_development()
    {
        var client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"))
            .CreateClient();

        var response = await client.GetAsync("/openapi/v1.json", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(
            "\"/api/health\"",
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Describes_the_rooms_endpoints_in_development()
    {
        var client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"))
            .CreateClient();

        var document = await client.GetStringAsync("/openapi/v1.json", TestContext.Current.CancellationToken);

        Assert.Contains("\"/api/rooms\"", document);
        Assert.Contains("\"/api/rooms/{id}\"", document);
        Assert.Contains("\"RoomResponse\"", document);
    }

    [Fact]
    public async Task Does_not_exist_in_production()
    {
        var client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Production"))
            .CreateClient();

        var response = await client.GetAsync("/openapi/v1.json", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
