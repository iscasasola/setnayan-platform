/**
 * SEC-7 — A FAILED PRICE READ REFUSES THE SALE. IT DOES NOT GUESS.
 *
 * 🚨 THE DEFECT THIS PINS. `setnayan-ai-event-pricing.ts` used to destructure
 * Supabase reads as `const { data } = await …`, throwing the `error` away. A
 * network blip, a timeout or an RLS refusal therefore arrived at the SAME branch
 * as "this row legitimately has no price", and both charged the hardcoded
 * ladder. Worse, at the call site the resolver's `null` meant "keep the normal
 * catalog charge", so a failed per-type read did not merely guess — it billed
 * the FLAT `SETNAYAN_AI` row instead of the tier the customer was shown.
 *
 * On the one product that has genuinely sold (a paid ₱2,499 order, 2026-08-25).
 *
 * ⚖ OWNER RULING 2026-08-27: REFUSE THE SALE. Better to tell someone "try again
 * in a minute" than take their money at a figure nobody chose. This file is that
 * ruling expressed as a test.
 *
 * ── WHAT IS DELIBERATELY *NOT* ASSERTED HERE ───────────────────────────────
 * An ABSENT row still falls back to the locked ladder, and that is correct: it
 * is what the ladder was written for (an environment where the seeding
 * migration has not run must still quote the owner-locked number). Verified
 * against production 2026-08-27 — all four tier rows exist and match the ladder
 * exactly — so in prod the absent branch is unreachable anyway. Whether it
 * should ALSO refuse is a separate owner decision, flagged and not folded in.
 *
 * Lives in `lib/` because `test:unit` globs `lib/**` and `app/**` only — a guard
 * under `tests/` outside those globs never runs.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  resolveSetnayanAiTypeChargeCentavos,
  resolveSetnayanAiEventChargeCentavos,
  resolveSetnayanAiTypePriceResolution,
} from './setnayan-ai-event-pricing';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'setnayan-ai-event-pricing.ts'), 'utf8');

type FakeOpts = {
  /** An error object for the `events` read, or null for a clean read. */
  eventsError?: { message: string } | null;
  /** An error object for the catalog read, or null for a clean read. */
  catalogError?: { message: string } | null;
  /** null → the event row is genuinely absent. */
  eventType?: string | null;
  introUsed?: boolean | null;
  catalogRow?: { retail_price_php?: number | null; onboarding_price_php?: number | null } | null;
};

/**
 * A fake client that can fail a read the way Supabase actually does: it RESOLVES
 * with `{ data: null, error }` rather than throwing. That distinction is the
 * whole bug — a `try/catch` would never have seen it.
 */
