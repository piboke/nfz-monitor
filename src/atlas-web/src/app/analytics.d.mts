import { QueueRow, Filters, HistoryPoint } from "./models";
export function median(values: (number | null)[]): number | null;
export function filterRows(rows: QueueRow[], filters: Filters): QueueRow[];
export function periodSeries(
  history: HistoryPoint[],
  metric: "awaiting" | "removed" | "pcusDays",
  from?: string,
  to?: string,
): { period: string; value: number | null; coverage: number }[];
export function changes(
  history: HistoryPoint[],
  metric: "awaiting" | "removed" | "pcusDays",
  from: string,
  to: string,
): { id: string; case: number; delta: number; percent: number | null }[];
