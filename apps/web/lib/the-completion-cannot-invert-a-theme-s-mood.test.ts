/**
 * 🔒 COMPLETING A PALETTE TO FIVE CANNOT INVERT ITS MOOD.
 *
 * THE DEFECT THIS EXISTS FOR SHIPPED, PASSED 12,164 UNIT TESTS, AND LOOKED
 * PERFECT BY EVERY COUNT ANYONE HAD THOUGHT TO TAKE. All 2,600 seeded themes
 * carried exactly five reception colors, every original three was preserved in
 * order, every palette round-tripped the sanitizer — and 906 of them (35%) had
 * been handed the OPPOSITE of the character their `mood_tag` names.
 *
 * The cause was a completion that chose slots 3-4 by "whichever lightness pole
 * this set does not have yet", with `mood_tag` not an input at all. A dark
 * palette always already HAS deep, so it always received light. Measured in
 * CIELAB against the shipped SQL: dark_moody swatches at L*≥85 went 2 → 262,
 * romantic_ethereal swatches at L*≤25 went 0 → 235, 383 rows stopped reading
 * dark and 523 stopped reading light.
 *
 * ⚠ AND THE METRIC THAT BUILD WAS PROUD OF — "rows with a lightness span under
 * 30: ZERO" — WAS THE DEFECT STATED AS A VIRTUE. Every palette spanned both
 * poles precisely because the ones that deliberately did not were forced to.
 * Do not reintroduce a full-span goal to make this file easier to satisfy.
 *
 * WHY THIS READS THE SQL AND NOT THE GENERATOR: the generator's own tests
 * prove the FUNCTION behaves. They cannot see whether anyone re-ran the seed
 * script afterwards, and they cannot see the 100 hand-authored rows at all. A
 * correct generator over a stale seed is indistinguishable from a correct
 * system unless something opens the files that actually ship.
 *
 * WHY CIELAB AND NOT HSL: `role_palette` is hex, the gallery renders hex, and
 * HSL's `l` is not lightness — a spring green `#19D393` sits at HSL l=46 and
 * at L*=75. Every threshold below is L*.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', '..', 'supabase', 'migrations');
const HAND_SEED = '20271194462267_moodboard_theme_templates.sql';
const GENERATED_SEED = '20271196372720_moodboard_theme_templates_2500_seed.sql';

// ── CIELAB, written out here on purpose ─────────────────────────────────
// The generator exports none of this and this file imports none of it: a
// palette rule checked with the generator's own private helpers would agree
// with it by construction, including when both are wrong.

function lab(hex: string): { L: number; a: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
const lightness = (hex: string) => lab(hex).L;
const starChroma = (hex: string) => {
  const { a, b } = lab(hex);
  return Math.hypot(a, b);
};
const median = (xs: number[]) => {
  const s = [...xs].sort((p, q) => p - q);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

type SeededTheme = {
  file: string;
  style_family: string;
  mood_tag: string;
  name: string;
  description: string;
  reception: string[];
};

/** Every VALUES row of a seed migration. Each row is one line opening on
 *  `  ('`; its literals are style_family, mood_tag, name, description,
 *  role_palette, reception_design, sort_order — and SQL escapes a quote by
 *  doubling it, which this unescapes. */
function themesIn(file: string): SeededTheme[] {
  const out: SeededTheme[] = [];
  for (const line of readFileSync(join(MIGRATIONS, file), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t.startsWith("('") || !t.includes('::jsonb')) continue;
    const lits: string[] = [];
    let i = 0;
    while (i < t.length) {
      if (t[i] !== "'") {
        i += 1;
        continue;
      }
      let j = i + 1;
      let buf = '';
      while (j < t.length) {
        if (t[j] === "'" && t[j + 1] === "'") {
          buf += "'";
          j += 2;
          continue;
        }
        if (t[j] === "'") break;
        buf += t[j];
        j += 1;
      }
      lits.push(buf);
      i = j + 1;
    }
    if (lits.length < 5) continue;
    const palette = JSON.parse(lits[4]!) as { reception?: string[] };
    if (!Array.isArray(palette.reception)) continue;
    out.push({
      file,
      style_family: lits[0]!,
      mood_tag: lits[1]!,
      name: lits[2]!,
      description: lits[3]!,
      reception: palette.reception,
    });
  }
  return out;
}

