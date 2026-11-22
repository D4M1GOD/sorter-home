using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace SorterHome.Tests.Api;

/// <summary>
/// Collects the SQL commands that EF Core sends to the database, from its own log, so a test can
/// check what really runs.
/// </summary>
internal sealed class SqlCapture : ILoggerProvider
{
    private readonly ConcurrentQueue<string> commands = new();

    public IReadOnlyList<string> Commands => [.. commands];

    public ILogger CreateLogger(string categoryName) => new CommandLogger(categoryName, commands);

    public void Dispose()
    {
    }

    private sealed class CommandLogger(string category, ConcurrentQueue<string> commands) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => category == DbLoggerCategory.Database.Command.Name;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (category == DbLoggerCategory.Database.Command.Name && eventId == RelationalEventId.CommandExecuted)
            {
                commands.Enqueue(formatter(state, exception));
            }
        }
    }
}
