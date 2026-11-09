using System.Text.Json;
using NfzAtlas.Domain;
using NfzAtlas.Infrastructure;

var arguments = args.Chunk(2).ToDictionary(a => a[0], a => a.Length == 2 ? a[1] : throw new ArgumentException("Parametry wymagają wartości."));
var allowed = new[] { "--data", "--work", "--province", "--case", "--benefit", "--fixture" };
if (arguments.Keys.Except(allowed).Any()) throw new ArgumentException("Nieznany parametr. Opcje: " + string.Join(' ', allowed));
var data = Path.GetFullPath(arguments.GetValueOrDefault("--data", "data"));
var work = Path.GetFullPath(arguments.GetValueOrDefault("--work", ".etl-work"));
Directory.CreateDirectory(work);
await using var runLock = new FileStream(Path.Combine(work, "run.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
using var shutdown = new CancellationTokenSource(TimeSpan.FromHours(5));
Console.CancelKeyPress += (_, e) => { e.Cancel = true; shutdown.Cancel(); };
var provinces = arguments.TryGetValue("--province", out var province) ? province.Split(',') : Regions.Names.Keys.ToArray();
if (provinces.Any(p => !Regions.Names.ContainsKey(p))) throw new ArgumentException("Nieznany kod województwa NFZ (01–16, nie TERYT).");
var cases = arguments.TryGetValue("--case", out var category) ? category.Split(',').Select(int.Parse).ToArray() : new[] { 1, 2 };
if (cases.Any(c => c is not (1 or 2))) throw new ArgumentException("Kategoria musi mieć wartość 1 lub 2.");
var benefit = arguments.GetValueOrDefault("--benefit");
var partitions = provinces.SelectMany(p => cases.Select(c => new Partition(p, c, benefit))).ToArray();
try
{
    var results = new List<(Partition, JsonElement[])>();
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
    http.DefaultRequestHeaders.UserAgent.ParseAdd("NfzAtlas/1.0 (+https://github.com/piboke/nfz-monitor)");
    using var source = new NfzClient(http);
    var crawler = new Crawler(source, work);
    foreach (var partition in partitions)
    {
        if (arguments.TryGetValue("--fixture", out var fixture))
        {
            using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(fixture, shutdown.Token));
            // Fixtures are accepted only in separate test outputs and are never marked complete.
            if (data == Path.GetFullPath("data")) throw new ArgumentException("Fixture nie może zostać opublikowany do produkcyjnego data/.");
            results.Add((partition, doc.RootElement.GetProperty("data").EnumerateArray().Select(r => r.Clone()).ToArray()));
        }
        else results.Add((partition, await crawler.Download(partition, shutdown.Token)));
    }
    var national = provinces.Distinct().Count() == 16 && cases.Distinct().Count() == 2 && benefit is null && !arguments.ContainsKey("--fixture");
    var manifest = await new Publisher(data).Publish(results, national, DateTimeOffset.UtcNow, shutdown.Token);
    if (arguments.ContainsKey("--fixture")) await JsonFiles.Write(Path.Combine(data, "manifest.json"), manifest with { Complete = false, Warnings = ["DANE TESTOWE — fixture, nie zestaw produkcyjny."] });
    Console.WriteLine($"Opublikowano {manifest.QueueCount} kolejek, {manifest.Shards.Length} shardów; krajowy: {national}.");
    foreach (var directory in Directory.EnumerateDirectories(work)) Directory.Delete(directory, true);
}
catch (Exception error)
{
    Console.Error.WriteLine(JsonSerializer.Serialize(new { at = DateTimeOffset.UtcNow, error = error.GetType().Name, message = error.Message }));
    Environment.ExitCode = 1;
}
