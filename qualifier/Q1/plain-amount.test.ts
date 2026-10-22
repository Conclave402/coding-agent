// A1: base unit amounts render as plain amounts with Latin digits, comma grouping,
// 2..decimals fraction digits and the word "minus" for negatives, and nothing else
// is accepted.
import test from "node:test";
import assert from "node:assert/strict";

import { plainAmount } from "./plain-amount.ts";

test("A1 whole and fractional base units use the decimals argument", () => {
  assert.equal(plainAmount("1000000", 6, "USDC"), "1.00 USDC");
  assert.equal(plainAmount("1234567", 6, "USDC"), "1.234567 USDC");
  assert.equal(plainAmount("1234500", 2, "USDC"), "12,345.00 USDC");
  assert.equal(plainAmount("1", 2, "USDC"), "0.01 USDC");
  assert.equal(plainAmount("0", 6, "USDC"), "0.00 USDC");
});

test("A1 zeros beyond the second fraction digit are removed", () => {
  assert.equal(plainAmount("1234500", 6, "USDC"), "1.2345 USDC");
  assert.equal(plainAmount("1234000", 6, "USDC"), "1.234 USDC");
  assert.equal(plainAmount("1000001", 6, "USDC"), "1.000001 USDC");
});

test("A1 thousands are grouped with commas", () => {
  assert.equal(plainAmount("1000000000000", 2, "USDC"), "10,000,000,000.00 USDC");
  assert.equal(plainAmount("999999", 2, "USDC"), "9,999.99 USDC");
  assert.equal(plainAmount("100000", 2, "USDC"), "1,000.00 USDC");
});

test("A1 a negative value is the word minus and never contains a dash", () => {
  const out = plainAmount("-123450", 2, "USDC");
  assert.equal(out, "minus 1,234.50 USDC");
  assert.equal(out.includes("-"), false);
  assert.equal(plainAmount("-1", 2, "USDC").includes("-"), false);
});

test("A1 negative zero is zero", () => {
  assert.equal(plainAmount("-0", 2, "USDC"), "0.00 USDC");
  assert.equal(plainAmount("-0", 6, "USDC"), "0.00 USDC");
});

test("A1 Arabic Indic and extended Arabic Indic digits are read as Latin digits", () => {
  assert.equal(plainAmount("\u0661\u0662\u0663\u0664\u0665\u0660\u0660", 2, "USDC"), "12,345.00 USDC");
  assert.equal(plainAmount("\u06F1\u06F2\u06F3\u06F4\u06F5\u06F0\u06F0", 2, "USDC"), "12,345.00 USDC");
  assert.equal(plainAmount("\u0661\u0662\u0663", 0, ""), "123");
});

test("A1 every rendered digit is a Latin digit", () => {
  const out = plainAmount("\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669\u0660", 2, "USDC");
  assert.match(out, /^[0-9,. A-Z]+$/);
});

test("A1 invalid amounts and arguments throw", () => {
  for (const bad of ["", "-", "1.5", "12a", " 12", "12 ", "+12", "1,000", "--1", "\u0661a"]) {
    assert.throws(() => plainAmount(bad, 2, "USDC"), undefined, JSON.stringify(bad));
  }
  assert.throws(() => plainAmount("1", -1, "USDC"));
  assert.throws(() => plainAmount("1", 1.5, "USDC"));
  assert.throws(() => plainAmount(null as unknown as string, 2, "USDC"));
  assert.throws(() => plainAmount("1", 2, undefined as unknown as string));
});

test("A1 decimals of zero renders whole units only", () => {
  assert.equal(plainAmount("1234", 0, "USDC"), "1,234 USDC");
  assert.equal(plainAmount("-1234", 0, "USDC"), "minus 1,234 USDC");
});
