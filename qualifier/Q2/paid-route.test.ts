// A4: the route answers 402 when unpaid, verifies then settles when paid, answers
// 200 with X-PAYMENT-RESPONSE only after a real settlement, and never charges twice.
import test from "node:test";
import assert from "node:assert/strict";

import { createPaidRoute } from "./paid-route.ts";

const PAY_TO = "0x1111111111111111111111111111111111111111";
const ASSET = "0x2222222222222222222222222222222222222222";

function paidHeader(payload: unknown = { x402Version: 2, scheme: "exact" }): string {
  return Buffer.from(JSON.stringify(payload), "binary").toString("base64");
}

function stubFacilitator(
  verifyResult: unknown = { isValid: true },
  settleResult: unknown = { success: true, transaction: "0xdead", network: "base", payer: "0xabc" },
) {
  const calls: string[] = [];
  return {
    calls,
    facilitator: {
      async verify() {
        calls.push("verify");
        return verifyResult;
      },
      async settle() {
        calls.push("settle");
        return settleResult;
      },
    },
  };
}

function route(extra: Record<string, unknown> = {}) {
  const { calls, facilitator } = stubFacilitator();
  const fn = createPaidRoute({
    price: "5000",
    payTo: PAY_TO,
    network: "eip155:8453",
    asset: ASSET,
    facilitator,
    ...extra,
  });
  return { fn, calls };
}

test("A4 an unpaid request is a 402 with the payment requirements", async () => {
  const { fn, calls } = route();
  const res = await fn(new Request("https://agent.example/patch", { method: "POST" }));
  assert.equal(res.status, 402);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  const body = await res.json();
  assert.equal(body.x402Version, 2);
  assert.equal(body.accepts.length, 1);
  assert.equal(body.accepts[0].scheme, "exact");
  assert.equal(body.accepts[0].network, "eip155:8453");
  assert.equal(body.accepts[0].maxAmountRequired, "5000");
  assert.equal(body.accepts[0].payTo, PAY_TO);
  assert.equal(body.accepts[0].asset, ASSET);
  assert.equal(body.accepts[0].resource, "https://agent.example/patch");
  assert.equal(calls.length, 0, "nothing is verified before a payment is offered");
});

test("A4 a verified and settled payment is a 200 with X-PAYMENT-RESPONSE", async () => {
  const { fn, calls } = route();
  const res = await fn(
    new Request("https://agent.example/patch", { method: "POST", headers: { "X-PAYMENT": paidHeader() } }),
  );
  assert.equal(res.status, 200);
  const receiptHeader = res.headers.get("x-payment-response");
  assert.ok(receiptHeader, "X-PAYMENT-RESPONSE header is set");
  const receipt = JSON.parse(Buffer.from(receiptHeader!, "base64").toString("binary"));
  assert.equal(receipt.success, true);
  assert.equal(receipt.transaction, "0xdead");
  assert.equal(receipt.network, "base");
  assert.deepEqual(calls, ["verify", "settle"], "verify runs before settle, once each");
});

test("A4 a payment that does not verify is a 402 and is never settled", async () => {
  const { facilitator, calls } = stubFacilitator({ isValid: false });
  const fn = createPaidRoute({
    price: "5000",
    payTo: PAY_TO,
    network: "eip155:8453",
    asset: ASSET,
    facilitator,
  });
  const res = await fn(new Request("https://agent.example/patch", { headers: { "X-PAYMENT": paidHeader() } }));
  assert.equal(res.status, 402);
  assert.equal(res.headers.get("x-payment-response"), null);
  assert.deepEqual(calls, ["verify"]);
});

test("A4 a verification that throws is a 402", async () => {
  const fn = createPaidRoute({
    price: "5000",
    payTo: PAY_TO,
    network: "eip155:8453",
    asset: ASSET,
    facilitator: {
      verify() {
        throw new Error("facilitator down");
      },
      settle() {
        return { success: true };
      },
    },
  });
  const res = await fn(new Request("https://agent.example/patch", { headers: { "X-PAYMENT": paidHeader() } }));
  assert.equal(res.status, 402);
  const body = await res.json();
  assert.match(body.error, /verification failed/);
});

test("A4 a settlement that fails is a 402 with no success receipt", async () => {
  const { facilitator } = stubFacilitator({ isValid: true }, { success: false, error: "insufficient funds" });
  const fn = createPaidRoute({
    price: "5000",
    payTo: PAY_TO,
    network: "eip155:8453",
    asset: ASSET,
    facilitator,
  });
  const res = await fn(new Request("https://agent.example/patch", { headers: { "X-PAYMENT": paidHeader() } }));
  assert.equal(res.status, 402);
  assert.equal(res.headers.get("x-payment-response"), null);
});

test("A4 a settlement that reports failure is a 402 even when it carries a transaction", async () => {
  const { facilitator } = stubFacilitator({ isValid: true }, { success: false, transaction: "0xdead" });
  const fn = createPaidRoute({
    price: "5000",
    payTo: PAY_TO,
    network: "eip155:8453",
    asset: ASSET,
    facilitator,
  });
  const res = await fn(new Request("https://agent.example/patch", { headers: { "X-PAYMENT": paidHeader() } }));
  assert.equal(res.status, 402);
  assert.equal(res.headers.get("x-payment-response"), null);
});

test("A4 a settlement that throws is a 402", async () => {
  const fn = createPaidRoute({
    price: "5000",
    payTo: PAY_TO,
    network: "eip155:8453",
    asset: ASSET,
    facilitator: {
      verify() {
        return { isValid: true };
      },
      settle() {
        throw new Error("broadcast failed");
      },
    },
  });
  const res = await fn(new Request("https://agent.example/patch", { headers: { "X-PAYMENT": paidHeader() } }));
  assert.equal(res.status, 402);
});

test("A4 a malformed payment header is a 402", async () => {
  const { fn, calls } = route();
  const res = await fn(new Request("https://agent.example/patch", { headers: { "X-PAYMENT": "not base64 json" } }));
  assert.equal(res.status, 402);
  assert.equal(calls.length, 0);
});

test("A4 a handler runs only after settlement and keeps the receipt header", async () => {
  const { fn, calls } = route({
    handler() {
      calls.push("handler");
      return new Response(JSON.stringify({ patch: "diff --git a/x b/x" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const res = await fn(new Request("https://agent.example/patch", { headers: { "X-PAYMENT": paidHeader() } }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.patch, /diff --git/);
  assert.ok(res.headers.get("x-payment-response"));
  assert.deepEqual(calls, ["verify", "settle", "handler"]);
});

test("A4 invalid options are refused at construction", () => {
  const bad = (opts: Record<string, unknown>) =>
    createPaidRoute({
      price: "5000",
      payTo: PAY_TO,
      network: "eip155:8453",
      facilitator: { verify: () => true, settle: () => true } as never,
      ...opts,
    } as never);
  assert.throws(() => bad({ payTo: "" }));
  assert.throws(() => bad({ network: "" }));
  assert.throws(() => bad({ price: "0.005" }));
  assert.throws(() => bad({ price: "-1" }));
  assert.throws(() => bad({ facilitator: {} }));
});
