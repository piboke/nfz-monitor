import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(root, "src/atlas-web/src/app");
const require = createRequire(resolve(root, "src/atlas-web/package.json"));
const ts = require("typescript");
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(resolve(directory, entry.name))
          : entry.name.endsWith(".ts")
            ? [resolve(directory, entry.name)]
            : [],
      ),
    )
  ).flat();
}
const errors = [];
const sources = await files(app);
for (const file of sources) {
  const name = relative(app, file);
  const layer = name.split(sep)[0];
  const text = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    )
      continue;
    const specifier = statement.moduleSpecifier?.text;
    if (!specifier?.startsWith(".")) continue;
    const target = relative(app, resolve(dirname(file), specifier));
    const targetLayer = target.split(sep)[0];
    if (layer === "core" && targetLayer !== "core")
      errors.push(`${name}: core nie może zależeć od ${target}.`);
    if (layer === "shared" && targetLayer === "modules")
      errors.push(
        `${name}: komponent współdzielony nie może zależeć od modułu funkcjonalnego.`,
      );
    if (layer === "modules" && targetLayer.startsWith("app.component"))
      errors.push(`${name}: moduł nie może zależeć od głównego komponentu.`);
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `Granice core / modules / shared poprawne (${sources.length} plików TypeScript).`,
);
