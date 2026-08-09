/**
 * ⚠ SOMEBODY IS TOLD WHEN A CAMERA IS SILENTLY DROPPED.
 *
 * THE BUG. `provisionRoamBroadcasts` counts every camera channel it refuses
 * because the Setnayan pool channel's `concurrent_cap` was already full
 * (`skippedOverCap`) — and its ONE caller, `goLivePanood`, called it with the
 * result discarded on the floor. A host could name six camera channels, print
 * six QR codes, hand them to six people, press Go live, get a green success, and
 * two of those operators would never appear on air. Nothing threw. Nothing
 * logged. Nobody was told. The number existed the whole time.
 *
 * WHAT THIS GUARDS, AND WHY IT IS SHAPED LIKE THIS. A number COMPUTED and
 * discarded is exactly the defect, so asserting that `skippedOverCap` is
 * calculated would pass on the broken code. Every assertion below follows the
 * value along the only path that ends in a human reading it:
 *
 *   1. the pure sentence      — cameraDropNotice()      (behaviour)
 *   2. onto the result        — provisionRoamBroadcasts (source, comments stripped)
 *   3. out of the action      — goLivePanood            (source, comments stripped)
 *   4. onto the two screens   — GoLiveCard · TransportRow (source, comments stripped)
 *
 * Hops 2–4 are source assertions because the wiring cannot be exercised here:
 * `provisionRoamBroadcasts`'s loop dynamically imports `live-studio-channel-grants`
 * and `panood-youtube`, both of which carry `import 'server-only'` and do not
 * resolve under `tsx --test`; `goLivePanood` is a `'use server'` module over
 * `next/navigation`; and the two screens are React islands. What CAN break
 * silently in a future edit is the wiring, so the wiring is what is pinned.
 *
 * ⚠ EVERY source assertion runs over `codeOf()` — comments stripped. This file's
 * subject is documented in prose at all four sites (that is the point of the
 * comments), and a whole-file grep would happily match the paragraph explaining
 * the bug and then pass forever on its own justification.
 *
 * Run: `npx tsx --test lib/live-studio-camera-drop-notice.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cameraDropNotice } from './live-studio-roam-provision';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

/** Strip comments — see the header. The subject is the CODE, so it reads code. */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 · THE SENTENCE ITSELF — behaviour
   ══════════════════════════════════════════════════════════════════════════════ */

test('nothing dropped → no banner at all', () => {
  assert.equal(cameraDropNotice({ skippedOverCap: 0, carried: 4, cap: 4 }), null);
  assert.equal(cameraDropNotice({ skippedOverCap: -3, carried: 4, cap: 4 }), null);
  assert.equal(cameraDropNotice({ skippedOverCap: Number.NaN, carried: 4, cap: 4 }), null);
});

test('the host is told HOW MANY were dropped, OUT OF HOW MANY, and the ceiling', () => {
  const notice = cameraDropNotice({ skippedOverCap: 2, carried: 4, cap: 4 });
  assert.ok(notice, 'a dropped camera must produce a sentence');
  // The three numbers a host can act on. 2 refused + 4 carried = 6 they set up.
  assert.match(notice, /\b2 of your 6 cameras\b/);
  assert.match(notice, /\b4 cameras at a time\b/);
  // Plain English, and no engineering vocabulary leaks to the couple.
  assert.ok(
    !/concurrent_cap|skippedOverCap|zone|roam|manifest/i.test(notice),
    'this is read by a couple on their wedding day, not by an engineer',
  );
});

test('one dropped camera reads as one, not as "1 cameras is/are"', () => {
  const one = cameraDropNotice({ skippedOverCap: 1, carried: 3, cap: 3 });
  assert.ok(one);
  assert.match(one, /\b1 of your 4 cameras is not being broadcast\b/);
  const many = cameraDropNotice({ skippedOverCap: 2, carried: 3, cap: 3 });
  assert.ok(many);
  assert.match(many, /\b2 of your 5 cameras are not being broadcast\b/);
});

test('the denominator is what the host SET UP, never inferred from the cap', () => {
  // A zone that already had a stream is counted as reused BEFORE the cap check,
  // so `carried` can legitimately sit above `cap`. Printing "cap + dropped" would
  // under-report the host's own cameras back to them.
  const notice = cameraDropNotice({ skippedOverCap: 1, carried: 5, cap: 4 });
  assert.ok(notice);
  assert.match(notice, /\b1 of your 6 cameras\b/);
  assert.match(notice, /\b4 cameras at a time\b/);
});

