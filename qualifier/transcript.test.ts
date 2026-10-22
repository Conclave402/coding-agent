// A3: the endpoint gives an equivalent answer when Kognai calls again.
// The evidence in qualifier/Qn/transcript.json is the real request and the real
// answer of the live endpoint, each captured after a verified and settled x402
// payment. These tests check the transcripts are complete and usable, not just
// that the files exist.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tasks = ["Q1", "Q2", "Q3", "Q4", "Q5"] as const;
const read = (task: string) =>
  JSON.parse(readFileSync(join(here, task, "transcript.json"), "utf8"));

test("A3: every qualifier task has a transcript of a settled request and answer", () => {
  for (const task of tasks) {
    const tr = read(task);
    assert.equal(tr.task, task, `${task}: task id`);
    assert.equal(tr.endpoint, "https://conclavex402.pythonanywhere.com/patch");
    assert.equal(tr.request.method, "POST");
    assert.equal(typeof tr.request.body.spec_md, "string");
    assert.ok(tr.request.body.spec_md.length > 20, `${task}: the spec that was sent`);
    assert.equal(tr.response.status, 200, `${task}: paid answer`);
    assert.equal(tr.payment.amount_atomic, "5000");
    assert.match(tr.payment.settlement, /^0x[0-9a-f]{64}$/i, `${task}: settlement hash`);
  }
});

test("A3: each answer is a patch with tests, not a refusal", () => {
  for (const task of tasks) {
    const { response } = read(task);
    assert.equal(response.body.refused, false, `${task}: not refused`);
    assert.match(response.body.patch, /^diff --git /, `${task}: unified diff`);
    if (task === "Q3") {
      // the offer is data, validated against the registry schema, so it adds no test file
      assert.equal(response.body.tests.length, 0, "Q3: an offer adds no test path");
    } else {
      assert.ok(response.body.tests.length > 0, `${task}: test paths named`);
    }
    assert.equal(typeof response.body.notes, "string");
    assert.ok(response.body.notes.length > 40, `${task}: notes explain the patch`);
  }
});

test("A3: every task answer names its own qualifier file", () => {
  for (const task of tasks) {
    const { response } = read(task);
    assert.ok(
      response.body.patch.includes(`qualifier/${task}/`),
      `${task}: the patch writes into qualifier/${task}/`,
    );
  }
});

test("Q3: the offer at the root and at its qualifier path cannot drift", () => {
  const root = JSON.parse(readFileSync(join(here, "..", "lax-offer.json"), "utf8"));
  const qual = JSON.parse(readFileSync(join(here, "Q3", "lax-offer.json"), "utf8"));
  assert.deepEqual(root, qual, "the two copies differ");
  assert.equal(root.capabilities[0].pricing.amount, "0.005", "the price the wire charges");
});
