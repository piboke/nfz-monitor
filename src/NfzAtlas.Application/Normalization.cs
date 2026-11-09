using System.Text.Json;
using System.Text.RegularExpressions;
using NfzAtlas.Domain;

namespace NfzAtlas.Application;

public static partial class Normalization
{
    [GeneratedRegex(@"^(\d+)\s+d(?:ni|zień)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DaysPattern();
    public static int? ParsePcusDays(string? value) => value is not null && DaysPattern().Match(value.Trim()) is { Success: true } match && int.TryParse(match.Groups[1].Value, out var days) ? days : null;
    public static QueueRow Map(JsonElement record, Partition partition)
    {
        var id = String(record, "id");
        if (!Guid.TryParse(id, out _)) throw new InvalidDataException("Brak prawidłowego UUID kolejki.");
        var a = Required(record, "attributes", JsonValueKind.Object);
        var category = Number(a, "case");
        if (category != partition.Case) throw new InvalidDataException("Niezgodna kategoria medyczna.");
        var benefit = String(a, "benefit");
        var providerCode = String(a, "provider-code");
        if (string.IsNullOrWhiteSpace(benefit) || string.IsNullOrWhiteSpace(providerCode)) throw new InvalidDataException("Brak nazwy świadczenia lub kodu świadczeniodawcy.");
        var stats = Object(Object(a, "statistics"), "provider-data");
        var computed = Object(Object(a, "statistics"), "computed-data");
        var dates = Object(a, "dates");
        var period = NullableString(stats, "update");
        if (period is not null && !Regex.IsMatch(period, @"^\d{4}-(0[1-9]|1[0-2])$")) throw new InvalidDataException("Nieznany format okresu sprawozdawczego.");
        var pcusDate = NullableString(dates, "date-situation-as-at");
        if (pcusDate is not null && !DateOnly.TryParseExact(pcusDate, "yyyy-MM-dd", out _)) throw new InvalidDataException("Nieznany format daty PCUŚ.");
        var locality = String(a, "locality"); var address = String(a, "address");
        var facility = string.Join('|', partition.Province, providerCode, String(a, "registry-number"), String(a, "id-resort-part-VII"), String(a, "id-resort-part-VIII"), Identity.Normalize(locality), Identity.Normalize(address), Identity.Normalize(String(a, "place")));
        var lat = Double(a, "latitude"); var lon = Double(a, "longitude");
        if (lat is < -90 or > 90 || lon is < -180 or > 180) throw new InvalidDataException("Nieprawidłowe współrzędne.");
        var pcus = NullableString(dates, "pcus");
        return new QueueRow(id!, Identity.Hash(facility), partition.Province, category!.Value,
            Identity.Hash(Identity.Normalize(benefit)), benefit!, providerCode!, String(a, "provider"), String(a, "place"),
            address, locality, String(a, "county"), First(a, "registration-phone", "phone", "information-phone", "additional-phone"), NullableString(a, "email"), NullableString(a, "website"), lat, lon,
            NullableString(a, "benefits-for-children") switch { "Y" => true, "N" => false, _ => null }, NullableString(a, "age-range"), null,
            pcus, ParsePcusDays(pcus), Bool(dates, "applicable") ?? false, pcusDate,
            Nonnegative(stats, "awaiting"), Nonnegative(stats, "removed"), Nonnegative(stats, "average-period"), Nonnegative(computed, "average-period"), period, NullableString(computed, "update"));
    }
    private static int? Nonnegative(JsonElement e, string key) { var n = Number(e, key); return n < 0 ? throw new InvalidDataException($"Ujemne {key}.") : n; }
    public static JsonElement Required(JsonElement e, string key, JsonValueKind kind) => e.TryGetProperty(key, out var v) && v.ValueKind == kind ? v : throw new InvalidDataException($"Zmiana schematu: {key}.");
    private static JsonElement Object(JsonElement e, string key) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.Object ? v : default;
    private static string String(JsonElement e, string key) => NullableString(e, key) ?? "";
    private static string? NullableString(JsonElement e, string key) => e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(key, out var v) || v.ValueKind == JsonValueKind.Null ? null : v.ValueKind == JsonValueKind.String ? v.GetString() : throw new InvalidDataException($"Zmiana typu {key}.");
    private static int? Number(JsonElement e, string key) => e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(key, out var v) || v.ValueKind == JsonValueKind.Null ? null : v.GetInt32();
    private static double? Double(JsonElement e, string key) => e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(key, out var v) || v.ValueKind == JsonValueKind.Null ? null : v.GetDouble();
    private static bool? Bool(JsonElement e, string key) => e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(key, out var v) || v.ValueKind == JsonValueKind.Null ? null : v.GetBoolean();
    private static string? First(JsonElement e, params string[] keys) => keys.Select(k => NullableString(e, k)).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
}
