using SorterHome.Domain.Households;

namespace SorterHome.Tests.Database;

/// <summary>A household chosen by the test, in place of the fixed one of the app.</summary>
internal sealed class TestHousehold(Guid id) : ICurrentHousehold
{
    public Guid Id => id;
}
