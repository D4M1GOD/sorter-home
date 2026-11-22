namespace SorterHome.Tests.Api;

/// <summary>Without a connection string the API does not start, and it says how to fix it.</summary>
public sealed class MissingConnectionStringTests
{
    [Fact]
    public async Task The_api_does_not_start_and_explains_how_to_set_it()
    {
        // An empty value also hides any User Secret of the developer's machine.
        await using var factory = new SorterHomeApiFactory("");

        var exception = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        // The message may come wrapped by the test host: look in the whole chain.
        var text = exception.ToString();
        Assert.Contains("The connection string 'SorterHome' is missing.", text);
        Assert.Contains("dotnet user-secrets set \"ConnectionStrings:SorterHome\"", text);
    }
}
