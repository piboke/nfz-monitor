import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../data");
const m = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
if (m.schemaVersion !== "1.0" || !m.complete)
  throw new Error("Niekompletny lub nieobsługiwany zbiór.");
if (
  m.national &&
  (m.regions.length !== 16 || new Set(m.shards.map((s) => s.case)).size !== 2)
)
  throw new Error("Nieprawidłowy zakres krajowy.");
if (m.shards.reduce((n, s) => n + s.count, 0) !== m.queueCount)
  throw new Error("Niezgodna liczba kolejek.");
for (const s of m.shards) {
  for (const p of [s.path, s.historyPath]) {
    if (!p.startsWith(`aggregates/${m.generation}/`) || p.includes(".."))
      throw new Error("Nieprawidłowa ścieżka.");
    await stat(resolve(root, p));
  }
  const rows = JSON.parse(await readFile(resolve(root, s.path), "utf8"));
  if (rows.length !== s.count) throw new Error("Niekompletny shard.");
}
console.log(
  `Manifest i ${m.shards.length} shardów poprawne; ${m.queueCount} kolejek; krajowy: ${m.national}.`,
);
