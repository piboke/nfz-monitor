import { Injectable, signal } from "@angular/core";
import type { QueueRow } from "../../../core/models/dataset.models";
@Injectable({ providedIn: "root" })
export class QueueComparisonStore {
  private readonly selectedState = signal<QueueRow[]>([]);
  readonly selected = this.selectedState.asReadonly();
  readonly limit = 4;
  contains(row: QueueRow): boolean {
    return this.selected().some(
      (item) => item.id === row.id && item.case === row.case,
    );
  }
  toggle(row: QueueRow): void {
    if (this.contains(row))
      this.selectedState.update((rows) =>
        rows.filter((item) => item.id !== row.id || item.case !== row.case),
      );
    else if (this.selected().length < this.limit)
      this.selectedState.update((rows) => [...rows, row]);
  }
  clear(): void {
    this.selectedState.set([]);
  }
}
