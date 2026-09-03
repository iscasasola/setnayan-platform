/**
 * Side-by-side measurement of the CURATED naming vocabulary (`WEDDING_NAMES`
 * — reads its live length below, not a number frozen in this comment) against
 * the generated one (`SETNAYAN_NAMES`, 336 generated swatches). Run from
 * apps/web:
 *
 *   npx tsx scripts/analyze-color-vocabulary.ts
 *
 * 🔑 MB5 (2026-09-03) already answered the question this script was built to
 * ask — a WHOLESALE swap was measured here and refused; `WEDDING_NAMES` now
 * carries a MERGE of the two (see the docblock atop that export). This script
 * is kept because the same question — what would a bigger table lose? —
 * applies again to any future addition, not because a swap is still pending.
 *
 * It answers the only question that decides whether a wholesale swap is safe:
 * WHAT COULD THE OLD TABLE NAME THAT THE NEW ONE CANNOT? A vocabulary that
 * grows 5x can still lose a colour region, and a lost region does not fail
 * loudly — it quietly falls through to a CSS word or a descriptive phrase.
 *
 * It reuses the SHIPPED colour maths (./lib/color-space) and re-states only the
 * small hue-compatibility policy from ./lib/color-names, whose constants are
 * imported-by-value here as literals because that module does not export them.
 * If those constants change, change them here too — this script's numbers are
 * only as current as that copy.
 */
import {
  chromaStar,
  deltaHStar,
  hueDeltaDeg,
  hueStar,
  labDistance,
  labOfHex,
  srgbHueDeg,
  type Lab,
} from '../lib/color-space';
import { CSS_NAMES, WEDDING_NAMES, foldColorName } from '../lib/color-names';
import { SETNAYAN_NAMES, SETNAYAN_SWATCHES, SETNAYAN_METALLICS } from '../lib/color-vocabulary.generated';

// mirrored from lib/color-names.ts
const ACHROMATIC_CHROMA = 6;
const TINTED_NEUTRAL_CHROMA = 12;
const MAX_HUE_DRIFT = 12;
const MAX_HUE_DRIFT_DEG = 40;
const MAX_SRGB_HUE_DRIFT_DEG = 30;

type M = { hex: string; lab: Lab };
const measure = (hex: string): M => ({ hex, lab: labOfHex(hex) });

function hueCompatible(input: M, candidate: M): boolean {
  const ic = chromaStar(input.lab);
  const cc = chromaStar(candidate.lab);
  const candidateIsAchromatic = cc < ACHROMATIC_CHROMA;
  if (ic < ACHROMATIC_CHROMA) return candidateIsAchromatic;
  const hueMatches =
    !candidateIsAchromatic &&
    deltaHStar(input.lab, candidate.lab) <= MAX_HUE_DRIFT &&
    hueDeltaDeg(hueStar(input.lab), hueStar(candidate.lab)) <= MAX_HUE_DRIFT_DEG &&
    hueDeltaDeg(srgbHueDeg(input.hex), srgbHueDeg(candidate.hex)) <= MAX_SRGB_HUE_DRIFT_DEG;
  if (ic < TINTED_NEUTRAL_CHROMA) return candidateIsAchromatic || hueMatches;
  return hueMatches;
}

function nearest(input: M, table: readonly { name: string; hex: string }[]) {
  let best: { name: string; hex: string; d: number } | null = null;
  for (const nc of table) {
    const c = measure(nc.hex);
    if (!hueCompatible(input, c)) continue;
    const d = labDistance(input.lab, c.lab);
    if (!best || d < best.d) best = { name: nc.name, hex: nc.hex, d };
  }
  return best;
}

const line = (s: string) => console.log(s);
const NEW = SETNAYAN_NAMES;

// The file's own density law for the curated radius: 20 × (32/N)^(1/3).
const RADIUS = 20 * Math.cbrt(32 / NEW.length);
line(`OLD curated entries: ${WEDDING_NAMES.length}   NEW generated entries: ${NEW.length}`);
line(`density-law radius at N=${NEW.length}:  20 × (32/${NEW.length})^(1/3) = ${RADIUS.toFixed(2)} ΔE`);
line(`(old table shipped WEDDING_NAME_RADIUS_DE = 16 at N=62; law gives ${(20 * Math.cbrt(32 / 62)).toFixed(2)})`);

