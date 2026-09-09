/**
 * story-light.test.ts — the story is readable at every point of its own day.
 *
 * `08` step 2.2's acceptance criterion, in full: an automated contrast check
 * across all six stages × the neutral palette + three sample palettes, at
 * body ≥ 12:1, muted ≥ 4.6:1 and accent-as-text ≥ 4.5:1.
 *
 * It checks the OUTCOME — the arithmetic that decides what a reader's eye
 * actually meets — not that a class name exists somewhere. Three things make
 * that non-trivial, and each has its own test below:
 *
 *   1. THE MUTED COLOUR IS NEVER SET, IT IS COMPOSITED. The spine writes
 *      `text-ink/60`, so the colour on the page is the ink at 60% over the
 *      ground. A guard that measured the ink alone would pass a page whose
 *      every caption sits at 4.2:1 — and this one found exactly that: at the
 *      `text-ink/55` the spine shipped with, 4.6:1 was UNREACHABLE on the
 *      neutral morning paper by any ink, pure black included (4.54:1). The
 *      markup moved to the floor. The alpha is READ FROM THE MARKUP here, so a
 *      future `text-ink/40` fails this file instead of shipping.
 *   2. THE CROSSFADE HAS ITS OWN GROUNDS. Halfway between two safe stages is a
 *      third colour neither stage was measured against, held for a full screen
 *      of scrolling. Every pair is walked, not just the endpoints.
 *   3. TWO LUMINANCES IN ONE REPO IS A LIE WAITING TO HAPPEN. `story-light`'s
 *      triple-based one is asserted to agree with `booth-studio`'s hex-based
 *      one, the discipline `colour-access.ts` keeps against its SQL twin.
 *
 * ── THE CONTRACT IS SPLIT, AND SAYING SO IS THE POINT ──────────────────────
 * 12:1 holds AT REST, on each of the six stages — where a reader spends all but
 * a moment of their time, and the criterion `08` step 2.2 actually sets. It is
 * NOT asserted mid-crossfade, because it is unreachable there: the worst ground
 * a light→dark fade passes through allows 4.67:1 at the very most, so a guard
 * demanding 12:1 across the fade would be demanding the impossible and the only
 * way green would be to stop crossfading. In the fade the floor is AA, plus a
 * measured budget on how much of it renders muted text softly.
 *
 * ── SABOTAGE-CHECKED ───────────────────────────────────────────────────────
 * `the naive crossfade this design forbids is measurably illegible` is the
 * check that proves the rest can fail: it computes the ink the FORBIDDEN
 * implementation would produce (ground and ink lerped together) and asserts it
 * falls below the floor on the same ground where the shipped one clears it. If
 * someone "simplifies" `paintStage` into that lerp, the suite goes red with the
 * measured ratio in the message.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { relativeLuminance } from './booth-studio';
import {
  ACCENT_MIN,
  BODY_MIN,
  CANDLE,
  CANDLE_LABEL,
  FADE_BODY_MIN,
  FADE_SOFT_BUDGET,
  MUTED_ALPHA,
  MUTED_MIN,
  STAGE_NAMES,
  compositeOver,
  contrastRatio,
  deriveStages,
  describe,
  luminanceOf,
  mix,
  neutralStages,
  paintStage,
  rgbOfHex,
  stageOfMinute,
  type Rgb,
  type StageColours,
} from './story-light';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORY_DIR = resolve(HERE, '..', 'app', '[slug]', '_components', 'story');

/*
  THE PALETTES UNDER TEST.

  Three are the design's own sample boards (`prototypes/story.html`), chosen
  because they are deliberately hostile in different ways: champagne-and-sage is
  almost all light, orchid-and-gold carries a near-black, sea-glass-and-coral
  has two mid-toned colours and no true light. The fourth is the SHIPPED default
  reception palette (`lib/mood-board.ts`), which is the one a couple who never
  opened the mood board actually gets.
*/
const PALETTES: Array<{ name: string; swatches: string[] }> = [
  {
    name: 'champagne & sage (garden afternoon)',
    swatches: ['#E6D3B3', '#7E8B72', '#FBFBFA', '#6B4E3D', '#C5A059'],
  },
  {
    name: 'sea glass & coral (Cebu at sundown)',
    swatches: ['#F4E9D8', '#1F3A5F', '#E76F51', '#9FC5D9', '#2A9D8F'],
  },
  {
    name: 'orchid & gold (Makati at eighteen)',
    swatches: ['#F8EAF0', '#5B2A86', '#D4AF37', '#1C1B22', '#C77DFF'],
  },
  {
    name: 'the shipped reception default',
    swatches: ['#C97B4B', '#824A2A', '#D08654', '#F5EDE4', '#2B1D14'],
  },
  {
    // A REAL BOARD, READ OUT OF PRODUCTION 2026-09-09 (the `maria-and-jose`
    // event). Every other palette here was chosen to be hostile; this one was
    // chosen by a person, and it is the hardest of the lot — five colours with
    // no true dark, so the night stage has nothing deep to build a ground from.
    name: 'a real saved board (prod)',
    swatches: ['#FBFBFA', '#C5A059', '#9CA98B', '#C9A9A6', '#D8C7B0'],
  },
];

