import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { DatasetRepository } from "../../../../core/data/dataset.repository";
import { REGIONS } from "../../../../core/models/dataset.models";
import { PortalNavigation } from "../../../../core/routing/portal-navigation.service";
import { ChartComponent } from "../../../../shared/components/chart/chart.component";
import { formatNumber } from "../../../../shared/formatting/numbers";
import { REGION_POSITIONS } from "../../../../shared/maps/region-positions";

@Component({
  selector: "app-home-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ChartComponent],
  templateUrl: "./home-page.component.html",
})
export class HomePageComponent {
  readonly data = inject(DatasetRepository);
  readonly navigation = inject(PortalNavigation);
  readonly regions = REGIONS;
  readonly regionCodes = Object.keys(this.regions).sort();
  readonly number = formatNumber;
  serviceText = "";
  filters = { province: "" };
  readonly nationalRegions = computed(() => this.data.summary()?.regions ?? []);
  readonly groupRegionLabels = computed(() =>
    this.nationalRegions().map((region) => REGIONS[region.key]),
  );
  readonly groupRegionValues = computed(() =>
    this.nationalRegions().map((region) => region.queues),
  );
  readonly homeChanges = computed(() =>
    (this.data.summary()?.shards ?? [])
      .filter((row) => row.matchedQueues > 0)
      .sort(
        (a, b) =>
          Math.abs(b.awaitingChange ?? 0) - Math.abs(a.awaitingChange ?? 0),
      )
      .slice(0, 6)
      .map((row) => {
        const [province, category, benefit] = row.key.split("/");
        return {
          ...row,
          province,
          category,
          benefit,
          name:
            this.data.benefits().find((item) => item.id === benefit)?.name ??
            benefit,
        };
      }),
  );
  homeChangeLink(change: {
    province: string;
    category: string;
    benefit: string;
  }): string {
    return this.navigation.link("radar", change);
  }
  regionSummary(code: string) {
    return this.nationalRegions().find((region) => region.key === code);
  }
  regionStyle(code: string) {
    const region = this.regionSummary(code);
    return {
      left: REGION_POSITIONS[code][0] + "%",
      top: REGION_POSITIONS[code][1] + "%",
      background: !region
        ? "#717985"
        : region.freshPercent >= 80
          ? "#222b36"
          : "#b60500",
    };
  }
  homeSearch(): void {
    const benefit =
      this.data.benefits().find((item) => item.name === this.serviceText) ??
      this.data.benefits()[0];
    void this.router.navigate(["/atlas"], {
      queryParams: {
        benefit: benefit?.id ?? "",
        province: this.filters.province,
        category: "1",
      },
    });
  }
  openRegion(code: string): void {
    void this.router.navigate(["/atlas"], {
      queryParams: {
        province: code,
        benefit: this.data.benefits()[0]?.id ?? "",
        category: "1",
      },
    });
  }
  private readonly router = inject(Router);
  constructor() {
    this.serviceText = this.data.benefits()[0]?.name ?? "";
  }
}
