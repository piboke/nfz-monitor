import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatasetRepository } from "../../../../core/data/dataset.repository";
import { REPORT_TEMPLATES } from "../../../../core/models/analysis.models";
import { PortalNavigation } from "../../../../core/routing/portal-navigation.service";
import { QueueWorkspace } from "../../../explorer/services/queue-workspace.store";
import { QueueAnalysis } from "../../../radar/services/queue-analysis.service";
import { ReportExportService } from "../../services/report-export.service";

@Component({
  selector: "app-report-settings",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: "./report-settings.component.html",
})
export class ReportSettingsComponent {
  readonly workspace = inject(QueueWorkspace);
  readonly analysis = inject(QueueAnalysis);
  readonly data = inject(DatasetRepository);
  readonly navigation = inject(PortalNavigation);
  readonly exporter = inject(ReportExportService);
  readonly templates = REPORT_TEMPLATES;
  readonly download = output<void>();
}
