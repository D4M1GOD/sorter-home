using Microsoft.EntityFrameworkCore;

namespace SorterHome.Tests.Database;

/// <summary>The migrations create the expected tables, and none is missing for the model.</summary>
public sealed class MigrationTests(PostgresServer server)
{
    [Fact]
    public async Task Apply_to_an_empty_database_and_create_the_three_tables()
    {
        var token = TestContext.Current.CancellationToken;
        var connectionString = await server.EmptyDatabaseAsync("migration_empty");
        await using var database = TestDatabase.Open(connectionString);

        await database.Context.Database.MigrateAsync(token);

        Assert.Empty(await database.Context.Database.GetPendingMigrationsAsync(token));
        var columns = await database.Context.Database
            .SqlQueryRaw<string>(
                """
                SELECT table_name || '.' || column_name || ' ' || data_type
                    || coalesce('(' || character_maximum_length || ')', '')
                    || CASE WHEN is_nullable = 'YES' THEN ' null' ELSE '' END AS "Value"
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name IN ('rooms', 'containers', 'items')
                ORDER BY table_name, ordinal_position
                """)
            .ToListAsync(token);
        Assert.Equal(
            [
                "containers.id uuid",
                "containers.room_id uuid",
                "containers.type_id character varying(40)",
                "containers.name character varying(60)",
                "containers.x_mm integer",
                "containers.y_mm integer",
                "containers.rotation integer",
                "containers.stack_position integer",
                "items.id uuid",
                "items.container_id uuid",
                "items.position integer",
                "items.name character varying(60)",
                "items.quantity integer",
                "items.quantity_out integer",
                "items.description character varying(500)",
                "items.category character varying(40)",
                "items.photo_id uuid null",
                "rooms.id uuid",
                "rooms.household_id uuid",
                "rooms.name character varying(60)",
                "rooms.width_mm integer",
                "rooms.depth_mm integer",
            ],
            columns);
    }

    [Fact]
    public async Task Exist_for_every_change_of_the_model()
    {
        var connectionString = await server.MigratedDatabaseAsync("migration_model");
        await using var database = TestDatabase.Open(connectionString);

        // Fails when an entity or its mapping changed and nobody ran "dotnet ef migrations add".
        Assert.False(database.Context.Database.HasPendingModelChanges());
    }
}
