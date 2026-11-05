/**
 * GUARD — the four render-time self-heals run on EVERY render, always.
 *
 * 🚨 THE TRAP THIS EXISTS TO KILL, and it is the tidy move, not a careless one.
 *
 * Five idempotent writes sit in this page's prologue, and every one of them is
 * Cameras-flavoured:
 *
 *   provisionFreeCamerasAdmin     — materializes the three free seats and their
 *                                   claim QR tokens. It has ONE production call
 *                                   site: this page.
 *   ensureFreePapicPoolGrantAdmin — arms the free 50-point pool. Without a grant
 *                                   `papic_reserve_event_points()` takes its
 *                                   "fence absent → allow" branch and capture
 *                                   runs UNMETERED.
 *   (ensureFreePapicOneCameraAdmin — the free dedicated camera — was the sixth
 *    and is GONE, owner 2026-10-13: its points are 0 since 20271130515135, so it
 *    armed nothing and cost a request on every view.)
 *   reconcileLimitedSnapshot      — pending → active.
 *   syncGuestCameras              — keeps guest cameras level with late RSVPs.
 *
 * When this page was split into three rooms, filing these with the Cameras room
 * is what a tidy engineer does by reflex. The consequence: a couple whose event
 * has passed lands on **Photos** by default — so free cameras would silently
 * stop being created, and capture would silently stop being metered, for exactly
 * the population least likely to open Cameras.
 *
 * ⚠ THE ROOMS ARE GONE (2026-08-27 — one page, four ways in), AND THIS GUARD IS
 * NOT. The trap it kills never depended on tabs: it is "a write that only runs
 * when some branch of the render happens to be taken". Its anchor moves from
 * the first room branch to the start of the JSX, which is the same rule stated
 * against the shape the page has now. Deleting it because the rooms went away
 * would retire a guard for a bug that is still one refactor away.
 *
 * Nothing throws. Nothing logs. CI stays green. The only symptom is an absence —
 * the same family as the phantom column, the phantom enum value, the phantom RPC
 * argument and the blocked iframe.
 *
 * ⚠ SO THIS IS NOT A STYLE RULE. Weakening it re-opens a silent, unbilled,
 * camera-less event. If a self-heal genuinely must move, it moves to a place
 * that runs on every render — never behind a room.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/*
  📷 THE PAPIC PAGE IS GONE (owner 2026-10-26: "place that on home and remove that page"); its four self-heals moved,
  in the same order, to `papic-self-heal.tsx`, which Home renders inside the couple's Papic card on every render. So
  `PAGE` is that component, its "render" is its final `return null`, and Home is checked for drawing it unconditionally.
*/
const PAGE = readFileSync(resolve(HERE, '..', '_components', 'papic-self-heal.tsx'), 'utf8');
const HOME = readFileSync(resolve(HERE, '..', '..', '..', 'page.tsx'), 'utf8');

/** Comments stripped — a guard must never pass on the prose explaining it. */
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The four writes, by the call this page makes. */
const SELF_HEALS = [
  'provisionFreeCamerasAdmin',
  'ensureFreePapicPoolGrantAdmin',
  'reconcileLimitedSnapshot',
  'syncGuestCameras',
] as const;

/**
 * The page's PROLOGUE — everything before it starts rendering. A self-heal here
 * runs on every render; one inside the JSX runs only when whatever branch holds
 * it is taken.
 */
function prologue(): string {
  const jsx = CODE.lastIndexOf('return null;');
  assert.ok(jsx > 0, 'the self-heal has no end — has it been restructured?');
  const out = CODE.slice(0, jsx);
  assert.ok(out.length > 300, 'the prologue came back suspiciously short');
  return out;
}

test('the four self-heals are still called by this page at all', () => {
  // If one disappears entirely, that is a bigger change than this guard covers —
  // but it must not pass silently on its way out.
  const missing = SELF_HEALS.filter((fn) => !new RegExp(`\\b${fn}\\s*\\(`).test(CODE));
  assert.deepEqual(
    missing,
    [],
    `these self-heals no longer run on this page at all:\n  ${missing.join('\n  ')}`,
  );
});

test('🚨 every self-heal runs BEFORE the page renders anything', () => {
  const before = prologue();
  const gated = SELF_HEALS.filter((fn) => !new RegExp(`\\b${fn}\\s*\\(`).test(before));
  assert.deepEqual(
    gated,
    [],
    `these run inside the render — whoever does not take that branch silently stops getting them:\n  ${gated.join('\n  ')}`,
  );
});

