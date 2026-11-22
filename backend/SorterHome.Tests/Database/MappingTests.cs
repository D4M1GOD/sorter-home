using Microsoft.EntityFrameworkCore;

namespace SorterHome.Tests.Database;

/// <summary>What is saved is read back the same, field by field.</summary>
public sealed class MappingTests(PostgresServer server)
{
    [Fact]
    public async Task Saves_and_reads_a_room_with_its_container_and_items()
    {
        var token = TestContext.Current.CancellationToken;
        var connectionString = await server.MigratedDatabaseAsync("mapping");
        var room = TestData.Room();
        room.Name = "Garage";
        room.WidthMm = 30480;
        room.DepthMm = 1219;
        var container = TestData.Container(room);
        container.Name = "Christmas";
        container.XMm = 305;
        container.YMm = 610;
        container.Rotation = 90;
        container.StackPosition = 2;
        var withPhoto = TestData.Item(container, position: 0);
        withPhoto.Name = "Lights";
        withPhoto.Quantity = 4;
        withPhoto.QuantityOut = 4;
        withPhoto.Description = "Warm white\n10 m";
        withPhoto.Category = "Navidad";
        withPhoto.PhotoId = Guid.CreateVersion7();
        var withoutPhoto = TestData.Item(container, position: 1);
        withoutPhoto.Name = "Tape";
        withoutPhoto.Quantity = 0;
        withoutPhoto.QuantityOut = 0;
        await using (var writer = TestDatabase.Open(connectionString))
        {
            writer.Context.Rooms.Add(room);
            await writer.Context.SaveChangesAsync(token);
        }

        await using var reader = TestDatabase.Open(connectionString);
        var saved = await reader.Context.Rooms
            .Include(r => r.Containers)
            .ThenInclude(c => c.Items)
            .SingleAsync(r => r.Id == room.Id, token);

        // The application created the ids, time ordered (UUID version 7).
        Assert.Equal(7, room.Id.Version);
        Assert.Equal(7, container.Id.Version);
        Assert.Equal(7, withPhoto.Id.Version);
        Assert.Equal(room.HouseholdId, saved.HouseholdId);
        Assert.Equal("Garage", saved.Name);
        Assert.Equal(30480, saved.WidthMm);
        Assert.Equal(1219, saved.DepthMm);
        var savedContainer = Assert.Single(saved.Containers);
        Assert.Equal(container.Id, savedContainer.Id);
        Assert.Equal(room.Id, savedContainer.RoomId);
        Assert.Equal("tough-box-27-gal", savedContainer.TypeId);
        Assert.Equal("Christmas", savedContainer.Name);
        Assert.Equal(305, savedContainer.XMm);
        Assert.Equal(610, savedContainer.YMm);
        Assert.Equal(90, savedContainer.Rotation);
        Assert.Equal(2, savedContainer.StackPosition);
        var items = savedContainer.Items.OrderBy(i => i.Position).ToList();
        Assert.Equal(2, items.Count);
        Assert.Equal(withPhoto.Id, items[0].Id);
        Assert.Equal(0, items[0].Position);
        Assert.Equal("Lights", items[0].Name);
        Assert.Equal(4, items[0].Quantity);
        Assert.Equal(4, items[0].QuantityOut);
        Assert.Equal("Warm white\n10 m", items[0].Description);
        Assert.Equal("Navidad", items[0].Category);
        Assert.Equal(withPhoto.PhotoId, items[0].PhotoId);
        Assert.Equal(withoutPhoto.Id, items[1].Id);
        Assert.Equal(1, items[1].Position);
        Assert.Equal(0, items[1].Quantity);
        Assert.Equal("", items[1].Description);
        Assert.Equal("", items[1].Category);
        Assert.Null(items[1].PhotoId);
    }
}