/* ══════════════════════════════════════════════════════════════════════════════
   2 · THE COUNT REACHES THE RESULT — it is no longer thrown away
   ══════════════════════════════════════════════════════════════════════════════ */

const PROVISION = 'lib/live-studio-roam-provision.ts';

test('provisionRoamBroadcasts CARRIES the sentence out on its result', () => {
  const src = repoFile(PROVISION);
  const fn = codeOf(src.slice(src.indexOf('export async function provisionRoamBroadcasts')));
  assert.match(
    fn,
    /notice: cameraDropNotice\(\{\s*skippedOverCap,\s*carried: created \+ reused,\s*cap,?\s*\}\)/,
    'the success result must build the sentence from the count — computing skippedOverCap and returning it as a bare number is the bug this file exists for',
  );
  // …and the field is on the TYPE, so a caller can actually reach it.
  const type = codeOf(src.slice(src.indexOf('export type ProvisionResult'), src.indexOf('function failure(')));
  assert.match(type, /notice: string \| null;/, 'ProvisionResult must declare the notice');
});

test('a failed provision reports no dropped cameras rather than a stale one', () => {
  const src = repoFile(PROVISION);
  const fn = codeOf(src.slice(src.indexOf('function failure('), src.indexOf('export async function provisionRoamBroadcasts')));
  assert.match(fn, /notice: null,/, 'a failure has no camera count to report');
});

/* ══════════════════════════════════════════════════════════════════════════════
   3 · THE COUNT LEAVES THE ACTION — goLivePanood no longer discards the result
   ══════════════════════════════════════════════════════════════════════════════ */

const ACTIONS = 'app/dashboard/[eventId]/studio/panood/setup/actions.ts';

test('goLivePanood keeps the provision result and returns the notice to the screen', () => {
  const src = repoFile(ACTIONS);
  const fn = codeOf(
    src.slice(src.indexOf('export async function goLivePanood'), src.indexOf('export async function endPanoodBroadcast')),
  );
  assert.match(
    fn,
    /const provisioned = await provisionRoamBroadcasts\(/,
    'the result must be BOUND — `await provisionRoamBroadcasts(...)` on its own line is how the count was lost',
  );
  assert.match(fn, /notice = provisioned\.notice;/, 'the notice must be lifted out of the provision result');
  assert.match(
    fn,
    /return \{ ok: true, notice \};/,
    'the success the host receives must carry the notice — a notice that stops at the server is the same silence',
  );
});

test('GoLiveResult can actually hold a notice — a success is not just {ok:true}', () => {
  const type = codeOf(repoFile(ACTIONS));
  assert.match(
    type,
    /export type GoLiveResult = \{ ok: true; notice\?: string \| null \} \| \{ error: string \};/,
    'the success shape must have somewhere to put it',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   4 · THE COUNT IS SHOWN — both screens with a "Go live" button render it
   ══════════════════════════════════════════════════════════════════════════════ */

const SCREENS = [
  'app/dashboard/[eventId]/studio/panood/setup/go-live-card.tsx',
  'app/panood/control/[eventId]/transport-row.tsx',
];

for (const screen of SCREENS) {
  test(`${screen} READS the notice off the result and RENDERS it`, () => {
    const src = codeOf(repoFile(screen));

    // (a) read it off the action's reply — not just handle the error branch.
    assert.match(
      src,
      /setNotice\(result\.notice \?\? null\)/,
      'the success branch must take the notice; handling only `error` is how the count stayed invisible',
    );
    // (b) hold it in state the render can see.
    assert.match(src, /const \[notice, setNotice\] = useState<string \| null>\(null\)/);
    // (c) ⭐ THE ONE THAT MATTERS — the state variable is actually PAINTED. A
    //     notice stored in state and never rendered is the original defect with
    //     an extra step.
    assert.match(
      src,
      /\{notice \? \([\s\S]{0,800}<span>\{notice\}<\/span>/,
      'the notice must reach the DOM inside a branch guarded on the notice itself',
    );
    // (d) it is a WARNING, not an error — the broadcast did go out, and dressing
    //     a live show up as a failure sends a host hunting for something to retry.
    assert.match(src, /role="status"/);
    // (e) cleared before each press, so yesterday's banner cannot linger over a
    //     broadcast it is not about.
    assert.match(src, /setError\(null\);\s*setNotice\(null\);/);
  });
}
