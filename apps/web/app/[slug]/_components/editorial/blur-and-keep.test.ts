/**
 * Owner ruling 2026-08-17 / confirmed 2026-08-18: withdrawing photo consent
 * must BLUR AND KEEP the capture, not hide it — so one guest opting out cannot
 * delete a table of ten people's group photo.
 *
 * The property that makes this safe to ship is MONOTONICITY: the gate can only
 * ever show LESS of the original than before, never more. Every test below
 * exists to pin one row of that table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publicKeyForCapture, type ConsentVeto } from './consent-veto';

const HERE = import.meta.dirname;

function veto(over: Partial<ConsentVeto> = {}): ConsentVeto {
  return { ids: new Set(), safeKeyById: new Map(), failed: false, ...over };
}

test('a capture nobody objected to shows its original, untouched', () => {
  assert.equal(publicKeyForCapture(veto(), 'p1', 'r2://media/p1.jpg'), 'r2://media/p1.jpg');
});

test('a vetoed capture WITH a blurred stand-in shows the stand-in — the ruling itself', () => {
  const v = veto({ ids: new Set(['p1']), safeKeyById: new Map([['p1', 'r2://media/p1.wallsafe.jpg']]) });
  assert.equal(publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'), 'r2://media/p1.wallsafe.jpg');
});

test('a vetoed capture with NO blurred stand-in still shows NOTHING', () => {
  // The bake is asynchronous and can fail. Until a blurred copy actually
  // exists, the old behaviour must hold — otherwise the softening would
  // publish the very face it exists to protect.
  const v = veto({ ids: new Set(['p1']) });
  assert.equal(publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'), null);
});

test('an unresolved veto shows nothing, even where a stand-in exists', () => {
  // `failed` means "we could not determine who objected". A stand-in for THIS
  // photo says nothing about the others, so the whole surface stays closed.
  const v = veto({ failed: true, safeKeyById: new Map([['p1', 'r2://media/p1.wallsafe.jpg']]) });
  assert.equal(publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'), null);
});

test('MONOTONE: no input can turn a hidden capture into its unblurred original', () => {
  // 🔑 THE WHOLE SAFETY ARGUMENT, ASSERTED RATHER THAN REASONED. Across every
  // combination of the gate's inputs, a vetoed capture never yields the
  // original key. If a future edit breaks this, it publishes a face somebody
  // asked us not to publish.
  const ORIGINAL = 'r2://media/p1.jpg';
  let checked = 0;
  for (const failed of [true, false]) {
    for (const vetoed of [true, false]) {
      for (const safe of [null, 'r2://media/p1.wallsafe.jpg']) {
        const v = veto({
          failed,
          ids: vetoed ? new Set(['p1']) : new Set(),
          safeKeyById: safe ? new Map([['p1', safe]]) : new Map(),
        });
        const out = publicKeyForCapture(v, 'p1', ORIGINAL);
        checked++;
        if (vetoed || failed) {
          assert.notEqual(out, ORIGINAL, `vetoed=${vetoed} failed=${failed} safe=${safe} leaked the original`);
        }
      }
    }
  }
  // A loop that skips everything passes — count what was examined.
  assert.equal(checked, 8, 'the matrix did not run in full');
});

test('a missing id or key is nothing to show', () => {
  assert.equal(publicKeyForCapture(veto(), null, 'r2://media/p1.jpg'), null);
  assert.equal(publicKeyForCapture(veto(), 'p1', null), null);
  assert.equal(publicKeyForCapture(veto(), 'p1', ''), null);
});

test('every public read in the recap goes through the gate — no raw veto checks left', () => {
  // 🔑 A GATE, NOT A CHECK REPEATED TEN TIMES. Before this change data.ts
  // consulted the veto in ten places and each dropped the row on its own.
  // Exactly ONE raw check may remain: the hero, which deliberately keeps the
  // old drop (an all-faces-blurred photo must not LEAD a wedding recap).
  const src = readFileSync(join(HERE, 'data.ts'), 'utf8');
  const raw = src.split('\n').filter((l) => l.includes('consentVeto.ids.has') && !l.trim().startsWith('//'));
  assert.equal(
    raw.length,
    1,
    `${raw.length} raw veto checks in data.ts — every public read must call publicKeyForCapture()` +
      ` instead, so the blur rule lives in one place. Found:\n${raw.join('\n')}`,
  );
  assert.match(raw[0], /heroPhotoId/, 'the one permitted raw check is the hero; this is a different site');
});

test('the bake runs for a withdrawal even when the couple never bought the wall', () => {
  // 🔑 THE RULING WOULD SILENTLY NOT APPLY OTHERWISE. Blurring was built as a
  // venue-wall feature and gated on the LIVE_WALL SKU. Withdrawal blur governs
  // the PUBLIC EVENT PAGE, which no SKU covers — so gating it the same way
  // would leave every non-wall event hiding photos forever, i.e. no change at
  // all for most couples.
  const src = readFileSync(join(HERE, '../../../../lib/face-blur.ts'), 'utf8');
  assert.match(src, /photo_consent['"]?,\s*false/, 'the bake no longer counts withdrawn-consent guests');
  assert.match(
    src,
    /if \(!withdrawnCount\) \{[\s\S]{0,400}?LIVE_WALL/,
    'the LIVE_WALL gate must be SKIPPED when a withdrawal is what triggered the bake',
  );
});
