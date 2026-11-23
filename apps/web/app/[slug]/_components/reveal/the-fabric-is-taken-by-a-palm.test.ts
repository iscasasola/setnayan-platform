/**
 * 🧵 THE FABRIC IS TAKEN BY A PALM, AND LIES CRUMPLED LIKE THE PILAK SATIN (owner 23 Nov 2026).
 *
 *   · *"fabric should not be grabbed in 1 pixel, have a bigger coverage so the pixels do not get distorted"*: a finger
 *     takes a palm of cloth around the thread it touches (a smooth bell, sized to the cloth), the hand closes and opens
 *     over a fraction of a second, the cloth beyond the palm goes along with it, and no thread is ever drawn longer
 *     than its own length (the clamp), so the satin's picture is never pulled thin.
 *   · *"you know the pilak background you placed? we want fabric to be crumpled like that and be pulled from that
 *     form"* (specs d1fafcd5): the satin lies gathered in real slack (`crumpleZ`), the creases ease out as it lifts,
 *     and its sheen is woven in code; no photo's baked folds, and the reference photo is never shipped.
 *
 * Source-read, comments stripped. Sabotage check (run once by hand): make `grab()` take only the nearest thread
 * (`cluster: [{ k: best, ox: 0, oy: 0, w: 1 }]`) → red; drop `crumple: true` from the fabric → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(readFileSync(join(__dirname, 'scenes/drape.ts'), 'utf8'));
const body = (head: string) => {
  const at = SRC.indexOf(head);
  assert.ok(at >= 0, `${head.trim()} is gone`);
  return SRC.slice(at, SRC.indexOf('\n  }\n', at));
};

test('a finger takes a palm of cloth, never one thread, and the hand closes and opens softly', () => {
  assert.match(SRC, /const palmR = \(vh: number, hold: number\) => vh \* \(/, 'the palm is not sized to the cloth');
  assert.match(SRC, /const bell = \(d2: number, R: number\) => Math\.exp\(/, 'the palm’s hold has no smooth falloff');
  const grab = body('  grab(id: number, w: Pt): boolean {');
  assert.match(grab, /cluster: this\.leadAround\(at, palmR\(this\.c\.vh, this\.cfg\.hold\), this\.cols\)/, 'a grab takes one thread again');
  assert.match(body('  private leadAround(p: Pt, R: number, from: number): Lead[] {'), /bell\(/, 'the palm’s threads are held all alike, with a hard edge');
  assert.match(body('  drag(id: number, w: Pt): void {'), /palmR\(this\.c\.vh, this\.cfg\.hold\) \* 1\.2/, 'a hand can drag the cloth thin');
  assert.match(SRC, /const take = ss\(0, 0\.25, gg\.age\);/, 'the hand yanks the cloth in one frame');
  assert.match(body('  release(id: number): void {'), /g\.off = true;/, 'letting go drops the cloth in one frame');
  assert.match(SRC, /gg\.age \+= gg\.off \? -dt/, 'a hand that let go never opens');
});

test('no thread is drawn longer than its own length; crumpled satin never folds a triangle flat', () => {
  assert.match(SRC, /const CLAMP = 1\.0\d+;/, 'the stretch clamp is gone or loose');
  const clamp = body('  clampPass(): void {');
  assert.match(clamp, /const lim = cr\[c\]! \* CLAMP;/);
  assert.match(clamp, /const lo = this\.fold \? cr\[c\]! \* 0\.\d+ : 0;/, 'gathered satin may collapse into a slit');
  assert.match(SRC, /if \(held\) for \(let s = 0; s < HELD_CLAMPS; s\+\+\) this\.clampPass\(\);/, 'a held cloth is clamped only once a frame');
  assert.match(SRC, /if \(this\.fold\) this\.bend\(/, 'pushed satin folds one thread wide');
});

test('the fabric lies crumpled like the pilak satin, eases out as it lifts, and is woven in code', () => {
  assert.match(SRC, /function crumpleZ\(x: number, y: number, vh: number\): number \{/);
  assert.match(SRC, /this\.crease = 1 - ss\(/, 'the creases never ease out');
  const fab = body('export const fabric = (): Scene =>');
  assert.match(fab, /crumple: true/, 'the fabric lies flat again');
  assert.doesNotMatch(fab, /c\.art\(/, 'the fabric draws a photo’s baked folds again');
  for (const f of ['pilak.webp', 'pilak.jpg', 'satin.webp']) assert.ok(!existsSync(join(process.cwd(), 'public/reveal/art', f)), `${f} ships`);
});
