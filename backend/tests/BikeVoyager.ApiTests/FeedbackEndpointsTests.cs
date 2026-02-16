using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BikeVoyager.Api.Feedback;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BikeVoyager.ApiTests;

public class FeedbackEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly StubFeedbackSender _stubSender;

    public FeedbackEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _stubSender = new StubFeedbackSender();
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IFeedbackSender>();
                services.AddSingleton<IFeedbackSender>(_stubSender);
            });
        });
    }

    [Fact]
    public async Task Feedback_refuse_un_payload_invalide()
    {
        using var client = _factory.CreateClient();

        using var response = await client.PostAsJsonAsync("/api/feedback", new
        {
            subject = "court",
            message = "trop court",
            website = "",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var payload = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(payload);
        Assert.True(document.RootElement.TryGetProperty("errors", out var errors));
        Assert.True(errors.TryGetProperty("subject", out _));
        Assert.True(errors.TryGetProperty("message", out _));
    }

    [Fact]
    public async Task Feedback_envoie_une_remarque_valide()
    {
        using var client = _factory.CreateClient();

        using var response = await client.PostAsJsonAsync("/api/feedback", new
        {
            subject = "  Retour\r\napplication  ",
            message = "Bonjour,\nVoici un retour utile sur le comportement observé.",
            contactEmail = "   contact@example.com   ",
            page = "aide",
            website = "",
        });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.NotNull(_stubSender.LastEnvelope);
        Assert.Equal("Retour application", _stubSender.LastEnvelope!.Subject);
        Assert.Equal("contact@example.com", _stubSender.LastEnvelope.ContactEmail);
        Assert.Equal("aide", _stubSender.LastEnvelope.Page);
    }

    private sealed class StubFeedbackSender : IFeedbackSender
    {
        public FeedbackEnvelope? LastEnvelope { get; private set; }

        public Task<FeedbackSendResult> SendAsync(
            FeedbackEnvelope envelope,
            CancellationToken cancellationToken)
        {
            LastEnvelope = envelope;
            return Task.FromResult(FeedbackSendResult.Sent("ok"));
        }
    }
}
