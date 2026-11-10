using System.Diagnostics;
using System.Text.Json;
using NfzAtlas.Domain;
using NfzAtlas.Infrastructure;

namespace NfzAtlas.ETL;

public sealed class EtlRunner
{
    public async Task Run(EtlOptions options, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(options.WorkDirectory);
        await using var runLock = new FileStream(
            Path.Combine(options.WorkDirectory, "run.lock"),
            FileMode.OpenOrCreate,
            FileAccess.ReadWrite,
            FileShare.None
        );
        if (options.RebuildHistory)
        {
            var count = await ArchiveRecovery.RebuildHistory(
                options.DataDirectory,
                cancellationToken
            );
            Console.WriteLine(
                $"Odtworzono {count} obserwacji z oryginalnymi datami pobrania. Uruchom pełny ETL, aby ponownie wygenerować projekcje frontendu."
            );
            return;
        }
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd(
            "NfzAtlas/1.0 (+https://github.com/piboke/nfz-monitor)"
        );
        using var source = new NfzClient(http, maxConcurrency: EtlOptions.WorkerCount);
        if (options.MeasureVolume)
        {
            await Measure(source, options.Partitions, cancellationToken);
            return;
        }
        var results = await Download(source, options, cancellationToken);
        var manifest = await new Publisher(options.DataDirectory).Publish(
            results,
            options.National,
            DateTimeOffset.UtcNow,
            cancellationToken
        );
        if (options.FixturePath is not null)
            await JsonFiles.Write(
                Path.Combine(options.DataDirectory, "manifest.json"),
                manifest with
                {
                    Complete = false,
                    Warnings = ["DANE TESTOWE — fixture, nie zestaw produkcyjny."],
                },
                cancellationToken
            );
        Console.WriteLine(
            $"Opublikowano {manifest.QueueCount} kolejek, {manifest.Shards.Length} shardów; krajowy: {options.National}."
        );
        foreach (var directory in Directory.EnumerateDirectories(options.WorkDirectory))
            Directory.Delete(directory, true);
    }

    private static async Task<List<(Partition, JsonElement[])>> Download(
        INfzSource source,
        EtlOptions options,
        CancellationToken cancellationToken
    )
    {
        if (options.FixturePath is not null)
        {
            using var document = JsonDocument.Parse(
                await File.ReadAllTextAsync(options.FixturePath, cancellationToken)
            );
            return options
                .Partitions.Select(partition =>
                    (
                        partition,
                        document
                            .RootElement.GetProperty("data")
                            .EnumerateArray()
                            .Select(record => record.Clone())
                            .ToArray()
                    )
                )
                .ToList();
        }
        var crawler = new Crawler(source, options.WorkDirectory);
        var completed = new System.Collections.Concurrent.ConcurrentDictionary<
            Partition,
            JsonElement[]
        >();
        await Parallel.ForEachAsync(
            options.Partitions,
            new ParallelOptions
            {
                MaxDegreeOfParallelism = EtlOptions.WorkerCount,
                CancellationToken = cancellationToken,
            },
            async (partition, token) =>
            {
                completed[partition] = await crawler.Download(partition, token);
            }
        );
        return options.Partitions.Select(partition => (partition, completed[partition])).ToList();
    }

    private static async Task Measure(
        INfzSource source,
        IEnumerable<Partition> partitions,
        CancellationToken cancellationToken
    )
    {
        var stopwatch = Stopwatch.StartNew();
        var measurements = new List<object>();
        long queues = 0,
            pages = 0;
        foreach (var partition in partitions)
        {
            var first = await source.FetchAsync(partition, 1, cancellationToken);
            queues += first.Count;
            var pageCount = Math.Max(1, (first.Count + 24) / 25);
            pages += pageCount;
            measurements.Add(
                new
                {
                    partition.Province,
                    partition.Case,
                    queues = first.Count,
                    pages = pageCount,
                }
            );
        }
        Console.WriteLine(
            JsonSerializer.Serialize(
                new
                {
                    measuredAt = DateTimeOffset.UtcNow,
                    partitions = measurements,
                    queues,
                    pages,
                    minimumThrottleSeconds = pages * 0.35,
                    measurementSeconds = stopwatch.Elapsed.TotalSeconds,
                },
                JsonFiles.Options
            )
        );
    }
}
