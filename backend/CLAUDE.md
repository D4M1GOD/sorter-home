# Backend conventions

ASP.NET Core Web API on .NET 10. The SDK is pinned in `global.json`, and the settings shared by
every project (net10.0, nullable, implicit usings, warnings as errors) are in
`Directory.Build.props`.

## Projects and dependencies
- `SorterHome.Domain`: pure rules. No NuGet packages and no project references.
- `SorterHome.Infrastructure`: database and photos. It may reference Domain, never Api.
- `SorterHome.Api`: controllers and the registration of every service (`Program.cs`). It may
  reference Domain and Infrastructure.
- `SorterHome.Tests`: the only test project. It references Api.
- Never add a reference that points the other way.

## Code
- Inside each project the code is organized in folders by feature (`Rooms`, `Containers`,
  `Items`, `Health`), not by kind (no `Controllers/` or `Services/` folders).
- Endpoints are controllers (`[ApiController]`, `ControllerBase`) with routes under `api/`.
  No Minimal API.
- Nullable reference types are on: fix a possible null, never hide it with `!`.
- Asynchronous methods receive a `CancellationToken` and pass it on.

## Database
- PostgreSQL 18 through Entity Framework Core 10 (Npgsql). The local database runs in Docker
  Compose (`docker-compose.yml`, service `db`).
- The image tag `postgres:18` lives in two places: `docker-compose.yml` and
  `PostgresServer.Image` in `SorterHome.Tests`. Change both together.
- Tables are plural and every name is snake_case (`rooms`, `width_mm`), by EFCore.NamingConventions.
- Ids are uuid version 7 created by the application (`Guid.CreateVersion7()`), never by the
  database or EF (`ValueGeneratedNever`).
- Lengths are integer millimeters. `description` and `category` are `''` when empty, never null.
- Entities are plain classes in Domain. The mapping is in `IEntityTypeConfiguration` classes in
  Infrastructure, one per feature folder; never EF attributes in Domain.
- CHECK constraints only for rules of a single row (their SQL uses the snake_case names). Rules
  that need other rows or other tables live in Domain.
- Every query is limited to the current household by the named query filter
  `SorterHomeDbContext.HouseholdFilter` on rooms, containers and items. Never use
  `IgnoreQueryFilters()` without saying so.
- The `position` of a new item is max + 1 per container; two concurrent inserts can collide on
  the unique index: handle it in 5.4 (retry or 409).

## Migrations
- Create them with the local tool, from `backend/` (`dotnet tool restore` installs it):
  `dotnet ef migrations add <Name> --project SorterHome.Infrastructure --startup-project SorterHome.Api --output-dir Database/Migrations`
- Apply them by hand in development:
  `dotnet ef database update --project SorterHome.Infrastructure --startup-project SorterHome.Api`
- One migration per change of the model, with a descriptive PascalCase name. Never written by
  hand.
- Never edit or delete a migration that is already in `main` or applied outside this machine:
  fix it with a new migration.
- Read the generated `Up` and `Down` before committing, and watch for dropped columns or data.
- The model snapshot is committed with its migration and never edited by hand. If it has a merge
  conflict, recreate the migration.
- A test fails when the model changed and the migration is missing.

## Secrets
- Never put a password in `appsettings*.json` or anywhere in the repository.
- The API reads the connection string `ConnectionStrings:SorterHome`; in development it comes
  from User Secrets (`dotnet user-secrets ... --project SorterHome.Api`).
- Docker reads `POSTGRES_PASSWORD` from `backend/.env` (ignored by git; `.env.example` is the
  model). It is only used when the volume is created for the first time.
- The password of `.env` and the one in the User Secret must be the same. If they differ, the
  API starts but `/api/health` answers 503.

## Tests
- xUnit v3, run by the Microsoft Testing Platform (`global.json`), in `SorterHome.Tests`, with
  folders that mirror the code.
- Endpoints are tested through `SorterHomeApiFactory` (the whole API in memory), which gives the
  API the connection string of the tests; never the plain `WebApplicationFactory<Program>`.
- Database tests run against a real PostgreSQL started by Testcontainers (`PostgresServer`), one
  database per test class. Docker Desktop must be running; the tests fail if it is not.
- Pass `TestContext.Current.CancellationToken` to every call that accepts a token.