// ── 1. regression: old colour regions the new table cannot name ──────────
line('\n── 1. EVERY OLD CURATED NAME → ITS NEAREST NEW SWATCH ──────────────────');
const rows = WEDDING_NAMES.map((w) => {
  const input = measure(w.hex);
  const n = nearest(input, NEW);
  return { old: w, near: n };
}).sort((a, b) => (b.near?.d ?? 1e9) - (a.near?.d ?? 1e9));

const orphaned = rows.filter((r) => !r.near || r.near.d > RADIUS);
line(`beyond the ${RADIUS.toFixed(2)} ΔE radius (region loses its curated name): ${orphaned.length} of ${rows.length}`);
for (const r of rows.slice(0, 20)) {
  const flag = !r.near || r.near.d > RADIUS ? '  ⚠' : '   ';
  line(
    `${flag} ${r.old.name.padEnd(24)} ${r.old.hex}  →  ${
      r.near ? `${r.near.name.padEnd(20)} ${r.near.hex}  ΔE ${r.near.d.toFixed(1)}` : 'NO HUE-COMPATIBLE MATCH'
    }`,
  );
}
for (const R of [9, 12, 16, 20]) {
  const n = rows.filter((r) => !r.near || r.near.d > R).length;
  line(`    at radius ${R}: ${n} old regions unnamed`);
}

// ── 2. old NAME STRINGS the new vocabulary drops ─────────────────────────
line('\n── 2. OLD NAME STRINGS ────────────────────────────────────────────────');
const newWords = new Set(NEW.map((n) => foldColorName(n.name)));
const metalWords = new Set(
  SETNAYAN_METALLICS.flatMap((m) => [foldColorName(m.filipino), foldColorName(m.english)]),
);
const kept = WEDDING_NAMES.filter((w) => newWords.has(foldColorName(w.name)));
const inMetal = WEDDING_NAMES.filter((w) => !newWords.has(foldColorName(w.name)) && metalWords.has(foldColorName(w.name)));
const dropped = WEDDING_NAMES.filter(
  (w) => !newWords.has(foldColorName(w.name)) && !metalWords.has(foldColorName(w.name)),
);
line(`survive as a swatch name: ${kept.length}  ·  survive only as a METALLIC: ${inMetal.length}  ·  dropped: ${dropped.length}`);
line(`  metallic-only: ${inMetal.map((w) => w.name).join(', ')}`);
line(`  dropped words:`);
for (const w of dropped) {
  const n = nearest(measure(w.hex), NEW);
  line(`    ${w.name.padEnd(24)} ${w.hex}  → nearest new word: ${n ? `${n.name} (ΔE ${n.d.toFixed(1)})` : 'none'}`);
}

// ── 3. collisions with the CSS floor ─────────────────────────────────────
line('\n── 3. COLLISIONS WITH CSS_NAMES (the never-fails floor) ───────────────');
const cssWords = new Map(CSS_NAMES.map((c) => [foldColorName(c.name), c]));
const wordClash = NEW.filter((n) => cssWords.has(foldColorName(n.name)));
line(`name-string collisions: ${wordClash.length}`);
for (const n of wordClash) {
  const c = cssWords.get(foldColorName(n.name))!;
  line(`    ${n.name.padEnd(20)} new ${n.hex}   css ${c.hex}   ΔE ${labDistance(labOfHex(n.hex), labOfHex(c.hex)).toFixed(1)}`);
}
const cssHexes = new Map(CSS_NAMES.map((c) => [c.hex.toUpperCase(), c.name]));
const hexClash = NEW.filter((n) => cssHexes.has(n.hex));
line(`exact-hex collisions with CSS: ${hexClash.length}${hexClash.length ? ' — ' + hexClash.map((n) => `${n.hex} ${n.name}/${cssHexes.get(n.hex)}`).join(', ') : ''}`);
const oldHexes = new Map(WEDDING_NAMES.map((c) => [c.hex.toUpperCase(), c.name]));
const oldHexClash = NEW.filter((n) => oldHexes.has(n.hex));
line(`exact-hex collisions with old WEDDING_NAMES: ${oldHexClash.length}${oldHexClash.length ? ' — ' + oldHexClash.map((n) => `${n.hex} ${n.name}/${oldHexes.get(n.hex)}`).join(', ') : ''}`);

