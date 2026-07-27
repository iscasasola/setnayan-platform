/**
 * ⭐ THE REGRESSION LOCK: a REFUSED verification flip must be REPORTED.
 *
 * The P0 this file guards (prod, 2026-07-27): `submitApplication` and
 * `submitInlineForReview` both wrote `verification_state = 'pending_review'`
 * through the VENDOR'S OWN authenticated client and never checked the result.
 * `guard_vendor_profiles_entitlement` refuses that write, so Postgres said no,
 * the app discarded the "no", and the vendor saw a green "submitted" while their
 * shop stayed 'unverified' forever. Prod corroborated it: 0 verified vendors,
 * 0 vendor_tier_history rows, 0 vendor_verifications rows — nobody had EVER
 * successfully applied, and the marketplace filters on verified, so it stayed
 * empty.
 *
 * The tests that must go RED if that behaviour ever returns are the two marked
 * ⭐ below: a DB error and a 0-row write both have to surface as `ok: false`.
 * A fix that works but still swallows errors has not fixed the actual defect.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  markVendorPendingReview,
  revertVendorPendingReview,
  PENDING_REVIEW_ADVANCEABLE,
} from './vendor-verification-state';

const VPID = 'a0000000-0000-4000-8000-000000000001';
const UID = 'b0000000-0000-4000-8000-000000000002';
const NOW = '2026-07-27T09:00:00.000Z';

type Calls = {
  updates: Array<{ payload: Record<string, unknown>; filters: Array<[string, unknown]> }>;
};

type StubFacts = {
  /** Current verification_state, or null to simulate "no matching row". */
  state: string | null;
  /** Simulate the DB refusing the read. */
  readError?: string;
  /** Simulate the DB refusing the write — this is the guard's real behaviour. */
  updateError?: string;
  /** Simulate a write that matched ZERO rows (a silently-filtered update). */
  updateRows?: number;
};