const HAND = themesIn(HAND_SEED);
const ALL = [...HAND, ...themesIn(GENERATED_SEED)];

test('the seeds parse to the 2,600 rows this file claims to be checking', () => {
  // A parser that silently matched nothing would make every assertion below
  // vacuously green — the loudest way for a guard to go inert.
  assert.equal(HAND.length, 100, `hand-authored seed parsed to ${HAND.length} rows`);
  assert.equal(ALL.length, 2600, `both seeds parsed to ${ALL.length} rows`);
  for (const t of ALL) assert.equal(t.reception.length, 5, `${t.name} has ${t.reception.length}`);
});

test('🚨 completing a theme does not move where it sits on the light/dark scale', () => {
  // The audit's own two counts, recomputed from the shipped SQL alone: a row
  // whose ORIGINAL three read dark (median L* < 40) must still read dark at
  // five, and one that read light (> 70) must still read light. The inverting
  // build failed this 383 and 523 times respectively.
  //
  // 🔑 The assertion is deliberately RELATIVE — each row against its own
  // three, never against an absolute per-mood band. A hand-authored
  // dark_moody row is allowed to be an emerald-and-gold hacienda with a median
  // L* of 55; that is the author's call. What is not allowed is the COMPLETION
  // moving it.
  const stoppedReadingDark: string[] = [];
  const stoppedReadingLight: string[] = [];
  for (const t of ALL) {
    const before = median(t.reception.slice(0, 3).map(lightness));
    const after = median(t.reception.map(lightness));
    if (before < 40 && after >= 40) stoppedReadingDark.push(`"${t.name}" ${before.toFixed(1)} → ${after.toFixed(1)}`);
    if (before > 70 && after <= 70) stoppedReadingLight.push(`"${t.name}" ${before.toFixed(1)} → ${after.toFixed(1)}`);
  }
  assert.deepEqual(stoppedReadingDark.slice(0, 10), [], `${stoppedReadingDark.length} rows stopped reading dark`);
  assert.deepEqual(stoppedReadingLight.slice(0, 10), [], `${stoppedReadingLight.length} rows stopped reading light`);
});

test('🚨 the five keep the three’s median lightness, to within a rounding', () => {
  // The mechanism behind the test above, asserted directly so a future change
  // that keeps the thresholds green by luck still fails here: the two added
  // colors STRADDLE the set's own median L*, one at or below it and one at or
  // above, so the median of five is arithmetically the median of three.
  let worst = { name: '', drift: 0 };
  for (const t of ALL) {
    const drift = Math.abs(
      median(t.reception.map(lightness)) - median(t.reception.slice(0, 3).map(lightness)),
    );
    if (drift > worst.drift) worst = { name: t.name, drift };
  }
  assert.ok(worst.drift <= 1, `"${worst.name}" moved its median L* by ${worst.drift.toFixed(2)}`);
});

/**
 * How far outside its OWN lightness range each mood's completion may reach, in
 * L*. This is the "mood is an input" assertion: under the build this replaces,
 * a dark_moody theme whose own lightest color sat at L*52 was handed one at
 * L*94 — a reach of +42 — and a romantic_ethereal theme whose own darkest sat
 * at L*59 was handed one at L*20, a reach of −39. Every bound below has ~6
 * points of headroom over what the current completion actually produces, so it
 * fails on an inversion and not on a nudge.
 */
const MOOD_REACH: Record<string, { lighter: number; deeper: number }> = {
  dark_moody: { lighter: 14, deeper: 26 },
  nostalgic_vintage: { lighter: 14, deeper: 22 },
  romantic_ethereal: { lighter: 22, deeper: 10 },
  whimsical_storybook: { lighter: 20, deeper: 16 },
  minimalist: { lighter: 20, deeper: 16 },
  simple_understated: { lighter: 14, deeper: 14 },
  organic_natural: { lighter: 14, deeper: 14 },
  // The one mood for which opening the range IS the point.
  bold_contrasting: { lighter: 24, deeper: 24 },
  maximalist_complex: { lighter: 20, deeper: 20 },
  glam_luxurious: { lighter: 18, deeper: 20 },
};

