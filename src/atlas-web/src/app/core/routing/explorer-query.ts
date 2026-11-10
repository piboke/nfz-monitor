import {
  DEFAULT_REPORT_SETTINGS,
  type ReportSettings,
} from "../models/analysis.models.js";
import {
  EMPTY_FILTERS,
  REGIONS,
  type Filters,
} from "../models/dataset.models.js";
export interface ExplorerQuery {
  filters: Filters;
  settings: ReportSettings;
}
export function parseExplorerQuery(params: URLSearchParams): ExplorerQuery {
  const filters = { ...EMPTY_FILTERS };
  for (const key of Object.keys(filters) as (keyof Filters)[]) {
    if (params.has(key)) filters[key] = (params.get(key) ?? "").slice(0, 250);
  }
  if (filters.province && !Object.hasOwn(REGIONS, filters.province))
    filters.province = "";
  if (!["", "1", "2"].includes(filters.category)) filters.category = "1";
  for (const key of ["min", "max"] as const) {
    if (
      filters[key] &&
      (!/^\d+(?:\.\d+)?$/.test(filters[key]) ||
        !Number.isFinite(Number(filters[key])))
    )
      filters[key] = "";
  }
  const metric = params.get("metric");
  const group = params.get("group");
  const template = Number(params.get("template"));
  const list = (key: string, max: number) =>
    [
      ...new Set(
        (params.get(key) ?? "")
          .split(",")
          .filter(Boolean)
          .map((value) => value.slice(0, 250)),
      ),
    ].slice(0, max);
  return {
    filters,
    settings: {
      ...DEFAULT_REPORT_SETTINGS,
      additionalBenefits: list("services", 4),
      reportProviders: list("providers", 20),
      from: (params.get("from") ?? "").slice(0, 10),
      to: (params.get("to") ?? "").slice(0, 10),
      metric:
        metric === "pcusDays" || metric === "removed" ? metric : "awaiting",
      group:
        group === "county" || group === "facility" || group === "benefit"
          ? group
          : "province",
      reportTemplate: Number.isFinite(template)
        ? Math.min(6, Math.max(0, Math.trunc(template)))
        : 0,
      chartType: params.get("chart") === "bar" ? "bar" : "line",
    },
  };
}
export function serializeExplorerQuery(
  query: ExplorerQuery,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query.filters))
    if (value) params[key] = value;
  const s = query.settings;
  if (s.additionalBenefits.length)
    params["services"] = s.additionalBenefits.join(",");
  if (s.reportProviders.length)
    params["providers"] = s.reportProviders.join(",");
  if (s.from) params["from"] = s.from;
  if (s.to) params["to"] = s.to;
  return {
    ...params,
    metric: s.metric,
    group: s.group,
    template: String(s.reportTemplate),
    chart: s.chartType,
  };
}