function stub(facts: StubFacts): { client: SupabaseClient; calls: Calls } {
  const calls: Calls = { updates: [] };

  const client = {
    from(table: string) {
      assert.equal(table, 'vendor_profiles', 'only vendor_profiles should be touched');
      return {
        select() {
          const q: Record<string, unknown> = {
            eq: () => q,
            maybeSingle: async () =>
              facts.readError
                ? { data: null, error: { message: facts.readError } }
                : {
                    data: facts.state === null ? null : { verification_state: facts.state },
                    error: null,
                  },
          };
          return q;
        },
        update(payload: Record<string, unknown>) {
          const filters: Array<[string, unknown]> = [];
          calls.updates.push({ payload, filters });
          const q: Record<string, unknown> = {
            eq: (col: string, val: unknown) => {
              filters.push([col, val]);
              return q;
            },
            // `.select()` terminates the update chain in markVendorPendingReview.
            select: async () =>
              facts.updateError
                ? { data: null, error: { message: facts.updateError } }
                : {
                    data: Array.from({ length: facts.updateRows ?? 1 }, () => ({
                      vendor_profile_id: VPID,
                    })),
                    error: null,
                  },
            // revertVendorPendingReview awaits the chain directly.
            then: (res: (v: unknown) => unknown) =>
              Promise.resolve(
                facts.updateError
                  ? { data: null, error: { message: facts.updateError } }
                  : { data: null, error: null },
              ).then(res),
          };
          return q;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const args = { vendorProfileId: VPID, userId: UID, nowIso: NOW };

/* ── ⭐ THE TWO THAT MUST NEVER GO GREEN AGAIN ───────────────────────────── */

test('⭐ a REFUSED write is reported as failure, never as silent success', async () => {
  // Verbatim shape of the guard's rejection.
  const { client } = stub({
    state: 'unverified',
    updateError:
      'vendor_profiles tier/seat/add-on/trust columns are not writable by the vendor (self-grant blocked)',
  });

  const result = await markVendorPendingReview(client, args);

  assert.equal(result.ok, false, 'a refused flip MUST NOT report ok:true');
  assert.match(
    result.ok === false ? result.error : '',
    /self-grant blocked/,
    'the underlying refusal must reach the vendor, not be replaced by silence',
  );
});

test('⭐ a write that matched ZERO rows is a failure, not a success', async () => {
  // PostgREST returns 200 + [] for an update whose filters matched nothing.
  // Treating that as success is the same class of bug as ignoring `error`.
  const { client } = stub({ state: 'unverified', updateRows: 0 });

  const result = await markVendorPendingReview(client, args);

  assert.equal(result.ok, false, 'a 0-row update MUST be reported as failure');
});

/* ── The happy path still works ──────────────────────────────────────────── */

test('unverified → pending_review flips, and pins the write to BOTH ids', async () => {
  const { client, calls } = stub({ state: 'unverified' });

  const result = await markVendorPendingReview(client, args);

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.ok === true ? { from: result.fromState, changed: result.changed } : null,
    { from: 'unverified', changed: true },
  );
  assert.equal(calls.updates.length, 1);
  assert.deepEqual(calls.updates[0]!.payload, {
    verification_state: 'pending_review',
    updated_at: NOW,
  });
  // Ownership is asserted in application code because service_role bypasses RLS.
  assert.deepEqual(
    calls.updates[0]!.filters,
    [
      ['vendor_profile_id', VPID],
      ['user_id', UID],
    ],
    'the update must be pinned to the caller’s own profile AND user id',
  );
});

test('a demoted shop may re-apply', async () => {
  const { client } = stub({ state: 'demoted' });
  const result = await markVendorPendingReview(client, args);
  assert.equal(result.ok, true);
  assert.equal(result.ok === true && result.changed, true);
});

/* ── The no-ops: success WITHOUT a write ─────────────────────────────────── */

test('already pending_review is an idempotent no-op, not an error', async () => {
  const { client, calls } = stub({ state: 'pending_review' });

  const result = await markVendorPendingReview(client, args);

  assert.equal(result.ok, true);
  assert.equal(result.ok === true && result.changed, false);
  assert.equal(calls.updates.length, 0, 'no write should be attempted');
});

test('⭐ an annual_renewal from a VERIFIED shop keeps the badge (no delisting)', async () => {
  // `vendor_profiles_public_read` requires verification_state = 'verified', so
  // flipping a verified shop to 'pending_review' would remove it from the
  // marketplace for the whole review window. The application row carries the
  // in-flight signal instead.
  const { client, calls } = stub({ state: 'verified' });

  const result = await markVendorPendingReview(client, args);

  assert.equal(result.ok, true, 'a renewal submit must not fail');
  assert.equal(result.ok === true && result.changed, false);
  assert.equal(calls.updates.length, 0, 'a verified shop must NOT be downgraded');
});

/* ── Failure paths ───────────────────────────────────────────────────────── */

test('a read error surfaces, and no write is attempted', async () => {
  const { client, calls } = stub({ state: null, readError: 'connection reset' });
  const result = await markVendorPendingReview(client, args);
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.error : '', /connection reset/);
  assert.equal(calls.updates.length, 0);
});

test('a profile that is not the caller’s own is refused', async () => {
  // The read is pinned to user_id, so a mismatched pair returns no row at all.
  const { client, calls } = stub({ state: null });
  const result = await markVendorPendingReview(client, args);
  assert.equal(result.ok, false);
  assert.equal(calls.updates.length, 0);
});

test('missing identity is refused before any DB call', async () => {
  const { client, calls } = stub({ state: 'unverified' });
  const result = await markVendorPendingReview(client, {
    vendorProfileId: '',
    userId: UID,
    nowIso: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(calls.updates.length, 0);
});

/* ── The compensating action stays narrow ────────────────────────────────── */

test('revert refuses to grant trust — "verified" is not a revert target', async () => {
  const { client, calls } = stub({ state: 'pending_review' });

  const result = await revertVendorPendingReview(client, {
    vendorProfileId: VPID,
    userId: UID,
    toState: 'verified',
    nowIso: NOW,
  });

  assert.equal(result.ok, false, 'the rollback path must never be able to verify a shop');
  assert.equal(calls.updates.length, 0);
  assert.ok(!PENDING_REVIEW_ADVANCEABLE.includes('verified'));
});

test('revert restores the prior state, only from pending_review', async () => {
  const { client, calls } = stub({ state: 'pending_review' });

  const result = await revertVendorPendingReview(client, {
    vendorProfileId: VPID,
    userId: UID,
    toState: 'unverified',
    nowIso: NOW,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.updates[0]!.payload, {
    verification_state: 'unverified',
    updated_at: NOW,
  });
  assert.deepEqual(calls.updates[0]!.filters, [
    ['vendor_profile_id', VPID],
    ['user_id', UID],
    ['verification_state', 'pending_review'],
  ]);
});

test('revert surfaces its own error', async () => {
  const { client } = stub({ state: 'pending_review', updateError: 'boom' });
  const result = await revertVendorPendingReview(client, {
    vendorProfileId: VPID,
    userId: UID,
    toState: 'unverified',
    nowIso: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'boom');
});

/* ══════════════════════════════════════════════════════════════════════════
   ⭐ THE CALL SITES.

   The tests above prove the LIB reports refusals. They cannot prove a CALLER
   checks the answer — and a caller that ignores `flip.ok` reproduces the exact
   defect. The bug also shipped in TWO places at once (verify/actions.ts and
   shop/inline-docs-actions.ts had byte-similar code), so this sweeps the whole
   vendor-facing tree rather than the two known files: a third copy added later
   fails here instead of in production.
   ══════════════════════════════════════════════════════════════════════════ */

const SUBMIT_ACTIONS = [
  'app/vendor-dashboard/verify/actions.ts',
  'app/vendor-dashboard/shop/inline-docs-actions.ts',
] as const;

async function webRoot(): Promise<string> {
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * Every `.update(...)` applied to `vendor_profiles` in `source`, as raw text.
 * Chunks from `.from('vendor_profiles')` to the end of the statement.
 */
function vendorProfileUpdates(source: string): string[] {
  return source
    .split(/\.from\(\s*['"]vendor_profiles['"]\s*\)/)
    .slice(1)
    .map((chunk) => chunk.split(';')[0] ?? '')
    .filter((stmt) => /\.update\(/.test(stmt));
}

test('⭐ no vendor-facing code writes verification_state through its own client', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = await webRoot();

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
    }
    return out;
  };

  const offenders: string[] = [];
  for (const file of walk(join(root, 'app', 'vendor-dashboard'))) {
    const source = readFileSync(file, 'utf8');
    for (const stmt of vendorProfileUpdates(source)) {
      // The trust columns. Writing either from vendor-facing code is refused by
      // `guard_vendor_profiles_entitlement` — silently, unless routed through
      // lib/vendor-verification-state.ts (service_role) and error-checked.
      if (/verification_state\s*:/.test(stmt) || /public_visibility\s*:/.test(stmt)) {
        offenders.push(file.slice(root.length + 1));
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'These files write a TRUST column on vendor_profiles directly. The DB guard ' +
      'refuses that write, and the vendor is told nothing. Route it through ' +
      'markVendorPendingReview() (service_role) and CHECK the result.',
  );
});

test('⭐ both submit actions route through the lib AND check its result', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = await webRoot();

  for (const rel of SUBMIT_ACTIONS) {
    const source = readFileSync(join(root, rel), 'utf8');

    assert.match(
      source,
      /markVendorPendingReview/,
      `${rel} must flip verification_state through the authorised helper`,
    );
    // The whole defect in one assertion: the result must be BRANCHED ON.
    assert.match(
      source,
      /if\s*\(\s*!\s*flip\.ok\s*\)/,
      `${rel} must branch on the flip result — an unchecked call is the original bug`,
    );
    // …and the failure must actually reach the vendor, not be logged and dropped.
    assert.match(
      source,
      /flip\.error/,
      `${rel} must surface the failure text to the vendor`,
    );
  }
});
