export type ExplorerMode = "atlas" | "radar" | "reports";
export type Metric = "awaiting" | "removed" | "pcusDays";
export type Grouping = "province" | "county" | "facility" | "benefit";
export type QueueSort = "provider" | "locality" | "pcusDays" | "awaiting";
export interface PeriodPoint {
  period: string;
  value: number | null;
  coverage: number;
}
export interface QueueChange {
  id: string;
  case: number;
  delta: number;
  percent: number | null;
}
export interface QueueGroup {
  name: string;
  queues: number;
  known: number;
  awaiting: number | null;
  removed: number | null;
  pcus: number | null;
}
export interface ReportSettings {
  additionalBenefits: string[];
  reportProviders: string[];
  from: string;
  to: string;
  metric: Metric;
  group: Grouping;
  reportTemplate: number;
  chartType: "line" | "bar";
}
export const REPORT_TEMPLATES = [
  "Dostępność leczenia w Polsce",
  "Porównanie województw",
  "Kolejki dla wybranego świadczenia",
  "Dostępność leczenia w powiecie",
  "Historia kolejek placówki",
  "Największe wzrosty i spadki",
  "Anomalie i braki w danych NFZ",
] as const;
export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  additionalBenefits: [],
  reportProviders: [],
  from: "",
  to: "",
  metric: "awaiting",
  group: "province",
  reportTemplate: 0,
  chartType: "line",
};
