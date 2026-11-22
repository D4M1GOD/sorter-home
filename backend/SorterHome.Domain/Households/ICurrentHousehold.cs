namespace SorterHome.Domain.Households;

/// <summary>
/// The household whose data is being used. Every query of rooms, containers and items is limited
/// to it. Today it is a fixed value; with user accounts it will come from the signed-in user.
/// </summary>
public interface ICurrentHousehold
{
    Guid Id { get; }
}
