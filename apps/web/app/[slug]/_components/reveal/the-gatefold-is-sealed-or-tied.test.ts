/**
 * 🎀🔏 THE GATEFOLD IS SEALED OR TIED, NEVER BOTH (owner 23 Nov 2026: *"ribbon and wax seal never co exist together"* ·
 * *"envelope gatefold is still not fixed"*; drawing v22 `prototypes/reveals_round3_veil_rules_2026-11-23/src/env2.js`).
 *
 *   · The couple picks "Closed with": Wax seal (the default, stored as nothing) or Ribbon and bow.
 *   · Sealed: no ribbon. The seal is never broken (owner 23 Nov: *"The wax seal stays on the left flap. Do no break the
 *     seal"*): it rides the left panel whole, standing off along that panel's own face (so it never cuts into the paper
 *     as it turns); the left panel opens first (tau 1.0), and the right comes free from under it (tau 1.35).
 *   · Tied: no seal. The bow comes undone and the ribbon slides off before the panels part (tau 3.5).
 *   · Both on a soft spring, so either opens slowly.
 *
 * Source-read, comments stripped. Sabotage check (run once by hand): build the seal outside the `else` (both at once)
 * → red; drop `gatefoldClosure` from `REVEAL_ONLY_EFFECT_KEYS` → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { DEFAULT_REVEAL_EFFECTS, resolveRevealEffects, withGatefoldClosure } from '@/lib/std-reveal-effects';
import { revealHint } from './reveal-templates';

const ROOT = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const R = 'app/[slug]/_components/reveal';
const ENV = read(`${R}/scenes/envelope.ts`);
const GATE = ENV.slice(ENV.indexOf('export const envelopeGatefold'));

test('the gatefold builds the ribbon OR the seal, from the couple’s closure, never both', () => {
  assert.match(GATE, /const tied = c\.closure === 'ribbon';/);
  assert.match(GATE, /if \(tied\) rib = new GateRibbon\(c, SEAL_Y, 0, 0\.1\);\s*else seal = makeSeal\(c, 0\.4, true\);/, 'the ribbon and the seal can be built together');
  assert.equal((GATE.match(/makeSeal\(/g) ?? []).length, 1, 'the gatefold makes a second seal');
  assert.equal((GATE.match(/new GateRibbon\(/g) ?? []).length, 1, 'the gatefold ties a second ribbon');
  assert.match(ENV, /class GateRibbon \{/, 'the tied gatefold lost its ribbon');
});

test('sealed, the seal is never broken: it rides the left panel whole, standing off along the panel’s face', () => {
  const place = GATE.slice(GATE.indexOf('function placeSeal(): void {'));
  assert.ok(GATE.includes('function placeSeal(): void {'), 'the gatefold’s seal does not ride a panel');
  assert.match(place, /const tp = flaps\[0\]\?\.tip;/, 'the seal does not ride the left panel');
  assert.match(place, /for \(const half of seal\) \{/, 'the seal’s pieces move apart');
  assert.doesNotMatch(place, /flaps\[k\]|seal\[1 - k\]|ck\b/, 'the seal breaks in two again');
  assert.match(place, /Math\.sin\(tp\.th\) \* SEAL_OFF/, 'the seal stands off toward the screen, not along the paper’s face');
  assert.match(place, /Math\.cos\(tp\.th\) \* SEAL_OFF/);
  assert.match(place, /half\.rotation\.y = -tp\.th;/, 'the seal does not turn with the left panel');
});

test('the panels part from 1.0 when sealed, after the ribbon when tied, on the soft spring', () => {
  assert.match(GATE, /at: \(tied \? 3\.5 : 1\.0\) \+ \(side < 0 \? 0 : 0\.35\)/);
  assert.match(GATE, /spring: new Hinge\(0\.95, 2\.3\)/);
});

test('the closure is the couple’s: stored only when tied, read by the guest page, the previews and the Maker', () => {
  assert.equal(resolveRevealEffects({ gatefoldClosure: 'ribbon' }).gatefoldClosure, 'ribbon');
  assert.equal(resolveRevealEffects({ gatefoldClosure: 'seal' }).gatefoldClosure, undefined);
  assert.equal(resolveRevealEffects({ gatefoldClosure: 'both' }).gatefoldClosure, undefined, 'a stored junk closure plays');
  assert.equal(withGatefoldClosure(withGatefoldClosure(DEFAULT_REVEAL_EFFECTS, 'ribbon'), 'seal').gatefoldClosure, undefined);
  assert.deepEqual(withGatefoldClosure(DEFAULT_REVEAL_EFFECTS, 'seal'), DEFAULT_REVEAL_EFFECTS, 'the default seal is stored as something');
  assert.match(read('lib/reveal-access.ts'), /REVEAL_ONLY_EFFECT_KEYS = \[[^\]]*'gatefoldClosure'/, 'a couple without Event Pro can change the closure');
  assert.match(read(`${R}/scene-reveal.tsx`), /closure: cb\.current\.closure \?\? 'seal',/, 'the stage does not hand the closure to the scene');
  assert.match(read(`${R}/reveal-overlay.tsx`), /closure=\{eventEffects\?\.gatefoldClosure\}/, 'the guest page does not pass the closure');
  assert.match(read('app/dashboard/[eventId]/_components/reveal-preview.tsx'), /closure=\{effects\?\.gatefoldClosure\}/, 'the preview does not pass the closure');
  const maker = read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx');
  assert.match(maker, /data="gatefold-closure"/, 'the couple cannot pick the closure');
  assert.match(maker, /onPick=\{\(k\) => setEffects\(withGatefoldClosure\(effects, k as GatefoldClosure\)\)\}/);
});

test('the guest is told what to tap: the seal, or the bow when tied', () => {
  assert.equal(revealHint('envelope-gatefold'), 'Tap the seal');
  assert.equal(revealHint('envelope-gatefold', 'ribbon'), 'Tap the bow');
  assert.equal(revealHint('envelope-classic', 'ribbon'), 'Tap the seal');
});
