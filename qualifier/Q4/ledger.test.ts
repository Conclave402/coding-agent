// A1: the ledger is idempotent by key, exact, and capped per account.
import test from "node:test";
import assert from "node:assert/strict";

import { createLedger } from "./ledger.ts";

test("A1 a post is applied once and the balance is exact", () => {
  const l = createLedger({ cap: "1000" });
  const r = l.post({ key: "k1", account: "a", amount: "250" });
  assert.equal(r.duplicate, false);
  assert.equal(typeof r.id, "string");
  assert.equal(l.balance("a"), "250");
  assert.equal(l.post({ key: "k2", account: "a", amount: "750" }).duplicate, false);
  assert.equal(l.balance("a"), "1000");
});

test("A1 the same key with the same payload posts once and keeps its id", () => {
  const l = createLedger({ cap: "1000" });
  const first = l.post({ key: "k1", account: "a", amount: "100" });
  const again = l.post({ key: "k1", account: "a", amount: "100" });
  assert.equal(again.duplicate, true);
  assert.equal(again.id, first.id);
  assert.equal(l.balance("a"), "100");
});

test("A1 the same key with another payload throws and changes nothing", () => {
  const l = createLedger({ cap: "1000" });
  l.post({ key: "k1", account: "a", amount: "100" });
  assert.throws(() => l.post({ key: "k1", account: "a", amount: "101" }));
  assert.throws(() => l.post({ key: "k1", account: "b", amount: "100" }));
  assert.equal(l.balance("a"), "100");
  assert.equal(l.balance("b"), "0");
});

test("A1 a post above the cap throws and changes nothing", () => {
  const l = createLedger({ cap: "100" });
  l.post({ key: "k1", account: "a", amount: "99" });
  assert.throws(() => l.post({ key: "k2", account: "a", amount: "2" }));
  assert.equal(l.balance("a"), "99");
  // The refused key is free to use with an amount that fits.
  assert.equal(l.post({ key: "k2", account: "a", amount: "1" }).duplicate, false);
  assert.equal(l.balance("a"), "100");
});

test("A1 the cap is per account", () => {
  const l = createLedger({ cap: "100" });
  l.post({ key: "k1", account: "a", amount: "100" });
  assert.equal(l.post({ key: "k2", account: "b", amount: "100" }).duplicate, false);
  assert.equal(l.balance("a"), "100");
  assert.equal(l.balance("b"), "100");
});

test("A1 an unknown account has a zero balance", () => {
  const l = createLedger({ cap: "10" });
  assert.equal(l.balance("nobody"), "0");
});

test("A1 amounts are positive integer strings only", () => {
  const l = createLedger({ cap: "1000" });
  for (const bad of ["0", "-1", "1.5", "", " 1", "1 ", "1e3", "0x10", "abc"]) {
    assert.throws(() => l.post({ key: "kb" + bad, account: "a", amount: bad }), undefined, JSON.stringify(bad));
  }
  assert.throws(() => createLedger({ cap: "0" }));
  assert.throws(() => createLedger({ cap: "-5" }));
  assert.equal(l.balance("a"), "0");
});

test("A1 a repeated key does not need the cap again", () => {
  const l = createLedger({ cap: "100" });
  l.post({ key: "k1", account: "a", amount: "100" });
  assert.equal(l.post({ key: "k1", account: "a", amount: "100" }).duplicate, true);
  assert.equal(l.balance("a"), "100");
});

test("A1 large amounts stay exact", () => {
  const l = createLedger({ cap: String(10n ** 25n + 1n) });
  l.post({ key: "k1", account: "a", amount: String(10n ** 24n + 1n) });
  l.post({ key: "k2", account: "a", amount: String(9n * 10n ** 24n) });
  assert.equal(l.balance("a"), String(10n ** 25n + 1n));
});

test("A1 empty keys and accounts are refused", () => {
  const l = createLedger({ cap: "10" });
  assert.throws(() => l.post({ key: "", account: "a", amount: "1" }));
  assert.throws(() => l.post({ key: "k", account: "", amount: "1" }));
  assert.throws(() => l.balance(""));
});
