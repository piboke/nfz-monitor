import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PortalNavigation } from "../../../../core/routing/portal-navigation.service";
import { ContactComponent } from "../../../../shared/components/contact/contact.component";
import {
  formatNumber,
  queueFreshness,
} from "../../../../shared/formatting/numbers";
import { QueueWorkspace } from "../../../explorer/services/queue-workspace.store";
import { QueueComparisonStore } from "../../services/queue-comparison.store";
import { FacilityMapComponent } from "../facility-map/facility-map.component";
import { QueueComparisonComponent } from "../queue-comparison/queue-comparison.component";

@Component({
  selector: "app-queue-results",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    FacilityMapComponent,
    ContactComponent,
    QueueComparisonComponent,
  ],
  templateUrl: "./queue-results.component.html",
})
export class QueueResultsComponent {
  readonly workspace = inject(QueueWorkspace);
  readonly comparison = inject(QueueComparisonStore);
  readonly navigation = inject(PortalNavigation);
  readonly number = formatNumber;
  readonly freshness = queueFreshness;
}
