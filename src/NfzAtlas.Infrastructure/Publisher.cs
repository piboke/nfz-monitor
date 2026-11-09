using System.Text.Json;
using NfzAtlas.Application;
using NfzAtlas.Domain;

namespace NfzAtlas.Infrastructure;

public sealed record SourceObservation(string QueueId, int Case, string Province, string Fingerprint, DateTimeOffset RetrievedAt, string SchemaVersion, JsonElement Source);
public sealed class Publisher(string dataRoot)
{
    public const string SchemaVersion = "1.0";
    public async Task<Manifest> Publish(IReadOnlyList<(Partition Partition, JsonElement[] Records)> partitions, bool national, DateTimeOffset now, CancellationToken ct)
    {
        if (national && (partitions.Count != 32 || partitions.Any(p => p.Partition.Benefit is not null) || partitions.Select(p => (p.Partition.Province, p.Partition.Case)).Distinct().Count() != 32))
            throw new InvalidDataException("Zakres krajowy wymaga 32 kompletnych partycji bez filtra świadczenia.");
        var ids = new HashSet<(string, int)>();
        foreach (var (partition, records) in partitions)
            foreach (var raw in records)
                if (!ids.Add((raw.GetProperty("id").GetString()!, partition.Case))) throw new InvalidDataException("Powtórzona kolejka pomiędzy partycjami.");
        var staging = dataRoot + ".staging";
        var backup = dataRoot + ".backup";
        if (Directory.Exists(backup) && !Directory.Exists(dataRoot)) Directory.Move(backup, dataRoot);
        if (Directory.Exists(backup)) Directory.Delete(backup, true);
        if (Directory.Exists(staging)) Directory.Delete(staging, true);
        Directory.CreateDirectory(staging);
        if (Directory.Exists(dataRoot))
        {
            foreach (var section in new[] { "history", "snapshots" })
            {
                var from = Path.Combine(dataRoot, section);
                if (!Directory.Exists(from)) continue;
                foreach (var file in Directory.EnumerateFiles(from, "*", SearchOption.AllDirectories))
                {
                    var target = Path.Combine(staging, Path.GetRelativePath(dataRoot, file));
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    File.Copy(file, target);
                }
            }
            var manifest = Path.Combine(dataRoot, "manifest.json");
            if (File.Exists(manifest)) File.Copy(manifest, Path.Combine(staging, "manifest.json"));
        }
        try
        {
            var result = await new Publisher(staging).PublishCore(partitions, national, now, ct);
            if (Directory.Exists(dataRoot)) Directory.Move(dataRoot, backup);
            try { Directory.Move(staging, dataRoot); }
            catch { if (Directory.Exists(backup)) Directory.Move(backup, dataRoot); throw; }
            if (Directory.Exists(backup)) Directory.Delete(backup, true);
            return result;
        }
        finally { if (Directory.Exists(staging)) Directory.Delete(staging, true); }
    }
    private async Task<Manifest> PublishCore(IReadOnlyList<(Partition Partition, JsonElement[] Records)> partitions, bool national, DateTimeOffset now, CancellationToken ct)
    {
        var previousManifest = await JsonFiles.Read<Manifest>(Path.Combine(dataRoot, "manifest.json"), ct);
        if (previousManifest?.National == true && !national) throw new InvalidDataException("Nie wolno zastąpić zbioru krajowego zakresem częściowym. Użyj osobnego --data.");
        var generation = now.ToString("yyyyMMddTHHmmssfffffffZ");
        var stage = Path.Combine(dataRoot, "aggregates", generation);
        Directory.CreateDirectory(stage);
        var shards = new List<Shard>(); var summaries = new List<Aggregate>(); var quality = new List<QualityEvent>();
        var allRows = new List<QueueRow>(); var allHistory = new List<Observation>(); var sourceChanges = new List<SourceObservation>();
        var historyWrites = new List<(string Path, Observation[] Data)>();
        foreach (var (partition, records) in partitions)
        {
            var mapped = records.Select(r => (Row: Normalization.Map(r, partition), Raw: r)).ToArray();
            foreach (var group in mapped.GroupBy(p => p.Row.BenefitId))
            {
                var key = $"{partition.Province}/{partition.Case}/{group.Key}";
                var historyPath = Path.Combine(dataRoot, "history", key + ".json.gz");
                var history = (await JsonFiles.Read<Observation[]>(historyPath, ct) ?? []).ToList();
                var latest = history.GroupBy(o => o.Queue.Id).ToDictionary(g => g.Key, g => g.MaxBy(o => o.RetrievedAt)!);
                var rows = group.Select(p => p.Row).OrderBy(q => q.Id).ToArray();
                foreach (var item in group)
                {
                    var fingerprint = Identity.Hash(JsonSerializer.Serialize(item.Row, JsonFiles.Options));
                    if (!latest.TryGetValue(item.Row.Id, out var prior) || prior.Fingerprint != fingerprint)
                    {
                        history.Add(new(fingerprint, now, SchemaVersion, item.Row));
                        sourceChanges.Add(new(item.Row.Id, item.Row.Case, item.Row.Province, fingerprint, now, SchemaVersion, item.Raw));
                    }
                }
                historyWrites.Add((historyPath, history.ToArray()));
                var jsonPath = $"aggregates/{generation}/{key}.json";
                var chartPath = $"aggregates/{generation}/{key}.history.json";
                await JsonFiles.Write(Path.Combine(dataRoot, jsonPath), rows, ct);
                await JsonFiles.Write(Path.Combine(dataRoot, chartPath), Analytics.Series(history), ct);
                var events = Analytics.Anomalies(rows, history, DateOnly.FromDateTime(now.UtcDateTime));
                await JsonFiles.Write(Path.Combine(dataRoot, $"aggregates/{generation}/{key}.quality.json"), events, ct);
                quality.AddRange(events);
                shards.Add(new(partition.Province, partition.Case, group.Key, rows[0].Benefit, jsonPath, chartPath, rows.Length, new FileInfo(Path.Combine(dataRoot, jsonPath)).Length));
                summaries.Add(Analytics.Summarize(key, rows, history, DateOnly.FromDateTime(now.UtcDateTime)));
                allRows.AddRange(rows); allHistory.AddRange(history);
            }
        }
        // Preserve history for queues absent from the latest source; flag changes in reporting coverage.
        var coverage = previousManifest?.Shards.Sum(s => s.Count);
        var warnings = new List<string>();
        if (!national) warnings.Add("Zakres ograniczony: wyniki nie opisują całej Polski.");
        if (coverage is > 0 && coverage != allRows.Count) warnings.Add($"Zmiana liczby raportujących kolejek: {coverage} → {allRows.Count}. Porównania wyłącznie na wspólnych kolejkach.");
        var summary = new { total = Analytics.Summarize("scope", allRows, allHistory, DateOnly.FromDateTime(now.UtcDateTime)), regions = allRows.GroupBy(q => q.Province).Select(g => Analytics.Summarize(g.Key, g.ToArray(), allHistory.Where(o => o.Queue.Province == g.Key).ToArray(), DateOnly.FromDateTime(now.UtcDateTime))), shards = summaries, qualityCounts = quality.GroupBy(q => q.Kind).ToDictionary(g => g.Key, g => g.Count()) };
        await JsonFiles.Write(Path.Combine(stage, "summary.json"), summary, ct);
        var periods = allHistory.Select(o => o.Queue.ReportingPeriod).OfType<string>().Distinct().Order().ToArray();
        var manifest = new Manifest(SchemaVersion, now, true, national, NfzClient.BaseUrl, national ? "Polska · wszystkie województwa · obie kategorie" : string.Join(", ", partitions.Select(p => $"{Regions.Names[p.Partition.Province]} / kategoria {p.Partition.Case} / {p.Partition.Benefit ?? "wszystkie świadczenia"}")), periods, partitions.Select(p => p.Partition.Province).Distinct().Order().ToArray(), shards.OrderBy(s => s.Province).ThenBy(s => s.Benefit).ThenBy(s => s.Case).ToArray(), warnings.ToArray(), allRows.Count, generation);
        var historyByProvider = allHistory.GroupBy(o => (o.Queue.Province, o.Queue.ProviderCode)).ToDictionary(g => g.Key, g => Analytics.Series(g));
        foreach (var provider in allRows.GroupBy(q => (q.Province, q.ProviderCode)))
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(provider.Key.ProviderCode, @"^\d{1,20}$")) throw new InvalidDataException("Nieobsługiwany format kodu świadczeniodawcy.");
            await JsonFiles.Write(Path.Combine(stage, "providers", provider.Key.Province, provider.Key.ProviderCode + ".json"), new { rows = provider.ToArray(), history = historyByProvider[provider.Key] }, ct);
        }
        var bytes = Directory.EnumerateFiles(stage, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length);
        if (bytes > 700L * 1024 * 1024) throw new IOException("Zestawienia przekroczyły budżet 700 MiB GitHub Pages. Publikacja wstrzymana.");
        if (Directory.EnumerateFiles(dataRoot, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length) > 3L * 1024 * 1024 * 1024) throw new IOException("Archiwum przekroczyło 3 GiB. Wymagana rotacja repozytorium archiwalnego.");
        // Manifest is the commit point. Consumers never see a generation without all its files.
        foreach (var write in historyWrites) await JsonFiles.Write(write.Path, write.Data, ct);
        if (sourceChanges.Count > 0) await JsonFiles.Write(Path.Combine(dataRoot, "snapshots", generation + ".json.gz"), sourceChanges, ct);
        await JsonFiles.Write(Path.Combine(dataRoot, "manifest.json"), manifest, ct);
        foreach (var dir in Directory.EnumerateDirectories(Path.Combine(dataRoot, "aggregates")))
            if (Path.GetFileName(dir) != generation) Directory.Delete(dir, true);
        return manifest;
    }
}
