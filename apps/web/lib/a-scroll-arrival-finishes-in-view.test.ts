/**
 * a-scroll-arrival-finishes-in-view.test.ts — A SCENE THAT FOLLOWS THE SCROLL HAS ARRIVED BY THE TIME IT IS
 * REASONABLY IN VIEW, at every height and every Movement (the 2026-10-15 Animate walk, F1).
 *
 * 🔴 What was measured: the scroll-driven arrival ran over `entry 0% → entry 92%` — 92 % of the scene's OWN entry,
 * which is as long as the scene is tall. The Dress code scene sat at opacity 0.60, blur 3.2 px, scale 0.94 with its top
 * half-way up the screen; Venue on the Details page's first screen rested at 0.46 for good. Calm wrote no
 * `--hub-in-end`, so every untouched scene had that range.
 *
 *   (1) EVERY scene that follows the scroll is given its range (`hubCanvasVars`), Calm included; one that plays on
 *       arrival is given none.
 *   (2) THE RANGE, MODELLED for heights 40 px → 4 screens at three phone heights: the arrival is complete once the
 *       scene is fully on screen OR its top is in the upper 60 % of the screen, whichever comes first — for every
 *       feel. (A view() `entry` range is min(scene, screen) long and starts as the top comes in; `entry min(P%, Nvh)`
 *       ends at min(P% of it, N% of the screen).) Sabotage: Cinematic back to `cover 30%` → red.
 *   (3) THE STYLESHEET's fallback, wherever `--hub-in-end` is read, is Calm's own range — never the old `entry 92%`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_SCROLL_IN_END, hubCanvasVars, resolveHubMotion, sanitizeHubCanvas } from './hub-canvas';

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/** Scroll (px, from the moment the scene's top enters at the bottom) at which an `entry …` range end is reached. */
function endsAt(range: string, sceneH: number, screenH: number): number {
  const entry = Math.min(sceneH, screenH);
  const pct = (p: string) => (Number(p) / 100) * entry;
  const vh = (n: string) => (Number(n) / 100) * screenH;
  const min = range.match(/^entry min\((\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)vh\)$/);
  if (min) return Math.min(pct(min[1]!), vh(min[2]!));
  const plain = range.match(/^entry (\d+(?:\.\d+)?)%$/);
  if (plain) return pct(plain[1]!);
  const cover = range.match(/^cover (\d+(?:\.\d+)?)%$/);
  if (cover) return (Number(cover[1]) / 100) * (sceneH + screenH);
  throw new Error(`a range this model cannot read: ${range}`);
}

test('(1) every scene that follows the scroll is given its range; one on arrival none', () => {
  let n = 0;
  for (const timeline of ['scrub', 'time'] as const) {
    for (const duration of [undefined, 0.6, 1.1, 1.8]) {
      for (const inFx of [undefined, { fade: true }, { fade: true, blur: true, move: 'right', size: 'grow' }]) {
        const c = sanitizeHubCanvas({ timeline, ...(duration ? { duration } : {}), ...(inFx ? { inFx } : {}) });
        const v = hubCanvasVars(c);
        if (resolveHubMotion(c).timeline === 'scrub') assert.ok(v['--hub-in-end'], `a scroll scene got no range (${JSON.stringify(c)})`);
        else assert.equal(v['--hub-in-end'], undefined);
        n++;
      }
    }
  }
  assert.ok(n >= 24, 'anti-vacuity');
  /* Calm — the one nobody sets — is written too. */
  assert.equal(hubCanvasVars(sanitizeHubCanvas({ timeline: 'scrub' }))['--hub-in-end'], HUB_SCROLL_IN_END.calm);
});

test('(2) at every height and every feel, the arrival is complete once the scene is fully on screen or its top is in the upper 60 %', () => {
  let n = 0;
  for (const [feel, range] of Object.entries(HUB_SCROLL_IN_END)) {
    for (const screenH of [568, 812, 932]) {
      for (let sceneH = 40; sceneH <= 4 * screenH; sceneH += 37) {
        const fullyVisible = sceneH <= screenH ? sceneH : Infinity;
        const topAt60 = 0.4 * screenH;
        const inView = Math.min(fullyVisible, topAt60);
        const end = endsAt(range, sceneH, screenH);
        assert.ok(end <= inView + 0.5, `${feel} (${range}): a ${sceneH}px scene on a ${screenH}px screen finishes after ${Math.round(end)}px of scroll — it is in view after ${Math.round(inView)}px`);
        assert.ok(end > 0, 'an arrival with no length is no arrival');
        n++;
      }
    }
  }
  assert.ok(n > 300, `anti-vacuity: ${n}`);
  /* Three feels are three different lengths, Quick the shortest. */
  const at = (f: keyof typeof HUB_SCROLL_IN_END) => endsAt(HUB_SCROLL_IN_END[f], 2000, 812);
  assert.ok(at('quick') < at('calm') && at('calm') < at('cinematic'), 'Quick · Calm · Cinematic are not three tempos');
});

test('(2b) a part that arrives one after another never gets a range that ends before it starts — at any height', () => {
  /* The parts' staggered starts (`entry 4%` … `entry 28%`, globals.css) must sit before the feel's end, or the part's
     arrival range is inverted. */
  const starts = [...CSS.matchAll(/--hub-part-in-range: entry (\d+)% var\(--hub-in-end/g)].map((m) => Number(m[1]));
  assert.ok(starts.length >= 8 && Math.max(...starts) === 28, `anti-vacuity: ${starts}`);
  for (const [feel, range] of Object.entries(HUB_SCROLL_IN_END)) {
    for (const screenH of [568, 812, 932]) for (let h = 20; h <= 3 * screenH; h += 13) {
      const entry = Math.min(h, screenH);
      for (const s of starts) assert.ok((s / 100) * entry <= endsAt(range, h, screenH) + 0.5, `${feel}: a ${h}px part starting at entry ${s}% ends before it starts`);
    }
  }
});

test('(3) the stylesheet falls back to Calm’s own range wherever it reads the feel', () => {
  const reads = [...CSS.matchAll(/var\(--hub-in-end, ([^)]*\)?)\)/g)].map((m) => m[1]);
  assert.ok(reads.length >= 9, `anti-vacuity: ${reads.length} reads`);
  for (const r of reads) assert.equal(r, HUB_SCROLL_IN_END.calm, `a fallback that is not Calm’s range: ${r}`);
  assert.doesNotMatch(CSS, /entry 0% entry 92%|var\(--hub-in-end, entry 92%\)/, 'the old range is back');
});
