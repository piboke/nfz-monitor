import type { QueueRow } from "../../core/models/dataset.models.js";
const formatter = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
export function formatNumber(value: number | null | undefined): string {
  return value == null ? "brak danych" : formatter.format(value);
}
export function sumKnown(
  rows: readonly QueueRow[],
  metric: "awaiting" | "removed",
): number | null {
  const values = rows
    .map((row) => row[metric])
    .filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
export function queueFreshness(row: QueueRow, now = new Date()): string {
  if (!row.reportingPeriod || !row.pcusUpdatedAt) return "Brak dat";
  const sourceDate = Date.parse(row.pcusUpdatedAt);
  const period = Date.parse(row.reportingPeriod + "-01");
  const currentPeriod = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1);
  const age = (now.getTime() - sourceDate) / 86400000;
  return !Number.isFinite(age) ||
    !Number.isFinite(period) ||
    age > 35 ||
    age < 0 ||
    period < cutoff ||
    period > currentPeriod
    ? "Dane opóźnione"
    : "Dane aktualne";
}
