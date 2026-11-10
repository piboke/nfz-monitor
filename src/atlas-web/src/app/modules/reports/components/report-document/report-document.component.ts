import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  QueryList,
  ViewChildren,
} from "@angular/core";
import { DatasetRepository } from "../../../../core/data/dataset.repository";
import { REGIONS } from "../../../../core/models/dataset.models";
import { ChartComponent } from "../../../../shared/components/chart/chart.component";
import {
  formatNumber,
  queueFreshness,
  sumKnown,
} from "../../../../shared/formatting/numbers";
import { QueueWorkspace } from "../../../explorer/services/queue-workspace.store";
import { QueueAnalysis } from "../../../radar/services/queue-analysis.service";
import { ReportExportService } from "../../services/report-export.service";

@Component({
  selector: "app-report-document",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartComponent],
  templateUrl: "./report-document.component.html",
})
export class ReportDocumentComponent {
  readonly workspace = inject(QueueWorkspace);
  readonly analysis = inject(QueueAnalysis);
  readonly data = inject(DatasetRepository);
  readonly exporter = inject(ReportExportService);
  readonly regions = REGIONS;
  readonly regionCodes = Object.keys(this.regions).sort();
  readonly number = formatNumber;
  readonly sum = sumKnown;
  readonly freshness = queueFreshness;
  @ViewChildren(ChartComponent) charts!: QueryList<ChartComponent>;
}
