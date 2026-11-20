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

## Tests
- xUnit v3, run by the Microsoft Testing Platform (`global.json`), in `SorterHome.Tests`, with
  folders that mirror the code.
- Endpoints are tested through `WebApplicationFactory<Program>` (the whole API in memory).
- Pass `TestContext.Current.CancellationToken` to every call that accepts a token.
