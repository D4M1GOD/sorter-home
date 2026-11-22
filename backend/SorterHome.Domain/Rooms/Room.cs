using SorterHome.Domain.Containers;
using SorterHome.Domain.Validation;

namespace SorterHome.Domain.Rooms;

/// <summary>
/// A named area drawn as a floor plan with real dimensions. All lengths are whole millimeters.
/// The API creates and changes rooms only through <see cref="Create"/> and <see cref="Update"/>,
/// which apply the rules. The setters stay public for EF Core and for the database tests.
/// </summary>
public sealed class Room
{
    public const int NameMaxLength = 60;

    /// <summary>4 ft, rounded to whole millimeters.</summary>
    public const int MinSizeMm = 1219;

    /// <summary>100 ft.</summary>
    public const int MaxSizeMm = 30480;

    /// <summary>The width of a new room: 12 ft (FR-1b).</summary>
    public const int DefaultWidthMm = 3658;

    /// <summary>The depth of a new room: 10 ft (FR-1b).</summary>
    public const int DefaultDepthMm = 3048;

    public const string NameRequired = "Room name is required.";
    public const string NameTooLong = "Room name must have at most 60 characters.";
    public const string WidthRequired = "Width is required.";
    public const string WidthOutOfRange = "Width must be from 1219 to 30480 mm.";
    public const string DepthRequired = "Depth is required.";
    public const string DepthOutOfRange = "Depth must be from 1219 to 30480 mm.";

    /// <summary>Created by the application, time ordered (UUID version 7).</summary>
    public Guid Id { get; init; } = Guid.CreateVersion7();

    /// <summary>The household that owns the room. Its containers and items belong to it too.</summary>
    public Guid HouseholdId { get; set; }

    public string Name { get; set; } = "";

    /// <summary>Left-to-right size of the plan.</summary>
    public int WidthMm { get; set; }

    /// <summary>Front-to-back size of the plan.</summary>
    public int DepthMm { get; set; }

    public List<Container> Containers { get; } = [];

    /// <summary>
    /// A new room of the household with the default size. The name is trimmed; it is required
    /// and has at most 60 characters (counted like the frontend: UTF-16 characters).
    /// </summary>
    public static Result<Room> Create(string? name, Guid householdId)
    {
        var errors = new List<ValidationError>();
        var trimmed = CheckName(name, errors);
        if (errors.Count > 0)
        {
            return Result<Room>.Failure(errors);
        }

        return Result<Room>.Success(new Room
        {
            HouseholdId = householdId,
            Name = trimmed,
            WidthMm = DefaultWidthMm,
            DepthMm = DefaultDepthMm,
        });
    }

    /// <summary>
    /// Changes the name and the size. Returns every rule the input breaks; when there is any,
    /// nothing changes. The rule that a room cannot be smaller than its containers is not here
    /// yet (step 5.4).
    /// </summary>
    public IReadOnlyList<ValidationError> Update(string? name, int? widthMm, int? depthMm)
    {
        var errors = new List<ValidationError>();
        var trimmed = CheckName(name, errors);
        CheckSize(widthMm, nameof(WidthMm), WidthRequired, WidthOutOfRange, errors);
        CheckSize(depthMm, nameof(DepthMm), DepthRequired, DepthOutOfRange, errors);
        if (errors.Count > 0)
        {
            return errors;
        }

        Name = trimmed;
        WidthMm = widthMm!.Value;
        DepthMm = depthMm!.Value;
        return [];
    }

    private static string CheckName(string? name, List<ValidationError> errors)
    {
        var trimmed = name?.Trim() ?? "";
        if (trimmed.Length == 0)
        {
            errors.Add(new ValidationError(nameof(Name), NameRequired));
        }
        else if (trimmed.Length > NameMaxLength)
        {
            errors.Add(new ValidationError(nameof(Name), NameTooLong));
        }

        return trimmed;
    }

    private static void CheckSize(
        int? sizeMm,
        string field,
        string required,
        string outOfRange,
        List<ValidationError> errors)
    {
        if (sizeMm is null)
        {
            errors.Add(new ValidationError(field, required));
        }
        else if (sizeMm < MinSizeMm || sizeMm > MaxSizeMm)
        {
            errors.Add(new ValidationError(field, outOfRange));
        }
    }
}
