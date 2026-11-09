using System.Net;
using System.Text.Json;
using NfzAtlas.Application;
using NfzAtlas.Domain;

namespace NfzAtlas.Infrastructure;

public sealed class NfzClient(HttpClient http, TimeSpan? minimumInterval = null,
    Func<TimeSpan, CancellationToken, Task>? delay = null) : INfzSource, IDisposable
{
    public const string BaseUrl = "https://apinfz.nfz.gov.pl/app-itl-api-pcus/";
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly Func<TimeSpan, CancellationToken, Task> pause = delay ?? Task.Delay;
    private readonly TimeSpan interval = minimumInterval ?? TimeSpan.FromMilliseconds(350);
    public static TimeSpan RetryDelay(HttpResponseMessage response, int attempt, DateTimeOffset now)
    {
        var retry = response.Headers.RetryAfter;
        var duration = retry?.Delta ?? (retry?.Date is DateTimeOffset at ? at - now : TimeSpan.FromSeconds(Math.Pow(2, attempt) + Random.Shared.NextDouble()));
        return duration < TimeSpan.Zero ? TimeSpan.Zero : duration;
    }
    public async Task<PageResult> FetchAsync(Partition partition, int page, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var path = $"queues?province={partition.Province}&case={partition.Case}&limit=25&page={page}&format=json";
            if (partition.Benefit is not null) path += "&benefit=" + Uri.EscapeDataString(partition.Benefit);
            for (var attempt = 0; attempt < 6; attempt++)
            {
                await pause(interval, cancellationToken);
                HttpResponseMessage response;
                try { response = await http.GetAsync(new Uri(new Uri(BaseUrl), path), cancellationToken); }
                catch (HttpRequestException) when (attempt < 5) { await pause(TimeSpan.FromSeconds(Math.Pow(2, attempt)), cancellationToken); continue; }
                catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested && attempt < 5) { await pause(TimeSpan.FromSeconds(Math.Pow(2, attempt)), cancellationToken); continue; }
                using (response)
                {
                    if ((response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500) && attempt < 5)
                    {
                        var wait = RetryDelay(response, attempt, DateTimeOffset.UtcNow);
                        Console.Error.WriteLine($"HTTP {(int)response.StatusCode}, ponowienie po {wait.TotalSeconds:F1}s");
                        await pause(wait, cancellationToken); continue;
                    }
                    response.EnsureSuccessStatusCode();
                    using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                    return Parse(doc.RootElement, page);
                }
            }
            throw new IOException("Wyczerpano ponowienia NFZ.");
        }
        finally { gate.Release(); }
    }
    public static PageResult Parse(JsonElement root, int requestedPage)
    {
        var meta = Normalization.Required(root, "meta", JsonValueKind.Object);
        var records = Normalization.Required(root, "data", JsonValueKind.Array);
        var links = Normalization.Required(root, "links", JsonValueKind.Object);
        var page = meta.GetProperty("page").GetInt32(); var count = meta.GetProperty("count").GetInt32(); var limit = meta.GetProperty("limit").GetInt32();
        if (page != requestedPage || count < 0 || limit is < 1 or > 25 || records.GetArrayLength() > limit) throw new InvalidDataException("Nieprawidłowe metadane paginacji.");
        var hasNext = links.TryGetProperty("next", out var next) && next.ValueKind == JsonValueKind.String && !string.IsNullOrEmpty(next.GetString());
        if (hasNext != ((long)page * limit < count)) throw new InvalidDataException("Sprzeczna paginacja next/count.");
        if (records.GetArrayLength() != Math.Min(limit, Math.Max(0, count - (page - 1) * limit))) throw new InvalidDataException("Niekompletna strona NFZ.");
        return new(count, page, limit, hasNext, records.EnumerateArray().Select(r => r.Clone()).ToArray());
    }
    public void Dispose() => gate.Dispose();
}
