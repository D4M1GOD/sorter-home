using Microsoft.Extensions.DependencyInjection;
using SorterHome.Domain.Households;
using SorterHome.Infrastructure;
using SorterHome.Infrastructure.Database;
using SorterHome.Infrastructure.Households;

namespace SorterHome.Tests.Database;

/// <summary>
/// A <see cref="SorterHomeDbContext"/> built with the same registration as the API
/// (<see cref="InfrastructureServices.AddInfrastructure"/>), for one household.
/// </summary>
internal sealed class TestDatabase : IAsyncDisposable
{
    private readonly ServiceProvider provider;
    private readonly AsyncServiceScope scope;

    private TestDatabase(ServiceProvider provider)
    {
        this.provider = provider;
        scope = provider.CreateAsyncScope();
        Context = scope.ServiceProvider.GetRequiredService<SorterHomeDbContext>();
    }

    public SorterHomeDbContext Context { get; }

    /// <summary>Opens the database as the given household (by default the fixed one of the app).</summary>
    public static TestDatabase Open(string connectionString, Guid? householdId = null)
    {
        var services = new ServiceCollection();
        services.AddInfrastructure(connectionString);
        // Registered last, so it replaces the fixed household.
        services.AddSingleton<ICurrentHousehold>(new TestHousehold(householdId ?? FixedHousehold.FixedId));
        return new TestDatabase(services.BuildServiceProvider());
    }

    public async ValueTask DisposeAsync()
    {
        await scope.DisposeAsync();
        await provider.DisposeAsync();
    }
}
