using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record QueueRow(
    string Id, string FacilityId, string Province, int Case, string BenefitId, string Benefit,
    string ProviderCode, string Provider, string Place, string Address, string Locality, string County,
    string? Phone, string? Email, string? Website, double? Latitude, double? Longitude,
    bool? ForChildren, string? AgeRange, string? BenefitCode,
    string? Pcus, int? PcusDays, bool PcusApplicable, string? PcusUpdatedAt,
    int? Awaiting, int? Removed, int? AverageDays, int? ComputedAverageDays,
    string? ReportingPeriod, string? ComputedPeriod);

public sealed record Observation(string Fingerprint, DateTimeOffset RetrievedAt, string SchemaVersion, QueueRow Queue);
public sealed record HistoryPoint(string Id, string FacilityId, string BenefitId, int Case, string Province,
    string? ReportingPeriod, string? PcusUpdatedAt, int? Awaiting, int? Removed, int? PcusDays,
    string? Pcus, DateTimeOffset RetrievedAt);
public sealed record Aggregate(string Key, int Queues, int KnownAwaiting, long? AwaitingEntries,
    int KnownPcus, double? MedianPcusDays, int FreshQueues, double FreshPercent,
    int MatchedQueues, long? AwaitingChange, double? AwaitingChangePercent,
    double? MedianPcusChange, int RisingQueues, int FallingQueues);
public sealed record QualityEvent(string QueueId, string Kind, string Message);
public sealed record Shard(string Province, int Case, string BenefitId, string Benefit, string Path,
    string HistoryPath, int Count, long Bytes);
public sealed record Manifest(string SchemaVersion, DateTimeOffset? LastSync, bool Complete, bool National,
    string Source, string Scope, string[] Periods, string[] Regions, Shard[] Shards, string[] Warnings,
    int QueueCount, string Generation);
public sealed record Partition(string Province, int Case, string? Benefit = null)
{
    public string Key => $"{Province}-{Case}-{Identity.Hash(Benefit ?? "*")}";
}
public sealed record PageResult(int Count, int Page, int Limit, bool HasNext, JsonElement[] Records);
public interface INfzSource
{
    Task<PageResult> FetchAsync(Partition partition, int page, CancellationToken cancellationToken);
}
public static class Identity
{
    public static string Hash(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..24];
    public static string Normalize(string? text) => string.Join(' ', (text ?? "").Normalize(NormalizationForm.FormC).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
}
public static class Regions
{
    public static readonly IReadOnlyDictionary<string, string> Names = new Dictionary<string, string>
    {
        ["01"] = "dolnośląskie",
        ["02"] = "kujawsko-pomorskie",
        ["03"] = "lubelskie",
        ["04"] = "lubuskie",
        ["05"] = "łódzkie",
        ["06"] = "małopolskie",
        ["07"] = "mazowieckie",
        ["08"] = "opolskie",
        ["09"] = "podkarpackie",
        ["10"] = "podlaskie",
        ["11"] = "pomorskie",
        ["12"] = "śląskie",
        ["13"] = "świętokrzyskie",
        ["14"] = "warmińsko-mazurskie",
        ["15"] = "wielkopolskie",
        ["16"] = "zachodniopomorskie"
    };
}
