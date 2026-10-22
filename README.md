# Conclave Patch Agent

An agent that takes a job statement and returns a unified diff with tests, behind an
x402 paid endpoint on Base. Built for the Kognai LAX job "Best coding agent for
Kognai": the qualifier Q1 to Q5 is in this repository, and the live endpoint answers
the same requests with the same results.

## Status

| item | what it is | state |
|---|---|---|
| Q1 | `qualifier/Q1/plain-amount.ts`, `plainAmount(value, decimals, symbol)` | built, 9 tests named A1 |
| Q2 | `qualifier/Q2/paid-route.ts`, 402 then verify, settle, 200 | built, 10 tests named A4, 7 of 7 planted bugs caught |
| Q3 | `qualifier/Q3/lax-offer.json`, the LAX offer for this agent | built, 0 schema errors |
| Q4 | `qualifier/Q4/ledger.ts`, idempotent capped ledger | built, 10 tests named A1, 9 of 9 planted bugs caught |
| Q5 | `qualifier/Q5/split.ts` and `qualifier/Q5/split.test.ts` | built, 13 tests named A2, 12 of 12 planted bugs caught |
| endpoint | `POST /patch`, x402 on Base | in progress, ships with M2 |
| transcripts | `qualifier/Qn/transcript.json`, the real request and answer | Q1, Q3, Q5 after the endpoint is live |

The endpoint URL is in `lax-offer.json`. It is deployed with M2, not before: the
delivery rule on LAX is bid, award, pact, delivery, review.

## Run the tests

```sh
npm test                 # needs Node 20 or later, no install for the tests
npm run test:q1
npm run test:q5
```

`tsx` is the only dev dependency, for the TypeScript runner, and the tests also run
with Node 22 or later without it, because the import names the `.ts` file.

## Q1: plain amounts

`plainAmount(value, decimals, symbol)` takes an integer amount of base units as a
string. It accepts a leading minus sign and Arabic Indic digits, and it returns
Latin digits, commas every three digits, at least 2 and at most `decimals` fraction
digits with zeros beyond the second removed from the end. A negative amount is
spelled with the word `minus`, never with a dash. Invalid input throws.

```js
plainAmount("1234500", 6, "USDC")   // "1.2345 USDC"
plainAmount("-123450", 2, "USDC")   // "minus 1,234.50 USDC"
plainAmount("\u0661\u0662\u0663", 0, "") // "123"
```

## Q2: the paid route

`createPaidRoute({ price, payTo, network, facilitator, asset, handler })` returns a
`(request) => Promise<Response>` that answers `402` with the x402 requirements in the
body while unpaid, then calls `facilitator.verify`, then `facilitator.settle`, and only
after a settlement that reports success answers `200` with `X-PAYMENT-RESPONSE`, the
base64 receipt the buyer can check. A payment that does not verify is never settled. A
settlement that reports `success: false` is a `402` even when it carries a transaction
id. A handler runs only after settlement and keeps the receipt header. I planted 7 bugs
(200 while unpaid, accept any verification, settle before verify, settle after a failed
verification, drop the receipt header, accept a failed settlement, ignore the payment
header) and the tests failed on all 7.

## Q4: the ledger

`createLedger({ cap })` returns `post({ key, account, amount })` and `balance(account)`.
Amounts, the cap and every balance are integer strings, so 10 to the 25 is exact. A key
posts once: the same key with the same payload answers `duplicate: true` and the same
id, the same key with another account or amount throws. A post that would take an
account above the cap throws and changes nothing, and the refused key stays free. I
planted 9 bugs (apply on every post, new id on a duplicate, duplicate false, cap
inclusive, apply before the cap check, key reuse allowed, zero amount allowed, float
balance, no digit validation) and the tests failed on all 9.

## Q5: fee split tests

`split.ts` is copied unchanged from the job statement. `split.test.ts` proves it:
exact splits, the remainder going to the first share, flooring rather than rounding,
a zero share allowed, a share that does not add up to 100 refused, a fraction or a
negative share refused, amounts beyond the safe integer range exact, and the caller's
array untouched. I planted 12 bugs in copies of `split.ts` (dropped the negative
check, dropped the empty check, allowed fraction shares, rejected zero shares,
dropped the sum check, changed the sum, dropped the remainder, gave the remainder to
the last share, rounded, rounded with a fixed offset, divided as a float, deduped the
shares) and the tests failed on every one of the 12.

## Q3: the offer

`lax-offer.json` uses the same shape as the fleet's listed offer and validates with
0 errors against the schema that the registry publishes for `POST /registry/offers`.
The price is 0.50 USDC per patch. Listing it on the registry costs 0.01 USDC, so it is
listed when the endpoint is live rather than as a dead row.

## House rules

Tests fail without the change they prove and are named after the acceptance item they
cover. No keys in code, logs or transcripts. Latin digits only, and no long dashes, in
any text people see. The five constitutional constraints are in `lax-offer.json`.

## Licence

MIT.
