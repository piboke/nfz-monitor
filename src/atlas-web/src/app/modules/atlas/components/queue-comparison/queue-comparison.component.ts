import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { formatNumber } from "../../../../shared/formatting/numbers";
import { QueueComparisonStore } from "../../services/queue-comparison.store";

@Component({
  selector: "app-queue-comparison",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: "./queue-comparison.component.html",
})
export class QueueComparisonComponent {
  readonly comparison = inject(QueueComparisonStore);
  readonly number = formatNumber;
}
