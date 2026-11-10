using NfzAtlas.Domain;

namespace NfzAtlas.ETL;

public sealed record EtlOptions(
    string DataDirectory,
    string WorkDirectory,
    Partition[] Partitions,
    bool National,
    string? FixturePath,
    bool MeasureVolume,
    bool RebuildHistory
)
{
    public const int WorkerCount = 6;
    public static readonly TimeSpan ExecutionTimeout = TimeSpan.FromHours(5);
    private static readonly HashSet<string> Allowed =
    [
        "--data",
        "--work",
        "--province",
        "--case",
        "--benefit",
        "--fixture",
        "--measure",
        "--rebuild-history",
    ];

    public static EtlOptions Parse(IReadOnlyList<string> args)
    {
        if (args.Count % 2 != 0)
            throw new ArgumentException("Każdy parametr wymaga wartości.");
        var values = new Dictionary<string, string>();
        for (var i = 0; i < args.Count; i += 2)
        {
            if (!Allowed.Contains(args[i]))
                throw new ArgumentException($"Nieznany parametr: {args[i]}.");
            if (!values.TryAdd(args[i], args[i + 1]))
                throw new ArgumentException($"Powtórzony parametr: {args[i]}.");
        }
        var data = Path.GetFullPath(values.GetValueOrDefault("--data", "data"));
        var work = Path.GetFullPath(values.GetValueOrDefault("--work", ".etl-work"));
        var provinces = values.TryGetValue("--province", out var province)
            ? province.Split(',').Distinct().ToArray()
            : Regions.Names.Keys.ToArray();
        if (provinces.Length == 0 || provinces.Any(code => !Regions.Names.ContainsKey(code)))
            throw new ArgumentException("Nieznany kod województwa NFZ (01–16, nie TERYT).");
        var cases = values
            .GetValueOrDefault("--case", "1,2")
            .Split(',')
            .Distinct()
            .Select(value =>
                int.TryParse(value, out var category) && category is 1 or 2
                    ? category
                    : throw new ArgumentException("Kategoria musi mieć wartość 1 lub 2.")
            )
            .ToArray();
        var fixture = values.GetValueOrDefault("--fixture");
        if (fixture is not null && data == Path.GetFullPath("data"))
            throw new ArgumentException(
                "Fixture nie może zostać opublikowany do produkcyjnego data/."
            );
        var measure = BooleanOption(values, "--measure");
        var rebuild = BooleanOption(values, "--rebuild-history");
        if ((fixture is null ? 0 : 1) + (measure ? 1 : 0) + (rebuild ? 1 : 0) > 1)
            throw new ArgumentException(
                "Wybierz jeden tryb: fixture, pomiar wolumenu albo odtworzenie historii."
            );
        var benefit = values.GetValueOrDefault("--benefit");
        var partitions = provinces
            .SelectMany(code => cases.Select(category => new Partition(code, category, benefit)))
            .ToArray();
        var national =
            provinces.Length == 16 && cases.Length == 2 && benefit is null && fixture is null;
        return new(data, work, partitions, national, fixture, measure, rebuild);
    }

    private static bool BooleanOption(IReadOnlyDictionary<string, string> options, string key)
    {
        if (!options.TryGetValue(key, out var value))
            return false;
        return bool.TryParse(value, out var result)
            ? result
            : throw new ArgumentException($"Parametr {key} przyjmuje true albo false.");
    }
}
