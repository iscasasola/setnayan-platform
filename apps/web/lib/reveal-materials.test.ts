/**
 * reveal-materials.test.ts — every theme dresses its opening; Classic and the
 * veil stay exactly as they were (Maker Phase 6).
 *
 * The plan's acceptance line: "material slots exist for all ten themes × four
 * openings (a property test over the registry)". The four dressable openings are
 * the rigid ones (three envelopes + doors); the sheer veil is never dressed
 * (owner 2026-09-24: "the veil is untouched").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INVITE_THEME_IDS, INVITE_THEMES } from './invite-themes';
import { REVEAL_TEMPLATE_IDS } from './reveal-config-pure';
import { REVEAL_MATERIALS, revealMaterialVars, revealMaterialsFor } from './reveal-materials';
import { stripComments } from './strip-comments';

const HEX = /^#[0-9a-f]{6}$/;
const TRIPLE = /^\d{1,3} \d{1,3} \d{1,3}$/;
const DRESSABLE = REVEAL_TEMPLATE_IDS.filter((t) => t !== 'veil-sheer');

test('the registry has exactly the ten themes, and only Classic is undressed', () => {
  assert.deepEqual(Object.keys(REVEAL_MATERIALS).sort(), [...INVITE_THEME_IDS].sort());
  const undressed = INVITE_THEME_IDS.filter((id) => REVEAL_MATERIALS[id] === null);
  assert.deepEqual(undressed, ['house']);
});

test('ten themes × the four dressable openings: every material slot is a real colour', () => {
  let slots = 0;
  for (const id of INVITE_THEME_IDS) {
    const m = revealMaterialsFor(id);
    const vars = revealMaterialVars(m);
    for (const opening of DRESSABLE) {
      if (!m) {
        assert.deepEqual(vars, {}, `Classic must render the shipped ${opening} untouched`);
        continue;
      }
      for (const k of ['paper', 'liner', 'door', 'seal', 'veil', 'petals'] as const) {
        assert.match(m[k], HEX, `${id} × ${opening}: ${k}`);
        slots += 1;
      }
      for (const [name, v] of Object.entries(vars)) assert.match(v, TRIPLE, `${id}: ${name} must be an R G B triple`);
      assert.ok(m.name.length > 0);
    }
  }
  console.log(`  material slots checked: ${slots}`);
  // RE-AIMED 23 Nov (themes batch 1): five more dressed themes — 14, every theme but Classic.
  assert.equal(slots, 14 * DRESSABLE.length * 6);
});

test('the dressed paper is the theme’s own colour — the materials follow the theme', () => {
  for (const id of INVITE_THEME_IDS) {
    const m = REVEAL_MATERIALS[id];
    if (!m) continue;
    const p = INVITE_THEMES[id].palette;
    const own = new Set([p.canvas, p.surface, p.accent, p.heading, p.ink].map((c) => c.toLowerCase()));
    const fromPalette = [m.paper, m.liner, m.door].filter((c) => own.has(c)).length;
    assert.ok(fromPalette >= 1, `${id}: no material comes from the theme's palette`);
  }
});

test('the overlay draws NO theme materials since 23 Nov 2026 — the nine reveals are as drawn, the veil untouched', () => {
  const src = stripComments(
    readFileSync(join(__dirname, '..', 'app/[slug]/_components/reveal/reveal-overlay.tsx'), 'utf8'),
  );
  const veil = src.indexOf('<VeilReveal');
  assert.ok(veil > 0, 'anchors moved — re-anchor this guard');
  /* The retired CSS envelopes were what took the theme's paper / liner / door colours; the reveals that replaced them are
     frozen as drawn (owner, "REVEALS ACCEPTED FOR NOW AT v10"). The prop rides on, reported for the walk only. */
  assert.equal((src.match(/revealMaterialVars\(/g) ?? []).length, 0, 'a theme dressing is back on a reveal drawn as frozen');
  assert.match(src, /data-reveal-dressed=\{materials \? '' : undefined\}/);
  const veilBlock = src.slice(veil, src.indexOf('/>', veil));
  assert.doesNotMatch(veilBlock, /materials/, 'the veil is untouched');
});
