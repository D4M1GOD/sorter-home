using SorterHome.Domain.Rooms;
using SorterHome.Domain.Validation;

namespace SorterHome.Tests.Rooms;

/// <summary>The rules of a room, in the Domain alone: no database, no API.</summary>
public sealed class RoomTests
{
    private static readonly Guid Household = Guid.CreateVersion7();

    [Fact]
    public void Create_gives_the_default_size_and_trims_the_name()
    {
        var result = Room.Create("  Garage  ", Household);

        Assert.Empty(result.Errors);
        var room = Assert.IsType<Room>(result.Value);
        Assert.Equal("Garage", room.Name);
        Assert.Equal(3658, room.WidthMm);
        Assert.Equal(3048, room.DepthMm);
    }

    [Fact]
    public void Create_sets_the_household_and_a_time_ordered_id()
    {
        var room = Room.Create("Garage", Household).Value!;

        Assert.Equal(Household, room.HouseholdId);
        Assert.Equal(7, room.Id.Version);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void Create_requires_a_name(string? name)
    {
        var result = Room.Create(name, Household);

        Assert.Null(result.Value);
        Assert.Equal([new ValidationError("Name", Room.NameRequired)], result.Errors);
    }

    [Fact]
    public void Create_accepts_60_characters_after_trimming()
    {
        var result = Room.Create("  " + new string('a', 60) + "  ", Household);

        Assert.Equal(60, result.Value!.Name.Length);
    }

    [Fact]
    public void Create_rejects_61_characters()
    {
        var result = Room.Create(new string('a', 61), Household);

        Assert.Null(result.Value);
        Assert.Equal([new ValidationError("Name", Room.NameTooLong)], result.Errors);
    }

    [Fact]
    public void Update_changes_the_three_fields_and_trims_the_name()
    {
        var room = NewRoom();

        var errors = room.Update(" Shed ", 6096, 1524);

        Assert.Empty(errors);
        Assert.Equal("Shed", room.Name);
        Assert.Equal(6096, room.WidthMm);
        Assert.Equal(1524, room.DepthMm);
    }

    [Theory]
    [InlineData(1219, 30480)]
    [InlineData(30480, 1219)]
    public void Update_accepts_the_limits(int widthMm, int depthMm)
    {
        var room = NewRoom();

        Assert.Empty(room.Update("Garage", widthMm, depthMm));
        Assert.Equal(widthMm, room.WidthMm);
        Assert.Equal(depthMm, room.DepthMm);
    }

    [Theory]
    [InlineData(1218, 3048, "WidthMm", Room.WidthOutOfRange)]
    [InlineData(30481, 3048, "WidthMm", Room.WidthOutOfRange)]
    [InlineData(3658, 1218, "DepthMm", Room.DepthOutOfRange)]
    [InlineData(3658, 30481, "DepthMm", Room.DepthOutOfRange)]
    public void Update_rejects_a_size_out_of_range(int widthMm, int depthMm, string field, string message)
    {
        var room = NewRoom();

        Assert.Equal([new ValidationError(field, message)], room.Update("Garage", widthMm, depthMm));
    }

    [Theory]
    [InlineData("name", "Name", Room.NameRequired)]
    [InlineData("width", "WidthMm", Room.WidthRequired)]
    [InlineData("depth", "DepthMm", Room.DepthRequired)]
    public void Update_requires_every_field(string missing, string field, string message)
    {
        var room = NewRoom();

        var errors = room.Update(
            missing == "name" ? null : "Garage",
            missing == "width" ? null : 3658,
            missing == "depth" ? null : 3048);

        Assert.Equal([new ValidationError(field, message)], errors);
    }

    [Fact]
    public void Update_returns_every_error_at_once()
    {
        var room = NewRoom();

        var errors = room.Update(" ", 1218, null);

        Assert.Equal(
            [
                new ValidationError("Name", Room.NameRequired),
                new ValidationError("WidthMm", Room.WidthOutOfRange),
                new ValidationError("DepthMm", Room.DepthRequired),
            ],
            errors);
    }

    [Fact]
    public void Update_changes_nothing_when_a_rule_is_broken()
    {
        var room = NewRoom();

        room.Update("New name", 6096, 30481);

        Assert.Equal("Garage", room.Name);
        Assert.Equal(3658, room.WidthMm);
        Assert.Equal(3048, room.DepthMm);
    }

    private static Room NewRoom() => Room.Create("Garage", Household).Value!;
}
