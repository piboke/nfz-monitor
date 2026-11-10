import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { filterRows } from "../../../core/analytics/queue-analytics";
import { DatasetRepository } from "../../../core/data/dataset.repository";
import { LatestRequest } from "../../../core/data/latest-request";
import { errorMessage } from "../../../core/errors/error-message";
import {
  DEFAULT_REPORT_SETTINGS,
  type ExplorerMode,
  type QueueSort,
  type ReportSettings,
} from "../../../core/models/analysis.models";
import {
  EMPTY_FILTERS,
  type Filters,
  type HistoryPoint,
  type QualityEvent,
  type QueueRow,
} from "../../../core/models/dataset.models";
import {
  parseExplorerQuery,
  serializeExplorerQuery,
} from "../../../core/routing/explorer-query";
import { PortalNavigation } from "../../../core/routing/portal-navigation.service";

/** State scoped to one explorer page. Only applied filters drive derived data. */
@Injectable()
export class QueueWorkspace {
  readonly data = inject(DatasetRepository);
  readonly navigation = inject(PortalNavigation);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new LatestRequest();
  private remoteKey = "";
  readonly mode = signal<ExplorerMode>("atlas");
  readonly loading = signal(false);
  readonly error = signal("");
  readonly rows = signal<QueueRow[]>([]);
  readonly history = signal<HistoryPoint[]>([]);
  readonly qualityEvents = signal<QualityEvent[]>([]);
  readonly appliedFilters = signal<Filters>({ ...EMPTY_FILTERS });
  readonly settings = signal<ReportSettings>({ ...DEFAULT_REPORT_SETTINGS });
  filters: Filters = { ...EMPTY_FILTERS };
  serviceText = "";
  readonly benefits = this.data.benefits;
  private readonly pageState = signal(1);
  private readonly pageSizeState = signal(20);
  private readonly sortState = signal<QueueSort>("pcusDays");
  private readonly descendingState = signal(false);
  display: "list" | "map" = "list";
  readonly filtered = computed(() => {
    const filters = { ...this.appliedFilters() };
    if (this.mode() === "reports" && this.settings().additionalBenefits.length)
      filters.benefit = "";
    const providers =
      this.mode() === "reports" ? this.settings().reportProviders : [];
    return filterRows(this.rows(), filters).filter(
      (row) =>
        !providers.length ||
        providers.includes(row.province + "|" + row.providerCode),
    );
  });
  readonly counties = computed(() =>
    [
      ...new Set(
        this.rows()
          .filter(
            (row) =>
              !this.appliedFilters().province ||
              row.province === this.appliedFilters().province,
          )
          .map((row) => row.county),
      ),
    ]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pl")),
  );
  readonly providerOptions = computed(() =>
    [
      ...new Map(
        this.rows().map((row) => [
          row.province + "|" + row.providerCode,
          {
            id: row.province + "|" + row.providerCode,
            name:
              row.provider +
              " · NFZ: " +
              row.providerCode +
              " · " +
              row.locality,
          },
        ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name, "pl")),
  );
  readonly periods = computed(() =>
    [
      ...new Set(
        this.history()
          .map((point) =>
            this.settings().metric === "pcusDays"
              ? point.pcusUpdatedAt
              : point.reportingPeriod,
          )
          .filter((period): period is string => !!period),
      ),
    ].sort(),
  );
  readonly sorted = computed(() => {
    const key = this.sortState();
    const descending = this.descendingState();
    return [...this.filtered()].sort((a, b) => {
      const left = a[key],
        right = b[key];
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      const difference =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "pl");
      return descending ? -difference : difference;
    });
  });
  readonly paged = computed(() =>
    this.sorted().slice(
      (this.pageState() - 1) * this.pageSizeState(),
      this.pageState() * this.pageSizeState(),
    ),
  );
  readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSizeState())),
  );
  readonly reportServices = computed(() =>
    [
      ...new Set([
        this.appliedFilters().benefit,
        ...this.settings().additionalBenefits,
      ]),
    ]
      .map((id) => this.benefits().find((benefit) => benefit.id === id)?.name)
      .filter(Boolean)
      .join("; "),
  );
  constructor() {
    this.destroyRef.onDestroy(() => this.requests.invalidate());
  }
  connect(mode: ExplorerMode): void {
    this.mode.set(mode);
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const query = new URLSearchParams();
        for (const key of params.keys) query.set(key, params.get(key) ?? "");
        void this.restore(query);
      });
  }
  private async restore(params: URLSearchParams): Promise<void> {
    const query = parseExplorerQuery(params);
    if (!query.filters.benefit)
      query.filters.benefit = this.benefits()[0]?.id ?? "";
    query.settings.additionalBenefits =
      query.settings.additionalBenefits.filter((id) =>
        this.benefits().some((benefit) => benefit.id === id),
      );
    this.filters = query.filters;
    this.serviceText =
      this.benefits().find((benefit) => benefit.id === this.filters.benefit)
        ?.name ?? "";
    this.settings.set(query.settings);
    this.appliedFilters.set({ ...this.filters });
    await this.fetchScope(false);
  }
  async load(): Promise<void> {
    this.additionalBenefits = this.additionalBenefits.slice(0, 4);
    this.localFilters(false);
    const task = this.fetchScope(true);
    void this.updateUrl();
    await task;
  }
  private async fetchScope(force: boolean): Promise<void> {
    const services = [
      ...new Set([
        this.filters.benefit,
        ...(this.mode() === "reports" ? this.additionalBenefits : []),
      ]),
    ];
    const key = JSON.stringify([
      services,
      this.filters.province,
      this.filters.category,
      this.mode() !== "atlas",
    ]);
    if (!force && this.remoteKey === key) return;
    this.remoteKey = key;
    const request = this.requests.begin();
    this.loading.set(true);
    this.error.set("");
    this.page = 1;
    try {
      if (!this.filters.benefit)
        throw new Error("Wybierz świadczenie z listy podpowiedzi.");
      const scope = services.flatMap((benefit) =>
        this.data.shards(benefit, this.filters.province, this.filters.category),
      );
      const result = await this.data.load(scope, this.mode() !== "atlas");
      if (!this.requests.isCurrent(request)) return;
      this.rows.set(result.rows);
      this.history.set(result.history);
      this.qualityEvents.set(result.events);
      this.configurePeriods();
    } catch (error) {
      if (!this.requests.isCurrent(request)) return;
      this.remoteKey = "";
      this.rows.set([]);
      this.history.set([]);
      this.qualityEvents.set([]);
      this.error.set(errorMessage(error));
    } finally {
      if (this.requests.isCurrent(request)) this.loading.set(false);
    }
  }
  localFilters(syncUrl = true): void {
    this.filters.min = this.filters.min == null ? "" : String(this.filters.min);
    this.filters.max = this.filters.max == null ? "" : String(this.filters.max);
    this.appliedFilters.set({ ...this.filters });
    this.page = 1;
    if (syncUrl) void this.updateUrl();
  }
  updateUrl(): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeExplorerQuery({
        filters: this.filters,
        settings: this.settings(),
      }),
      replaceUrl: true,
    });
  }
  async serviceChanged(): Promise<void> {
    const match = this.benefits().find(
      (benefit) =>
        benefit.name.toLocaleLowerCase("pl") ===
        this.serviceText.toLocaleLowerCase("pl"),
    );
    this.filters.benefit = match?.id ?? "";
    if (match) await this.load();
  }
  async reset(): Promise<void> {
    this.settings.set({
      ...DEFAULT_REPORT_SETTINGS,
      additionalBenefits: [],
      reportProviders: [],
    });
    this.filters = { ...EMPTY_FILTERS, benefit: this.benefits()[0]?.id ?? "" };
    this.serviceText = this.benefits()[0]?.name ?? "";
    await this.load();
  }
  setSort(key: QueueSort): void {
    this.descendingState.set(
      this.sortState() === key ? !this.descendingState() : false,
    );
    this.sortState.set(key);
    this.page = 1;
  }
  configurePeriods(): void {
    const periods = this.periods();
    if (!periods.includes(this.from))
      this.from =
        periods.length > 1 ? periods[periods.length - 2] : (periods[0] ?? "");
    if (!periods.includes(this.to)) this.to = periods.at(-1) ?? "";
  }
  metricChanged(): void {
    this.configurePeriods();
    void this.updateUrl();
  }
  templateChanged(): void {
    this.group =
      this.reportTemplate === 3
        ? "county"
        : this.reportTemplate === 4
          ? "facility"
          : "province";
    this.chartType = this.reportTemplate === 1 ? "bar" : "line";
    void this.updateUrl();
  }
  async share(): Promise<void> {
    await this.updateUrl();
    try {
      await this.navigation.copyCurrentUrl();
    } catch {
      this.error.set(
        "Skopiuj adres widoczny w pasku przeglądarki — zawiera konfigurację widoku.",
      );
    }
  }
  get page(): number {
    return this.pageState();
  }
  set page(value: number) {
    this.pageState.set(value);
  }
  get pageSize(): number {
    return this.pageSizeState();
  }
  set pageSize(value: number) {
    this.pageSizeState.set(value);
  }
  get additionalBenefits(): string[] {
    return this.settings().additionalBenefits;
  }
  set additionalBenefits(value: string[]) {
    this.settings.update((settings) => ({
      ...settings,
      additionalBenefits: value,
    }));
  }
  get reportProviders(): string[] {
    return this.settings().reportProviders;
  }
  set reportProviders(value: string[]) {
    this.settings.update((settings) => ({
      ...settings,
      reportProviders: value,
    }));
  }
  get from(): string {
    return this.settings().from;
  }
  set from(value: string) {
    this.settings.update((settings) => ({ ...settings, from: value }));
  }
  get to(): string {
    return this.settings().to;
  }
  set to(value: string) {
    this.settings.update((settings) => ({ ...settings, to: value }));
  }
  get metric(): ReportSettings["metric"] {
    return this.settings().metric;
  }
  set metric(value: ReportSettings["metric"]) {
    this.settings.update((settings) => ({ ...settings, metric: value }));
  }
  get group(): ReportSettings["group"] {
    return this.settings().group;
  }
  set group(value: ReportSettings["group"]) {
    this.settings.update((settings) => ({ ...settings, group: value }));
  }
  get reportTemplate(): number {
    return this.settings().reportTemplate;
  }
  set reportTemplate(value: number) {
    this.settings.update((settings) => ({
      ...settings,
      reportTemplate: value,
    }));
  }
  get chartType(): ReportSettings["chartType"] {
    return this.settings().chartType;
  }
  set chartType(value: ReportSettings["chartType"]) {
    this.settings.update((settings) => ({ ...settings, chartType: value }));
  }
}
