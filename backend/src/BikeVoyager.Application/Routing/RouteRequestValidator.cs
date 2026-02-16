using FluentValidation;

namespace BikeVoyager.Application.Routing;

public sealed class RouteRequestValidator : AbstractValidator<RouteRequest>
{
    private static readonly string[] AllowedModes = { "walking", "bicycle", "ebike" };
    private static readonly string[] AllowedAssistLevels = { "low", "medium", "high" };

    public RouteRequestValidator()
    {
        RuleFor(x => x.From)
            .NotNull();

        RuleFor(x => x.To)
            .NotNull();

        When(x => x.From is not null, () =>
        {
            RuleFor(x => x.From.Lat)
                .InclusiveBetween(-90, 90);

            RuleFor(x => x.From.Lon)
                .InclusiveBetween(-180, 180);
        });

        When(x => x.To is not null, () =>
        {
            RuleFor(x => x.To.Lat)
                .InclusiveBetween(-90, 90);

            RuleFor(x => x.To.Lon)
                .InclusiveBetween(-180, 180);
        });

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

        RuleFor(x => x.Mode)
            .NotEmpty()
            .Must(mode => AllowedModes.Contains(mode, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Le mode doit être walking, bicycle ou ebike.");

        RuleFor(x => x.SpeedKmh)
            .GreaterThan(0)
            .LessThanOrEqualTo(60);

        RuleFor(x => x.EbikeAssist)
            .Must(level =>
                string.IsNullOrWhiteSpace(level) ||
                AllowedAssistLevels.Contains(level, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Le niveau d'assistance doit être low, medium ou high.");
    }
}
