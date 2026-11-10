import test from "node:test";
import assert from "node:assert/strict";
import {
  ageRangeLabel,
  phoneContacts,
} from "../src/app/shared/formatting/contact.js";

test("age ranges have readable separators without interpreting missing ages", () => {
  assert.equal(
    ageRangeLabel("0-3,4-9,10-15,16-18"),
    "0–3, 4–9, 10–15, 16–18 lat",
  );
  assert.equal(ageRangeLabel(null), "NFZ nie podał zakresu wieku.");
  assert.equal(ageRangeLabel("od 18 roku życia"), "od 18 roku życia");
});
test("dial links preserve phone numbers but never append extension digits", () => {
  assert.deepEqual(phoneContacts("(22) 123-45-67 wew. 123"), [
    { label: "(22) 123-45-67 wew. 123", href: "tel:+48221234567" },
  ]);
  assert.equal(phoneContacts("+48 22 123 45 67")[0].href, "tel:+48221234567");
});
test("multiple contacts stay separate and unsafe or missing numbers cannot be dialled", () => {
  assert.equal(phoneContacts("221234567; 331234567").length, 2);
  assert.equal(phoneContacts("brak numeru")[0].href, null);
  assert.deepEqual(phoneContacts(null), []);
  assert.equal(phoneContacts("javascript:123456789")[0].href, null);
});

test("legacy Polish trunk prefix is removed only from the dial link", () => {
  assert.deepEqual(phoneContacts("0223277050"), [
    { label: "0223277050", href: "tel:+48223277050" },
  ]);
});
