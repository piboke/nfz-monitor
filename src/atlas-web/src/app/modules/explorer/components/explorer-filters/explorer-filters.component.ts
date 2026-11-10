import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatasetRepository } from "../../../../core/data/dataset.repository";
import { REGIONS } from "../../../../core/models/dataset.models";
import { formatNumber } from "../../../../shared/formatting/numbers";
import { QueueWorkspace } from "../../services/queue-workspace.store";

@Component({
  selector: "app-explorer-filters",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: "./explorer-filters.component.html",
})
export class ExplorerFiltersComponent {
  readonly workspace = inject(QueueWorkspace);
  readonly data = inject(DatasetRepository);
  readonly regions = REGIONS;
  readonly number = formatNumber;
}
