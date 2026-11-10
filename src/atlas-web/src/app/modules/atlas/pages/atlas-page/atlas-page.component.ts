import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ExplorerFiltersComponent } from "../../../explorer/components/explorer-filters/explorer-filters.component";
import { QueueWorkspace } from "../../../explorer/services/queue-workspace.store";
import { QueueResultsComponent } from "../../components/queue-results/queue-results.component";

@Component({
  selector: "app-atlas-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExplorerFiltersComponent, QueueResultsComponent],
  templateUrl: "./atlas-page.component.html",
  providers: [QueueWorkspace],
})
export class AtlasPageComponent {
  readonly workspace = inject(QueueWorkspace);
  constructor() {
    this.workspace.connect("atlas");
  }
}
