/**
 * live-studio-unlock-never-expires.test.ts — the three properties LS6
 * (owner-ruled 2026-09-02: "unlock once per event, unlimited streams, unlimited
 * video link upload") depends on staying true, pinned in their own file so a
 * later PR cannot quietly reintroduce a clock.
 *
 *   1. AN OWNED EVENT'S MULTICAM DOES NOT EXPIRE WITH TIME. An event that bought
 *      Live Studio a decade ago and has sat untouched since still gets
 *      `canPublishMultiCam === true` today — because nothing in the resolution
 *      chain reads a purchase date, a first-go-live anchor, or the current clock
 *      at all any more.
 *   2. NO SURFACE SAYS "PER DAY" FOR LIVE_STUDIO. The catalog, the AI-crawler
 *      surface, the help center, and the buy pages all describe a one-time,
 *      once-per-event unlock — never a daily or per-event-day rate.
 *   3. RECLAIM'S GRACE PERIOD IS STILL AN IMPORTED, NAMED CONSTANT. LS6 retired
 *      the broadcast-day constant `reclaimStaleCheckouts` used to borrow
 *      (`PANOOD_WINDOW_HOURS`); the pool-channel reclaim sweep must still read
 *      from ONE named place, never a bare `24` typed twice.
 *
 * Uses the repo's ONE comment stripper (lib/strip-comments.ts) so prose
 * describing "per day" — this docblock included — is never mistaken for the
 * defect itself.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { canPublishMultiCam } from './live-studio-publish';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

/* ══════════════════════════════════════════════════════════════════════════════
   1 · AN OWNED EVENT'S MULTICAM DOES NOT EXPIRE WITH TIME
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * A minimal ownership stub: `orders` holds ONE paid row, dated a decade before
 * this test runs, and every other table/RPC `eventSkuActive` might touch is a
 * graceful no-op. `checkOrderActive` only ever `.select('status')`s this table —
 * it never reads `created_at` — so this stub does not even need to construct a
 * "long ago" timestamp for the code to ignore; the point is there is no code
 * path left that could read one.
 */
function longAgoOwnedSupabase(): SupabaseClient {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    neq: () => q,
    in: () => q,
    not: () => q,
    order: () => q,
    limit: () => q,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then(onOk: (v: unknown) => unknown) {
      return Promise.resolve({ data: [{ status: 'paid' }], error: null }).then(onOk);
    },
  };
  return {
    from: () => q,
    rpc: () => Promise.resolve({ data: false, error: null }),
  } as unknown as SupabaseClient;
}

test('🔒 an event owned long ago and never touched since still gets multi-cam today', async () => {
  const supabase = longAgoOwnedSupabase();
  const ok = await canPublishMultiCam(supabase, 'S89E-DECADEOLD1');
  assert.equal(ok, true, 'LS6 retired the clock — ownership alone must be enough, regardless of age');
});

test('decideBroadcastWindow reads NOTHING but the ownership boolean', () => {
  const src = stripComments(read('./live-studio-window.ts'));
  const fn = src.slice(
    src.indexOf('export function decideBroadcastWindow'),
    src.indexOf('\nexport ', src.indexOf('export function decideBroadcastWindow') + 10) === -1
      ? undefined
      : src.indexOf('\nexport ', src.indexOf('export function decideBroadcastWindow') + 10),
  );
  assert.doesNotMatch(fn, /\bnow\b/, 'the decision must not read a clock — that is the whole retirement');
  assert.doesNotMatch(fn, /getTime\(\)|Date\.now/, 'no time arithmetic may survive in the decision');
  assert.match(fn, /input\.owned/, 'ownership must still be the thing actually read');
});

/* ══════════════════════════════════════════════════════════════════════════════
   2 · NO SURFACE SAYS "PER DAY" FOR LIVE_STUDIO
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Every `.ts`/`.tsx` file under app/ + lib/, DERIVED — not a hand-typed list —
 * so a ninth surface that resurrects "per event-day" prose next month is caught
 * without anyone remembering to add it here. Skips test files themselves (they
 * are allowed to name the retired phrase while asserting it is gone) and this
 * file.
 */
