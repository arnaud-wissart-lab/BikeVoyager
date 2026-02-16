using FluentValidation;

namespace BikeVoyager.Application.Routing;

public sealed class LoopRequestValidator : AbstractValidator<LoopRequest>
{
    private static readonly string[] AllowedModes = { "walking", "bicycle", "ebike" };
    private static readonly string[] AllowedAssistLevels = { "low", "medium", "high" };

    public LoopRequestValidator()
    {
        RuleFor(x => x.Start)
            .NotNull();

        When(x => x.Start is not null, () =>
        {
            RuleFor(x => x.Start.Lat)
                .InclusiveBetween(-90, 90);

            RuleFor(x => x.Start.Lon)
                .InclusiveBetween(-180, 180);

            RuleFor(x => x.Start.Label)
                .NotEmpty();
        });

        RuleFor(x => x.TargetDistanceKm)
            .GreaterThan(0)
            .LessThanOrEqualTo(300);

        RuleFor(x => x.Mode)
            .NotEmpty()
            .Must(mode => AllowedModes.Contains(mode, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Le mode doit être walking, bicycle ou ebike.");

        RuleFor(x => x.SpeedKmh)
            .GreaterThan(0)
            .LessThanOrEqualTo(60);

        RuleFor(x => x.Variation)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(9999);

        RuleFor(x => x.EbikeAssist)
            .Must(level =>
                string.IsNullOrWhiteSpace(level) ||
                AllowedAssistLevels.Contains(level, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Le niveau d'assistance doit être low, medium ou high.");

        When(x => x.Waypoints is not null, () =>
        {
            RuleForEach(x => x.Waypoints!)
                .NotNull()
                .ChildRules(waypoint =>
                {
                    waypoint.RuleFor(p => p.Lat)
                        .InclusiveBetween(-90, 90);
                    waypoint.RuleFor(p => p.Lon)
                        .InclusiveBetween(-180, 180);
                    waypoint.RuleFor(p => p.Label)
                        .NotEmpty();
                });
        });
    }
}
