using BikeVoyager.Api.Middleware;
using BikeVoyager.Api.Security;
using System.Net.Mail;
using System.Text;

namespace BikeVoyager.Api.Feedback;

public static class FeedbackEndpoints
{
    public static IEndpointRouteBuilder MapFeedbackEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/v1/feedback",
                async (FeedbackSubmissionRequest request,
                    HttpContext context,
                    IFeedbackSender feedbackSender,
                    CancellationToken cancellationToken) =>
                {
                    var validationErrors = ValidateAndNormalizeRequest(request);
                    if (validationErrors.Errors.Count > 0)
                    {
                        return Results.ValidationProblem(validationErrors.Errors);
                    }

                    var sessionId = AnonymousApiSessionContext.TryGetSessionId(context, out var anonymousSessionId)
                        ? anonymousSessionId
                        : context.TraceIdentifier;
                    var correlationId = context.Response.Headers[CorrelationIdMiddleware.HeaderName].FirstOrDefault()
                        ?? context.TraceIdentifier;

                    var envelope = new FeedbackEnvelope(
                        Subject: validationErrors.Subject!,
                        Message: validationErrors.Message!,
                        ContactEmail: validationErrors.ContactEmail,
                        Page: validationErrors.Page,
                        SessionId: sessionId,
                        CorrelationId: correlationId,
                        UserAgent: context.Request.Headers.UserAgent.ToString(),
                        SubmittedAtUtc: DateTimeOffset.UtcNow);

                    var sendResult = await feedbackSender.SendAsync(envelope, cancellationToken);
                    if (sendResult.IsSent)
                    {
                        return Results.Accepted(
                            value: new
                            {
                                status = "accepted",
                                message = sendResult.Message,
                            });
                    }

                    if (sendResult.IsDisabled)
                    {
                        return Results.Json(
                            new
                            {
                                status = "disabled",
                                message = sendResult.Message,
                            },
                            statusCode: StatusCodes.Status503ServiceUnavailable);
                    }

                    return Results.Json(
                        new
                        {
                            status = "failed",
                            message = sendResult.Message,
                        },
                        statusCode: StatusCodes.Status502BadGateway);
                })
            .RequireRateLimiting("feedback")
            .WithName("SubmitDeveloperFeedback");

        return endpoints;
    }

    private static FeedbackValidationResult ValidateAndNormalizeRequest(
        FeedbackSubmissionRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            errors["website"] = ["Valeur invalide."];
            return new FeedbackValidationResult(errors, null, null, null, null);
        }

        if (!TryNormalizeSingleLine(request.Subject, minLength: 6, maxLength: 120, out var subject))
        {
            errors["subject"] = ["Objet requis (6 à 120 caractères)."];
        }

        if (!TryNormalizeMultiLine(request.Message, minLength: 20, maxLength: 3500, out var message))
        {
            errors["message"] = ["Message requis (20 à 3500 caractères)."];
        }

        string? page = null;
        if (!TryNormalizeOptionalSingleLine(request.Page, maxLength: 120, out page))
        {
            errors["page"] = ["Page invalide."];
        }

        string? contactEmail = null;
        if (!TryNormalizeEmail(request.ContactEmail, out contactEmail))
        {
            errors["contactEmail"] = ["Adresse email invalide."];
        }

        return new FeedbackValidationResult(errors, subject, message, contactEmail, page);
    }

    private static bool TryNormalizeOptionalSingleLine(
        string? raw,
        int maxLength,
        out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return true;
        }

        if (!TryNormalizeSingleLine(raw, minLength: 1, maxLength: maxLength, out var parsed))
        {
            return false;
        }

        normalized = parsed;
        return true;
    }

    private static bool TryNormalizeSingleLine(
        string? raw,
        int minLength,
        int maxLength,
        out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var builder = new StringBuilder(Math.Min(raw.Length, maxLength));
        foreach (var character in raw)
        {
            if (character is '\r' or '\n')
            {
                builder.Append(' ');
                continue;
            }

            if (char.IsControl(character))
            {
                continue;
            }

            builder.Append(character);
            if (builder.Length >= maxLength)
            {
                break;
            }
        }

        normalized = CollapseWhitespace(builder.ToString());
        if (normalized.Length < minLength || normalized.Length > maxLength)
        {
            return false;
        }

        return true;
    }

    private static bool TryNormalizeMultiLine(
        string? raw,
        int minLength,
        int maxLength,
        out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var builder = new StringBuilder(Math.Min(raw.Length, maxLength));
        var previousWasNewline = false;

        foreach (var character in raw)
        {
            if (character == '\r')
            {
                continue;
            }

            if (character == '\n')
            {
                if (!previousWasNewline)
                {
                    builder.Append('\n');
                }

                previousWasNewline = true;
                continue;
            }

            if (char.IsControl(character) && character != '\t')
            {
                continue;
            }

            builder.Append(character);
            previousWasNewline = false;

            if (builder.Length >= maxLength)
            {
                break;
            }
        }

        normalized = builder.ToString().Trim();
        if (normalized.Length < minLength || normalized.Length > maxLength)
        {
            return false;
        }

        return true;
    }

    private static string CollapseWhitespace(string value)
    {
        var builder = new StringBuilder(value.Length);
        var pendingSpace = false;
        foreach (var character in value.Trim())
        {
            if (char.IsWhiteSpace(character))
            {
                pendingSpace = true;
                continue;
            }

            if (pendingSpace && builder.Length > 0)
            {
                builder.Append(' ');
            }

            builder.Append(character);
            pendingSpace = false;
        }

        return builder.ToString();
    }

    private static bool TryNormalizeEmail(string? raw, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return true;
        }

        var candidate = raw.Trim();
        if (candidate.Length > 254 || candidate.Contains('\r') || candidate.Contains('\n'))
        {
            return false;
        }

        try
        {
            var mailAddress = new MailAddress(candidate);
            normalized = mailAddress.Address;
            return true;
        }
        catch
        {
            return false;
        }
    }

    private sealed record FeedbackValidationResult(
        Dictionary<string, string[]> Errors,
        string? Subject,
        string? Message,
        string? ContactEmail,
        string? Page);
}

public sealed record FeedbackSubmissionRequest(
    string? Subject,
    string? Message,
    string? ContactEmail,
    string? Page,
    string? Website);
