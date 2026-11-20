var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
// The checks behind GET /api/health. None yet: the database adds its own in step 5.2.
builder.Services.AddHealthChecks();

var app = builder.Build();

// Configure the HTTP request pipeline.
// The OpenAPI document (/openapi/v1.json) exists only in Development.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();

app.Run();
