/**
 * apps/web/lib/every-animate-control-wears-the-mark.test.ts
 *
 * 💎 EVERY ANIMATE CONTROL WEARS THE SHIPPED " ◆" (owner 2026-10-16, DECISION_LOG "ALL ANIMATE, EFFECTS, STYLES AND
 * ACCENTS ARE EVENT HUB PRO ◆": *"all animate, effects, styles, accents are pro"*). The 2026-10-18 re-gate (#6623)
 * held every Animate pick at ✓ Apply, but on the toolbar's Animate only Movement ◆ and Leaves ◆ said so — the effects
 * (Fade · Blur · Move · Size), While on screen, From / To, Band, Plays, Rows, Words / Reveal and Delay wore nothing,
 * so a free couple met the Apply sheet's list with no warning on the row they had used.
 *
 * PROPERTY, not phrasing: every visible name `StageAnimate` draws — each `small` of a `Dd` and each effect chip — goes
 * through `animatePro` or already ends in ◆. A new control added without the mark turns this red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { animatePro } from '@/app/dashboard/[eventId]/launch/_components/stage-panel/stage-animate';

const SRC = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/launch/_components/stage-panel/stage-animate.tsx'), 'utf8'));

test('animatePro adds the mark once, never twice', () => {
  assert.equal(animatePro('Delay'), 'Delay ◆');
  assert.equal(animatePro('Leaves ◆'), 'Leaves ◆');
  assert.equal(animatePro(animatePro('Rows')), 'Rows ◆');
});

test('every Dd name on the Animate rows wears ◆', () => {
  const smalls = [...SRC.matchAll(/\bsmall=(\{[^\n]*?\}|"[^"]*")(?=\s+label=)/g)].map((m) => m[1]!);
  // While on screen · From/To · Band · Movement · Plays · Rows · Words/Reveal · Delay · Leaves
  assert.ok(smalls.length >= 9, `the scan found ${smalls.length} names — it is blind`);
  for (const s of smalls) {
    const marked = /^\{animatePro\(/.test(s) || /◆"$/.test(s);
    assert.ok(marked, `an Animate control is named without ◆: small=${s}`);
  }
});

test('the four effects (Fade · Blur · Move · Size) each wear ◆', () => {
  const block = /const EFFECTS = \[([\s\S]*?)\] as const;/.exec(SRC);
  assert.ok(block, 'EFFECTS not found — the scan is blind');
  const labels = [...block[1]!.matchAll(/label:\s*([^}]+?)\s*\}/g)].map((m) => m[1]!.trim());
  assert.equal(labels.length, 4, `expected the four effects, found ${labels.length}`);
  for (const l of labels) assert.match(l, /^animatePro\('(Fade|Blur|Move|Size)'\)$/, `an effect chip without ◆: ${l}`);
});
