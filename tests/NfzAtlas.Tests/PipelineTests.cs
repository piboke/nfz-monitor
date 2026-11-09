using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using NfzAtlas.Application;
using NfzAtlas.Domain;
using NfzAtlas.Infrastructure;
using Xunit;

namespace NfzAtlas.Tests;

public sealed class PipelineTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "nfz-tests-" + Guid.NewGuid().ToString("N"));
    private static JsonElement Fixture() => JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "queues-live.json"))).RootElement.Clone();
    private static QueueRow Row() => Normalization.Map(Fixture().GetProperty("data")[0], new("07", 1));
    private static Observation O(QueueRow q, int day = 1) => new(Identity.Hash(JsonSerializer.Serialize(q)), new DateTimeOffset(2026, 11, day, 0, 0, 0, TimeSpan.Zero), "1.0", q);
    [Fact]
    public void MapsActualPcusApiWithoutInventingBenefitCode()
    {
        var q = Row(); Assert.Equal("2026-09", q.ReportingPeriod); Assert.Equal("0 dni", q.Pcus); Assert.Equal(0, q.PcusDays);
        Assert.Null(q.BenefitCode); Assert.Null(q.Latitude); Assert.NotEmpty(q.FacilityId); Assert.True(q.ForChildren);
    }
    [Theory]
    [InlineData("12 dni", 12)]
    [InlineData("1 dzień", 1)]
    [InlineData("ponad 3 miesiące", null)]
    [InlineData("2026-12-01", null)]
    [InlineData(null, null)]
    public void OnlyParsesExplicitDays(string? input, int? expected) => Assert.Equal(expected, Normalization.ParsePcusDays(input));
    [Fact]
    public void IdentityUsesNormalizedNamesAndRetainsDiacritics()
    {
        Assert.Equal(Identity.Hash(Identity.Normalize(" Łódź  ")), Identity.Hash(Identity.Normalize("łódź")));
        Assert.NotEqual(Identity.Hash("LODZ"), Identity.Hash("ŁÓDŹ"));
        Assert.Equal(Row().FacilityId, Row().FacilityId);
    }
    [Fact]
    public void RejectsSchemaDriftAndNegativeStatistics()
    {
        var node = JsonNode.Parse(Fixture().GetProperty("data")[0].GetRawText())!;
        node["attributes"]!["statistics"]!["provider-data"]!["awaiting"] = -3;
        Assert.Throws<InvalidDataException>(() => Normalization.Map(JsonSerializer.SerializeToElement(node), new("07", 1)));
        node["attributes"]!["case"] = 2;
        Assert.Throws<InvalidDataException>(() => Normalization.Map(JsonSerializer.SerializeToElement(node), new("07", 1)));
        Assert.Throws<InvalidDataException>(() => NfzClient.Parse(JsonSerializer.SerializeToElement(new { data = Array.Empty<object>() }), 1));
    }
    [Fact]
    public void NullIsNotZeroAndMedianIsNotMean()
    {
        var q = Row() with { Awaiting = null, Pcus = null, PcusDays = null };
        var result = Analytics.Summarize("x", [q], [], new(2026, 11, 9));
        Assert.Null(result.AwaitingEntries); Assert.Null(result.MedianPcusDays); Assert.Null(result.AwaitingChange);
        Assert.Equal(3, Analytics.Median([1, 3, 100])); Assert.Equal(2, Analytics.Median([1, 3])); Assert.Null(Analytics.Median([]));
    }
    [Fact]
    public void ComparesOnlyConsecutiveMonthsOnMatchedQueues()
    {
        var q = Row() with { Awaiting = 150, ReportingPeriod = "2026-10" };
        var old = q with { Awaiting = 100, ReportingPeriod = "2026-09" };
        var result = Analytics.Summarize("x", [q, q with { Id = Guid.NewGuid().ToString(), Awaiting = 1000 }], [O(old)], new(2026, 11, 9));
        Assert.Equal(1, result.MatchedQueues); Assert.Equal(50L, result.AwaitingChange); Assert.Equal(50d, result.AwaitingChangePercent); Assert.Equal(1, result.RisingQueues);
        Assert.Null(Analytics.Summarize("x", [q], [O(old with { ReportingPeriod = "2026-08" })], new(2026, 11, 9)).AwaitingChange);
    }
    [Fact]
    public void ZeroBaselineDoesNotBecomeInfinity()
    {
        var q = Row() with { Awaiting = 10, ReportingPeriod = "2026-10" };
        Assert.Null(Analytics.Summarize("x", [q], [O(q with { Awaiting = 0, ReportingPeriod = "2026-09" })], new(2026, 11, 9)).AwaitingChangePercent);
    }
    [Fact]
    public void FlagsStaleAndLargeChangesForVerification()
    {
        var q = Row() with { Awaiting = 200, ReportingPeriod = "2026-10", PcusUpdatedAt = "2026-11-09" };
        var events = Analytics.Anomalies([q], [O(q with { Awaiting = 100, ReportingPeriod = "2026-09" })], new(2026, 11, 9));
        Assert.Contains(events, e => e.Kind == "awaiting-jump"); Assert.DoesNotContain(events, e => e.Kind == "stale");
        Assert.Contains(Analytics.Anomalies([q with { PcusUpdatedAt = null }], [], new(2026, 11, 9)), e => e.Kind == "stale");
    }
    [Fact]
    public async Task Retries429AndHonorsBothRetryAfterFormats()
    {
        var count = 0; var waits = new List<TimeSpan>();
        var handler = new Handler(_ => ++count == 1 ? new(HttpStatusCode.TooManyRequests) { Headers = { RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(7)) } } : new(HttpStatusCode.OK) { Content = new StringContent(Fixture().GetRawText()) });
        using var http = new HttpClient(handler); using var source = new NfzClient(http, TimeSpan.Zero, (d, _) => { waits.Add(d); return Task.CompletedTask; });
        var result = await source.FetchAsync(new("07", 1), 1, default);
        Assert.Equal(2, count); Assert.Contains(TimeSpan.FromSeconds(7), waits); Assert.Equal(25, result.Records.Length);
        using var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
        var now = DateTimeOffset.UtcNow; response.Headers.RetryAfter = new RetryConditionHeaderValue(now.AddSeconds(20));
        Assert.InRange(NfzClient.RetryDelay(response, 1, now).TotalSeconds, 19, 21);
    }
    [Fact]
    public async Task DoesNotRetryClientErrors()
    {
        var calls = 0; using var http = new HttpClient(new Handler(_ => { calls++; return new(HttpStatusCode.BadRequest); }));
        using var source = new NfzClient(http, TimeSpan.Zero, (_, _) => Task.CompletedTask);
        await Assert.ThrowsAsync<HttpRequestException>(() => source.FetchAsync(new("07", 1), 1, default)); Assert.Equal(1, calls);
    }
    [Fact]
    public async Task RequestsAreSerialized()
    {
        var inFlight = 0; var max = 0;
        using var http = new HttpClient(new AsyncHandler(async () => { var n = Interlocked.Increment(ref inFlight); max = Math.Max(n, max); await Task.Delay(10); Interlocked.Decrement(ref inFlight); return new(HttpStatusCode.OK) { Content = new StringContent(Fixture().GetRawText()) }; }));
        using var source = new NfzClient(http, TimeSpan.Zero, (_, _) => Task.CompletedTask);
        await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => source.FetchAsync(new("07", 1), 1, default))); Assert.Equal(1, max);
    }
    [Fact]
    public async Task PaginationResumesAfterFailureAndRejectsDuplicates()
    {
        var records = Fixture().GetProperty("data").EnumerateArray().Select(r => r.Clone()).ToArray();
        var fail = true; var secondCalls = 0;
        var source = new FakeSource((_, p) => p switch { 1 => new(26, 1, 25, true, records), 2 => Second(), _ => throw new Exception() });
        PageResult Second() { secondCalls++; if (fail) throw new IOException("test interrupted"); return new(26, 2, 25, false, [records[0]]); }
        var crawler = new Crawler(source, root);
        await Assert.ThrowsAsync<IOException>(() => crawler.Download(new("07", 1), default));
        fail = false;
        await Assert.ThrowsAsync<InvalidDataException>(() => crawler.Download(new("07", 1), default));
        Assert.Equal(2, secondCalls);
    }
    [Fact]
    public async Task RejectsChangingCounts()
    {
        var records = Fixture().GetProperty("data").EnumerateArray().Select(r => r.Clone()).ToArray();
        var source = new FakeSource((_, p) => new(p == 1 ? 26 : 27, p, 25, p == 1, p == 1 ? records : [records[0]]));
        await Assert.ThrowsAsync<InvalidDataException>(() => new Crawler(source, root).Download(new("07", 1), default));
    }
    [Fact]
    public async Task PublicationIsIdempotentAndPreservesHistoryAcrossBuilds()
    {
        var raw = Fixture().GetProperty("data")[0].Clone(); var publisher = new Publisher(root);
        var now = new DateTimeOffset(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);
        var manifest = await publisher.Publish([(new("07", 1), new[] { raw })], false, now, default);
        Assert.False(manifest.National); Assert.True(manifest.Complete); Assert.Single(manifest.Shards);
        var historyPath = Directory.GetFiles(Path.Combine(root, "history"), "*.gz", SearchOption.AllDirectories).Single();
        var first = await JsonFiles.Read<Observation[]>(historyPath); Assert.Single(first!);
        manifest = await publisher.Publish([(new("07", 1), new[] { raw })], false, now.AddDays(1), default);
        Assert.Single((await JsonFiles.Read<Observation[]>(historyPath))!);
        Assert.Single(Directory.GetFiles(Path.Combine(root, "snapshots"), "*.gz"));
        var rows = await JsonFiles.Read<QueueRow[]>(Path.Combine(root, manifest.Shards[0].Path)); Assert.Single(rows!);
        Assert.True(File.Exists(Path.Combine(root, manifest.Shards[0].HistoryPath)));
        var node = JsonNode.Parse(raw.GetRawText())!; node["attributes"]!["statistics"]!["provider-data"]!["awaiting"] = 5;
        await publisher.Publish([(new("07", 1), new[] { JsonSerializer.SerializeToElement(node) })], false, now.AddDays(2), default);
        Assert.Equal(2, (await JsonFiles.Read<Observation[]>(historyPath))!.Length);
        Assert.Single(Directory.GetDirectories(Path.Combine(root, "aggregates")));
    }
    [Fact] public void RejectsIncompletePages() => Assert.Throws<InvalidDataException>(() => NfzClient.Parse(JsonSerializer.SerializeToElement(new { meta = new { page = 1, count = 25, limit = 25 }, links = new { next = (string?)null }, data = new[] { new { id = "x" } } }), 1));
    [Fact]
    public async Task DownloadsAllPagesWithStableIds()
    {
        var records = Fixture().GetProperty("data").EnumerateArray().Select(r => r.Clone()).ToArray();
        var final = JsonNode.Parse(records[0].GetRawText())!;
        final["id"] = Guid.NewGuid().ToString();
        var source = new FakeSource((_, p) => p == 1 ? new(26, 1, 25, true, records) : new(26, 2, 25, false, [JsonSerializer.SerializeToElement(final)]));
        var result = await new Crawler(source, root).Download(new("07", 1), default);
        Assert.Equal(26, result.Length);
        Assert.Equal(26, result.Select(r => r.GetProperty("id").GetString()).Distinct().Count());
    }
    [Fact]
    public async Task FailedPublicationLeavesPreviousGenerationUntouched()
    {
        var raw = Fixture().GetProperty("data")[0].Clone();
        var publisher = new Publisher(root);
        var now = new DateTimeOffset(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);
        var first = await publisher.Publish([(new("07", 1), new[] { raw })], false, now, default);
        var broken = JsonNode.Parse(raw.GetRawText())!;
        broken["id"] = Guid.NewGuid().ToString();
        broken["attributes"]!["case"] = 2;
        broken["attributes"]!["statistics"] = "wrong-schema";
        await Assert.ThrowsAsync<InvalidDataException>(() => publisher.Publish([(new("07", 1), new[] { raw }), (new("07", 2), new[] { JsonSerializer.SerializeToElement(broken) })], false, now.AddDays(1), default));
        var current = await JsonFiles.Read<Manifest>(Path.Combine(root, "manifest.json"));
        Assert.Equal(first.Generation, current!.Generation);
        Assert.True(File.Exists(Path.Combine(root, first.Shards[0].Path)));
        Assert.Single(Directory.GetFiles(Path.Combine(root, "snapshots")));
    }
    [Fact]
    public async Task RawOnlyChangeIsArchivedWithoutInventingSourcePeriods()
    {
        var raw = Fixture().GetProperty("data")[0].Clone();
        var publisher = new Publisher(root);
        var now = new DateTimeOffset(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);
        await publisher.Publish([(new("07", 1), new[] { raw })], false, now, default);
        var node = JsonNode.Parse(raw.GetRawText())!;
        node["attributes"]!["ramp"] = "N";
        var m = await publisher.Publish([(new("07", 1), new[] { JsonSerializer.SerializeToElement(node) })], false, now.AddDays(1), default);
        Assert.Equal(2, Directory.GetFiles(Path.Combine(root, "snapshots")).Length);
        var history = await JsonFiles.Read<HistoryPoint[]>(Path.Combine(root, m.Shards[0].HistoryPath));
        Assert.Single(history!.Select(p => p.ReportingPeriod).Distinct());
        Assert.Equal(2, history!.Length);
    }
    [Fact]
    public async Task IncompleteScopeCannotBeLabeledNational()
    {
        await Assert.ThrowsAsync<InvalidDataException>(() => new Publisher(root).Publish([(new("07", 1), Fixture().GetProperty("data").EnumerateArray().Select(r => r.Clone()).ToArray())], true, DateTimeOffset.UtcNow, default));
        Assert.False(File.Exists(Path.Combine(root, "manifest.json")));
    }
    [Fact]
    public void DoesNotCompareChangedFacilityIdentity()
    {
        var q = Row() with { ReportingPeriod = "2026-10", Awaiting = 150 };
        var old = q with { ReportingPeriod = "2026-09", Awaiting = 100, FacilityId = "another-facility" };
        Assert.Null(Analytics.Summarize("x", [q], [O(old)], new(2026, 11, 9)).AwaitingChange);
    }
    [Fact]
    public async Task ConcurrentClientNeverExceedsConfiguredBound()
    {
        var inFlight = 0; var max = 0; var sync = new object();
        using var http = new HttpClient(new AsyncHandler(async () =>
        {
            var current = Interlocked.Increment(ref inFlight);
            lock (sync) max = Math.Max(max, current);
            await Task.Delay(20);
            Interlocked.Decrement(ref inFlight);
            return new(HttpStatusCode.OK) { Content = new StringContent(Fixture().GetRawText()) };
        }));
        using var source = new NfzClient(http, TimeSpan.Zero, (_, _) => Task.CompletedTask, maxConcurrency: 2);
        await Task.WhenAll(Enumerable.Range(0, 7).Select(_ => source.FetchAsync(new("07", 1), 1, default)));
        Assert.Equal(2, max);
    }
    [Fact]
    public async Task RebuildsHistoryFromRawArchiveWithOriginalRetrievalDates()
    {
        var raw = Fixture().GetProperty("data")[0].Clone();
        var now = new DateTimeOffset(2026, 11, 9, 12, 0, 0, TimeSpan.Zero);
        await new Publisher(root).Publish([(new("07", 1), new[] { raw })], false, now, default);
        var file = Directory.GetFiles(Path.Combine(root, "history"), "*.gz", SearchOption.AllDirectories).Single();
        var original = await JsonFiles.Read<Observation[]>(file);
        Directory.Delete(Path.Combine(root, "history"), true);
        Assert.Equal(1, await ArchiveRecovery.RebuildHistory(root, default));
        var recovered = await JsonFiles.Read<Observation[]>(file);
        Assert.Equal(original![0].Queue, recovered![0].Queue);
        Assert.Equal(now, recovered[0].RetrievedAt);
        Assert.Equal(1, await ArchiveRecovery.RebuildHistory(root, default));
    }
    [Fact]
    public async Task EmptyArchiveCannotEraseHistory()
    {
        Directory.CreateDirectory(Path.Combine(root, "history"));
        var preserved = Path.Combine(root, "history", "preserved.txt");
        await File.WriteAllTextAsync(preserved, "keep");
        await Assert.ThrowsAsync<InvalidDataException>(() => ArchiveRecovery.RebuildHistory(root, default));
        Assert.Equal("keep", await File.ReadAllTextAsync(preserved));
    }
    [Fact]
    public async Task EmptyNationalResponseCannotReplacePublishedData()
    {
        var partitions = Regions.Names.Keys.SelectMany(p => new[] { 1, 2 }.Select(c => (new Partition(p, c), Array.Empty<JsonElement>()))).ToArray();
        await Assert.ThrowsAsync<InvalidDataException>(() => new Publisher(root).Publish(partitions, true, DateTimeOffset.UtcNow, default));
        Assert.False(Directory.Exists(root));
    }
    public void Dispose() { if (Directory.Exists(root)) Directory.Delete(root, true); }
    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> send) : HttpMessageHandler { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => Task.FromResult(send(request)); }
    private sealed class AsyncHandler(Func<Task<HttpResponseMessage>> send) : HttpMessageHandler { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => send(); }
    private sealed class FakeSource(Func<Partition, int, PageResult> send) : INfzSource { public Task<PageResult> FetchAsync(Partition p, int page, CancellationToken ct) => Task.FromResult(send(p, page)); }
}
