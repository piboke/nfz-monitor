using System.Text.Json;
using NfzAtlas.Application;
using NfzAtlas.Domain;

namespace NfzAtlas.Infrastructure;

public sealed record CrawlState(
    Partition Partition,
    DateTimeOffset StartedAt,
    int Expected,
    int NextPage,
    bool Done
);

public sealed class Crawler(INfzSource source, string checkpointRoot)
{
    public async Task<JsonElement[]> Download(Partition partition, CancellationToken ct)
    {
        var dir = Path.Combine(checkpointRoot, partition.Key);
        var statePath = Path.Combine(dir, "state.json");
        var state = await JsonFiles.Read<CrawlState>(statePath, ct);
        if (
            state is not null
            && (
                state.Partition != partition
                || DateTimeOffset.UtcNow - state.StartedAt > TimeSpan.FromHours(12)
            )
        )
        {
            Directory.Delete(dir, true);
            state = null;
        }
        var first = await source.FetchAsync(partition, 1, ct);
        if (state is not null && first.Count != state.Expected)
        {
            Directory.Delete(dir, true);
            state = null;
        }
        if (state is null)
        {
            state = new(partition, DateTimeOffset.UtcNow, first.Count, 2, !first.HasNext);
            await JsonFiles.Write(Path.Combine(dir, "1.json.gz"), first, ct);
            await JsonFiles.Write(statePath, state, ct);
        }
        while (!state.Done)
        {
            var page = await source.FetchAsync(partition, state.NextPage, ct);
            if (page.Count != state.Expected)
                throw new InvalidDataException(
                    "Wolumen NFZ zmienił się podczas pobierania; uruchom ponownie."
                );
            // Validate before checkpointing. A malformed page can never poison a resumed crawl.
            foreach (var record in page.Records)
                Normalization.Map(record, partition);
            await JsonFiles.Write(Path.Combine(dir, $"{page.Page}.json.gz"), page, ct);
            state = state with { NextPage = page.Page + 1, Done = !page.HasNext };
            await JsonFiles.Write(statePath, state, ct);
            Console.WriteLine(
                $"{partition.Province}/{partition.Case}: {Math.Min((long)page.Page * 25, page.Count)}/{page.Count}"
            );
        }
        var result = new List<JsonElement>();
        for (var page = 1; page < state.NextPage; page++)
        {
            var path = Path.Combine(dir, $"{page}.json.gz");
            var stored = await JsonFiles.Read<PageResult>(path, ct);
            if (stored is null)
            {
                Console.WriteLine(
                    $"{partition.Province}/{partition.Case}: odtwarzanie brakującej strony {page} checkpointu"
                );
                stored = page == 1 ? first : await source.FetchAsync(partition, page, ct);
                if (stored.Count != state.Expected || stored.Page != page)
                    throw new InvalidDataException(
                        "Zmiana źródła podczas odtwarzania checkpointu; nie publikujemy niepełnych danych."
                    );
                foreach (var record in stored.Records)
                    Normalization.Map(record, partition);
                await JsonFiles.Write(path, stored, ct);
            }
            if (stored.Count != state.Expected || stored.Page != page)
                throw new InvalidDataException($"Sprzeczne metadane checkpointu strony {page}.");
            result.AddRange(stored.Records);
        }
        var ids = new HashSet<string>();
        foreach (var r in result)
        {
            var row = Normalization.Map(r, partition);
            if (!ids.Add(row.Id))
                throw new InvalidDataException(
                    "Powtórzony UUID pomiędzy stronami; niestabilna paginacja NFZ. Nie publikujemy niepełnych danych."
                );
        }
        if (result.Count != state.Expected)
            throw new InvalidDataException("Liczba rekordów nie zgadza się z meta.count.");
        // A second boundary check catches count changes while restoring a completed checkpoint.
        var boundary = await source.FetchAsync(partition, 1, ct);
        if (boundary.Count != state.Expected)
            throw new InvalidDataException("Zmieniona liczba rekordów po pobraniu.");
        return result.ToArray();
    }
}
