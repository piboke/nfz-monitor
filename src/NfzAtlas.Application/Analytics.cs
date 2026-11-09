using NfzAtlas.Domain;

namespace NfzAtlas.Application;

public static class Analytics
{
    public static double? Median(IEnumerable<double> source)
    {
        var n = source.Order().ToArray();
        return n.Length == 0 ? null : n.Length % 2 == 1 ? n[n.Length / 2] : (n[n.Length / 2 - 1] + n[n.Length / 2]) / 2;
    }
    public static HistoryPoint[] Series(IEnumerable<Observation> source) => source
        .Select(o => new HistoryPoint(o.Queue.Id, o.Queue.FacilityId, o.Queue.BenefitId, o.Queue.Case, o.Queue.Province, o.Queue.ReportingPeriod, o.Queue.PcusUpdatedAt, o.Queue.Awaiting, o.Queue.Removed, o.Queue.PcusDays, o.Queue.Pcus, o.RetrievedAt)).ToArray();
    public static bool Fresh(QueueRow q, DateOnly asOf) => q.ReportingPeriod is not null &&
        DateOnly.TryParseExact(q.ReportingPeriod + "-01", "yyyy-MM-dd", out var period) &&
        period >= new DateOnly(asOf.Year, asOf.Month, 1).AddMonths(-2) && period <= asOf &&
        DateOnly.TryParse(q.PcusUpdatedAt, out var d) && d >= asOf.AddDays(-35) && d <= asOf;
    public static Aggregate Summarize(string key, IReadOnlyList<QueueRow> rows, IReadOnlyList<Observation> history, DateOnly asOf)
    {
        var old = history.GroupBy(o => (o.Queue.Id, o.Queue.Case)).ToDictionary(g => g.Key, g => g.OrderByDescending(o => o.RetrievedAt).ToArray());
        var pairs = rows.Select(q => (Current: q, Prior: Previous(q, old.GetValueOrDefault((q.Id, q.Case)) ?? [])))
            .Where(p => p.Prior is not null && p.Current.Awaiting.HasValue && p.Prior.Awaiting.HasValue).ToArray();
        var delta = pairs.Sum(p => (long)p.Current.Awaiting!.Value - p.Prior!.Awaiting!.Value);
        var baseline = pairs.Sum(p => (long)p.Prior!.Awaiting!.Value);
        var known = rows.Where(q => q.Awaiting.HasValue).ToArray();
        var fresh = rows.Count(q => Fresh(q, asOf));
        return new Aggregate(key, rows.Count, known.Length, known.Length == 0 ? null : known.Sum(q => (long)q.Awaiting!.Value),
            rows.Count(q => q.PcusDays.HasValue), Median(rows.Where(q => q.PcusDays.HasValue).Select(q => (double)q.PcusDays!.Value)), fresh, rows.Count == 0 ? 0 : Math.Round(fresh * 100d / rows.Count, 1),
            pairs.Length, pairs.Length == 0 ? null : delta, baseline == 0 ? null : Math.Round(delta * 100d / baseline, 2),
            Median(rows.Select(q => (Q: q, P: PreviousPcus(q, old.GetValueOrDefault((q.Id, q.Case)) ?? [])))
                .Where(p => p.Q.PcusDays.HasValue && p.P?.PcusDays is not null).Select(p => (double)p.Q.PcusDays!.Value - p.P!.PcusDays!.Value)),
            pairs.Count(p => p.Current.Awaiting > p.Prior!.Awaiting), pairs.Count(p => p.Current.Awaiting < p.Prior!.Awaiting));
    }
    public static QueueRow? Previous(QueueRow q, IEnumerable<Observation> history)
    {
        if (!DateOnly.TryParseExact(q.ReportingPeriod + "-01", "yyyy-MM-dd", out var date)) return null;
        var priorPeriod = date.AddMonths(-1).ToString("yyyy-MM");
        return history.Where(o => o.Queue.ReportingPeriod == priorPeriod && o.Queue.FacilityId == q.FacilityId && o.Queue.BenefitId == q.BenefitId).OrderByDescending(o => o.RetrievedAt).FirstOrDefault()?.Queue;
    }
    private static QueueRow? PreviousPcus(QueueRow q, IEnumerable<Observation> history) => q.PcusUpdatedAt is null ? null : history.Where(o => o.Queue.FacilityId == q.FacilityId && o.Queue.BenefitId == q.BenefitId && o.Queue.PcusUpdatedAt is not null && string.CompareOrdinal(o.Queue.PcusUpdatedAt, q.PcusUpdatedAt) < 0).OrderByDescending(o => o.Queue.PcusUpdatedAt).ThenByDescending(o => o.RetrievedAt).FirstOrDefault()?.Queue;
    public static QualityEvent[] Anomalies(IReadOnlyList<QueueRow> rows, IReadOnlyList<Observation> history, DateOnly asOf)
    {
        var lookup = history.GroupBy(o => (o.Queue.Id, o.Queue.Case)).ToDictionary(g => g.Key, g => g.ToArray());
        var result = new List<QualityEvent>();
        foreach (var q in rows)
        {
            if (!Fresh(q, asOf)) result.Add(new(q.Id, "stale", "Brak aktualnych statystyk lub PCUŚ; sprawdź daty źródłowe."));
            if (q.Pcus is not null && q.PcusApplicable && q.PcusDays is null) result.Add(new(q.Id, "pcus-text", "Tekstowy PCUŚ bez jednoznacznego przeliczenia na dni."));
            var prior = Previous(q, lookup.GetValueOrDefault((q.Id, q.Case)) ?? []);
            if (q.Awaiting is int now && prior?.Awaiting is int before && Math.Abs((long)now - before) >= 50 && (before == 0 || Math.Abs((double)now - before) / before >= .5)) result.Add(new(q.Id, "awaiting-jump", "Zmiana wpisów o co najmniej 50 i 50% miesiąc do miesiąca. Wymaga weryfikacji."));
            var pcus = PreviousPcus(q, lookup.GetValueOrDefault((q.Id, q.Case)) ?? []);
            if (q.PcusDays is int days && pcus?.PcusDays is int old && Math.Abs((long)days - old) >= 90) result.Add(new(q.Id, "pcus-jump", "Zmiana PCUŚ o co najmniej 90 dni. Wymaga weryfikacji."));
        }
        return result.ToArray();
    }
}
