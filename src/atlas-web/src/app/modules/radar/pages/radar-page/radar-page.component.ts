import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ExplorerFiltersComponent } from "../../../explorer/components/explorer-filters/explorer-filters.component";
import { QueueWorkspace } from "../../../explorer/services/queue-workspace.store";
import { ReportDocumentComponent } from "../../../reports/components/report-document/report-document.component";
import { ReportSettingsComponent } from "../../../reports/components/report-settings/report-settings.component";
import { ReportExportService } from "../../../reports/services/report-export.service";
import { QueueAnalysis } from "../../services/queue-analysis.service";

@Component({
  selector: "app-radar-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ExplorerFiltersComponent,
    ReportSettingsComponent,
    ReportDocumentComponent,
  ],
  templateUrl: "./radar-page.component.html",
  providers: [QueueWorkspace, QueueAnalysis, ReportExportService],
})
export class RadarPageComponent {
  readonly workspace = inject(QueueWorkspace);
  constructor() {
    this.workspace.connect("radar");
  }
}
