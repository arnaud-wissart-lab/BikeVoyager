namespace BikeVoyager.Application.Routing;

public sealed class LoopNotFoundException : Exception
{
    public LoopNotFoundException(string message) : base(message)
    {
    }
}
