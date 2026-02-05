using BikeVoyager.Application.Trips;
using FluentValidation;
using Xunit;

namespace BikeVoyager.UnitTests;

public class TripValidationTests
{
    [Fact]
    public void Rejette_une_distance_negative()
    {
        var validator = new CreateTripRequestValidator();
        var request = new CreateTripRequest("Sortie", -5, DateTime.UtcNow);

        var result = validator.Validate(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Accepte_une_demande_valide()
    {
        var validator = new CreateTripRequestValidator();
        var request = new CreateTripRequest("Sortie", 42.5, DateTime.UtcNow);

        var result = validator.Validate(request);

        Assert.True(result.IsValid);
    }
}
