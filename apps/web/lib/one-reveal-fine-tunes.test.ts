import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  ANIM_TEMPO_TIMINGS,
  REVEAL_FINE_TUNE,
  resolveRevealTiming,
  sanitizeStudioConfig,
} from '@/lib/monogram-studio-shared';

/**
 * ⚖ Owner 2026-09-21: *"please add that fine tune on the lower part reveal
 * which will be the official reveal"* · *"on the upper editors should both not
 * have reveal. just the one at the bottom."*
 */

test('no slider values → the tempo preset, named', () => {
  assert.deepEqual(resolveRevealTiming('quick'), { ...ANIM_TEMPO_TIMINGS.quick, preset: 'quick' });
  assert.deepEqual(resolveRevealTiming('classic', { dur: 'x', delay: null }), { ...ANIM_TEMPO_TIMINGS.classic, preset: 'classic' });
});

test('fine-tuned values are kept and called custom; a preset’s numbers keep its name', () => {
  const t = resolveRevealTiming('classic', { dur: 4, delay: 0.5, smooth: 0.8 });
  assert.deepEqual(t, { dur: 4, delay: 0.5, smooth: 0.8, preset: 'custom' });
  assert.equal(resolveRevealTiming('classic', ANIM_TEMPO_TIMINGS.ceremonial).preset, 'ceremonial');
});

test('out-of-range values are clamped to the sliders — and the saved config agrees', () => {
  const t = resolveRevealTiming('classic', { dur: 99, delay: -3, smooth: 7 });
  assert.equal(t.dur, REVEAL_FINE_TUNE.dur.max);
  assert.equal(t.delay, REVEAL_FINE_TUNE.delay.min);
  assert.equal(t.smooth, REVEAL_FINE_TUNE.smooth.max);
  // The slider ranges and the stored-config bounds must be the same range, or a
  // value the slider allows would be silently changed on save.
  for (const k of ['dur', 'delay', 'smooth'] as const) {
    for (const edge of [REVEAL_FINE_TUNE[k].min, REVEAL_FINE_TUNE[k].max]) {
      const cfg = sanitizeStudioConfig({ text: 'A & B', anim: { kind: 'handwriting', dur: 6, delay: 0.3, smooth: 0.9, [k]: edge } });
      assert.equal(cfg?.anim?.[k], edge, `${k}=${edge} is allowed by the slider but changed by the saved config`);
    }
  }
});

const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));
const M = ['app', 'dashboard', '[eventId]', 'monogram'];

test('the studio shows no Reveal tab — the reveal is the one at the bottom', () => {
  const css = read('lib', 'monogram-studio', 'markup-v2.ts');
  assert.match(css, /\.vsroot \.vs \.vt\[data-vt="reveal"\]\{display:none!important\}/, 'the studio’s Reveal tab is visible again');
  assert.match(css, /#animbox\{display:none!important\}/, 'the studio’s reveal panel is visible again');
});

test('the official reveal saves what its Fine-tune sliders say', () => {
  const rows = read(...M, 'animate-rows.tsx');
  assert.match(rows, /commitMonogram\(\{ \.\.\.m\.mark, eventId, kind, tempo, timing, animate \}\)/, 'the sliders are not saved');
  assert.equal((rows.match(/type="range"/g) ?? []).length, 1, 'expected ONE range input, mapped over the three sliders');
  assert.match(rows, /min=\{REVEAL_FINE_TUNE\[s\.k\]\.min\}/, 'the sliders no longer take their range from REVEAL_FINE_TUNE');
  const save = read(...M, 'commit-actions.ts');
  assert.match(save, /\.\.\.resolveRevealTiming\(tempo, input\.timing\)/, 'the save ignores the sliders');
});
