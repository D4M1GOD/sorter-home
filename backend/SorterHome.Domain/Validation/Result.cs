namespace SorterHome.Domain.Validation;

/// <summary>
/// What a Domain method that creates something returns: the value, or the rules the input broke,
/// never both. Invalid input is not an exception.
/// </summary>
public sealed class Result<T>
    where T : class
{
    private Result(T? value, IReadOnlyList<ValidationError> errors)
    {
        Value = value;
        Errors = errors;
    }

    /// <summary>The value; null when there are errors.</summary>
    public T? Value { get; }

    /// <summary>The rules the input broke; empty when there is a value.</summary>
    public IReadOnlyList<ValidationError> Errors { get; }

    public static Result<T> Success(T value) => new(value, []);

    public static Result<T> Failure(IReadOnlyList<ValidationError> errors)
    {
        if (errors.Count == 0)
        {
            throw new ArgumentException("A failure needs at least one error.", nameof(errors));
        }

        return new(null, errors);
    }
}
