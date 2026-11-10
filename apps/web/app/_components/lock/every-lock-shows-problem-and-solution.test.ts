/**
 * 🔒 EVERY LOCK SHOWS THE PROBLEM AND THE SOLUTION (HOUSE_TEMPLATES T30; owner 10 Nov 2026 "always show the Problem and
 * Solution"; Build 5 · Lane B). Held:
 *   · every lock in `lib/locks.ts` has a real name, a Problem line and a Solution line;
 *   · the ONE explainer rises full screen (`RiseScreen`) and draws Problem, then Solution, then the view-only preview,
 *     then the progress/price, with ONE button (Get verified or Upgrade) — and no Upgrade in the store shell;
 *   · `canUse` is the one decision: a verify lock lifts the moment the shop is Verified; no plan lock opens before it;
 *   · 🔑 A UI-ONLY LOCK IS A BUG: every lock names its server gate, or is on the list below of gates still to wire. The
 *     list must match exactly, so wiring one (or adding one) updates it — it can only shrink.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LOCKS, LOCK_KEYS, canUse, papersProgress, type LockDef } from '@/lib/locks';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/_components/lock
const WEB = join(HERE, '../../..');
const PART = stripComments(readFileSync(join(HERE, 'locked-feature.tsx'), 'utf8'));
const LIMIT = stripComments(readFileSync(join(HERE, 'limit-sheet.tsx'), 'utf8'));

/** Locks whose server gate is not wired yet (Build 5 Lane B, later slices). Shrinks only. */
const UI_ONLY_STILL_TO_WIRE = [
  'quotation',
  'payment',
  'forms',
  'bundleMaker',
  'promote',
  'analytics',
  'teamSeats',
  'beingFound',
  'reviews',
  'liveCards',
  'portfolio',
].sort();

test('every lock has a name, a Problem and a Solution', () => {
  for (const k of LOCK_KEYS) {
    const d: LockDef = LOCKS[k];
    assert.ok(d.name.trim().length > 0, `${k} has no name`);
    assert.ok(d.problem.trim().length > 8, `${k} has no Problem line`);
    assert.ok(d.solution.trim().length > 8, `${k} has no Solution line`);
    assert.notEqual(d.problem.trim(), d.solution.trim(), `${k}: the Solution repeats the Problem`);
  }
});

test('the explainer rises full screen: Problem, Solution, preview, progress, one button', () => {
  assert.match(PART, /<RiseScreen\b/);
  const order = ['data-lock-problem', 'data-lock-solution', 'data-lock-preview', 'data-lock-progress'].map((a) => PART.indexOf(a));
  for (const i of order) assert.ok(i > 0);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'Problem → Solution → preview → progress, in that order');
  // The preview is view-only.
  assert.match(PART, /<div\s+inert\b[^>]*data-lock-preview/);
  // One button: Get verified, or Upgrade — never both, and no Upgrade in the store shell.
  assert.match(PART, /label="Get verified" href=\{GET_VERIFIED_HREF\}/);
  assert.match(PART, /storeShell \? null : \(\s*<ActionButton[^>]*label=\{`Upgrade to/);
  assert.match(PART, /thumb=\{button\}/);
});

test('a locked row shows its real name and a 🔒 — never hidden, never a dead button', () => {
  assert.match(PART, /\{def\.name\}\s*<Lock aria-label="Locked"/);
  assert.match(PART, /onOpen=\{\(\) => setOpen\(true\)\}/);
  assert.doesNotMatch(PART, /disabled/);
});

test('canUse: Verified lifts every verify lock; no plan lock opens before the papers', () => {
  for (const k of LOCK_KEYS) {
    if (LOCKS[k].opens !== 'verified') continue;
    assert.deepEqual(canUse(k, { verified: false, tier: 'enterprise' }), { ok: false, needs: 'verify' });
    assert.deepEqual(canUse(k, { verified: true, tier: 'free' }), { ok: true });
  }
  assert.match(papersProgress({ done: 2, of: 4 }), /^2 of 4 papers in/);
  assert.match(papersProgress(null), /Couldn’t read/);
});

test('a UI-only lock is a bug: every lock names its server gate or is on the to-wire list', () => {
  const uiOnly = LOCK_KEYS.filter((k) => LOCKS[k].server === null).sort();
  assert.deepEqual(uiOnly, UI_ONLY_STILL_TO_WIRE, 'update UI_ONLY_STILL_TO_WIRE — it may only shrink');
  for (const k of LOCK_KEYS) {
    const s = LOCKS[k].server;
    if (!s) continue;
    assert.ok(existsSync(join(WEB, s)), `${k}: ${s} is gone`);
  }
  // The plans lock: the purchase is refused for an unverified shop on the server (NOT_VERIFIED).
  assert.match(readFileSync(join(WEB, LOCKS.plans.server), 'utf8'), /NOT_VERIFIED/);
  // The Offer Maker (Build 6 Lane D): every write asks canUse('offerMaker') before it touches a row.
  const offers = readFileSync(join(WEB, LOCKS.offerMaker.server), 'utf8');
  assert.match(offers, /canUse\('offerMaker'/);
  for (const fn of ['saveOffer', 'setOfferOn', 'removeOffer', 'loadOfferMaker']) {
    const at = offers.indexOf(`async function ${fn}(`);
    assert.ok(at >= 0, `${fn} is gone`);
    const end = offers.indexOf('\nasync function ', at + 1);
    const body = offers.slice(at, end < 0 ? undefined : end);
    const asked = body.indexOf('await gate()');
    assert.ok(asked >= 0 && (body.indexOf('.from(') < 0 || asked < body.indexOf('.from(')), `${fn} writes before the lock is asked`);
  }
});

test('Door 1 saves at the current limit and offers Upgrade or Keep, equal widths', () => {
  assert.match(LIMIT, /<RiseScreen\b/);
  assert.match(LIMIT, /grid grid-cols-2/);
  assert.match(LIMIT, /label=\{ask\.keep\}/);
  assert.match(LIMIT, /storeShell \? null/);
});
