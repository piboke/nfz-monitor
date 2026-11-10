using System.Text.Json;
using NfzAtlas.Application;
using NfzAtlas.Domain;

namespace NfzAtlas.Infrastructure;

public static class ArchiveRecovery
{
    public static async Task<int> RebuildHistory(string dataRoot, CancellationToken ct)
    {
        var snapshots = Path.Combine(dataRoot, "snapshots");
        if (!Directory.Exists(snapshots))
            throw new InvalidDataException("Brak archiwum źródłowego.");
        var files = Directory
            .GetFiles(snapshots, "*.json.gz")
            .Order(StringComparer.Ordinal)
            .ToArray();
        if (files.Length == 0)
            throw new InvalidDataException("Puste archiwum; nie usunięto istniejącej historii.");
        var histories = new Dictionary<string, List<Observation>>();
        var latest = new Dictionary<(string, int), Observation>();
        var count = 0;
        foreach (var file in files)
        {
            var records =
                await JsonFiles.Read<SourceObservation[]>(file, ct)
                ?? throw new InvalidDataException("Puste źródło.");
            foreach (var record in records.OrderBy(r => r.RetrievedAt))
            {
                if (record.SchemaVersion != Publisher.SchemaVersion)
                    throw new InvalidDataException(
                        "Wymagana wersja normalizacji właściwa dla archiwum."
                    );
                if (!Regions.Names.ContainsKey(record.Province) || record.Case is not (1 or 2))
                    throw new InvalidDataException("Nieprawidłowy zakres źródła.");
                var row = Normalization.Map(record.Source, new(record.Province, record.Case));
                if (row.Id != record.QueueId)
                    throw new InvalidDataException(
                        "Identyfikator archiwum nie zgadza się ze źródłem."
                    );
                var fingerprint = Identity.Hash(JsonSerializer.Serialize(row, JsonFiles.Options));
                var key = (row.Id, row.Case);
                if (latest.TryGetValue(key, out var prior))
                {
                    if (prior.RetrievedAt > record.RetrievedAt)
                        throw new InvalidDataException("Niejednoznaczna kolejność archiwum.");
                    if (
                        prior.Fingerprint == fingerprint
                        && prior.SourceFingerprint == record.Fingerprint
                    )
                        continue;
                }
                var observation = new Observation(
                    fingerprint,
                    record.RetrievedAt,
                    record.SchemaVersion,
                    row,
                    record.Fingerprint
                );
                latest[key] = observation;
                var shard = $"{row.Province}/{row.Case}/{row.BenefitId}.json.gz";
                if (!histories.TryGetValue(shard, out var history))
                    histories[shard] = history = [];
                history.Add(observation);
                count++;
            }
        }
        if (count == 0)
            throw new InvalidDataException("Brak obserwacji do odtworzenia.");
        var target = Path.Combine(dataRoot, "history");
        var staging = Path.Combine(dataRoot, "history-rebuild.staging");
        var backup = Path.Combine(dataRoot, "history-rebuild.backup");
        if (Directory.Exists(backup))
            throw new IOException(
                "Pozostał backup poprzedniego odtwarzania; zweryfikuj go przed ponowieniem."
            );
        if (Directory.Exists(staging))
            Directory.Delete(staging, true);
        try
        {
            foreach (var (path, observations) in histories)
                await JsonFiles.Write(Path.Combine(staging, path), observations, ct);
            if (Directory.Exists(target))
                Directory.Move(target, backup);
            try
            {
                Directory.Move(staging, target);
            }
            catch
            {
                if (Directory.Exists(backup))
                    Directory.Move(backup, target);
                throw;
            }
            if (Directory.Exists(backup))
                Directory.Delete(backup, true);
        }
        finally
        {
            if (Directory.Exists(staging))
                Directory.Delete(staging, true);
        }
        return count;
    }
}
