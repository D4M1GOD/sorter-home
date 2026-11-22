using Microsoft.EntityFrameworkCore;
using SorterHome.Infrastructure.Database;
using SorterHome.Infrastructure.Households;

namespace SorterHome.Tests.Database;

/// <summary>
/// Every query sees only the rooms, containers and items of the current household, without the
/// query having to say so.
/// </summary>
public sealed class HouseholdFilterTests(PostgresServer server)
{
    private static readonly Guid OtherHousehold = Guid.CreateVersion7();

    [Fact]
    public async Task Queries_see_only_the_data_of_the_current_household()
    {
        var token = TestContext.Current.CancellationToken;
        var connectionString = await server.MigratedDatabaseAsync("household");
        var mine = TestData.Room();
        var myItem = TestData.Item(TestData.Container(mine));
        var theirs = TestData.Room(OtherHousehold);
        var theirItem = TestData.Item(TestData.Container(theirs));
        await using (var writer = TestDatabase.Open(connectionString))
        {
            writer.Context.Rooms.AddRange(mine, theirs);
            await writer.Context.SaveChangesAsync(token);
        }

        await using var database = TestDatabase.Open(connectionString, FixedHousehold.FixedId);
        var rooms = await database.Context.Rooms.Select(r => r.Id).ToListAsync(token);
        var containers = await database.Context.Containers.Select(c => c.Id).ToListAsync(token);
        var items = await database.Context.Items.Select(i => i.Id).ToListAsync(token);

        Assert.Contains(mine.Id, rooms);
        Assert.DoesNotContain(theirs.Id, rooms);
        Assert.Contains(mine.Containers[0].Id, containers);
        Assert.DoesNotContain(theirs.Containers[0].Id, containers);
        Assert.Contains(myItem.Id, items);
        Assert.DoesNotContain(theirItem.Id, items);
        // Not even by id.
        Assert.Null(await database.Context.Items.SingleOrDefaultAsync(i => i.Id == theirItem.Id, token));
    }

    [Fact]
    public async Task The_other_household_sees_only_its_own_data()
    {
        var token = TestContext.Current.CancellationToken;
        var connectionString = await server.MigratedDatabaseAsync("household");
        var mine = TestData.Room();
        var theirs = TestData.Room(OtherHousehold);
        await using (var writer = TestDatabase.Open(connectionString))
        {
            writer.Context.Rooms.AddRange(mine, theirs);
            await writer.Context.SaveChangesAsync(token);
        }

        await using var database = TestDatabase.Open(connectionString, OtherHousehold);
        var rooms = await database.Context.Rooms.Select(r => r.Id).ToListAsync(token);
        var everyRoom = await database.Context.Rooms
            .IgnoreQueryFilters([SorterHomeDbContext.HouseholdFilter])
            .Select(r => r.Id)
            .ToListAsync(token);

        Assert.Contains(theirs.Id, rooms);
        Assert.DoesNotContain(mine.Id, rooms);
        // The filter is the only thing that hides them: without it both are there.
        Assert.Contains(mine.Id, everyRoom);
        Assert.Contains(theirs.Id, everyRoom);
    }
}
