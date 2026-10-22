// Qualifier Q2: an x402 paid route.
// Unpaid: 402 with the payment requirements in the body.
// Paid: verify, then settle through the facilitator, then 200 with X-PAYMENT-RESPONSE.
// A failed verification or settlement is a 402, never a 200.

export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
}

export interface Facilitator {
  verify(payment: unknown, requirements: PaymentRequirements): Promise<unknown> | unknown;
  settle(payment: unknown, requirements: PaymentRequirements): Promise<unknown> | unknown;
}

export interface PaidRouteOptions {
  price: string | number;
  payTo: string;
  network: string;
  facilitator: Facilitator;
  asset?: string;
  resource?: string;
  description?: string;
  maxTimeoutSeconds?: number;
  scheme?: string;
  extra?: Record<string, unknown>;
  handler?: (request: Request, settlement: unknown) => Promise<Response> | Response;
}

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function truthy(value: unknown, keys: string[]): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "object") {
    for (const key of keys) {
      const v = (value as Record<string, unknown>)[key];
      if (v === true) return true;
    }
  }
  return false;
}

function settlementSucceeded(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.success === false) return false;
    if (record.success === true || record.settled === true) return true;
    if (typeof record.transaction === "string" && record.transaction.length > 0) return true;
  }
  return false;
}

function b64decode(text: string): string {
  if (typeof atob === "function") return atob(text);
  // Node without atob on very old versions.
  return Buffer.from(text, "base64").toString("binary");
}

function b64encode(text: string): string {
  if (typeof btoa === "function") return btoa(text);
  return Buffer.from(text, "binary").toString("base64");
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export function createPaidRoute(options: PaidRouteOptions): (request: Request) => Promise<Response> {
  const {
    price,
    payTo,
    network,
    facilitator,
    asset = BASE_USDC,
    description = "paid call",
    maxTimeoutSeconds = 60,
    scheme = "exact",
    extra,
    handler,
  } = options;

  if (!payTo || typeof payTo !== "string") throw new Error("payTo must be a non empty string");
  if (!network || typeof network !== "string") throw new Error("network must be a non empty string");
  if (!facilitator || typeof facilitator.verify !== "function" || typeof facilitator.settle !== "function") {
    throw new Error("facilitator must expose verify and settle");
  }
  const amount = typeof price === "number" ? String(price) : price;
  if (typeof amount !== "string" || !/^[0-9]+$/.test(amount)) {
    throw new Error("price must be an integer string in atomic units");
  }

  return async function paidRoute(request: Request): Promise<Response> {
    // The v1 contract this bundle names uses X-PAYMENT; a v2 client sends
    // PAYMENT-SIGNATURE. Accept either so a caller is never refused on the
    // header name alone.
    const requirements: PaymentRequirements = {
      scheme,
      network,
      maxAmountRequired: amount,
      resource: options.resource ?? request.url,
      description,
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds,
      asset,
      ...(extra ? { extra } : {}),
    };

    const header =
      request.headers.get("x-payment") ?? request.headers.get("payment-signature");
    if (!header) {
      return json(
        {
          x402Version: 1,
          error: "payment required",
          accepts: [requirements],
        },
        402,
      );
    }

    let payment: unknown;
    try {
      payment = JSON.parse(b64decode(header.trim()));
    } catch {
      return json({ x402Version: 1, error: "invalid X-PAYMENT header", accepts: [requirements] }, 402);
    }

    let verification: unknown;
    try {
      verification = await facilitator.verify(payment, requirements);
    } catch (error) {
      return json(
        { x402Version: 1, error: "verification failed", detail: String(error), accepts: [requirements] },
        402,
      );
    }
    if (!truthy(verification, ["isValid", "valid", "verified", "success"])) {
      return json({ x402Version: 1, error: "payment not verified", accepts: [requirements] }, 402);
    }

    let settlement: unknown;
    try {
      settlement = await facilitator.settle(payment, requirements);
    } catch (error) {
      return json(
        { x402Version: 1, error: "settlement failed", detail: String(error), accepts: [requirements] },
        402,
      );
    }
    if (!settlementSucceeded(settlement)) {
      return json({ x402Version: 1, error: "payment not settled", accepts: [requirements] }, 402);
    }

    const receipt =
      settlement && typeof settlement === "object"
        ? { success: true, ...(settlement as Record<string, unknown>) }
        : { success: true, result: settlement };
    const receiptHeader = b64encode(JSON.stringify(receipt));

    if (handler) {
      const response = await handler(request, settlement);
      const headers = new Headers(response.headers);
      headers.set("x-payment-response", receiptHeader);
      headers.set("payment-response", receiptHeader);
      return new Response(response.body, { status: response.status, headers });
    }

    return json({ ok: true, paid: true }, 200, {
      "x-payment-response": receiptHeader,
      "payment-response": receiptHeader,
    });
  };
}
