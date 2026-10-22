// Qualifier Q4: an idempotent, capped ledger.
// Amounts, caps and balances are integer strings. A repeated key with the same
// payload posts once; the same key with another payload throws; a post that would
// take an account above the cap throws and changes nothing.

type Amount = string;

export interface PostInput {
  key: string;
  account: string;
  amount: Amount;
}

export interface PostResult {
  id: string;
  duplicate: boolean;
}

export interface Ledger {
  post(input: PostInput): PostResult;
  balance(account: string): string;
}

function positiveInteger(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new Error(`${name} must be a positive integer string`);
  }
  const n = BigInt(value);
  if (n <= 0n) throw new Error(`${name} must be a positive integer string`);
  return n;
}

function idFor(key: string, account: string, amount: string): string {
  // Deterministic so a duplicate returns the same id, and independent of order.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = `${key}\u0000${account}\u0000${amount}`;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return "tx_" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function createLedger({ cap }: { cap: Amount }): Ledger {
  const limit = positiveInteger(cap, "cap");
  const seen = new Map<string, { id: string; account: string; amount: string }>();
  const balances = new Map<string, bigint>();

  return {
    post(input: PostInput): PostResult {
      if (input === null || typeof input !== "object") throw new Error("input must be an object");
      const { key, account, amount } = input;
      if (typeof key !== "string" || key.length === 0) throw new Error("key must be a non empty string");
      if (typeof account !== "string" || account.length === 0) throw new Error("account must be a non empty string");
      const value = positiveInteger(amount, "amount");

      const prior = seen.get(key);
      if (prior) {
        if (prior.account === account && prior.amount === amount) {
          return { id: prior.id, duplicate: true };
        }
        throw new Error("key already used with another payload");
      }

      const current = balances.get(account) ?? 0n;
      const next = current + value;
      if (next > limit) {
        throw new Error("account would exceed the cap");
      }

      const id = idFor(key, account, amount);
      seen.set(key, { id, account, amount });
      balances.set(account, next);
      return { id, duplicate: false };
    },

    balance(account: string): string {
      if (typeof account !== "string" || account.length === 0) throw new Error("account must be a non empty string");
      return (balances.get(account) ?? 0n).toString();
    },
  };
}
