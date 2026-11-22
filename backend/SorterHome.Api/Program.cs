using System.Text.Json.Serialization;
using SorterHome.Infrastructure;
using SorterHome.Infrastructure.Database;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services
    .AddControllers(options =>
        // The rules live only in the Domain: ASP.NET must not add hidden "required" rules for the
        // properties and parameters that are not nullable.
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true)
    .AddJsonOptions(options =>
    {
        // A number must be a JSON number: "3658" (a string) is rejected with a 400.
        options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.Strict;
        // JSON that cannot be read gives a short stable message, not the internal one of .NET.
        options.AllowInputFormatterExceptionMessages = false;
    });
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
// The database. In development the connection string comes from User Secrets.
builder.Services.AddInfrastructure(
    builder.Configuration.GetConnectionString(InfrastructureServices.ConnectionStringName));
// The checks behind GET /api/health: the API answers only if it can connect to the database.
builder.Services.AddHealthChecks().AddDbContextCheck<SorterHomeDbContext>("database");

var app = builder.Build();

// Configure the HTTP request pipeline.
// The OpenAPI document (/openapi/v1.json) exists only in Development.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();

app.Run();