// ── 4. metallics: would they have hijacked the naming table? ─────────────
line('\n── 4. METALLICS, HAD THEY BEEN NAMEABLE ───────────────────────────────');
for (const m of SETNAYAN_METALLICS) {
  const inNew = nearest(measure(m.hex), NEW);
  const inCss = cssHexes.get(m.hex);
  const inOld = oldHexes.get(m.hex);
  line(
    `    ${m.filipino.padEnd(18)} ${m.hex} ${m.finish.padEnd(11)} nearest field swatch ${
      inNew ? `${inNew.name} ΔE ${inNew.d.toFixed(1)}` : 'none'
    }${inCss ? `  · EXACT css "${inCss}"` : ''}${inOld ? `  · EXACT old "${inOld}"` : ''}`,
  );
}

// ── 5. coverage sweep ────────────────────────────────────────────────────
line('\n── 5. COVERAGE SWEEP (32³ = 32,768 hexes, step 8) ─────────────────────');
const hexes: string[] = [];
for (let r = 0; r < 256; r += 8)
  for (let g = 0; g < 256; g += 8)
    for (let b = 0; b < 256; b += 8)
      hexes.push('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join(''));
for (const [label, table, R] of [
  ['OLD wedding @16', WEDDING_NAMES, 16],
  ['NEW setnayan @9', NEW, 9],
  ['NEW setnayan @12', NEW, 12],
  ['NEW setnayan @16', NEW, 16],
] as const) {
  let wins = 0;
  let lightnessLies = 0;
  for (const h of hexes) {
    const input = measure(h);
    const n = nearest(input, table);
    if (n && n.d <= R) {
      wins++;
      if (Math.abs(input.lab.L - labOfHex(n.hex).L) > 15) lightnessLies++;
    }
  }
  line(
    `    ${label.padEnd(18)} curated layer answers ${((wins / hexes.length) * 100).toFixed(1)}% of the cube · ` +
      `wins >15 L* from their name: ${((lightnessLies / Math.max(wins, 1)) * 100).toFixed(2)}%`,
  );
}

// ── 6. internal separation of the new table ──────────────────────────────
line('\n── 6. NEW TABLE INTERNAL SEPARATION ───────────────────────────────────');
let minGap = Infinity;
let minPair = '';
const gaps: number[] = [];
for (let i = 0; i < NEW.length; i++) {
  let best = Infinity;
  for (let k = 0; k < NEW.length; k++) {
    if (i === k) continue;
    const d = labDistance(labOfHex(NEW[i]!.hex), labOfHex(NEW[k]!.hex));
    if (d < best) best = d;
    if (d < minGap) {
      minGap = d;
      minPair = `${NEW[i]!.name} ↔ ${NEW[k]!.name}`;
    }
  }
  gaps.push(best);
}
gaps.sort((a, b) => a - b);
line(`    closest pair anywhere: ΔE ${minGap.toFixed(2)}  (${minPair})`);
line(`    nearest-neighbour ΔE — min ${gaps[0]!.toFixed(1)} · median ${gaps[Math.floor(gaps.length / 2)]!.toFixed(1)} · max ${gaps[gaps.length - 1]!.toFixed(1)}`);
line(`    pairs below MIN_PERCEPTUAL_GAP (12): ${gaps.filter((g) => g < 12).length} of ${gaps.length}`);

// ── 7. do the swatch names lie about their family? ───────────────────────
line('\n── 7. SWATCH NAME vs ITS OWN FAMILY ───────────────────────────────────');
let crossFamily = 0;
for (const s of SETNAYAN_SWATCHES) {
  const five = SETNAYAN_SWATCHES.find((x) => x.family === s.family && x.step === 500)!;
  if (!hueCompatible(measure(s.hex), measure(five.hex))) crossFamily++;
}
line(`    steps hue-INCOMPATIBLE with their own family's 500: ${crossFamily} of ${SETNAYAN_SWATCHES.length}`);
line('    (expected to be nonzero — the 25/50 tints are near-achromatic, which the guard treats as a different regime)');
