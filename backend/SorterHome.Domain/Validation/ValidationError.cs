namespace SorterHome.Domain.Validation;

/// <summary>
/// A rule that some input breaks. <paramref name="Field"/> is the name of the property in the
/// Domain (for example "WidthMm"); the API turns it into the name the client uses.
/// </summary>
public sealed record ValidationError(string Field, string Message);