function sourceFiles(): string[] {
  const out: string[] = [];
  const skipDirs = new Set(['node_modules', '.next', '__pycache__']);
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (skipDirs.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        walk(p);
      } else if (extname(name) === '.ts' || extname(name) === '.tsx') {
        if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
        out.push(p);
      }
    }
  })(join(WEB, 'app'));
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (skipDirs.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        walk(p);
      } else if (extname(name) === '.ts' || extname(name) === '.tsx') {
        if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
        out.push(p);
      }
    }
  })(join(WEB, 'lib'));
  return out;
}

test('🔴 no non-test surface under app/ or lib/ still says Live Studio is priced per day', () => {
  const files = sourceFiles();
  assert.ok(files.length >= 500, `floor: expected 500+ source files, found ${files.length} — the walk broke`);

  const offenders: string[] = [];
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    // Cheap pre-filter — stripping comments on every file in the tree would be
    // needlessly slow. "per event-day" only ever described LIVE_STUDIO in this
    // codebase (Patiktok says "per day", never "per event-day"), so the phrase
    // ALONE is specific enough without also requiring the SKU name nearby.
    //
    // ⚠ THAT PREMISE GAINED AN EXCEPTION ON 2026-09-03 (LS8), AND THE GUARD WAS
    // KEPT RATHER THAN LOOSENED. `LIVE_STUDIO_HOSTED_CHANNEL` came back on sale
    // at ₱3,000 PER DAY — genuinely per-day, deliberately, because a Setnayan
    // channel is a scarce resource while the software unlock is not. So a
    // Live-Studio-FAMILY SKU can now honestly be described as priced per day,
    // and this test fired on llms.txt prose saying exactly that. The prose was
    // reworded ("charged for each day it is used"); the assertion was NOT
    // relaxed to allow the phrase near the hosted-channel SKU.
    //
    // 🔑 WHY KEEP THE STRICTER RULE: the defect it guards is a surface telling a
    // couple their ₱2,500 one-time unlock expires. A regex that tried to tell
    // the two SKUs apart by proximity would be the thing that quietly stops
    // matching. If a future surface genuinely needs to say the hosted channel is
    // "priced per day", narrowing this is a deliberate decision to make with the
    // failure in front of you — not a phrase to slip past.
    if (!/per event-day/i.test(raw) && !/priced per day/i.test(raw)) continue;
    const stripped = stripComments(raw);
    if (/per event-day/i.test(stripped) || /priced per day/i.test(stripped)) {
      offenders.push(file.slice(WEB.length + 1));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these surfaces still describe Live Studio as priced per day/per event-day, ` +
      `which LS6 retired (2026-09-02 — one unlock, once per event, forever):\n  ${offenders.join('\n  ')}`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   3 · RECLAIM'S GRACE PERIOD IS STILL AN IMPORTED, NAMED CONSTANT
   ══════════════════════════════════════════════════════════════════════════════ */

test('the pool-channel reclaim grace period is a named constant, never a bare literal', () => {
  const src = stripComments(read('./live-studio-roam-provision.ts'));
  assert.match(
    src,
    /export const POOL_CHANNEL_RECLAIM_GRACE_HOURS = 24;/,
    'the grace period must still be declared as its own named, exported constant',
  );
  const fn = src.slice(
    src.indexOf('export async function reclaimStaleCheckouts'),
    src.indexOf('\nexport ', src.indexOf('export async function reclaimStaleCheckouts') + 10),
  );
  assert.match(
    fn,
    /POOL_CHANNEL_RECLAIM_GRACE_HOURS/,
    'reclaimStaleCheckouts must derive its cutoff from the named constant',
  );
  assert.doesNotMatch(
    fn,
    /\b24\s*\*\s*60\s*\*\s*60\b/,
    'no bare 24-hour literal may sit beside (or replace) the named constant',
  );
  // The retired import must not have come back — see the guard test's own note
  // on why reusing a constant whose meaning was retired would be worse than
  // writing a fresh one.
  assert.doesNotMatch(
    stripComments(read('./live-studio-roam-provision.ts')),
    /from '@\/lib\/panood-watermark'/,
    'must not re-import the retired broadcast-day constant',
  );
});
