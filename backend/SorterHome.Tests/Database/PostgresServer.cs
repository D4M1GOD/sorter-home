using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SorterHome.Tests.Database;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(PostgresServer))]

namespace SorterHome.Tests.Database;

/// <summary>
/// One throwaway PostgreSQL server for the whole test run, started in a Docker container by
/// Testcontainers. Each test class gets its own database in it, so classes that run in parallel
/// do not see each other's rows. Docker Desktop must be running.
/// </summary>
public sealed class PostgresServer : IAsyncLifetime
{
    /// <summary>The same image as the local database: keep it equal to backend/docker-compose.yml.</summary>
    public const string Image = "postgres:18";

    private readonly PostgreSqlContainer container = new PostgreSqlBuilder(Image).Build();
    private readonly ConcurrentDictionary<string, Lazy<Task<string>>> migrated = new();

    public async ValueTask InitializeAsync()
    {
        try
        {
            await container.StartAsync();
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException(
                "Couldn't start PostgreSQL for the tests. Start Docker Desktop: the database tests run "
                + "PostgreSQL in a container (Testcontainers).",
                exception);
        }
    }

    public ValueTask DisposeAsync() => container.DisposeAsync();

    /// <summary>
    /// The connection string of a database with every migration applied. It is created the first
    /// time a name is asked for, and shared by the tests that ask for the same name.
    /// </summary>
    public Task<string> MigratedDatabaseAsync(string name) =>
        migrated.GetOrAdd(name, key => new Lazy<Task<string>>(() => CreateMigratedAsync(key))).Value;

    /// <summary>The connection string of a new database with no tables at all.</summary>
    public async Task<string> EmptyDatabaseAsync(string name)
    {
        var databaseName = name.ToLowerInvariant();
        await using var connection = new NpgsqlConnection(container.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
        return new NpgsqlConnectionStringBuilder(container.GetConnectionString())
        {
            Database = databaseName,
        }.ConnectionString;
    }

    private async Task<string> CreateMigratedAsync(string name)
    {
        var connectionString = await EmptyDatabaseAsync(name);
        await using var database = TestDatabase.Open(connectionString);
        await database.Context.Database.MigrateAsync();
        return connectionString;
    }
}
