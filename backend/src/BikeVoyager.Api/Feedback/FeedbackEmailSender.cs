using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Mail;
using System.Text;

namespace BikeVoyager.Api.Feedback;

public interface IFeedbackSender
{
    Task<FeedbackSendResult> SendAsync(FeedbackEnvelope envelope, CancellationToken cancellationToken);
}

public sealed class FeedbackEmailSender : IFeedbackSender
{
    private readonly IOptions<FeedbackOptions> _options;
    private readonly ILogger<FeedbackEmailSender> _logger;

    public FeedbackEmailSender(
        IOptions<FeedbackOptions> options,
        ILogger<FeedbackEmailSender> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task<FeedbackSendResult> SendAsync(
        FeedbackEnvelope envelope,
        CancellationToken cancellationToken)
    {
        var options = _options.Value;

        if (!options.Enabled)
        {
            return FeedbackSendResult.Disabled("Le module de remarques n'est pas activé.");
        }

        if (string.IsNullOrWhiteSpace(options.Smtp.Host))
        {
            return FeedbackSendResult.Disabled("Le serveur SMTP n'est pas configuré.");
        }

        if (!TryCreateAddress(options.SenderEmail, options.SenderName, out var senderAddress))
        {
            return FeedbackSendResult.Disabled("L'adresse expéditeur n'est pas configurée.");
        }

        if (!TryCreateAddress(options.RecipientEmail, null, out var recipientAddress))
        {
            return FeedbackSendResult.Disabled("L'adresse destinataire n'est pas configurée.");
        }

        try
        {
            using var message = new MailMessage
            {
                From = senderAddress!,
                Subject = BuildSubject(options.SubjectPrefix, envelope.Subject),
                Body = BuildBody(envelope),
                IsBodyHtml = false,
                BodyEncoding = Encoding.UTF8,
                SubjectEncoding = Encoding.UTF8,
            };
            message.To.Add(recipientAddress!);

            using var smtpClient = new SmtpClient(options.Smtp.Host.Trim(), ResolvePort(options.Smtp.Port))
            {
                EnableSsl = options.Smtp.UseSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
            };

            if (!string.IsNullOrWhiteSpace(options.Smtp.Username))
            {
                smtpClient.UseDefaultCredentials = false;
                smtpClient.Credentials = new NetworkCredential(
                    options.Smtp.Username.Trim(),
                    options.Smtp.Password);
            }
            else
            {
                smtpClient.UseDefaultCredentials = true;
            }

            await smtpClient.SendMailAsync(message).WaitAsync(cancellationToken);
            return FeedbackSendResult.Sent("Votre remarque a été envoyée.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Envoi de remarque développeur impossible.");
            return FeedbackSendResult.Failed("L'envoi de la remarque a échoué.");
        }
    }

    private static bool TryCreateAddress(
        string? rawEmail,
        string? displayName,
        out MailAddress? address)
    {
        address = null;
        if (string.IsNullOrWhiteSpace(rawEmail))
        {
            return false;
        }

        try
        {
            address = string.IsNullOrWhiteSpace(displayName)
                ? new MailAddress(rawEmail.Trim())
                : new MailAddress(rawEmail.Trim(), displayName.Trim());
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static int ResolvePort(int configuredPort) =>
        configuredPort is >= 1 and <= 65535 ? configuredPort : 587;

    private static string BuildSubject(string? subjectPrefix, string subject)
    {
        var prefix = string.IsNullOrWhiteSpace(subjectPrefix) ? string.Empty : subjectPrefix.Trim();
        return string.IsNullOrEmpty(prefix)
            ? subject
            : $"{prefix} {subject}";
    }

    private static string BuildBody(FeedbackEnvelope envelope)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Nouveau retour utilisateur BikeVoyager");
        builder.AppendLine();
        builder.Append("Date UTC: ").AppendLine(envelope.SubmittedAtUtc.ToString("O"));
        builder.Append("Session: ").AppendLine(envelope.SessionId);
        builder.Append("Corrélation: ").AppendLine(envelope.CorrelationId);
        builder.Append("Page: ").AppendLine(envelope.Page ?? "-");
        builder.Append("Contact: ").AppendLine(envelope.ContactEmail ?? "-");
        builder.Append("User-Agent: ").AppendLine(envelope.UserAgent ?? "-");
        builder.AppendLine();
        builder.AppendLine("Message");
        builder.AppendLine("-------");
        builder.AppendLine(envelope.Message);
        return builder.ToString();
    }
}

public sealed record FeedbackEnvelope(
    string Subject,
    string Message,
    string? ContactEmail,
    string? Page,
    string SessionId,
    string CorrelationId,
    string? UserAgent,
    DateTimeOffset SubmittedAtUtc);

public sealed record FeedbackSendResult(
    FeedbackSendStatus Status,
    string Message)
{
    public bool IsSent => Status == FeedbackSendStatus.Sent;
    public bool IsDisabled => Status == FeedbackSendStatus.Disabled;
    public bool IsFailed => Status == FeedbackSendStatus.Failed;

    public static FeedbackSendResult Sent(string message) =>
        new(FeedbackSendStatus.Sent, message);

    public static FeedbackSendResult Disabled(string message) =>
        new(FeedbackSendStatus.Disabled, message);

    public static FeedbackSendResult Failed(string message) =>
        new(FeedbackSendStatus.Failed, message);
}

public enum FeedbackSendStatus
{
    Sent = 0,
    Disabled = 1,
    Failed = 2,
}
