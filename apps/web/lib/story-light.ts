/**
 * story-light.ts — the six stages of the story's light, and the arithmetic that
 * keeps every one of them readable.
 *
 * `01_The_Story.md` §1 (The light) + §4 (Colour) · `08` step 2.2 · ported from
 * `Design_Editorial_By_The_Minute_2026-09-07/prototypes/story.html`'s
 * `derive()` / `paint()`.
 *
 * The ground under the story moves from morning to night as the reader scrolls:
 *
 *     before · morning · afternoon · dusk · night · after
 *
 * and the colours are the HOST'S OWN — `sanitizeRolePalette(events.role_palette)
 * .reception`, the same three-to-five swatches they saved on their mood board,
 * under the shipped slot names (`PALETTE_LIMITS.reception.slotLabels`:
 * Dominant · Supporting · Accent · Neutral · Accent 2). Never invented names,
 * never a second palette editor.
 *
 * ── 🔴 NEVER LERP THE GROUND AND THE INK TOGETHER ──────────────────────────
 * The first design crossfaded both. Halfway between a light stage and a dark
 * one the two met at about 1.05:1 — an entire screen of scrolling where the
 * words were the same colour as the paper, twice per page. So: THE GROUND
 * CROSSFADES; THE INK IS CHOSEN, each frame, as whichever of the two stages'
 * inks reads better on the ground that is actually there (`paintStage`).
 *
 * ── 🔴 A COLOUR FROM A MOOD BOARD IS NEVER TRUSTED TO BE LEGIBLE ───────────
 * A reception palette is picked to look beautiful on a lawn, not to carry body
 * text. Every colour here is contrast-checked and nudged toward black or white
 * until it passes, at the floors below — at derivation AND again on the real
 * crossfaded ground, because the midpoint of two safe grounds is a third
 * ground that neither endpoint was checked against.
 *
 * ── PURE, AND IT HAS TO BE ─────────────────────────────────────────────────
 * No React, no DOM, no `server-only`, no I/O. That is what lets
 * `story-light.test.ts` exercise the real arithmetic across every stage of
 * four palettes rather than assert that a class name exists in a stylesheet.
 */

import { relativeLuminance } from './booth-studio';

/** A colour as sRGB channels. Triples, not hex — the crossfade lives here. */
export type Rgb = readonly [number, number, number];

/** One stage's three colours. Everything else on the page derives from them. */
export type StageColours = {
  /** The paper — `--color-cream`. */
  ground: Rgb;
  /** The words — `--color-ink`. */
  ink: Rgb;
  /** The accent, used AS TEXT — `--color-terracotta-700`. */
  accent: Rgb;
};

/**
 * The six stages, in order. The index IS the stage: `data-story-stage="3"` is
 * dusk. Kept as a tuple so a stage cannot be added without the derivation, the
 * neutral fallback and the guard all being updated together.
 */
export const STAGE_NAMES = ['before', 'morning', 'afternoon', 'dusk', 'night', 'after'] as const;
export type StageName = (typeof STAGE_NAMES)[number];
export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5;

/* ══════════════════════════════════════════════════════════════════════════
   THE FLOORS — what "readable" means here, and why each number
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Body text against the paper. Far above AA's 4.5:1 on purpose: this is a page
 * somebody reads for twenty minutes, on a phone, outdoors, at a wedding. The
 * app's own default ink measures 13.82:1 on white (`globals.css`), so 12:1 is
 * the standard the rest of the product already holds itself to, not a new one.
 */
export const BODY_MIN = 12;

/**
 * Muted text — every `text-ink/60` on the page.
 *
 * 🔑 IT IS NOT A COLOUR, IT IS AN ALPHA, and that is why this floor exists
 * separately. The shipped spine has no `--mute` token: it writes the ink at an
 * alpha over the ground, so the colour a reader actually sees is a composite
 * this module can compute but cannot set. Raising the ink's own contrast raises
 * the composite too, so the nudge converges — but only if it is CHECKED, which
 * is what `MUTED_ALPHA` below is for.
 */
