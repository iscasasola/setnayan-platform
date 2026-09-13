/**
 * A DEAL WITH NO QUOTED PRICE CANNOT BE LOCKED — AND NOBODY IS TOLD IT WAS.
 *
 * 🔴 WHAT THIS PINS (found 2026-09-10). A Deal struck in chat before the
 * supplier sent a formal quote has no base total. The card still offered
 * "🔒 Lock this deal"; pressing it booked nobody, stamped the Deal locked,
 * froze the thread at a NULL price, sent the supplier "Deal locked", and the
 * card then read "Price agreed and frozen at this amount."
 *
 * Three halves, each of which can rot on its own:
 *   1. THE RULE (`dealLockReadiness`) — behaviour, not source.
 *   2. THE WORDS — no sentence shown for an unpriced Deal claims a lock or a
 *      frozen amount; the freeze line's unpriced arm holds in EVERY state.
 *   3. THE WIRING — every screen that mounts the Lock form gates it on the rule
 *      (the file set is DERIVED by scanning app/, never listed), and `lockDeal`
 *      refuses BEFORE its first write. Comments are stripped first: the fixed
 *      files carry notes naming the strings they removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  dealLockReadiness,
  dealLockRefusal,
  dealNotLockableLine,
} from '@/lib/deal-lock-readiness';
import { lockFreezeLine } from '@/lib/lock-freeze-copy';
import type { LockRequestState } from '@/lib/lock-request-state';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const APP = join(WEB, 'app');
const ACTIONS = join(APP, '_components', 'negotiation-actions.ts');

const read = (abs: string) => stripComments(readFileSync(abs, 'utf8'));

/** A sentence that claims something was locked or a price frozen. "can't be
 *  locked" is allowed — it is the opposite claim. */
const CLAIMS_A_LOCK = /deal locked|price frozen|frozen at|is locked|now locked|been locked/i;

// ── 1 · THE RULE ─────────────────────────────────────────────────────────────

test('no quoted price ⇒ not lockable, whatever the changes are', () => {
  for (const base of [null, undefined]) {
    for (const items of [[], [{ amount_php: -5_000 }], [{ amount_php: 2_000 }, { amount_php: null }]]) {
      const r = dealLockReadiness(base, items);
      assert.equal(r.lockable, false, `base=${base} items=${JSON.stringify(items)} was lockable`);
      assert.equal(r.lockable === false && r.reason, 'no_quote');
    }
  }
});

test('a quoted price plus its changes is lockable at exactly that total', () => {
  // ₱100,000 quote, ₱15,000 discount, ₱2,500 add-on, a freebie (no money).
  const r = dealLockReadiness(10_000_000, [
    { amount_php: -15_000 },
    { amount_php: 2_500 },
    { amount_php: null },
  ]);
  assert.equal(r.lockable, true);
  assert.equal(r.lockable && r.totalPhp, 87_500);
  assert.equal(r.lockable && r.centavos, 8_750_000);
});

test('a total below zero is not a price anybody can book at', () => {
  const r = dealLockReadiness(1_000_000, [{ amount_php: -15_000 }]);
  assert.equal(r.lockable, false);
  assert.equal(r.lockable === false && r.reason, 'below_zero');
  // Zero is still a price (a fully comped service) — only BELOW zero refuses.
  assert.equal(dealLockReadiness(1_000_000, [{ amount_php: -10_000 }]).lockable, true);
});

// ── 2 · THE WORDS ────────────────────────────────────────────────────────────

