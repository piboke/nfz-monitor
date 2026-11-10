import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ExplorerFiltersComponent } from "../../../explorer/components/explorer-filters/explorer-filters.component";
import { QueueWorkspace } from "../../../explorer/services/queue-workspace.store";
import { QueueAnalysis } from "../../../radar/services/queue-analysis.service";
import { ReportDocumentComponent } from "../../components/report-document/report-document.component";
import { ReportSettingsComponent } from "../../components/report-settings/report-settings.component";
import { ReportExportService } from "../../services/report-export.service";

@Component({
  selector: "app-reports-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ExplorerFiltersComponent,
    ReportSettingsComponent,
    ReportDocumentComponent,
  ],
  templateUrl: "./reports-page.component.html",
  providers: [QueueWorkspace, QueueAnalysis, ReportExportService],
})
export class ReportsPageComponent {
  readonly workspace = inject(QueueWorkspace);
  readonly exporter = inject(ReportExportService);
  constructor() {
    this.workspace.connect("reports");
  }
}
