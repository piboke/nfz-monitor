import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { periodSeries } from "../../../../core/analytics/queue-analytics";
import { DatasetRepository } from "../../../../core/data/dataset.repository";
import { LatestRequest } from "../../../../core/data/latest-request";
import { errorMessage } from "../../../../core/errors/error-message";
import {
  REGIONS,
  type HistoryPoint,
  type QueueRow,
} from "../../../../core/models/dataset.models";
import { PortalNavigation } from "../../../../core/routing/portal-navigation.service";
import { ChartComponent } from "../../../../shared/components/chart/chart.component";
import { ContactComponent } from "../../../../shared/components/contact/contact.component";
import { ageRangeLabel } from "../../../../shared/formatting/contact";
import { formatNumber } from "../../../../shared/formatting/numbers";
import { QueueComparisonStore } from "../../../atlas/services/queue-comparison.store";

@Component({
  selector: "app-facility-page",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ContactComponent, ChartComponent],
  styleUrl: "./facility-page.component.scss",
  templateUrl: "./facility-page.component.html",
})
export class FacilityPageComponent {
  readonly data = inject(DatasetRepository);
  readonly comparison = inject(QueueComparisonStore);
  readonly navigation = inject(PortalNavigation);
  readonly number = formatNumber;
  readonly ageRangeLabel = ageRangeLabel;
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new LatestRequest();
  readonly loading = signal(false);
  readonly error = signal("");
  readonly detailRows = signal<QueueRow[]>([]);
  readonly detailHistory = signal<HistoryPoint[]>([]);
  readonly detail = signal<QueueRow | null>(null);
  readonly detailSeries = computed(() => {
    const queue = this.detail();
    return queue
      ? periodSeries(
          this.detailHistory().filter(
            (point) =>
              point.id === queue.id &&
              point.case === queue.case &&
              point.facilityId === queue.facilityId &&
              point.benefitId === queue.benefitId,
          ),
          "awaiting",
        )
      : [];
  });
  readonly detailLabels = computed(() =>
    this.detailSeries().map((point) => point.period),
  );
  readonly detailValues = computed(() =>
    this.detailSeries().map((point) => point.value),
  );
  constructor() {
    this.destroyRef.onDestroy(() => this.requests.invalidate());
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        void this.load(
          params.get("province") ?? "",
          params.get("code") ?? "",
          params.get("queue") ?? "",
        );
      });
  }
  private async load(
    province: string,
    code: string,
    queueId: string,
  ): Promise<void> {
    const request = this.requests.begin();
    this.loading.set(true);
    this.error.set("");
    this.detail.set(null);
    try {
      if (!Object.hasOwn(REGIONS, province) || !code)
        throw new Error(
          "Link nie zawiera prawidłowego województwa i kodu placówki.",
        );
      const result = await this.data.provider(province, code);
      if (!this.requests.isCurrent(request)) return;
      this.detailRows.set(result.rows);
      this.detailHistory.set(result.history);
      this.detail.set(
        result.rows.find((row) => row.id === queueId) ?? result.rows[0] ?? null,
      );
      if (!result.rows.length)
        this.error.set("Brak kolejek placówki w dostępnym zbiorze.");
    } catch (error) {
      if (this.requests.isCurrent(request)) this.error.set(errorMessage(error));
    } finally {
      if (this.requests.isCurrent(request)) this.loading.set(false);
    }
  }
  chooseDetail(row: QueueRow): void {
    this.detail.set(row);
  }
}
