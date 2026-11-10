import { Injectable, computed, signal } from "@angular/core";
import { errorMessage } from "../errors/error-message";
import {
  HistoryPoint,
  Manifest,
  QualityEvent,
  QueueRow,
  Shard,
  Summary,
} from "../models/dataset.models";
import { providerFileKey } from "./provider-file-key";
@Injectable({ providedIn: "root" })
export class DatasetRepository {
  private readonly manifestState = signal<Manifest | null>(null);
  readonly manifest = this.manifestState.asReadonly();
  private readonly summaryState = signal<Summary | null>(null);
  readonly summary = this.summaryState.asReadonly();
  private readonly errorState = signal<string>("");
  readonly error = this.errorState.asReadonly();
  readonly benefits = computed(() =>
    [
      ...new Map(
        (this.manifest()?.shards ?? []).map((shard) => [
          shard.benefitId,
          { id: shard.benefitId, name: shard.benefit },
        ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name, "pl")),
  );
  private initialization: Promise<void> | undefined;
  private cache = new Map<string, Promise<unknown>>();
  async read<T>(path: string): Promise<T> {
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.includes(".."))
      throw new Error("Nieprawidłowa ścieżka danych.");
    if (!this.cache.has(path)) {
      const task = fetch(new URL("data/" + path, document.baseURI), {
        signal: AbortSignal.timeout(30_000),
      })
        .catch(() => {
          throw new Error(
            "Nie udało się pobrać danych w wymaganym czasie. Sprawdź połączenie i spróbuj ponownie.",
          );
        })
        .then(async (r) => {
          if (!r.ok)
            throw new Error(
              "Nie udało się pobrać danych (" +
                r.status +
                "). Spróbuj ponownie.",
            );
          return r.json();
        })
        .catch((e) => {
          this.cache.delete(path);
          throw e;
        });
      this.cache.set(path, task);
    }
    return (await this.cache.get(path)) as T;
  }
  ensureInitialized(): Promise<void> {
    return (this.initialization ??= this.init());
  }
  async init() {
    this.errorState.set("");
    this.cache.delete("manifest.json");
    try {
      const m = await this.read<Manifest>("manifest.json");
      if (m.schemaVersion !== "1.0")
        throw new Error("Nieobsługiwana wersja danych. Odśwież aplikację.");
      this.manifestState.set(m);
      if (m.generation)
        this.summaryState.set(
          await this.read<Summary>(`aggregates/${m.generation}/summary.json`),
        );
    } catch (e) {
      this.errorState.set(errorMessage(e));
    }
  }
  shards(benefit: string, province: string, category: string) {
    return (this.manifest()?.shards || []).filter(
      (s) =>
        s.benefitId === benefit &&
        (!province || s.province === province) &&
        (!category || String(s.case) === category),
    );
  }
  async load(shards: Shard[], history = false) {
    if (
      shards.length > 256 ||
      shards.reduce((n, s) => n + s.bytes, 0) > 30 * 1024 * 1024
    )
      throw new Error(
        "Zawęź zakres do jednego świadczenia i mniejszego obszaru.",
      );
    const rows: QueueRow[] = [];
    const points: HistoryPoint[] = [];
    const events: QualityEvent[] = [];
    for (let i = 0; i < shards.length; i += 4) {
      const batch = shards.slice(i, i + 4);
      rows.push(
        ...(
          await Promise.all(batch.map((s) => this.read<QueueRow[]>(s.path)))
        ).flat(),
      );
      if (history)
        points.push(
          ...(
            await Promise.all(
              batch.map((s) => this.read<HistoryPoint[]>(s.historyPath)),
            )
          ).flat(),
        );
    }
    if (history)
      for (let i = 0; i < shards.length; i += 4) {
        events.push(
          ...(
            await Promise.all(
              shards
                .slice(i, i + 4)
                .map(async (shard) =>
                  (
                    await this.read<QualityEvent[]>(
                      shard.path.replace(/\.json$/, ".quality.json"),
                    )
                  ).map((event) => ({ ...event, category: shard.case })),
                ),
            )
          ).flat(),
        );
      }
    return { rows, history: points, events };
  }
  async provider(province: string, code: string) {
    const fileKey = providerFileKey(code);
    return this.read<{ rows: QueueRow[]; history: HistoryPoint[] }>(
      `aggregates/${this.manifest()!.generation}/providers/${province}/${fileKey}.json`,
    );
  }
}
