using SorterHome.Domain.Households;

namespace SorterHome.Infrastructure.Households;

/// <summary>
/// The only household while there are no user accounts. Every room is saved with this id.
/// Never change the value: when the households table is created, a migration inserts a row with
/// this same id and adds the foreign key, so the existing rooms need no change.
/// </summary>
public sealed class FixedHousehold : ICurrentHousehold
{
    public static readonly Guid FixedId = new("019a8f3c-5d2e-7b41-9c6a-3e8d1f2b4a70");

    public Guid Id => FixedId;
}
