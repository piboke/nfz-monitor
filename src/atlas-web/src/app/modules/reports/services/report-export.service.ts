import { Injectable, inject, signal } from "@angular/core";
import { DatasetRepository } from "../../../core/data/dataset.repository";
import { errorMessage } from "../../../core/errors/error-message";
import { REGIONS } from "../../../core/models/dataset.models";
import type { ChartComponent } from "../../../shared/components/chart/chart.component";
import { queueFreshness, sumKnown } from "../../../shared/formatting/numbers";
import { REGION_POSITIONS } from "../../../shared/maps/region-positions";
import { QueueWorkspace } from "../../explorer/services/queue-workspace.store";
import { QueueAnalysis } from "../../radar/services/queue-analysis.service";
import type { PdfReport } from "../pdf/report-pdf";
@Injectable()
export class ReportExportService {
  readonly workspace = inject(QueueWorkspace);
  readonly analysis = inject(QueueAnalysis);
  readonly data = inject(DatasetRepository);
  readonly exporting = signal(false);
  readonly generatedAt = signal(new Date());
  async download(charts: readonly ChartComponent[]): Promise<void> {
    if (
      this.workspace.loading() ||
      this.exporting() ||
      this.analysis.reportValidation()
    )
      return;
    this.exporting.set(true);
    this.generatedAt.set(new Date());
    this.workspace.error.set("");
    try {
      await this.workspace.updateUrl();
      if (this.workspace.loading())
        throw new Error("Poczekaj na zakończenie pobierania danych raportu.");
      const manifest = this.data.manifest();
      if (!manifest) throw new Error("Brak manifestu danych raportu.");
      const report: PdfReport = {
        title: this.analysis.reportTitle(),
        generatedAt: this.generatedAt(),
        sourceDate: manifest.lastSync,
        scope: manifest.scope,
        national: manifest.national,
        complete: manifest.complete,
        services: this.workspace.reportServices(),
        geography:
          (this.workspace.appliedFilters().province
            ? REGIONS[this.workspace.appliedFilters().province]
            : "Cały dostępny zakres") +
          " / " +
          (this.workspace.appliedFilters().county || "wszystkie powiaty"),
        category:
          this.workspace.appliedFilters().category === "1"
            ? "stabilny"
            : this.workspace.appliedFilters().category === "2"
              ? "pilny"
              : "obie (oddzielne kolejki)",
        from: this.workspace.from,
        to: this.workspace.to,
        metric: this.analysis.metricLabel(),
        warnings: manifest.warnings,
        queueCount: this.workspace.filtered().length,
        awaiting: sumKnown(this.workspace.filtered(), "awaiting"),
        medianPcus: this.analysis.medianPcus(),
        pairs: this.analysis.comparison().length,
        periods: this.analysis.chartSeries(),
        regions: Object.keys(REGIONS)
          .sort()
          .map((code) => ({
            code,
            name: REGIONS[code],
            value: this.analysis.reportRegionValue(code),
            x: REGION_POSITIONS[code][0],
            y: REGION_POSITIONS[code][1],
          })),
        groups: this.analysis.groups(),
        changes: this.analysis.comparison().map((c) => ({
          name: this.analysis.queueName(c.id, c.case),
          delta: c.delta,
          percent: c.percent,
          signal: this.analysis.isJump(c.delta, c.percent)
            ? "Duża zmiana - wymaga weryfikacji"
            : "-",
        })),
        stale: this.workspace
          .filtered()
          .filter(
            (q) =>
              queueFreshness(q) !== "Dane aktualne" ||
              q.awaiting === null ||
              q.pcus === null,
          )
          .map((q) => ({
            name: q.provider + " / " + q.locality,
            period: q.reportingPeriod,
            date: q.pcusUpdatedAt,
            status: queueFreshness(q),
          })),
        events: this.analysis.filteredEvents().map((event) => ({
          name: this.analysis.queueName(event.queueId, event.category),
          message: event.message,
        })),
        charts: charts.map((chart) => chart.exportPng()),
        mapSvg: "",
        url: location.href,
      };
      const response = await fetch(new URL("poland.svg", document.baseURI));
      if (!response.ok)
        throw new Error(
          "Nie udało się wczytać mapy raportu. Spróbuj ponownie.",
        );
      report.mapSvg = await response.text();
      const { downloadReport } = await import("../pdf/report-pdf");
      await downloadReport(report);
    } catch (error) {
      this.workspace.error.set(
        "Nie udało się wygenerować PDF. " + errorMessage(error),
      );
    } finally {
      this.exporting.set(false);
    }
  }
}
