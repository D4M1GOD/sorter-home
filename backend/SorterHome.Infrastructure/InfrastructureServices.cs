using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SorterHome.Domain.Households;
using SorterHome.Infrastructure.Database;
using SorterHome.Infrastructure.Households;

namespace SorterHome.Infrastructure;

public static class InfrastructureServices
{
    /// <summary>The name of the connection string in the configuration (ConnectionStrings:SorterHome).</summary>
    public const string ConnectionStringName = "SorterHome";

    /// <summary>
    /// Registers the database. Fails at startup with a clear message when the connection string
    /// is missing, instead of failing later on the first query.
    /// </summary>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"The connection string '{ConnectionStringName}' is missing. In development, set it once from backend/ with:"
                + Environment.NewLine
                + $"dotnet user-secrets set \"ConnectionStrings:{ConnectionStringName}\" "
                + "\"Host=localhost;Port=5432;Database=sorterhome;Username=sorterhome;Password=<password>;Timeout=5\" "
                + "--project SorterHome.Api");
        }

        services.AddSingleton<ICurrentHousehold, FixedHousehold>();
        services.AddDbContext<SorterHomeDbContext>(options =>
            options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention());
        return services;
    }
}