export const MUTED_MIN = 4.6;

/**
 * The lowest ink alpha the story tree uses as text. Measured from the markup,
 * not assumed: `text-ink/60` (20 uses) is the faintest; /70 and /75 are
 * stronger and pass whenever this one does.
 *
 * ⚠ IF A NEW `text-ink/NN` GOES LOWER THAN THIS, THIS CONSTANT IS WRONG and
 * the guard is checking a composite nobody renders. `story-light.test.ts` reads
 * the story tree and fails when it finds a lower one — the alpha is derived
 * from the markup, never trusted to have stayed put.
 *
 * 🔴 IT WAS `text-ink/55` UNTIL THIS SESSION, AND 4.6:1 WAS UNREACHABLE THERE.
 * Measured, not reasoned: on the neutral morning paper `#EFEBE4`, PURE BLACK at
 * 55% composites to `#6C6A67` — **4.54:1**, under the floor, and no ink is
 * darker than black. The whole small print of the story sat below the standard
 * the design set, and no choice of colour could have lifted it. At 60% the same
 * pure black reaches 5.44:1 and every derived palette clears the floor with
 * room to spare, so THE MARKUP MOVED TO THE FLOOR rather than the floor moving
 * to the markup — the same call `lint-guest-legibility` forces on type size.
 */
export const MUTED_ALPHA = 0.6;

/** The accent used as text — AA for normal text. */
export const ACCENT_MIN = 4.5;

/**
 * The floor DURING a crossfade, which is a different and lower number — and
 * this is the one place in this file where a lower number is the honest one.
 *
 * 🔑 12:1 IS NOT REACHABLE MID-FADE, BY ANY INK. Measured: the worst ground a
 * light→dark fade passes through is about `#747474`, where pure black reaches
 * 4.49:1 and pure white 4.67:1 — 4.67 is the CEILING there, not a shortfall of
 * effort. A guard demanding 12:1 across the fade would be demanding something
 * no implementation can deliver, and the only way to go green would be to stop
 * crossfading at all.
 *
 * So the contract is split, and both halves are guarded:
 *   • AT REST, on each of the six stages — the design's own criterion (`08`
 *     step 2.2): 12:1 body, 4.6:1 muted, 4.5:1 accent. This is where a reader
 *     spends essentially all of their time.
 *   • IN THE FADE — never below AA. That is the review's actual finding: the
 *     forbidden implementation passed through ~1.05:1, which is invisible. 4.5:1
 *     is legible, and `groundEase` below makes the crossing brief on top.
 */
export const FADE_BODY_MIN = 4.5;

/**
 * How much of a fade may sit below the at-rest muted floor.
 *
 * A muted composite cannot hold 4.6:1 over a mid-toned ground either (same
 * ceiling as above), so a light→dark crossing has a window where the small
 * print is softer than it is at rest. The answer is to make that window SHORT
 * rather than to pretend it is not there: `groundEase` spends the reader's
 * scroll near the two endpoints and crosses the middle quickly. This budget is
 * what the guard measures, and the measurement is in `groundEase`: the worst
 * pair went 82% (a straight line) → 54% (eased once) → **32%** (eased twice,
 * shipped). The budget sits just above what ships, so a change that widens the
 * window fails.
 *
 * 🛑 RAISING THIS NUMBER TO GET A CHANGE THROUGH IS THE ONE MOVE FORBIDDEN
 * HERE. It may only ever go down.
 */
export const FADE_SOFT_BUDGET = 0.34;

