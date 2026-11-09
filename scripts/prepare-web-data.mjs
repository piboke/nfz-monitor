import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "data"),
  target = resolve(root, "src/atlas-web/public/data");
const manifest = JSON.parse(
  await readFile(resolve(source, "manifest.json"), "utf8"),
);
if (
  manifest.schemaVersion !== "1.0" ||
  !/^[a-zA-Z0-9_-]*$/.test(manifest.generation)
)
  throw new Error("Nieprawidłowy manifest.");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(resolve(source, "manifest.json"), resolve(target, "manifest.json"));
if (manifest.generation)
  await cp(
    resolve(source, "aggregates", manifest.generation),
    resolve(target, "aggregates", manifest.generation),
    { recursive: true },
  );
console.log(
  `Dane frontendu: ${manifest.queueCount} kolejek; zakres krajowy: ${manifest.national}. Archiwum źródłowe nie jest kopiowane.`,
);
