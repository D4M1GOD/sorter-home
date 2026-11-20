using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace SorterHome.Api.Health;

/// <summary>The body of GET /api/health: "Healthy", "Degraded" or "Unhealthy".</summary>
public sealed record HealthResponse(string Status);

/// <summary>
/// Tells whether the API can serve requests. It runs the health checks registered in Program.cs
/// (none yet; the database adds one in step 5.2), so this controller does not change when a check
/// is added. Only the overall status is returned: the details of each check could reveal internal
/// information.
/// </summary>
[ApiController]
[Route("api/health")]
public sealed class HealthController(HealthCheckService healthChecks) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken cancellationToken)
    {
        var report = await healthChecks.CheckHealthAsync(cancellationToken);

        // A health answer is always current: no browser or proxy may keep a copy.
        Response.Headers.CacheControl = "no-store";

        var body = new HealthResponse(report.Status.ToString());
        // Degraded still serves requests, so it answers 200 like Healthy.
        return report.Status == HealthStatus.Unhealthy
            ? StatusCode(StatusCodes.Status503ServiceUnavailable, body)
            : Ok(body);
    }
}
