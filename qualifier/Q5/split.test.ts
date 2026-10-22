// A2: splitFees splits an integer total by whole percentages, keeps the total exact
// by giving the remainder to the first share, and refuses bad input. These tests pass
// on the reference below and must fail on a copy with any of the planted bugs.
import test from "node:test";
import assert from "node:assert/strict";

import { splitFees } from "./split.ts";

test("A2 an exact split has no remainder", () => {
  assert.deepEqual(splitFees(1000n, [50, 50]), [500n, 500n]);
  assert.deepEqual(splitFees(100n, [25, 25, 25, 25]), [25n, 25n, 25n, 25n]);
  assert.deepEqual(splitFees(12345n, [100]), [12345n]);
});

test("A2 the remainder goes to the first share and the total is preserved", () => {
  assert.deepEqual(splitFees(101n, [33, 33, 34]), [34n, 33n, 34n]);
  assert.deepEqual(splitFees(199n, [50, 50]), [100n, 99n]);
  assert.deepEqual(splitFees(5n, [50, 50]), [3n, 2n]);
  assert.deepEqual(splitFees(1n, [33, 33, 34]), [1n, 0n, 0n]);
});

test("A2 the shares of every accepted split add up to the total exactly", () => {
  const cases: Array<[bigint, number[]]> = [
    [1n, [50, 50]],
    [7n, [33, 33, 34]],
    [999n, [10, 20, 30, 40]],
    [123456789n, [1, 99]],
    [10n ** 25n + 1n, [50, 50]],
  ];
  for (const [total, shares] of cases) {
    const out = splitFees(total, shares);
    assert.equal(out.length, shares.length);
    assert.equal(out.reduce((a, b) => a + b, 0n), total, String(total));
    for (const part of out) assert.equal(typeof part, "bigint");
  }
});

test("A2 shares are floored, never rounded up", () => {
  assert.deepEqual(splitFees(199n, [50, 50]), [100n, 99n]);
  assert.deepEqual(splitFees(2n, [50, 50]), [1n, 1n]);
  assert.deepEqual(splitFees(3n, [50, 50]), [2n, 1n]);
  // A share whose own remainder is above 50 must still be floored, not rounded up.
  assert.deepEqual(splitFees(101n, [33, 67]), [34n, 67n]);
  assert.deepEqual(splitFees(7n, [67, 33]), [5n, 2n]);
  assert.deepEqual(splitFees(123456789n, [1, 99]), [1234568n, 122222221n]);
});

test("A2 a zero share is allowed and a zero total splits to zeros", () => {
  assert.deepEqual(splitFees(1000n, [100, 0]), [1000n, 0n]);
  assert.deepEqual(splitFees(0n, [50, 50]), [0n, 0n]);
  assert.deepEqual(splitFees(0n, [100]), [0n]);
});

test("A2 amounts beyond the safe integer range stay exact", () => {
  const total = 10n ** 25n + 1n;
  const out = splitFees(total, [50, 50]);
  assert.deepEqual(out, [5000000000000000000000001n, 5000000000000000000000000n]);
});

test("A2 a negative total throws", () => {
  assert.throws(() => splitFees(-1n, [50, 50]), /negative total/);
  assert.throws(() => splitFees(-1000n, [100]), /negative total/);
});

test("A2 no shares at all throws", () => {
  assert.throws(() => splitFees(100n, []), /bad shares/);
});

test("A2 shares that do not add up to 100 throw", () => {
  assert.throws(() => splitFees(100n, [50, 49]), /sum to 100/);
  assert.throws(() => splitFees(100n, [50, 51]), /sum to 100/);
  assert.throws(() => splitFees(100n, [100, 1]), /sum to 100/);
  assert.throws(() => splitFees(100n, [50]), /sum to 100/);
});

test("A2 a share that is not a whole number throws", () => {
  assert.throws(() => splitFees(100n, [50.5, 49.5]), /bad shares/);
  assert.throws(() => splitFees(100n, [33.3, 33.3, 33.4]), /bad shares/);
});

test("A2 a negative share throws", () => {
  assert.throws(() => splitFees(100n, [150, -50]), /bad shares/);
  assert.throws(() => splitFees(100n, [-1, 101]), /bad shares/);
});

test("A2 a share that is not a number throws", () => {
  assert.throws(() => splitFees(100n, [Number.NaN, 100]), /bad shares/);
  assert.throws(() => splitFees(100n, [Number.POSITIVE_INFINITY, 0]), /bad shares/);
});

test("A2 the caller's shares array is not modified", () => {
  const shares = [70, 30];
  splitFees(1001n, shares);
  assert.deepEqual(shares, [70, 30]);
});
