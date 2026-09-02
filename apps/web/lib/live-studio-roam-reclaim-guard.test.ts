/**
 * live-studio-roam-reclaim-guard.test.ts
 *
 * 2026-09-02 — "a finished wedding returns its channel." `NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY`
 * closed the BYO fallback the same day, so a single un-released pool checkout is now the
 * entire product down for every other event. `reclaimStaleCheckouts` in
 * lib/live-studio-roam-provision.ts is the backstop; this guard pins the four
 * safety properties that make it safe to have added, independently of the
 * behaviour tests in live-studio-channel-pool.test.ts.
 *
 * OWN FILE, ON PURPOSE. A file-level guard cannot say WHICH function a
 * sabotage landed in when the module is long and reuses the same names in
 * several places (checkoutPoolChannel, releasePoolChannelIfIdle,
 * reclaimStaleCheckouts all appear more than once across the file's
 * docblocks) — so every assertion below is sliced to the one function it
 * pins, not to the file as a whole.
 *
 *   1. reclaim runs AFTER the availability read in checkoutPoolChannel —
 *      LAST RESORT, NEVER EAGER. With a second channel connected it must
 *      never fire at all.
 *   2. the grace period is the IMPORTED PANOOD_WINDOW_HOURS constant, never a
 *      re-typed literal hour count.
 *   3. reclaimStaleCheckouts DELEGATES to releasePoolChannelIfIdle — it must
 *      never `.update(` the pool row itself. Two mechanisms deciding "is this
 *      channel free" would eventually disagree, and the way they disagree is
 *      a live wedding losing its channel mid-vow.
 *   4. the sweep is guarded to fire AT MOST ONCE per checkoutPoolChannel call,
 *      so a genuinely contended pool cannot turn the bounded retry into a
 *      slow spin.
 *
 * Uses the repo's ONE comment stripper (lib/strip-comments.ts) so prose
 * describing these very traps — this docblock included — is never mistaken
 * for the trap itself.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, 'live-studio-roam-provision.ts'), 'utf8');

/** Slice ONE exported function's source, from its signature to the next top-level export. */
function sliceFn(name: string): string {
  const start = SRC.indexOf(`export async function ${name}`);
  assert.ok(start > -1, `export async function ${name} must exist in live-studio-roam-provision.ts`);
  const next = SRC.indexOf('\nexport ', start + name.length);
  return SRC.slice(start, next > -1 ? next : undefined);
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 · LAST RESORT, NEVER EAGER
   ══════════════════════════════════════════════════════════════════════════════ */

test('reclaim runs AFTER the availability read, never eagerly', () => {
  const fn = stripComments(sliceFn('checkoutPoolChannel'));
  const readAt = fn.indexOf(".eq('status', 'available')");
  const reclaimAt = fn.indexOf('reclaimStaleCheckouts(');
  assert.ok(readAt > -1, 'the availability read must still be there');
  assert.ok(reclaimAt > -1, 'checkoutPoolChannel must call reclaimStaleCheckouts');
  assert.ok(
    reclaimAt > readAt,
    'reclaim must be called AFTER the availability read comes back empty — never before it, never unconditionally',
  );
  // …and specifically inside the branch where nothing was free.
  const emptyBranch = fn.slice(fn.indexOf('freeErr || !free'));
  assert.match(
    emptyBranch.slice(0, emptyBranch.indexOf('return null')),
    /reclaimStaleCheckouts\(/,
    'the sweep must live inside the "pool genuinely empty" branch, not beside it',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   2 · THE GRACE PERIOD IS THE IMPORTED CONSTANT
   ══════════════════════════════════════════════════════════════════════════════ */

test('the grace period is the imported PANOOD_WINDOW_HOURS constant, never a re-typed literal', () => {
  assert.match(
    stripComments(SRC.slice(0, SRC.indexOf('export type RoamZoneRow'))),
    /import \{ PANOOD_WINDOW_HOURS \} from '@\/lib\/panood-watermark';/,
    'must import the existing, pure, import-free window constant rather than re-typing an hour count',
  );
  const fn = stripComments(sliceFn('reclaimStaleCheckouts'));
  assert.match(fn, /PANOOD_WINDOW_HOURS \* 60 \* 60 \* 1000/, 'the staleness cutoff must be derived from the constant');
  assert.ok(
    !/\b24\s*\*\s*60\s*\*\s*60\b/.test(fn),
    'no hardcoded 24-hour literal may sit alongside (or replace) the imported constant',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   3 · ONE RELEASE PATH — DELEGATE, NEVER WRITE THE POOL DIRECTLY
   ══════════════════════════════════════════════════════════════════════════════ */

test('reclaim DELEGATES to releasePoolChannelIfIdle — it never writes the pool row itself', () => {
  const fn = stripComments(sliceFn('reclaimStaleCheckouts'));
  assert.match(
    fn,
    /releasePoolChannelIfIdle\(admin, eventId\)/,
    'reclaimStaleCheckouts must delegate the actual release decision to the one release path',
  );
  assert.ok(
    !/\.update\(/.test(fn),
    'reclaimStaleCheckouts must never .update( the pool row directly — a second writer disagreeing with the first is how a live wedding loses its channel',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   4 · SWEEP AT MOST ONCE PER CHECKOUT
   ══════════════════════════════════════════════════════════════════════════════ */

test('the sweep fires AT MOST ONCE per checkoutPoolChannel call', () => {
  const fn = stripComments(sliceFn('checkoutPoolChannel'));
  assert.match(fn, /let sweepAttempted = false;/, 'a once-only flag must exist, initialised before the retry loop');
  assert.match(fn, /sweepAttempted = true;/, 'the flag must be set the first time the sweep actually runs');
  assert.match(fn, /!sweepAttempted/, 'the sweep call must be gated on the flag, or a contended pool spins');
});

/* ══════════════════════════════════════════════════════════════════════════════
   5 · NOT A WIPE
   ══════════════════════════════════════════════════════════════════════════════ */

test('reclaim is documented as NOT a wipe — § 6 retention stays untouched', () => {
  const fn = SRC.slice(SRC.indexOf('export async function reclaimStaleCheckouts') - 3000, SRC.indexOf('export async function reclaimStaleCheckouts'));
  assert.match(fn, /NOT A WIPE/, 'the function must say in its own docblock that reclaim is not a wipe');
});
