import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { DatasetRepository } from "./core/data/dataset.repository";
import { PortalNavigation } from "./core/routing/portal-navigation.service";
import { ThemeService } from "./core/services/theme.service";
@Component({
  selector: "app-root",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./app.component.html",
})
export class AppComponent {
  constructor() {
    inject(PortalNavigation);
  }
  readonly data = inject(DatasetRepository);
  readonly theme = inject(ThemeService);
  readonly nav = [
    ["home", "Przegląd"],
    ["atlas", "Atlas"],
    ["radar", "Radar"],
    ["reports", "Raporty"],
    ["methodology", "Metodologia"],
    ["about", "O projekcie"],
  ] as const;
  skipToContent(event: Event): void {
    event.preventDefault();
    const main = document.getElementById("main-content");
    main?.focus();
    main?.scrollIntoView();
  }
}