test('🚨 no self-heal is gated on anything that came from the URL', () => {
  // ⚠ THE SUBTLER SHAPE THIS EXISTS FOR: called before the JSX, but inside a
  // branch derived from the request — which is exactly what "only in the
  // Cameras room" was. Two of these four DO sit inside conditions, on purpose:
  // `reconcileLimitedSnapshot` runs only when a snapshot exists, and
  // `syncGuestCameras` only when the camera count actually disagrees with the
  // guest list (an unread count is not a count of zero, and a write triggered
  // by a failed read is a write nobody asked for). Those are DATA conditions
  // and they are the design.
  //
  // 🔑 SO THE TEST IS THE SOURCE OF THE CONDITION, NOT ITS EXISTENCE. A first
  // cut here matched any `if (…) {` and flagged both of those — and a guard
  // that cries wolf teaches you to skim past the one time it is right, which
  // this repo has already paid for.
  const before = prologue();
  const offenders: string[] = [];
  for (const fn of SELF_HEALS) {
    const at = before.search(new RegExp(`\\b${fn}\\s*\\(`));
    if (at < 0) continue;
    // The 600 characters before the call — enough to catch an enclosing guard.
    const context = before.slice(Math.max(0, at - 600), at);
    if (/\b(?:room|tab|search|searchParams)\b[^;]{0,80}\)\s*\{[^}]*$/.test(context)) {
      offenders.push(fn);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these are gated on something from the URL — whoever arrives by another link silently stops getting them:\n  ${offenders.join('\n  ')}`,
  );
});

test('the page still renders (this guard is about ORDER, not absence)', () => {
  // ⚠ WITHOUT THIS, THE FILE PASSES VACUOUSLY. If `return (` ever disappeared,
  // `prologue()` would be the whole file and every assertion above would hold
  // for free. The rooms version of this test asserted `resolvePapicRoom(` for
  // exactly the same reason; the anchor changed, the reasoning did not.
  assert.match(CODE, /return null;/);
  assert.ok(prologue().length < CODE.length, 'the prologue is the whole file — there is no render');
});

test('🚨 Home draws the self-heal on every couple render — never behind the open state or an answer from the URL', () => {
  const at = HOME.indexOf('const papicCard: PapicCardInput | null =');
  const card = HOME.slice(at, HOME.indexOf(': null;', at));
  assert.ok(at > 0, 'premise: Home builds the Papic card');
  const heal = card.indexOf('<PapicSelfHeal eventId={eventId} />');
  assert.ok(heal > 0, 'the self-heal left the Papic card');
  // Not inside the outcome branch (`hasPapicOutcome(search) ? (…) : null`), which only a save's answer opens.
  const outcome = card.indexOf('hasPapicOutcome(search) ? (');
  const outcomeEnd = card.indexOf(') : null}', outcome);
  assert.ok(!(heal > outcome && heal < outcomeEnd), 'the self-heal runs only when the URL carries an outcome');
  // The card's settings are drawn closed too (the region is `inert`, never unmounted), so the heal runs folded.
  const cardSrc = readFileSync(resolve(HERE, '..', '..', '..', '_components', 'papic-home-card.tsx'), 'utf8');
  assert.match(cardSrc, /<div className="pt-4">\{settings\}<\/div>/, 'the settings are mounted only when open — the heal would stop running');
});

test('the three self-heals run together (the speed-up the removed page’s own guard held)', () => {
  // `the-papic-page-opens-fast.test.ts` went with the page; its part (3) — the heals in ONE trip, after the host check —
  // is the self-heal's shape now.
  const all = /await Promise\.all\(\[([\s\S]*?)\]\);/.exec(CODE)?.[1] ?? '';
  for (const fn of ['provisionFreeCamerasAdmin', 'ensureFreePapicPoolGrantAdmin', 'provisionUploadsCameraAdmin']) {
    assert.match(all, new RegExp(`\\b${fn}\\(`), `${fn} left the one Promise.all`);
  }
  assert.ok(CODE.indexOf('await eventEntitlementClient(eventId)') < CODE.indexOf('await Promise.all(['), 'a heal runs before the host check');
});