test('🚨 every mood is in the table, and the completion stays inside its reach', () => {
  const moods = new Set(ALL.map((t) => t.mood_tag));
  assert.deepEqual(
    [...moods].filter((m) => !(m in MOOD_REACH)),
    [],
    'a seeded mood has no reach bound — it would be silently unchecked',
  );
  const offenders: string[] = [];
  for (const t of ALL) {
    const reach = MOOD_REACH[t.mood_tag]!;
    const own = t.reception.slice(0, 3).map(lightness);
    const lightest = Math.max(...own);
    const darkest = Math.min(...own);
    for (const hex of t.reception.slice(3)) {
      const l = lightness(hex);
      if (l - lightest > reach.lighter) {
        offenders.push(
          `${t.mood_tag} "${t.name}": ${hex} at L* ${l.toFixed(0)} is ${(l - lightest).toFixed(0)} above the theme's own lightest (${lightest.toFixed(0)}), limit ${reach.lighter}`,
        );
      }
      if (darkest - l > reach.deeper) {
        offenders.push(
          `${t.mood_tag} "${t.name}": ${hex} at L* ${l.toFixed(0)} is ${(darkest - l).toFixed(0)} below the theme's own darkest (${darkest.toFixed(0)}), limit ${reach.deeper}`,
        );
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 10), [], `${offenders.length} added colors reach outside their mood`);
});

test('🚨 a dark_moody theme is never handed a near-white, nor romantic_ethereal a near-black', () => {
  // The two headline counts from the audit, asserted directly on the shipped
  // SQL: dark_moody swatches at L*>=85 were 2 across all 265 rows before the
  // completion existed and 262 after it; romantic_ethereal swatches at L*<=25
  // were 0 before and 235 after.
  const nearWhiteInDark = ALL.filter((t) => t.mood_tag === 'dark_moody').flatMap((t) =>
    t.reception.filter((h) => lightness(h) >= 85).map((h) => `${t.name}: ${h}`),
  );
  const nearBlackInEthereal = ALL.filter((t) => t.mood_tag === 'romantic_ethereal').flatMap((t) =>
    t.reception.filter((h) => lightness(h) <= 25).map((h) => `${t.name}: ${h}`),
  );
  // 5 is headroom over the 2 that the HAND-AUTHORED rows legitimately carry
  // (a gold or a capiz pearl inside a midnight palette, authored on purpose).
  assert.ok(
    nearWhiteInDark.length <= 5,
    `${nearWhiteInDark.length} near-white swatches in dark_moody themes: ${nearWhiteInDark.slice(0, 8).join(' · ')}`,
  );
  assert.deepEqual(
    nearBlackInEthereal.slice(0, 8),
    [],
    `${nearBlackInEthereal.length} near-black swatches in romantic_ethereal themes`,
  );
});

test('🚨 the added pair is per-THEME, not per-carrier', () => {
  // 99 distinct hand-authored triples produced only 68 distinct added pairs
  // when the derivation read the hue carrier alone — `#F5EFDB + #E7D186` went
  // identically onto navy, green, mangrove and black themes. The count of
  // distinct pairs must track the count of distinct sources.
  const triples = new Set(HAND.map((t) => t.reception.slice(0, 3).join(' ')));
  const pairs = new Set(HAND.map((t) => t.reception.slice(3).join(' ')));
  assert.ok(
    pairs.size >= triples.size * 0.8,
    `${triples.size} distinct source triples collapsed into ${pairs.size} distinct added pairs`,
  );
});

test('🚨 an added color never out-colors the palette it was added to', () => {
  // Measured in C*ab. This is what keeps "All white, no accent color at all"
  // from receiving an accent, and "nearly monochrome, one soft color kept to a
  // minimum" from receiving a second soft color — WITHOUT reading the
  // description: a palette that carries one hue does not gain a second.
  const offenders: string[] = [];
  for (const t of ALL) {
    const ceiling = Math.max(...t.reception.slice(0, 3).map(starChroma));
    for (const hex of t.reception.slice(3)) {
      if (starChroma(hex) > ceiling + 0.5) {
        offenders.push(
          `"${t.name}": added ${hex} at C*ab ${starChroma(hex).toFixed(1)} over a palette whose loudest is ${ceiling.toFixed(1)}`,
        );
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 10), [], `${offenders.length} added colors out-color their own theme`);
});

/**
 * The hand-authored 100 render their `description` DIRECTLY ABOVE the five
 * chips in template-gallery.tsx, so a completion that contradicts the sentence
 * ships a card that argues with itself. These five shipped:
 *
 *   Pure White Minimal Modern — "All white, no accent color at all" → got a
 *     charcoal at L*20 and a sage.
 *   Full Black Modern Statement — "All black — walls, linens, chairs" → got
 *     two near-whites, median L* +60.
 *   Moonlit Mangrove Heritage — "a moody, nighttime heritage reception" → got
 *     L*94 and L*84.
 *   Blush Line Modern — "nearly monochrome, one soft color kept to a minimum"
 *     → got a second soft color.
 *   Amethyst & Gold Regal — "Amethyst purple and gold" → got a salmon 45° off
 *     every hue present.
 *
 * The check below is not a list of those five: it reads every description for
 * the CLASS of claim and holds the added colors to it.
 */
const CLAIMS_RESTRAINT =
  /all white|all black|no accent colou?r|nearly monochrome|near-monochrome|monochrome|only one colou?r|kept to a minimum|minimal colou?r|most minimal|without a single loud|no colou?r at all/i;
const CLAIMS_DARKNESS = /moody|nighttime|night-time|midnight|moonlit|after dark|by candlelight|candlelit/i;
const CLAIMS_ALL_WHITE = /all white|no accent colou?r at all/i;
const CLAIMS_ALL_BLACK = /all black/i;

test('🚨 no hand-authored theme contradicts its own description', () => {
  const offenders: string[] = [];
  for (const t of HAND) {
    const original = t.reception.slice(0, 3);
    const added = t.reception.slice(3);
    const loudest = Math.max(...original.map(starChroma));
    const lightest = Math.max(...original.map(lightness));
    const darkest = Math.min(...original.map(lightness));
    const say = (why: string, hex: string) => offenders.push(`"${t.name}" — ${t.description}\n     ${hex}: ${why}`);
    for (const hex of added) {
      if (CLAIMS_RESTRAINT.test(t.description) && starChroma(hex) > loudest + 0.5) {
        say(`C*ab ${starChroma(hex).toFixed(0)} over a palette that promises restraint (loudest C*ab ${loudest.toFixed(0)})`, hex);
      }
      if (CLAIMS_ALL_WHITE.test(t.description) && lightness(hex) < darkest - 4) {
        say(`L* ${lightness(hex).toFixed(0)} under an "all white" palette's own darkest L* ${darkest.toFixed(0)}`, hex);
      }
      if ((CLAIMS_ALL_BLACK.test(t.description) || CLAIMS_DARKNESS.test(t.description)) && lightness(hex) > lightest + 4) {
        say(`L* ${lightness(hex).toFixed(0)} over a dark/night palette's own lightest L* ${lightest.toFixed(0)}`, hex);
      }
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} hand-authored cards argue with their own copy`);
});

test('the description checks above are actually matching descriptions', () => {
  // Without this, a typo in either regex turns the previous test into a green
  // that proves nothing — the same class of failure as a test glob that
  // matches no files and exits 0.
  assert.ok(HAND.filter((t) => CLAIMS_RESTRAINT.test(t.description)).length >= 5);
  assert.ok(HAND.filter((t) => CLAIMS_DARKNESS.test(t.description)).length >= 5);
  assert.equal(HAND.filter((t) => CLAIMS_ALL_WHITE.test(t.description)).length, 1);
  assert.equal(HAND.filter((t) => CLAIMS_ALL_BLACK.test(t.description)).length, 1);
});
