namespace BikeVoyager.Api.Feedback;

public sealed class FeedbackOptions
{
    public bool Enabled { get; set; } = true;
    public string RecipientEmail { get; set; } = "arnaud.wissart@live.fr";
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderName { get; set; } = "BikeVoyager";
    public string SubjectPrefix { get; set; } = "[BikeVoyager] ";
    public FeedbackSmtpOptions Smtp { get; set; } = new();
}

public sealed class FeedbackSmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
