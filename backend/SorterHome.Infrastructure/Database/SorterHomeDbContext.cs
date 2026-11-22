using Microsoft.EntityFrameworkCore;
using SorterHome.Domain.Containers;
using SorterHome.Domain.Households;
using SorterHome.Domain.Items;
using SorterHome.Domain.Rooms;

namespace SorterHome.Infrastructure.Database;

/// <summary>
/// The database of the app: rooms, their containers and the items inside them. The mapping of
/// each entity is in its feature folder (<c>Rooms/RoomConfiguration.cs</c>, and so on).
/// </summary>
public sealed class SorterHomeDbContext(
    DbContextOptions<SorterHomeDbContext> options,
    ICurrentHousehold currentHousehold) : DbContext(options)
{
    /// <summary>The name of the query filter that limits every query to the current household.</summary>
    public const string HouseholdFilter = "Household";

    /// <summary>Read by the query filters each time a query runs on this context.</summary>
    private Guid HouseholdId => currentHousehold.Id;

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<Container> Containers => Set<Container>();

    public DbSet<Item> Items => Set<Item>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SorterHomeDbContext).Assembly);

        // Every query sees only the data of the current household. Containers and items reach it
        // through their room. Bypassing it (IgnoreQueryFilters) must be a deliberate decision.
        modelBuilder.Entity<Room>()
            .HasQueryFilter(HouseholdFilter, room => room.HouseholdId == HouseholdId);
        modelBuilder.Entity<Container>()
            .HasQueryFilter(HouseholdFilter, container => container.Room!.HouseholdId == HouseholdId);
        modelBuilder.Entity<Item>()
            .HasQueryFilter(HouseholdFilter, item => item.Container!.Room!.HouseholdId == HouseholdId);
    }
}
