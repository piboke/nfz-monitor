import type {
  Metric,
  PeriodPoint,
  QueueChange,
} from "../models/analysis.models.js";
import type {
  Filters,
  HistoryPoint,
  QueueRow,
} from "../models/dataset.models.js";
export function median(values: readonly (number | null)[]): number | null {
  const n = values
    .filter((x): x is number => x !== null && Number.isFinite(x))
    .sort((a, b) => a - b);
  return n.length === 0
    ? null
    : n.length % 2
      ? n[n.length >> 1]
      : (n[n.length / 2 - 1] + n[n.length / 2]) / 2;
}
export function filterRows(rows: readonly QueueRow[], f: Filters): QueueRow[] {
  return rows.filter(
    (q) =>
      (!f.queue || q.id === f.queue) &&
      (!f.benefit || q.benefitId === f.benefit) &&
      (!f.province || q.province === f.province) &&
      (!f.category || String(q.case) === f.category) &&
      (!f.county || q.county === f.county) &&
      (!f.locality ||
        q.locality
          .toLocaleLowerCase("pl")
          .includes(f.locality.toLocaleLowerCase("pl"))) &&
      (!f.provider ||
        (q.provider + " " + q.place)
          .toLocaleLowerCase("pl")
          .includes(f.provider.toLocaleLowerCase("pl"))) &&
      (!f.age ||
        (f.age === "children"
          ? q.forChildren === true
          : q.forChildren === false)) &&
      (f.min === "" || (q.pcusDays !== null && q.pcusDays >= Number(f.min))) &&
      (f.max === "" || (q.pcusDays !== null && q.pcusDays <= Number(f.max))),
  );
}
// Keep the latest revision of each source period. Retrieval dates are never statistical periods.
export function periodSeries(
  history: readonly HistoryPoint[],
  metric: Metric,
  from = "",
  to = "",
): PeriodPoint[] {
  const pcus = metric === "pcusDays";
  const revisions = new Map<string, HistoryPoint>();
  for (const p of history) {
    const period = pcus ? p.pcusUpdatedAt : p.reportingPeriod;
    if (!period || (from && period < from) || (to && period > to)) continue;
    const key = p.id + "|" + p.case + "|" + period;
    const old = revisions.get(key);
    if (!old || old.retrievedAt < p.retrievedAt) revisions.set(key, p);
  }
  const groups = new Map<string, number[]>();
  for (const p of revisions.values()) {
    const period = (pcus ? p.pcusUpdatedAt : p.reportingPeriod)!;
    const values = groups.get(period) || [];
    const value = p[metric];
    if (value !== null) values.push(value);
    groups.set(period, values);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, values]) => ({
      period,
      value: pcus
        ? median(values)
        : values.length
          ? values.reduce((s, v) => s + v, 0)
          : null,
      coverage: values.length,
    }));
}
export function changes(
  history: readonly HistoryPoint[],
  metric: Metric,
  from: string,
  to: string,
): QueueChange[] {
  const pcus = metric === "pcusDays";
  const at = (period: string) => {
    const m = new Map<string, HistoryPoint>();
    for (const p of history) {
      if ((pcus ? p.pcusUpdatedAt : p.reportingPeriod) !== period) continue;
      const key = p.id + "|" + p.case;
      const old = m.get(key);
      if (!old || old.retrievedAt < p.retrievedAt) m.set(key, p);
    }
    return m;
  };
  const before = at(from),
    after = at(to);
  const result: QueueChange[] = [];
  for (const [key, p] of after) {
    const old = before.get(key);
    if (
      p[metric] === null ||
      old?.[metric] == null ||
      p.facilityId !== old.facilityId ||
      p.benefitId !== old.benefitId
    )
      continue;
    const current = p[metric]!;
    const previous = old[metric]!;
    const delta = current - previous;
    result.push({
      id: p.id,
      case: p.case,
      delta,
      percent: previous === 0 ? null : (delta * 100) / previous,
    });
  }
  return result;
}
