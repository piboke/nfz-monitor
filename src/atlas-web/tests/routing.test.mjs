import assert from "node:assert/strict";
import test from "node:test";
import {
  parseExplorerQuery,
  serializeExplorerQuery,
} from "../src/app/core/routing/explorer-query.js";
import { LatestRequest } from "../src/app/core/data/latest-request.js";
import { queueFreshness } from "../src/app/shared/formatting/numbers.js";

test("a shared report URL preserves services, provider codes, periods and chart configuration", () => {
  const query = new URLSearchParams(
    "benefit=abc&province=06&category=2&county=ŁÓDŹ&providers=06%7C061%2F100043&services=def,ghi&from=2026-09&to=2026-10&metric=removed&group=facility&template=4&chart=bar",
  );
  const parsed = parseExplorerQuery(query);
  const restored = parseExplorerQuery(
    new URLSearchParams(serializeExplorerQuery(parsed)),
  );
  assert.deepEqual(restored, parsed);
  assert.equal(restored.settings.reportProviders[0], "06|061/100043");
  assert.equal(restored.settings.chartType, "bar");
});
test("invalid URL configuration cannot produce NaN templates or negative day bounds", () => {
  const parsed = parseExplorerQuery(
    new URLSearchParams(
      "province=99&category=9&template=Infinity&metric=foo&group=foo&min=-5&max=Infinity&chart=invalid&services=a,a,b,c,d,e",
    ),
  );
  assert.equal(parsed.filters.province, "");
  assert.equal(parsed.filters.category, "1");
  assert.equal(parsed.settings.reportTemplate, 0);
  assert.equal(parsed.settings.metric, "awaiting");
  assert.equal(parsed.filters.min, "");
  assert.equal(parsed.filters.max, "");
  assert.equal(parsed.settings.chartType, "line");
  assert.deepEqual(parsed.settings.additionalBenefits, ["a", "b", "c", "d"]);
});
test("a delayed older response cannot overwrite a newer selected scope", async () => {
  const requests = new LatestRequest();
  let resolveOld;
  const old = new Promise((resolve) => {
    resolveOld = resolve;
  });
  let visible = "";
  const first = requests.begin();
  const pending = old.then((value) => {
    if (requests.isCurrent(first)) visible = value;
  });
  const second = requests.begin();
  if (requests.isCurrent(second)) visible = "nowa placówka";
  resolveOld("poprzednia placówka");
  await pending;
  assert.equal(visible, "nowa placówka");
  requests.invalidate();
  assert.equal(requests.isCurrent(second), false);
});
test("future reporting periods and missing source dates are never treated as current", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  assert.equal(
    queueFreshness(
      { reportingPeriod: "2026-10", pcusUpdatedAt: "2026-11-01" },
      now,
    ),
    "Dane aktualne",
  );
  assert.equal(
    queueFreshness(
      { reportingPeriod: "2027-01", pcusUpdatedAt: "2026-11-01" },
      now,
    ),
    "Dane opóźnione",
  );
  assert.equal(
    queueFreshness({ reportingPeriod: "2026-10", pcusUpdatedAt: null }, now),
    "Brak dat",
  );
});
