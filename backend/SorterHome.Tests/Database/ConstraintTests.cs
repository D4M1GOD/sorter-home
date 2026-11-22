using Microsoft.EntityFrameworkCore;
using Npgsql;
using SorterHome.Domain.Containers;
using SorterHome.Domain.Items;
using SorterHome.Domain.Rooms;

namespace SorterHome.Tests.Database;

/// <summary>
/// The rules that the database enforces by itself, whatever the code sends. Each broken rule
/// gives a PostgreSQL error code: 23514 for a CHECK, 22001 for a text that is too long, 23503
/// for a foreign key and 23505 for a unique index.
/// </summary>
public sealed class ConstraintTests(PostgresServer server)
{
    private const string Check = "23514";
    private const string TooLong = "22001";

    /// <summary>A change that breaks one rule, and the error PostgreSQL must give.</summary>
    private sealed record BrokenRule(Action<Room, Container, Item> Break, string SqlState, string? Constraint);

    private static readonly Dictionary<string, BrokenRule> BrokenRules = new()
    {
        ["room name empty"] = new((r, _, _) => r.Name = "", Check, "ck_rooms_name_not_blank"),
        ["room name blank"] = new((r, _, _) => r.Name = "   ", Check, "ck_rooms_name_not_blank"),
        ["room name 61"] = new((r, _, _) => r.Name = new string('a', 61), TooLong, null),
        ["room width 1218"] = new((r, _, _) => r.WidthMm = 1218, Check, "ck_rooms_width_mm"),
        ["room width 30481"] = new((r, _, _) => r.WidthMm = 30481, Check, "ck_rooms_width_mm"),
        ["room depth 1218"] = new((r, _, _) => r.DepthMm = 1218, Check, "ck_rooms_depth_mm"),
        ["room depth 30481"] = new((r, _, _) => r.DepthMm = 30481, Check, "ck_rooms_depth_mm"),
        ["container name blank"] = new((_, c, _) => c.Name = " ", Check, "ck_containers_name_not_blank"),
        ["container name 61"] = new((_, c, _) => c.Name = new string('a', 61), TooLong, null),
        ["container type blank"] = new((_, c, _) => c.TypeId = "", Check, "ck_containers_type_id_not_blank"),
        ["container type 41"] = new((_, c, _) => c.TypeId = new string('a', 41), TooLong, null),
        ["container x -1"] = new((_, c, _) => c.XMm = -1, Check, "ck_containers_x_mm"),
        ["container y -1"] = new((_, c, _) => c.YMm = -1, Check, "ck_containers_y_mm"),
        ["container rotation 45"] = new((_, c, _) => c.Rotation = 45, Check, "ck_containers_rotation"),
        ["container rotation 180"] = new((_, c, _) => c.Rotation = 180, Check, "ck_containers_rotation"),
        ["container stack -1"] = new((_, c, _) => c.StackPosition = -1, Check, "ck_containers_stack_position"),
        ["item name blank"] = new((_, _, i) => i.Name = "  ", Check, "ck_items_name_not_blank"),
        ["item name 61"] = new((_, _, i) => i.Name = new string('a', 61), TooLong, null),
        ["item description 501"] = new((_, _, i) => i.Description = new string('a', 501), TooLong, null),
        ["item category 41"] = new((_, _, i) => i.Category = new string('a', 41), TooLong, null),
        ["item position -1"] = new((_, _, i) => i.Position = -1, Check, "ck_items_position"),
        ["item quantity -1"] = new((_, _, i) => { i.Quantity = -1; i.QuantityOut = 0; }, Check, "ck_items_quantity"),
        ["item quantity 10000"] = new((_, _, i) => i.Quantity = 10000, Check, "ck_items_quantity"),
        ["item quantity out -1"] = new((_, _, i) => i.QuantityOut = -1, Check, "ck_items_quantity_out"),
        ["item quantity out above quantity"] = new(
            (_, _, i) => { i.Quantity = 5; i.QuantityOut = 6; }, Check, "ck_items_quantity_out"),
    };

    public static TheoryData<string> BrokenRuleNames => [.. BrokenRules.Keys];

