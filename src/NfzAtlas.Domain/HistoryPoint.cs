using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record HistoryPoint(
    string Id,
    string FacilityId,
    string BenefitId,
    int Case,
    string Province,
    string? ReportingPeriod,
    string? PcusUpdatedAt,
    int? Awaiting,
    int? Removed,
    int? PcusDays,
    string? Pcus,
    DateTimeOffset RetrievedAt
);
