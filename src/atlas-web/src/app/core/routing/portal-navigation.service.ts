import { ViewportScroller } from "@angular/common";
import { Injectable, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs";
import type { QueueRow } from "../models/dataset.models";
@Injectable({ providedIn: "root" })
export class PortalNavigation {
  private readonly router = inject(Router);
  readonly copied = signal(false);
  constructor() {
    const viewport = inject(ViewportScroller);
    let previousPage = "";
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const page = event.urlAfterRedirects.split("?")[0];
        if (page !== previousPage) viewport.scrollToPosition([0, 0]);
        previousPage = page;
      });
  }
  link(path: string, queryParams: Record<string, string>): string {
    return (
      "#" +
      this.router.serializeUrl(
        this.router.createUrlTree(["/" + path], { queryParams }),
      )
    );
  }
  facilityLink(row: QueueRow): string {
    return this.link("facility", {
      province: row.province,
      code: row.providerCode,
      queue: row.id,
    });
  }
  comparisonLink(row: QueueRow): string {
    return this.link("atlas", {
      benefit: row.benefitId,
      province: row.province,
      category: String(row.case),
    });
  }
  async openFacility(row: QueueRow): Promise<boolean> {
    return this.router.navigate(["/facility"], {
      queryParams: {
        province: row.province,
        code: row.providerCode,
        queue: row.id,
      },
    });
  }
  async copyCurrentUrl(): Promise<void> {
    await navigator.clipboard.writeText(location.href);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }
}
