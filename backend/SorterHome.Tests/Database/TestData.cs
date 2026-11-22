using SorterHome.Domain.Containers;
using SorterHome.Domain.Items;
using SorterHome.Domain.Rooms;
using SorterHome.Infrastructure.Households;

namespace SorterHome.Tests.Database;

/// <summary>Valid rows, which each test changes to what it needs.</summary>
internal static class TestData
{
    public static Room Room(Guid? householdId = null) => new()
    {
        HouseholdId = householdId ?? FixedHousehold.FixedId,
        Name = "Garage",
        WidthMm = 3658,
        DepthMm = 3048,
    };

    public static Container Container(Room room)
    {
        var container = new Container
        {
            TypeId = "tough-box-27-gal",
            Name = "Container 1",
            XMm = 0,
            YMm = 0,
            Rotation = 0,
            StackPosition = 0,
        };
        room.Containers.Add(container);
        return container;
    }

    public static Item Item(Container container, int position = 0)
    {
        var item = new Item
        {
            Position = position,
            Name = "Nails",
            Quantity = 100,
            QuantityOut = 20,
            Description = "",
            Category = "",
        };
        container.Items.Add(item);
        return item;
    }
}
