using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using SorterHome.Domain.Validation;

namespace SorterHome.Api.Validation;

public static class ValidationProblemExtensions
{
    /// <summary>
    /// A 400 with the errors of the Domain by field (ValidationProblemDetails, RFC 9457). The
    /// fields are named like in the JSON (camelCase: "WidthMm" becomes "widthMm"). It goes through
    /// ASP.NET's own factory, so the body has the same shape, type and traceId as its automatic
    /// 400 responses.
    /// </summary>
    public static ActionResult ValidationProblem(
        this ControllerBase controller,
        IEnumerable<ValidationError> errors)
    {
        var modelState = new ModelStateDictionary();
        foreach (var error in errors)
        {
            modelState.AddModelError(JsonNamingPolicy.CamelCase.ConvertName(error.Field), error.Message);
        }

        return controller.ValidationProblem(modelState);
    }
}