function allStageSets(): Array<{ name: string; stages: StageColours[] }> {
  return [
    { name: 'neutral (no theme saved)', stages: neutralStages() },
    ...PALETTES.map((p) => ({ name: p.name, stages: deriveStages(p.swatches) })),
  ];
}

/** Every floor, measured on one resolved set of colours. */
function assertLegible(where: string, ground: Rgb, ink: Rgb, accent: Rgb): void {
  const body = contrastRatio(ink, ground);
  assert.ok(
    body >= BODY_MIN,
    `${where}: body ink ${describe(ink)} on ${describe(ground)} is ${body.toFixed(2)}:1, below ${BODY_MIN}:1`,
  );

  const muted = compositeOver(ink, ground, MUTED_ALPHA);
  const mutedRatio = contrastRatio(muted, ground);
  assert.ok(
    mutedRatio >= MUTED_MIN,
    `${where}: muted text (ink at ${MUTED_ALPHA * 100}% → ${describe(muted)}) on ${describe(ground)} is ${mutedRatio.toFixed(2)}:1, below ${MUTED_MIN}:1`,
  );

  const acc = contrastRatio(accent, ground);
  assert.ok(
    acc >= ACCENT_MIN,
    `${where}: accent-as-text ${describe(accent)} on ${describe(ground)} is ${acc.toFixed(2)}:1, below ${ACCENT_MIN}:1`,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · EVERY STAGE, AT REST
   ══════════════════════════════════════════════════════════════════════════ */

test('all six stages of every palette clear the body, muted and accent floors', () => {
  for (const set of allStageSets()) {
    assert.equal(set.stages.length, 6, `${set.name}: expected six stages`);
    set.stages.forEach((s, i) => {
      assertLegible(`${set.name} · ${STAGE_NAMES[i]}`, s.ground, s.ink, s.accent);
    });
  }
});

test('painting a stage against itself reproduces that stage exactly', () => {
  /*
    The server's first paint is `paintStage(s, s, 0)`, and that path runs the
    ink through the IN-FADE floor, which is the weaker of the two. It returns
    the stage's own ink because that ink already clears the stronger one — but
    "because" is a thing that stops being true when someone edits the loop, and
    the failure would be invisible: a page that is a little less readable at
    rest than the stage it is showing, on every server render.
  */
  for (const set of allStageSets()) {
    set.stages.forEach((stage, i) => {
      const at = resolvePaint(stage, stage, 0);
      assert.deepEqual(
        at.ground,
        stage.ground,
        `${set.name} · ${STAGE_NAMES[i]}: the ground moved when nothing was fading`,
      );
      assert.deepEqual(
        at.ink,
        stage.ink,
        `${set.name} · ${STAGE_NAMES[i]}: at rest the ink is ${describe(at.ink)}, but the stage's own is ${describe(stage.ink)}`,
      );
    });
  }
});

test('a palette too thin to derive a day from falls back to the neutral six', () => {
  const neutral = neutralStages();
  for (const thin of [[], ['#E6D3B3'], ['not a colour', '#zzzzzz']]) {
    assert.deepEqual(deriveStages(thin), neutral, `[${thin.join(', ')}] should fall back`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · EVERY CROSSFADE, ALL THE WAY THROUGH
   ══════════════════════════════════════════════════════════════════════════ */

test('the words never go below AA at any point of any crossfade', () => {
  /*
    The in-fade half of the contract. 12:1 is unreachable over the mid-toned
    grounds a light→dark fade must pass through (see FADE_BODY_MIN's note — the
    measured ceiling there is 4.67:1), so what is asserted here is the review's
    actual finding: the words are never invisible. Every pair is walked, in both
    directions, because a reader scrolls back up.
  */
  let worst = { ratio: Infinity, where: '' };
  for (const set of allStageSets()) {
    for (let a = 0; a < set.stages.length; a += 1) {
      for (let b = 0; b < set.stages.length; b += 1) {
        for (let f = 0; f <= 1.0001; f += 0.02) {
          const { ground, ink, accent } = resolvePaint(set.stages[a]!, set.stages[b]!, f);
          const body = contrastRatio(ink, ground);
          const where = `${set.name} · ${STAGE_NAMES[a]}→${STAGE_NAMES[b]} at f=${f.toFixed(2)}`;
          if (body < worst.ratio) worst = { ratio: body, where };
          assert.ok(
            body >= FADE_BODY_MIN,
            `${where}: body ink ${describe(ink)} on ${describe(ground)} is ${body.toFixed(2)}:1, below the ${FADE_BODY_MIN}:1 in-fade floor`,
          );
          const acc = contrastRatio(accent, ground);
          assert.ok(
            acc >= ACCENT_MIN,
            `${where}: accent ${describe(accent)} on ${describe(ground)} is ${acc.toFixed(2)}:1`,
          );
        }
      }
    }
  }
  assert.ok(worst.ratio < Infinity, 'no crossfade was measured');
});

test('the softened window of a crossfade stays inside its budget', () => {
  /*
    The muted composite cannot hold its at-rest floor over a mid-toned ground
    either, so a light→dark crossing has a window where the small print is
    softer than it is at rest. This measures that window rather than asserting
    it away — and it is the number `groundEase` exists to hold down. It may only
    ever shrink: raising FADE_SOFT_BUDGET to make a change pass is the one move
    this file forbids.
  */
  let worstShare = 0;
  let worstWhere = '';
  for (const set of allStageSets()) {
    for (let a = 0; a < set.stages.length; a += 1) {
      for (let b = 0; b < set.stages.length; b += 1) {
        let soft = 0;
        let total = 0;
        for (let f = 0; f <= 1.0001; f += 0.01) {
          const { ground, ink } = resolvePaint(set.stages[a]!, set.stages[b]!, f);
          total += 1;
          if (contrastRatio(compositeOver(ink, ground, MUTED_ALPHA), ground) < MUTED_MIN) soft += 1;
        }
        const share = soft / total;
        if (share > worstShare) {
          worstShare = share;
          worstWhere = `${set.name} · ${STAGE_NAMES[a]}→${STAGE_NAMES[b]}`;
        }
      }
    }
  }
  assert.ok(
    worstShare <= FADE_SOFT_BUDGET,
    `${worstWhere}: ${(worstShare * 100).toFixed(0)}% of the fade renders muted text below ${MUTED_MIN}:1, over the ${(FADE_SOFT_BUDGET * 100).toFixed(0)}% budget`,
  );
});

/**
 * What `paintStage` actually resolves to, back in triples.
 *
 * ⚠ NOT `resolve` — a function declaration by that name shadows `node:path`'s
 * `resolve` for the WHOLE module, including the `STORY_DIR` const above it, and
 * hoisting means the file dies at load with a stack pointing at the colour
 * arithmetic rather than at the name. Cost: one run.
 */
function resolvePaint(
  a: StageColours,
  b: StageColours,
  f: number,
): { ground: Rgb; ink: Rgb; accent: Rgb } {
  const vars = paintStage(a, b, f);
  return {
    ground: rgbOfHex(channelsToHex(vars['--color-cream']))!,
    ink: rgbOfHex(channelsToHex(vars['--color-ink']))!,
    accent: rgbOfHex(channelsToHex(vars['--color-terracotta-700']))!,
  };
}

/** `'239 235 228'` → `'#EFEBE4'`, so the assertions above can speak in hex. */
function channelsToHex(channels: string): string {
  const [r, g, b] = channels.split(/\s+/).map(Number) as [number, number, number];
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE SABOTAGE — the forbidden crossfade, measured
   ══════════════════════════════════════════════════════════════════════════ */

test('the naive crossfade this design forbids is measurably illegible', () => {
  /*
    The review's major finding, reproduced as arithmetic so it cannot be
    re-introduced as a "simplification". Lerping the ink alongside the ground
    between a light stage and a dark one passes through a midpoint where the
    words are the colour of the paper.

    This asserts BOTH halves: that the forbidden implementation fails, and that
    the shipped one clears the floor on the very same ground. A guard that only
    asserted the second half would pass on a page that had never been at risk.
  */
  let worstNaive = Infinity;
  let checked = 0;

  for (const set of allStageSets()) {
    for (let a = 0; a < set.stages.length; a += 1) {
      for (let b = 0; b < set.stages.length; b += 1) {
        const A = set.stages[a]!;
        const B = set.stages[b]!;
        // Only pairs that actually cross from a light ground to a dark one can
        // produce the illegible midpoint; same-side fades never do, and
        // asserting they fail would be asserting something untrue.
        const crosses = luminanceOf(A.ground) > 0.4 !== luminanceOf(B.ground) > 0.4;
        if (!crosses) continue;
        checked += 1;

        const ground = mix(A.ground, B.ground, 0.5);
        const naiveInk = mix(A.ink, B.ink, 0.5);
        worstNaive = Math.min(worstNaive, contrastRatio(naiveInk, ground));

        const shipped = resolvePaint(A, B, 0.5);
        const shippedRatio = contrastRatio(shipped.ink, shipped.ground);
        assert.ok(
          shippedRatio >= FADE_BODY_MIN,
          `${set.name} · ${STAGE_NAMES[a]}→${STAGE_NAMES[b]}: the shipped midpoint ink is only ${shippedRatio.toFixed(2)}:1`,
        );
      }
    }
  }

  assert.ok(checked > 0, 'no light→dark crossfade was found to check — the palettes are wrong');
  assert.ok(
    worstNaive < FADE_BODY_MIN,
    `the forbidden lerp measured ${worstNaive.toFixed(2)}:1 at its worst, which clears the ${FADE_BODY_MIN}:1 floor — this guard is no longer proving anything`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE MUTED ALPHA IS READ FROM THE MARKUP, NEVER ASSUMED
   ══════════════════════════════════════════════════════════════════════════ */

test('no text in the story tree is fainter than the alpha this module corrects for', () => {
  const files = readdirSync(STORY_DIR).filter((f) => f.endsWith('.tsx'));
  assert.ok(files.length > 0, 'found no story components to scan — the path is wrong');

  const found: Array<{ file: string; alpha: number }> = [];
  for (const file of files) {
    const src = stripComments(readFileSync(join(STORY_DIR, file), 'utf8'));
    for (const m of src.matchAll(/\btext-ink\/(\d{1,3})\b/g)) {
      found.push({ file, alpha: Number(m[1]) / 100 });
    }
  }

  assert.ok(found.length > 0, 'found no muted text at all — this guard is watching nothing');
  const faintest = found.reduce((p, c) => (c.alpha < p.alpha ? c : p));
  assert.ok(
    faintest.alpha >= MUTED_ALPHA,
    `${faintest.file} renders text-ink/${Math.round(faintest.alpha * 100)}, fainter than MUTED_ALPHA (${MUTED_ALPHA}). Either lift the class or lower the constant — as it stands the contrast guard is measuring a composite nobody renders.`,
  );
});

test("the loudest table burns the owner's gold, and its number reads on it", () => {
  /*
    ⚖ Owner, 2026-09-09: "gold is fine" — the candle is FIXED, not derived from
    the couple's board. So the two things that must hold are:

      1. the number on a gold table is readable ON THE GOLD (it follows the
         candle, not the stage), and
      2. the rim is corrected per stage, because the fixed gold is nearly
         invisible as an edge on the light grounds — measured at ~1.5–2.2:1.

    Without (2) the ruling would have quietly cost the plan its legibility on
    every daylight stage, which is the trade nobody chose.
  */
  const onGold = contrastRatio(CANDLE_LABEL, CANDLE);
  assert.ok(
    onGold >= ACCENT_MIN,
    `the table number ${describe(CANDLE_LABEL)} on the candle ${describe(CANDLE)} is ${onGold.toFixed(2)}:1`,
  );
  // The mistake this guards against: white, which looks obvious and is not.
  assert.ok(
    contrastRatio([255, 255, 255], CANDLE) < ACCENT_MIN,
    'white on the candle would pass — then this guard is proving nothing',
  );

  let corrected = 0;
  for (const set of allStageSets()) {
    set.stages.forEach((stage, i) => {
      const vars = paintStage(stage, stage, 0);
      const candle = rgbOfHex(channelsToHex(vars['--color-candle']))!;
      const rim = rgbOfHex(channelsToHex(vars['--color-candle-ink']))!;
      assert.deepEqual(
        candle,
        CANDLE,
        `${set.name} · ${STAGE_NAMES[i]}: the candle moved with the palette — it is fixed`,
      );
      const rimRatio = contrastRatio(rim, stage.ground);
      assert.ok(
        rimRatio >= ACCENT_MIN,
        `${set.name} · ${STAGE_NAMES[i]}: the candle's rim ${describe(rim)} is ${rimRatio.toFixed(2)}:1 on ${describe(stage.ground)}`,
      );
      if (contrastRatio(CANDLE, stage.ground) < ACCENT_MIN) corrected += 1;
    });
  }
  assert.ok(
    corrected > 0,
    'no stage was found where the raw gold falls short — the rim correction is doing nothing',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · ONE LUMINANCE, TWO COORDINATES
   ══════════════════════════════════════════════════════════════════════════ */

test('the triple-based luminance agrees with the shipped hex-based one', () => {
  const samples = [
    '#000000',
    '#FFFFFF',
    '#E6D3B3',
    '#1F3A5F',
    '#C24E25',
    '#2C2A29',
    '#7E8B72',
    '#F8EAF0',
  ];
  for (const hex of samples) {
    const triple = luminanceOf(rgbOfHex(hex)!);
    const shipped = relativeLuminance(hex);
    assert.ok(
      Math.abs(triple - shipped) < 1e-12,
      `${hex}: story-light says ${triple}, booth-studio says ${shipped}`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   6 · THE BANDS
   ══════════════════════════════════════════════════════════════════════════ */

test('a minute lands in the stage its own daylight belongs to', () => {
  const cases: Array<[string, number, number]> = [
    ['6:00 AM · getting ready', 6 * 60, 1],
    ['11:29 AM · still morning', 11 * 60 + 29, 1],
    ['11:30 AM · afternoon opens', 11 * 60 + 30, 2],
    ['2:14 PM · the ceremony', 14 * 60 + 14, 2],
    ['4:29 PM · still afternoon', 16 * 60 + 29, 2],
    ['4:30 PM · golden hour', 16 * 60 + 30, 3],
    ['6:29 PM · still dusk', 18 * 60 + 29, 3],
    ['6:30 PM · night', 18 * 60 + 30, 4],
    ['9:47 PM · the money dance', 21 * 60 + 47, 4],
    ['1:00 AM · the last of them', 60, 1],
  ];
  for (const [label, minute, expected] of cases) {
    assert.equal(stageOfMinute(minute), expected, label);
  }
});
