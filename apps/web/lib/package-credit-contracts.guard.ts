/**
 * COMPILE-TIME GUARDS for the two bugs this wave shipped three times.
 *
 * These are not runtime tests. Every `@ts-expect-error` below asserts that the
 * WRONG code does not compile — and TypeScript flags an unused
 * `@ts-expect-error`, so if someone later widens a type until the mistake is
 * legal again, THIS FILE fails the build. The guard cannot rot silently.
 *
 * The history it encodes:
 *   1. `chosen_option_ids` — the browser's ids were persisted unsanitised.
 *   2. `credit_additions`  — the same bug, one table over, weeks later.
 *   3. the shared pricer   — a new argument was added at one call site and
 *      forgotten at the other, and `tsc` said nothing because it was optional.
 *
 * Each was found by a human reading code or a test written after the fact.
 * These make them mechanical.
 */
import type {
  PackageCustomizationsInput,
  PackageCustomizationsStored,
} from './vendor-packages';

/* ── 1. A client payload can never be persisted as-is ─────────────────────── */

declare const fromBrowser: PackageCustomizationsInput;

// The exact line that shipped the bug twice: spreading the request body into
// the row we store. It must not typecheck, because `Stored.credit_additions`
// requires a server-frozen `unit_price_centavos` the client cannot supply.
// @ts-expect-error — persisting a raw client payload must never compile
export const persistedRaw: PackageCustomizationsStored = { ...fromBrowser };

// A hand-built addition with no frozen price is the same mistake, spelled out.
export const persistedUnpriced: PackageCustomizationsStored = {
  credit_additions: [
    // @ts-expect-error — a stored purchase must carry the price it was charged at
    { service_id: 'svc', quantity: 1 },
  ],
};

// And money must never travel INWARD: a client cannot declare what it paid.
export const clientSendsPrice: PackageCustomizationsInput = {
  credit_additions: [
    // @ts-expect-error — a client-supplied price is the failure, not a convenience
    { service_id: 'svc', quantity: 1, unit_price_centavos: 1 },
  ],
};

/* ── 2. The safe direction still compiles ─────────────────────────────────── */

// Sanitised, server-priced: this is what the lock path actually builds.
export const persistedOk: PackageCustomizationsStored = {
  removed_item_ids: ['item-1'],
  chosen_option_ids: ['opt-1'],
  credit_additions: [{ service_id: 'svc', quantity: 2, unit_price_centavos: 30_000 }],
};

// Ids and quantities inbound: what a browser is allowed to say.
export const inputOk: PackageCustomizationsInput = {
  removed_item_ids: ['item-1'],
  credit_additions: [{ service_id: 'svc', quantity: 2 }],
};
