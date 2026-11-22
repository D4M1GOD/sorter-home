using System.Net;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using SorterHome.Tests.Api;
using SorterHome.Tests.Database;

namespace SorterHome.Tests.Health;

/// <summary>
/// GET /api/health, through the whole API running in memory (no port, no network), connected to
/// the PostgreSQL of the tests.
/// </summary>
public sealed class HealthEndpointTests(PostgresServer server) : IAsyncLifetime
{
    private SorterHomeApiFactory factory = null!;

    public async ValueTask InitializeAsync() =>
        factory = new SorterHomeApiFactory(await server.MigratedDatabaseAsync("health"));

    public ValueTask DisposeAsync() => factory.DisposeAsync();

    [Fact]
    public async Task Answers_healthy_when_every_check_passes()
    {
        // The database check passes only because the API uses the database of the factory.
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(
            """{"status":"Healthy"}""",
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Answers_503_unhealthy_when_the_database_cannot_be_reached()
    {
        // Nothing listens on port 1: the connection is refused at once.
        await using var unreachable = new SorterHomeApiFactory(
            "Host=127.0.0.1;Port=1;Database=sorterhome;Username=sorterhome;Password=unused;Timeout=2");
        var client = unreachable.CreateClient();

        var response = await client.GetAsync("/api/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        // Only the status: no error message, host or port.
        Assert.Equal(
            """{"status":"Unhealthy"}""",
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Answers_503_unhealthy_when_a_check_fails()
    {
        var client = ClientWithCheck(HealthCheckResult.Unhealthy());

        var response = await client.GetAsync("/api/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(
            """{"status":"Unhealthy"}""",
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Answers_200_degraded_when_a_check_is_degraded()
    {
        var client = ClientWithCheck(HealthCheckResult.Degraded());

        var response = await client.GetAsync("/api/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            """{"status":"Degraded"}""",
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    /// <summary>The API with one more health check that always gives this result.</summary>
    private HttpClient ClientWithCheck(HealthCheckResult result) =>
        factory
            .WithWebHostBuilder(builder =>
                builder.ConfigureTestServices(services =>
                    services.AddHealthChecks().AddCheck("test", () => result)))
            .CreateClient();
}
