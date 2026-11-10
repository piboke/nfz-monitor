using System.Text.Json;
using NfzAtlas.ETL;
using NfzAtlas.Infrastructure;

using var shutdown = new CancellationTokenSource(EtlOptions.ExecutionTimeout);
ConsoleCancelEventHandler cancelHandler = (_, @event) =>
{
    @event.Cancel = true;
    shutdown.Cancel();
};
Console.CancelKeyPress += cancelHandler;
try
{
    var options = EtlOptions.Parse(args);
    await new EtlRunner().Run(options, shutdown.Token);
    return 0;
}
catch (Exception error)
{
    Console.Error.WriteLine(
        JsonSerializer.Serialize(
            new
            {
                at = DateTimeOffset.UtcNow,
                error = error.GetType().Name,
                message = error.Message,
            },
            JsonFiles.Options
        )
    );
    return 1;
}
finally
{
    Console.CancelKeyPress -= cancelHandler;
}
