import { Injectable, computed, inject } from "@angular/core";
import {
  changes,
  median,
  periodSeries,
} from "../../../core/analytics/queue-analytics";
import { DatasetRepository } from "../../../core/data/dataset.repository";
import { REPORT_TEMPLATES } from "../../../core/models/analysis.models";
import { REGIONS, type QueueRow } from "../../../core/models/dataset.models";
import { sumKnown } from "../../../shared/formatting/numbers";
import { REGION_POSITIONS } from "../../../shared/maps/region-positions";
import { QueueWorkspace } from "../../explorer/services/queue-workspace.store";
@Injectable()
export class QueueAnalysis {
  readonly workspace = inject(QueueWorkspace);
  readonly data = inject(DatasetRepository);
  readonly templates = REPORT_TEMPLATES;
  readonly regionCodes = Object.keys(REGIONS).sort();
  readonly regionPositions = REGION_POSITIONS;
  readonly series = computed(() => {
    const allowed = new Map(
      this.workspace.filtered().map((row) => [row.id + "|" + row.case, row]),
    );
    return this.workspace.history().filter((point) => {
      const row = allowed.get(point.id + "|" + point.case);
      return (
        row?.facilityId === point.facilityId &&
        row?.benefitId === point.benefitId
      );
    });
  });
  readonly chartSeries = computed(() => {
    return periodSeries(
      this.series(),
      this.workspace.metric,
      this.workspace.from,
      this.workspace.to,
    );
  });
  readonly chartLabels = computed(() => {
    return this.chartSeries().map((p) => p.period);
  });
  readonly chartValues = computed(() => {
    return this.chartSeries().map((p) => p.value);
  });
  readonly metricLabel = computed(() => {
    return this.workspace.metric === "pcusDays"
      ? "Mediana PCUŚ (dni)"
      : this.workspace.metric === "removed"
        ? "Skreśleni z powodu udzielenia świadczenia"
        : "Wpisy na listach oczekujących";
  });
  readonly comparison = computed(() => {
    return changes(
      this.series(),
      this.workspace.metric,
      this.workspace.from,
      this.workspace.to,
    ).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  });
  readonly medianPcus = computed(() => {
    return median(this.workspace.filtered().map((q) => q.pcusDays));
  });
  readonly changeLabels = computed(() => {
    return this.comparison().map((c) => this.queueName(c.id, c.case));
  });
  readonly changeValues = computed(() => {
    return this.comparison().map((c) => c.percent);
  });
  readonly comparisonMap = computed(() => {
    return new Map(this.comparison().map((p) => [p.id + "|" + p.case, p]));
  });
  readonly reportTitle = computed(() => {
    if (this.workspace.reportTemplate === 0)
      return (
        "Dostępność leczenia: " +
        (this.workspace.appliedFilters().province
          ? REGIONS[this.workspace.appliedFilters().province]
          : this.data.manifest()?.national
            ? "Polska"
            : "dostępny zakres")
      );
    return this.templates[this.workspace.reportTemplate];
  });
  readonly reportValidation = computed(() => {
    return this.workspace.reportTemplate === 3 &&
      !this.workspace.appliedFilters().county
      ? "Wybierz powiat dla analizy powiatowej."
      : this.workspace.reportTemplate === 4 &&
          !this.workspace.reportProviders.length &&
          !this.workspace.appliedFilters().provider
        ? "Wybierz placówkę, której historię chcesz przeanalizować."
        : this.workspace.from > this.workspace.to
          ? "Popraw kolejność okresów analizy."
          : "";
  });
  readonly qualityChunks = computed(() => {
    const rows = this.filteredEvents();
    return Array.from({ length: Math.ceil(rows.length / 8) }, (_, i) =>
      rows.slice(i * 8, i * 8 + 8),
    );
  });
  readonly filteredEvents = computed(() => {
    const allowed = new Set(
      this.workspace.filtered().map((q) => q.id + "|" + q.case),
    );
    return this.workspace
      .qualityEvents()
      .filter((e) => allowed.has(e.queueId + "|" + e.category));
  });
  readonly groups = computed(() => {
    const groups = new Map<string, QueueRow[]>();
    for (const q of this.workspace.filtered()) {
      const key =
        this.workspace.group === "province"
          ? REGIONS[q.province]
          : this.workspace.group === "county"
            ? q.county + " · " + REGIONS[q.province]
            : this.workspace.group === "facility"
              ? q.provider +
                " · NFZ: " +
                q.providerCode +
                " · " +
                REGIONS[q.province]
              : q.benefit;
      const bucket = groups.get(key) ?? [];
      bucket.push(q);
      groups.set(key, bucket);
    }
    return [...groups]
      .map(([name, rows]) => ({
        name,
        queues: rows.length,
        known: rows.filter((q) => q.awaiting !== null).length,
        awaiting: sumKnown(rows, "awaiting"),
        removed: sumKnown(rows, "removed"),
        pcus: median(rows.map((q) => q.pcusDays)),
      }))
      .sort((a, b) => (b.awaiting ?? -1) - (a.awaiting ?? -1));
  });
  readonly groupLabels = computed(() => {
    return this.groups().map((g) => g.name);
  });
  readonly groupValues = computed(() => {
    return this.groups().map((g) =>
      this.workspace.metric === "pcusDays"
        ? g.pcus
        : this.workspace.metric === "removed"
          ? g.removed
          : g.awaiting,
    );
  });
  queueName(id: string, category: number) {
    const q = this.workspace
      .rows()
      .find((q) => q.id === id && q.case === category);
    return q
      ? q.provider +
          " · " +
          q.locality +
          " (" +
          (category === 1 ? "stabilny" : "pilny") +
          ")"
      : id;
  }
  isJump(delta: number, percent: number | null) {
    return this.workspace.metric === "pcusDays"
      ? Math.abs(delta) >= 90
      : Math.abs(delta) >= 50 && (percent === null || Math.abs(percent) >= 50);
  }
  reportRegionValue(code: string) {
    const rows = this.workspace.filtered().filter((q) => q.province === code);
    return !rows.length
      ? null
      : this.workspace.metric === "pcusDays"
        ? median(rows.map((q) => q.pcusDays))
        : sumKnown(rows, this.workspace.metric);
  }
  reportRegionStyle(code: string) {
    const value = this.reportRegionValue(code);
    const known = this.regionCodes
      .map((c) => this.reportRegionValue(c))
      .filter((n): n is number => n !== null);
    const max = Math.max(1, ...known);
    const size = value === null ? 24 : 26 + Math.sqrt(value / max) * 20;
    return {
      left: this.regionPositions[code][0] + "%",
      top: this.regionPositions[code][1] + "%",
      width: size + "px",
      height: size + "px",
      background: value === null ? "#717985" : "#b60500",
    };
  }
}