function fakeAdmin(o: FakeOpts): SupabaseClient {
  const client = {
    from(table: string) {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: o.eventsError
                  ? null
                  : o.eventType === null && o.introUsed === undefined
                    ? null
                    : { event_type: o.eventType ?? null, setnayan_ai_intro_used: o.introUsed ?? false },
                error: o.eventsError ?? null,
              }),
            }),
          }),
        };
      }
      if (table === 'platform_retail_catalog_v2') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: o.catalogError ? null : (o.catalogRow ?? null),
                error: o.catalogError ?? null,
              }),
            }),
            in: async () => ({
              data: o.catalogError ? null : [],
              error: o.catalogError ?? null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return client as unknown as SupabaseClient;
}

// ── THE RULING ──────────────────────────────────────────────────────────────

test('a failed CATALOG read refuses — it does not price off the ladder', async () => {
  const r = await resolveSetnayanAiTypePriceResolution(
    fakeAdmin({ catalogError: { message: 'connection reset' } }),
    'wedding',
  );
  assert.equal(r.status, 'read_error', 'a failed catalog read must not resolve to a price');
  assert.match(
    r.status === 'read_error' ? r.message : '',
    /connection reset/,
    'the refusal must carry the underlying cause for the fault log',
  );
});

test('a failed EVENTS read refuses the charge — and computes no amount', async () => {
  const r = await resolveSetnayanAiTypeChargeCentavos(
    fakeAdmin({ eventsError: { message: 'statement timeout' } }),
    'S89E-abc',
  );
  assert.equal(r.status, 'read_error');
  // The point is not only "it said no" — it is that NO NUMBER EXISTS to charge.
  assert.ok(
    !('centavos' in r),
    'a refusal must not carry an amount; an amount is exactly what would get billed',
  );
});

test('a failed CATALOG read refuses the charge too, through the resolver', async () => {
  const r = await resolveSetnayanAiTypeChargeCentavos(
    fakeAdmin({ eventType: 'wedding', catalogError: { message: 'RLS: permission denied' } }),
    'S89E-abc',
  );
  assert.equal(r.status, 'read_error');
  assert.ok(!('centavos' in r));
});

test('the SUPERSEDED renewal path refuses too — the shape survives nowhere in the file', async () => {
  const bad = await resolveSetnayanAiEventChargeCentavos(
    fakeAdmin({ introUsed: true, catalogError: { message: 'connection reset' } }),
    'S89E-abc',
  );
  assert.equal(bad.status, 'read_error');

  const evBad = await resolveSetnayanAiEventChargeCentavos(
    fakeAdmin({ eventsError: { message: 'timeout' } }),
    'S89E-abc',
  );
  assert.equal(evBad.status, 'read_error');
});

// ── THE BLAST RADIUS: what must STILL be chargeable ─────────────────────────

test('a clean read still resolves — refusing must not block a real sale', async () => {
  const r = await resolveSetnayanAiTypeChargeCentavos(
    fakeAdmin({ eventType: 'wedding', catalogRow: { retail_price_php: 2499 } }),
    'S89E-abc',
  );
  assert.deepEqual(r, { status: 'resolved', centavos: 249900 });
});

test('an ABSENT catalog row still falls back to the ladder — unchanged by this fix', async () => {
  // The owner's ruling was about the FAILED READ. This branch is what the locked
  // ladder exists for, and changing it would break every unseeded environment.
  const r = await resolveSetnayanAiTypePriceResolution(
    fakeAdmin({ catalogRow: null }),
    'wedding',
  );
  assert.equal(r.status, 'resolved');
  assert.ok(r.status === 'resolved' && r.php > 0, 'the ladder must still quote a real number');
});

test('an ABSENT event row still falls through, it does not refuse', async () => {
  // Preserves the pre-fix behaviour exactly: the caller keeps its ordinary
  // catalog charge. Only a read ERROR became a refusal.
  const r = await resolveSetnayanAiTypeChargeCentavos(
    fakeAdmin({ eventType: null }),
    'S89E-missing',
  );
  assert.deepEqual(r, { status: 'absent' });
});

test('Tier E still resolves to ₱0 without touching the database', async () => {
  // No vendors ⇒ Setnayan AI is not present. A product fact decided before any
  // read, so a broken database cannot turn it into a refusal.
  const r = await resolveSetnayanAiTypePriceResolution(
    fakeAdmin({ catalogError: { message: 'everything is on fire' } }),
    'simple_event',
  );
  assert.deepEqual(r, { status: 'resolved', php: 0 });
});

// ── THE SHAPE MUST NOT COME BACK ────────────────────────────────────────────

test('no read in this module discards its error', () => {
  /*
    🔑 THE REGRESSION THIS CATCHES IS A DELETION, not a wrong value: someone
    writes `const { data } = await admin.from(...)` again and the swallow is
    back, with every behaviour test above still green because the fake never
    errors on that new path.

    Comments are stripped first — the docblocks above legitimately quote the
    broken form while explaining it, and a raw match would fail on the very
    sentence describing the fix.
  */
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const swallows = code.match(/const\s*\{\s*data(?:\s*:\s*\w+)?\s*\}\s*=\s*await/g) ?? [];
  assert.deepEqual(
    swallows,
    [],
    `a Supabase read in setnayan-ai-event-pricing.ts discards its error again ` +
      `(${swallows.join(', ')}). Destructure \`error\` too and refuse on it — SEC-7, ` +
      `owner-ruled 2026-08-27.`,
  );

  // And the money path must not borrow the display helper, which still degrades
  // to the ladder by design.
  const chargeFn = code.slice(code.indexOf('export async function resolveSetnayanAiTypeChargeCentavos'));
  assert.ok(
    chargeFn.includes('resolveSetnayanAiTypePriceResolution'),
    'the charge path must use the RESOLUTION form, not the display helper',
  );
});

test('the caller maps read_error to a refusal, not to a different price', () => {
  /*
    🚨 THE SUBTLE HALF. Before the fix the resolver returned `null` on failure
    and the call site read `if (perType != null)` — so a failed read FELL THROUGH
    and sealed the flat retail total. Refusing at the resolver is worthless if
    the caller keeps treating "no answer" as "use the other price", so this
    asserts the mapping at the call site itself.
  */
  const authority = readFileSync(join(HERE, 'order-charge-authority.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  assert.match(
    authority,
    /perType\.status === 'read_error'[\s\S]{0,200}?refusal: 'read_error'/,
    'a read_error from the per-type resolver must return a refusal at the call site',
  );
  assert.ok(
    !/if\s*\(\s*perType\s*!=\s*null\s*\)/.test(authority),
    'the old null-check is back — a failed read would fall through to the flat retail price',
  );
});