test('the line shown in place of Lock asks for the quote and claims no lock', () => {
  const couple = dealNotLockableLine('no_quote', 'couple', 'Villa Catering');
  const vendor = dealNotLockableLine('no_quote', 'vendor', 'Maria & Jose');
  assert.match(couple, /quote/i);
  assert.match(couple, /Villa Catering/);
  assert.match(vendor, /send your proposal/i);
  assert.notEqual(couple, vendor, 'each side must be told its OWN next step');
  for (const role of ['couple', 'vendor'] as const) {
    for (const reason of ['no_quote', 'below_zero'] as const) {
      const line = dealNotLockableLine(reason, role, null);
      assert.doesNotMatch(line, CLAIMS_A_LOCK, `${role}/${reason}: "${line}"`);
      assert.match(line, /can[’']t/i, `${role}/${reason} does not say it cannot be locked`);
    }
  }
});

test('the refusal a stale page gets says NOTHING was locked', () => {
  for (const reason of ['no_quote', 'below_zero'] as const) {
    const msg = dealLockRefusal(reason);
    assert.match(msg, /nothing was locked/i);
    assert.doesNotMatch(msg, /deal locked|price frozen|frozen at/i);
  }
});

test('a Deal with no saved price is never told its amount is frozen — in ANY state', () => {
  const states: Array<LockRequestState | null | undefined> = [
    'none',
    'requested',
    'declined',
    'cancelled',
    'expired',
    'locked',
    null,
    undefined,
  ];
  for (const viewerRole of ['couple', 'vendor'] as const) {
    for (const state of states) {
      const line = lockFreezeLine({ state, viewerRole, priceFrozen: false });
      assert.equal(line.tone, 'unpriced', `${viewerRole}/${state}`);
      assert.doesNotMatch(line.text, /frozen at|deal locked|price frozen/i, `${viewerRole}/${state}: "${line.text}"`);
      assert.match(line.text, /no price was saved/i);
    }
  }
  // And the priced arm is unchanged — this is not a blanket rewrite.
  assert.match(lockFreezeLine({ state: 'none', viewerRole: 'couple', priceFrozen: true }).text, /frozen at this amount/i);
});

// ── 3 · THE WIRING ───────────────────────────────────────────────────────────

/** Every .tsx/.ts under app/ — derived, never listed. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if ((abs.endsWith('.tsx') || abs.endsWith('.ts')) && !abs.endsWith('.test.ts')) out.push(abs);
  }
  return out;
}

test('every screen that mounts the Lock form gates it on the price rule', () => {
  const mounts = walk(APP)
    .map((abs) => ({ file: abs.slice(WEB.length + 1), src: read(abs) }))
    .filter((f) => /action=\{lockDeal\}/.test(f.src));
  // Anti-vacuity: a scan that finds nothing passes for free.
  assert.ok(mounts.length >= 1, `found ${mounts.length} Lock forms — did the scan break?`);

  for (const { file, src } of mounts) {
    assert.match(src, /dealLockReadiness\(/, `${file} mounts Lock without asking whether the Deal has a price`);
    const gateAt = src.indexOf('!readiness.lockable ?');
    const formAt = src.indexOf('action={lockDeal}');
    assert.ok(gateAt > 0, `${file} never branches on !readiness.lockable`);
    assert.ok(gateAt < formAt, `${file} renders the Lock form before the no-price branch — the gate protects nothing`);
    // The button may not render with an optional price any more: an optional
    // price on the button is how "Lock this deal" appeared with none.
    assert.doesNotMatch(
      src,
      /newTotal != null \? ` — ₱/,
      `${file} renders the Lock button with an optional price again`,
    );
    assert.match(src, /priceFrozen:/, `${file} does not tell the freeze line whether a price exists`);
  }
});

test('lockDeal refuses a Deal with no price BEFORE any write', () => {
  const src = read(ACTIONS);
  const start = src.search(/export async function lockDeal\b/);
  assert.ok(start > 0, 'lockDeal is gone — this guard is blind. Re-anchor it.');
  const nextExport = src.indexOf('\nexport ', start + 10);
  const body = src.slice(start, nextExport === -1 ? src.length : nextExport);

  const gateAt = body.indexOf('if (!readiness.lockable)');
  assert.ok(body.includes('dealLockReadiness('), 'lockDeal no longer asks the price rule');
  assert.ok(gateAt > 0, 'lockDeal no longer refuses an unpriced Deal');

  const refusal = body.slice(gateAt, body.indexOf('}', body.indexOf('redirect(dest)', gateAt)) + 1);
  assert.match(refusal, /dealLockRefusal\(readiness\.reason\)/, 'the refusal is silent — the couple must be told why');

  // Every write and every "locked" message must come AFTER the refusal.
  const after: Array<[string, RegExp]> = [
    ['the booking', /bookVendorAtChatLock\(/],
    ['the Deal stamp', /\.update\(\{ locked_at: now \}\)/],
    ['the thread price freeze', /agreed_price_centavos:/],
    ['the "Deal locked" notice', /notifyChangeCounterparty\(ctx, 'Deal locked'/],
  ];
  for (const [what, re] of after) {
    const at = body.search(re);
    assert.ok(at > 0, `${what} anchor is missing — the ordering check would mean nothing`);
    assert.ok(gateAt < at, `${what} happens BEFORE the no-price refusal`);
  }

  // The booking must no longer be skipped silently on a missing price — with
  // the refusal in front, the only condition left is whether a booking row exists.
  assert.doesNotMatch(
    body,
    /agreedCentavos != null && newTotal != null/,
    'lockDeal again tolerates a missing price by skipping the booking and freezing anyway',
  );
});