/* ══════════════════════════════════════════════════════════════════════════
   THE ARITHMETIC
   ══════════════════════════════════════════════════════════════════════════ */

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/** '#E6D3B3' → [230, 211, 179]. Null for anything that is not a six-digit hex. */
export function rgbOfHex(hex: string): Rgb | null {
  const body = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())?.[1];
  if (!body) return null;
  const n = parseInt(body, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexOfRgb(c: Rgb): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

/**
 * Relative luminance of a triple.
 *
 * 🔑 NOT A SECOND OPINION. `booth-studio.ts` already owns this function for
 * hex strings; this is the same arithmetic in the coordinate the crossfade
 * needs (a triple, several times a frame, without a round trip through a
 * string). `story-light.test.ts` asserts the two AGREE on a spread of colours,
 * the same discipline `colour-access.ts` keeps against its SQL twin — where two
 * copies disagree, one of them is lying to somebody about whether a page is
 * readable.
 */
export function luminanceOf(c: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

/** WCAG contrast ratio. Symmetric — which is why light-on-dark needs no second check. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = luminanceOf(a);
  const l2 = luminanceOf(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Straight-line mix. `f = 0` is `a`, `f = 1` is `b`. */
export function mix(a: Rgb, b: Rgb, f: number): Rgb {
  const t = Math.max(0, Math.min(1, f));
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * What `text-ink/55` actually looks like: the ink composited over the ground at
 * that alpha. Browsers composite in sRGB space, so this is a straight mix.
 */
export function compositeOver(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return mix(bg, fg, alpha);
}

/**
 * Which extreme actually helps on this ground — black or white.
 *
 * 🔴 NOT A LUMINANCE THRESHOLD, AND THIS COST A RUN TO LEARN. The prototype
 * (and the first cut here) asked `luminance(ground) > 0.4`. On the ground a
 * light→dark crossfade sits at partway through — `#ABA4A0`, luminance 0.38 —
 * that test says "dark ground, go lighter", so it took a perfectly good
 * near-black ink and walked it all the way to WHITE, landing at 2.46:1 on a
 * ground where black reads 6.7:1. The threshold and the arithmetic disagreed,
 * and the threshold won.
 *
 * So: ask the contrast, which is the thing actually being optimised. On mid
 * grounds the two answers differ, and mid grounds are precisely where the
 * crossfade lives.
 */
function towardFor(bg: Rgb): Rgb {
  return contrastRatio(BLACK, bg) >= contrastRatio(WHITE, bg) ? BLACK : WHITE;
}

/**
 * Nudge a colour toward black or white until it clears `target` on `bg`.
 *
 * It gives up at the extreme rather than looping — pure black on pure black
 * cannot be fixed by moving, and returning the best it reached lets the guard
 * fail loudly with a measured ratio instead of the function hanging.
 */
export function nudgeUntilLegible(fg: Rgb, bg: Rgb, target: number): Rgb {
  if (contrastRatio(fg, bg) >= target) return fg;
  const toward = towardFor(bg);
  let out = fg;
  for (let f = 0.04; f <= 1.0001; f += 0.04) {
    out = mix(fg, toward, f);
    if (contrastRatio(out, bg) >= target) return out;
  }
  return out;
}

/**
 * The ink for a ground: strong enough for body text AND for the muted
 * composite.
 *
 * 🔑 TWO FLOORS, ONE NUDGE. Checking only the body floor is the trap: 12:1 ink
 * can still composite to 4.3:1 at 60% on a mid-toned ground, and every eyebrow,
 * caption and dateline on the page is that composite. The loop advances until
 * both hold, so a stage can never satisfy the headline and fail the small print.
 *
 * `body` is a parameter because the two floors are genuinely different numbers:
 * 12:1 at rest, AA mid-crossfade, where 12:1 does not exist. Passing it in is
 * what stops the fade from quietly lowering the floor a stage is held to.
 */
function inkFor(seed: Rgb, ground: Rgb, body: number): Rgb {
  const toward = towardFor(ground);
  let out = seed;
  let best = seed;
  let bestScore = -1;
  for (let f = 0; f <= 1.0001; f += 0.02) {
    out = f === 0 ? seed : mix(seed, toward, f);
    const bodyRatio = contrastRatio(out, ground);
    const mutedRatio = contrastRatio(compositeOver(out, ground, MUTED_ALPHA), ground);
    if (bodyRatio >= body && mutedRatio >= MUTED_MIN) return out;
    // Keep the strongest thing reached, so a ground where neither floor is
    // attainable still gets the most readable ink there is rather than the
    // seed it started from.
    if (bodyRatio > bestScore) {
      bestScore = bodyRatio;
      best = out;
    }
  }
  return best;
}

/** Saturation, for picking the swatch that reads as "their accent". */
function saturationOf(c: Rgb): number {
  const mx = Math.max(c[0], c[1], c[2]);
  const mn = Math.min(c[0], c[1], c[2]);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE SIX STAGES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The neutral light — warm paper and ink, offered when no theme was saved.
 *
 * 🔑 A CHOICE, NOT A FAILURE (`01` §4, and the Story Maker offers it as one of
 * three modes). Nothing on the page says "you did not pick colours"; it simply
 * reads as a printed paper, which is what the story is.
 *
 * Grounds are the prototype's, unchanged. Inks and accents run through the same
 * correction as a derived palette rather than being written down beside them —
 * a hand-typed pair is a pair nobody re-measures.
 */
const NEUTRAL_GROUNDS: Rgb[] = [
  [239, 235, 228],
  [247, 243, 236],
  [244, 236, 222],
  [64, 52, 54],
  [26, 22, 32],
  [236, 238, 236],
];

/** The fallback accent when a palette has none to offer — the app's own teal. */
const FALLBACK_ACCENT: Rgb = [47, 111, 106];

/**
 * Can ANY ink hold the at-rest floors on this ground? The ceiling is whichever
 * of black or white reads better; if that is short, no colour will do.
 */
function groundCanCarryBody(ground: Rgb): boolean {
  const best = towardFor(ground);
  return (
    contrastRatio(best, ground) >= BODY_MIN &&
    contrastRatio(compositeOver(best, ground, MUTED_ALPHA), ground) >= MUTED_MIN
  );
}

function stageFrom(ground0: Rgb, lightest: Rgb, darkest: Rgb, accent: Rgb): StageColours {
  /*
    A ground in the 0.28–0.5 luminance band is the worst case there is: too dark
    for dark ink, too light for light ink, so BOTH inks land near the floor and
    the correction has to travel a long way from the couple's actual colour. It
    is pushed decisively dark instead, which keeps the stage recognisably theirs
    rather than a grey nobody chose.
  */
  let ground = ground0;
  const l0 = luminanceOf(ground);
  if (l0 > 0.28 && l0 < 0.5) ground = mix(ground, BLACK, 0.4);

  /*
    🔴 THE GROUND IS CORRECTED TOO, NOT ONLY THE INK — and this is the half the
    prototype does not have. `01` §4 says a colour from a mood board is never
    trusted to be legible; a GROUND is a colour from a mood board. The neutral
    dusk paper `#403436` was measured at exactly 11.92:1 against PURE WHITE:
    eight hundredths under the floor, with no ink in existence that could close
    it. Correcting only the ink there produces a stage that fails by an amount
    no amount of ink-nudging can fix, which is how a floor becomes a suggestion.

    So the ground is walked toward its own nearer extreme — deeper if it is
    dark, paler if it is light — in small steps, until an ink CAN carry the
    body and the muted floors on it. Small steps, because every one of them is
    a step away from the colour the couple actually saved.
  */
  for (let i = 0; i < 40 && !groundCanCarryBody(ground); i += 1) {
    ground = mix(ground, towardFor(ground) === BLACK ? WHITE : BLACK, 0.05);
  }

  const darkGround = luminanceOf(ground) < 0.3;
  const inkSeed = darkGround
    ? mix([247, 240, 228], lightest, 0.15)
    : mix([27, 26, 23], darkest, 0.25);
  const ink = inkFor(inkSeed, ground, BODY_MIN);
  const accentSeed = darkGround ? mix(accent, WHITE, 0.45) : accent;
  return {
    ground,
    ink,
    accent: nudgeUntilLegible(accentSeed, ground, ACCENT_MIN),
  };
}

/** The neutral six, corrected. */
export function neutralStages(): StageColours[] {
  return NEUTRAL_GROUNDS.map((g) => stageFrom(g, [247, 243, 236], [26, 22, 32], FALLBACK_ACCENT));
}

/**
 * The host's six, from the reception palette they saved.
 *
 * Sorted by lightness, exactly as `01` §4 says: the lightest swatch becomes the
 * morning paper, the darkest becomes the night. The accent is the most
 * saturated of them, which is the one a person would point at and call "our
 * colour" — it is not slot 3, because a palette's Accent slot may hold a
 * neutral and the slot order is the couple's, not a promise about chroma.
 *
 * Returns the neutral six when the palette is empty or unparseable. Fewer than
 * two usable swatches is not a palette to derive a day from.
 */
export function deriveStages(swatches: readonly string[]): StageColours[] {
  const cs = swatches
    .map((s) => rgbOfHex(s))
    .filter((c): c is Rgb => c != null)
    .sort((a, b) => luminanceOf(b) - luminanceOf(a));
  if (cs.length < 2) return neutralStages();

  const lightest = cs[0]!;
  const second = cs[1] ?? lightest;
  const mid = cs[Math.min(2, cs.length - 1)] ?? second;
  const darkest = cs[cs.length - 1]!;
  const accent = [...cs].sort((a, b) => saturationOf(b) - saturationOf(a))[0]!;

  const grounds: Rgb[] = [
    mix(lightest, WHITE, 0.45), // before — the road, before the day had a light
    mix(lightest, WHITE, 0.2), // morning
    mix(second, lightest, 0.5), // afternoon
    mix(darkest, mid, 0.3), // dusk
    mix(darkest, BLACK, 0.55), // night
    mix(lightest, mid, 0.18), // after
  ];
  return grounds.map((g) => stageFrom(g, lightest, darkest, accent));
}

/* ══════════════════════════════════════════════════════════════════════════
   WHICH STAGE A MOMENT IS IN
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The bands, in minutes since Manila midnight.
 *
 * ⚠ A CLOCK CONSTANT HERE IS CORRECT, AND IT IS THE ONE PLACE IN THIS BUILD
 * THAT IS. The venue's phases are derived from `event_schedule_blocks` and never
 * from a threshold (`05` §4, owner lock 6) — because a reception opens when the
 * couple says it does. The SUN does not take instructions. Manila sits at 14.6°N
 * where sunset moves only between about 5:27 and 6:27 PM across the whole year,
 * so a dusk band of 4:30–6:30 PM contains it on every date, and no schedule row
 * is evidence about daylight.
 */
const MORNING_ENDS = 11 * 60 + 30;
const AFTERNOON_ENDS = 16 * 60 + 30;
const DUSK_ENDS = 18 * 60 + 30;

/** Which of the six a minute of a day falls in. */
export function stageOfMinute(minuteOfDay: number): StageIndex {
  if (minuteOfDay < MORNING_ENDS) return 1;
  if (minuteOfDay < AFTERNOON_ENDS) return 2;
  if (minuteOfDay < DUSK_ENDS) return 3;
  return 4;
}

/** The road is `before`; anything after the last day is `after`. */
export const ROAD_STAGE: StageIndex = 0;
export const AFTER_STAGE: StageIndex = 5;

/* ══════════════════════════════════════════════════════════════════════════
   PAINTING
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The three CSS custom properties the story wears, as `R G B` channel triples.
 *
 * 🔑 THE SHIPPED RE-SKIN MECHANISM, NOT A NEW ONE. Every colour class in the
 * story tree resolves to `rgb(var(--color-*) / <alpha>)` (`tailwind.config.ts`),
 * which is how `buildSitePaletteVars` already re-skins the couple's whole
 * website from one wrapper. Overriding these three on `.sn-story` repaints the
 * spine with NO component change — and the inventory is three because the tree
 * was measured: it uses only `ink`, `cream` and `terracotta-700`.
 */
export type StoryLightVars = {
  '--color-cream': string;
  '--color-ink': string;
  '--color-terracotta': string;
  '--color-terracotta-600': string;
  '--color-terracotta-700': string;
};

function channels(c: Rgb): string {
  return `${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])}`;
}

/**
 * The colours for a point in the crossfade between stage `a` and stage `b`.
 *
 * THE GROUND IS MIXED. THE INK IS CHOSEN. See the file header — this is the
 * review's major finding and the reason this function does not have one loop
 * that lerps a struct.
 *
 * The chosen ink is then re-corrected against the ground that is actually
 * there, because the midpoint of two safe grounds is a ground neither endpoint
 * was measured on.
 */
/**
 * The shape of the crossfade — the reader lingers at each stage and crosses
 * between them quickly.
 *
 * 🔑 IT IS NOT DECORATION, IT IS THE LEGIBILITY BUDGET. A straight line spends
 * as much scroll on the mid-toned grounds in between as on the two real stages,
 * and those middles are exactly where no ink can reach the at-rest floors. This
 * is smootherstep — flat at both ends, steepest at the halfway point — so the
 * illegible-ish band is crossed in a fraction of the distance while the stages
 * themselves hold. `FADE_SOFT_BUDGET` is the measured result.
 *
 * ⚠ IT EASES THE GROUND, NOT THE INK. The ink is still CHOSEN, per frame, on
 * whatever ground this produces.
 */
export function groundEase(f: number): number {
  const t = Math.max(0, Math.min(1, f));
  const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
  // TWICE, and the second pass was bought with a measurement, not a hunch. The
  // worst soft window across all four palettes and all thirty-six stage pairs:
  //
  //     linear            82%
  //     smootherstep      54%
  //     twice             32%   ← here
  //     three times       17%   — but the ground visibly snaps
  //
  // Three passes cross the middle about six and a half times faster than a
  // straight line, which stops reading as light changing and starts reading as
  // a flash. Two is the last one that still looks like dusk falling.
  return smoother(smoother(t));
}

export function paintStage(a: StageColours, b: StageColours, f: number): StoryLightVars {
  const ground = mix(a.ground, b.ground, groundEase(f));

  const inkPick = contrastRatio(a.ink, ground) >= contrastRatio(b.ink, ground) ? a.ink : b.ink;
  // FADE_BODY_MIN, not BODY_MIN — 12:1 does not exist over the grounds this
  // passes through, and asking for it would make the loop run to the extreme
  // every frame and return the same white for a third of the fade.
  const ink = inkFor(inkPick, ground, FADE_BODY_MIN);

  const accentPick =
    contrastRatio(a.accent, ground) >= contrastRatio(b.accent, ground) ? a.accent : b.accent;
  const accent = nudgeUntilLegible(accentPick, ground, ACCENT_MIN);

  return {
    '--color-cream': channels(ground),
    '--color-ink': channels(ink),
    // 500 and 600 track the corrected accent so any class added later to this
    // tree is legible by construction rather than by review.
    '--color-terracotta': channels(accent),
    '--color-terracotta-600': channels(accent),
    '--color-terracotta-700': channels(accent),
  };
}

/** The colours of one stage at rest — the server's first paint. */
export function paintAtRest(stages: readonly StageColours[], stage: StageIndex): StoryLightVars {
  const s = stages[stage] ?? stages[0]!;
  return paintStage(s, s, 0);
}

/** Hex, for a test's failure message — a triple is unreadable in a diff. */
export function describe(c: Rgb): string {
  return hexOfRgb(c);
}

/** Re-exported so a caller never reaches for a second luminance. */
export { relativeLuminance };
