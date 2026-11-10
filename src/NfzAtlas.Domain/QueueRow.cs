using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record QueueRow(
    string Id,
    string FacilityId,
    string Province,
    int Case,
    string BenefitId,
    string Benefit,
    string ProviderCode,
    string Provider,
    string Place,
    string Address,
    string Locality,
    string County,
    string? Phone,
    string? Email,
    string? Website,
    double? Latitude,
    double? Longitude,
    bool? ForChildren,
    string? AgeRange,
    string? BenefitCode,
    string? Pcus,
    int? PcusDays,
    bool PcusApplicable,
    string? PcusUpdatedAt,
    int? Awaiting,
    int? Removed,
    int? AverageDays,
    int? ComputedAverageDays,
    string? ReportingPeriod,
    string? ComputedPeriod
);