    [Theory]
    [MemberData(nameof(BrokenRuleNames))]
    public async Task Rejects_a_row_that_breaks_a_rule(string ruleName)
    {
        var rule = BrokenRules[ruleName];
        var room = TestData.Room();
        var container = TestData.Container(room);
        var item = TestData.Item(container);
        rule.Break(room, container, item);

        var error = await SaveAndCatchAsync(room);

        Assert.Equal(rule.SqlState, error.SqlState);
        Assert.Equal(rule.Constraint, error.ConstraintName);
    }

    [Fact]
    public async Task Accepts_the_values_at_the_limits()
    {
        var token = TestContext.Current.CancellationToken;
        await using var database = TestDatabase.Open(await server.MigratedDatabaseAsync("constraints"));
        var room = TestData.Room();
        room.Name = new string('a', Room.NameMaxLength);
        room.WidthMm = Room.MinSizeMm;
        room.DepthMm = Room.MaxSizeMm;
        var container = TestData.Container(room);
        container.Name = new string('a', Container.NameMaxLength);
        container.TypeId = new string('a', Container.TypeIdMaxLength);
        container.XMm = 0;
        container.YMm = 0;
        container.Rotation = 90;
        container.StackPosition = 0;
        var empty = TestData.Item(container, position: 0);
        empty.Quantity = Item.QuantityMin;
        empty.QuantityOut = 0;
        var full = TestData.Item(container, position: 1);
        full.Name = new string('a', Item.NameMaxLength);
        full.Description = new string('a', Item.DescriptionMaxLength);
        full.Category = new string('a', Item.CategoryMaxLength);
        full.Quantity = Item.QuantityMax;
        full.QuantityOut = Item.QuantityMax;
        database.Context.Rooms.Add(room);

        await database.Context.SaveChangesAsync(token);

        Assert.True(await database.Context.Items.CountAsync(i => i.ContainerId == container.Id, token) == 2);
    }

    [Fact]
    public async Task Rejects_a_container_whose_room_does_not_exist()
    {
        var token = TestContext.Current.CancellationToken;
        await using var database = TestDatabase.Open(await server.MigratedDatabaseAsync("constraints"));
        var orphan = new Container { RoomId = Guid.CreateVersion7(), TypeId = "tough-box-27-gal", Name = "Lost" };
        database.Context.Containers.Add(orphan);

        var exception = await Assert.ThrowsAsync<DbUpdateException>(
            () => database.Context.SaveChangesAsync(token));

        var error = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal("23503", error.SqlState);
        Assert.Equal("fk_containers_rooms_room_id", error.ConstraintName);
    }

    [Fact]
    public async Task Rejects_two_items_in_the_same_place_of_one_container()
    {
        var room = TestData.Room();
        var container = TestData.Container(room);
        TestData.Item(container, position: 3);
        TestData.Item(container, position: 3);

        var error = await SaveAndCatchAsync(room);

        Assert.Equal("23505", error.SqlState);
        Assert.Equal("ix_items_container_id_position", error.ConstraintName);
    }

    [Fact]
    public async Task Accepts_the_same_place_in_different_containers()
    {
        var token = TestContext.Current.CancellationToken;
        await using var database = TestDatabase.Open(await server.MigratedDatabaseAsync("constraints"));
        var room = TestData.Room();
        TestData.Item(TestData.Container(room), position: 0);
        var second = TestData.Container(room);
        second.XMm = 1000;
        TestData.Item(second, position: 0);
        database.Context.Rooms.Add(room);

        await database.Context.SaveChangesAsync(token);

        Assert.Equal(2, await database.Context.Items.CountAsync(i => i.Container!.RoomId == room.Id, token));
    }

    private async Task<PostgresException> SaveAndCatchAsync(Room room)
    {
        await using var database = TestDatabase.Open(await server.MigratedDatabaseAsync("constraints"));
        database.Context.Rooms.Add(room);

        var exception = await Assert.ThrowsAsync<DbUpdateException>(
            () => database.Context.SaveChangesAsync(TestContext.Current.CancellationToken));

        return Assert.IsType<PostgresException>(exception.InnerException);
    }
}
