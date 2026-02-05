using FluentValidation;

namespace BikeVoyager.Application.Trips;

public sealed class CreateTripRequestValidator : AbstractValidator<CreateTripRequest>
{
    public CreateTripRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(120);

        RuleFor(x => x.DistanceKm)
            .GreaterThan(0)
            .LessThanOrEqualTo(2000);

        RuleFor(x => x.StartDateUtc)
            .NotEmpty()
            .Must(date => date <= DateTime.UtcNow.AddYears(1))
            .WithMessage("La date de départ ne peut pas dépasser un an.");
    }
}
