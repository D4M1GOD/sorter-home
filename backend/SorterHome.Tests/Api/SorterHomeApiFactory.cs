using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using SorterHome.Infrastructure;

namespace SorterHome.Tests.Api;

/// <summary>
/// The whole API in memory, connected to the database of the tests and never to the developer's
/// one. The connection string is set with UseSetting, which WebApplicationFactory passes to
/// Program.cs from the start, so it is already there when Program.cs reads it.
/// </summary>
public sealed class SorterHomeApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    /// <summary>For tests that never reach the database (it is not opened at startup).</summary>
    public const string Unused = "Host=unused.invalid;Database=unused;Username=unused;Password=unused";

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseSetting(
            $"ConnectionStrings:{InfrastructureServices.ConnectionStringName}",
            connectionString);
}
