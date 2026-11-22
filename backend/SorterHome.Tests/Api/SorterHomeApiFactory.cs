using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using SorterHome.Domain.Households;
using SorterHome.Infrastructure;
using SorterHome.Tests.Database;

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

    /// <summary>The connection string of the database this API uses.</summary>
    public string ConnectionString => connectionString;

    /// <summary>
    /// The same API working for another household. A test with its own household sees exactly
    /// its own rows, not the ones the other tests of its class created.
    /// </summary>
    public WebApplicationFactory<Program> ForHousehold(Guid householdId) =>
        WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<ICurrentHousehold>(new TestHousehold(householdId))));

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseSetting(
            $"ConnectionStrings:{InfrastructureServices.ConnectionStringName}",
            connectionString);
}
