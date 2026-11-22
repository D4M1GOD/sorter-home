using SorterHome.Infrastructure;
using SorterHome.Infrastructure.Database;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
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
