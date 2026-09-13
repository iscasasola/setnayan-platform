#!/usr/bin/env node
/**
 * Generates `apps/web/lib/color-vocabulary.generated.ts` from the owner's
 * moodboard colour system markdown.
 *
 *   node scripts/gen-color-vocabulary.mjs            # reads scripts/color-system.md
 *   node scripts/gen-color-vocabulary.mjs <path.md>  # or an explicit source
 *
 * THE MARKDOWN IS THE SOURCE OF TRUTH, NOT THE .ts. Every swatch name, hex,
 * text-on pair, family mood word, metallic finish and curated palette in the
 * generated module is transcribed from it — nothing is invented here, and the
 * generator FAILS LOUD (non-zero exit) rather than emitting a partial table if
 * a count comes out wrong, because a silently short table is exactly how a
 * naming vocabulary loses a colour region without anyone noticing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ?? resolve(here, 'color-system.md');
const OUT = resolve(here, '../lib/color-vocabulary.generated.ts');

const md = readFileSync(SRC, 'utf8');
const lines = md.split('\n');

// ── expectations, asserted at the end ────────────────────────────────────
const EXPECT = { hueFamilies: 24, neutralFamilies: 4, swatches: 336, metallics: 13, palettes: 12 };

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

// ── parse ────────────────────────────────────────────────────────────────
const families = [];
const swatches = [];
const metallics = [];
const palettes = [];
const anchors = [];

let section = null; // 'wheel' | 'neutrals' | 'metallics' | 'palettes' | 'anchors'
let family = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  const h2 = /^## (.+)$/.exec(line);
  if (h2) {
    const t = h2[1].toLowerCase();
    section = t.includes('wheel')
      ? 'wheel'
      : t.includes('neutral')
        ? 'neutrals'
        : t.includes('metallic')
          ? 'metallics'
          : t.includes('palette')
            ? 'palettes'
            : t.includes('anchor')
              ? 'anchors'
              : null;
    family = null;
    continue;
  }

  // ### 1. Rosas · Rose (0°) — rose
  // ### 20. Takipsilim · Dusk (285°) — dusk — Setnayan's dark canvas
  // ### Buhangin · Sand — sand — warm neutral
  const h3 = /^### (.+)$/.exec(line);
  if (h3 && (section === 'wheel' || section === 'neutrals')) {
    const raw = h3[1];
    const ordered = /^(\d+)\.\s*(.*)$/.exec(raw);
    const body = ordered ? ordered[2] : raw;
    const parts = body.split(' — ').map((s) => s.trim());
    const head = parts[0]; // "Rosas · Rose (0°)"  |  "Buhangin · Sand"
    const gloss = parts[1] ?? null; // "rose" | "sand"
    const note = parts.slice(2).join(' — ') || null; // "Setnayan's dark canvas"

    const deg = /\((\d+)°\)/.exec(head);
    const names = head
      .replace(/\s*\(\d+°\)\s*/, '')
      .split('·')
      .map((s) => s.trim());

    family = {
      slug: slug(names[0]),
      filipino: names[0],
      english: names[1] ?? names[0],
      kind: section === 'wheel' ? 'hue' : 'neutral',
      degrees: deg ? Number(deg[1]) : null,
      gloss,
      note,
      temperature: null,
      moods: [],
      complement: null,
      triad: [],
    };
    // The neutral families carry no `*…*` meta line — their only descriptor is
    // the trailing note ("warm neutral", "true neutral", "cool neutral",
    // "brown neutral"). Read the temperature OUT of it where the source states
    // one, and leave it null where it does not: "brown" is a hue word, not a
    // temperature, and inferring 'warm' from it would be this generator making
    // up a fact the owner never wrote.
    if (family.kind === 'neutral' && note) {
      if (note.startsWith('warm ')) family.temperature = 'warm';
      else if (note.startsWith('cool ')) family.temperature = 'cool';
      else if (note.startsWith('true ')) family.temperature = 'neutral';
    }

    families.push(family);
    continue;
  }

  // *warm · romantic, classic, garden · complement: bakawan · triad: kalamansi, bughaw*
  const meta = /^\*(.+)\*$/.exec(line.trim());
  if (meta && family) {
    for (const seg of meta[1].split('·').map((s) => s.trim())) {
      if (/^(warm|cool|neutral)$/.test(seg)) family.temperature = seg;
      else if (seg.startsWith('complement:')) family.complement = slug(seg.slice(11));
      else if (seg.startsWith('triad:'))
        family.triad = seg
          .slice(6)
          .split(',')
          .map((s) => slug(s));
      else family.moods = seg.split(',').map((s) => s.trim());
    }
    continue;
  }

  // | 25 | **Rose Mist** | `#FFF8FA` | `#101010` |
  const swatch =
    /^\|\s*(\d+)\s*\|\s*\*\*(.+?)\*\*\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*(?:\|\s*`(#[0-9A-Fa-f]{6})`\s*)?\|/.exec(
      line,
    );
  if (swatch && family && (section === 'wheel' || section === 'neutrals')) {
    swatches.push({
      name: swatch[2].trim(),
      hex: swatch[3].toUpperCase(),
      family: family.slug,
      step: Number(swatch[1]),
      textOn: swatch[4] ? swatch[4].toUpperCase() : null,
    });
    continue;
  }

  // | **Ginto** | Gold | `#D4AF37` | polished | Primary metallic. … |
  const metallic =
    /^\|\s*\*\*(.+?)\*\*\s*\|\s*([^|]+?)\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|\s*([a-z]+)\s*\|\s*(.*?)\s*\|/.exec(
      line,
    );
  if (metallic && section === 'metallics') {
    metallics.push({
      slug: slug(metallic[1]),
      filipino: metallic[1].trim(),
      english: metallic[2].trim(),
      hex: metallic[3].toUpperCase(),
      finish: metallic[4],
      note: metallic[5],
    });
    continue;
  }

  // - **Takipsilim Ginto** (Dusk & Gold) — description *year-round · formal*
  //   `#201A45` Nightfall Noir `#473D8F` Deep Twilight …
  const palette = /^-\s+\*\*(.+?)\*\*\s*\((.+?)\)\s*—\s*(.*?)\s*\*(.+?)\*\s*$/.exec(line);
  if (palette && section === 'palettes') {
    const swatchLine = lines[i + 1] ?? '';
    const members = [];
    const memberRe = /`(#[0-9A-Fa-f]{6})`\s+([^`]+?)(?=\s*`#|\s*$)/g;
    let m;
    while ((m = memberRe.exec(swatchLine))) members.push({ hex: m[1].toUpperCase(), name: m[2].trim() });
    const [season, formality] = palette[4].split('·').map((s) => s.trim());
    palettes.push({
      slug: slug(palette[1]),
      filipino: palette[1].trim(),
      english: palette[2].trim(),
      description: palette[3].trim(),
      season,
      formality,
      members,
    });
    continue;
  }

  // - `arawGold` → **Golden Hour** (`araw-400`, #C3A552)
  const anchor = /^-\s+`([A-Za-z]+)`\s*→\s*\*\*(.+?)\*\*\s*\(`(.+?)`,\s*(#[0-9A-Fa-f]{6})\)/.exec(line);
  if (anchor && section === 'anchors') {
    anchors.push({
      token: anchor[1],
      name: anchor[2].trim(),
      ref: anchor[3],
      hex: anchor[4].toUpperCase(),
    });
  }
}

// ── fail loud ────────────────────────────────────────────────────────────
const problems = [];
const hue = families.filter((f) => f.kind === 'hue');
const neutral = families.filter((f) => f.kind === 'neutral');
if (hue.length !== EXPECT.hueFamilies) problems.push(`hue families ${hue.length} ≠ ${EXPECT.hueFamilies}`);
if (neutral.length !== EXPECT.neutralFamilies)
  problems.push(`neutral families ${neutral.length} ≠ ${EXPECT.neutralFamilies}`);
if (swatches.length !== EXPECT.swatches) problems.push(`swatches ${swatches.length} ≠ ${EXPECT.swatches}`);
if (metallics.length !== EXPECT.metallics) problems.push(`metallics ${metallics.length} ≠ ${EXPECT.metallics}`);
if (palettes.length !== EXPECT.palettes) problems.push(`palettes ${palettes.length} ≠ ${EXPECT.palettes}`);
// Mood words / complement / triad exist only on the hue wheel — the neutral
// families publish none, and demanding them would be asserting a shape the
// source does not have.
for (const f of hue) {
  if (f.moods.length === 0) problems.push(`hue family ${f.slug} has no mood words`);
  if (!f.complement) problems.push(`hue family ${f.slug} has no complement`);
  if (f.triad.length !== 2) problems.push(`hue family ${f.slug} has ${f.triad.length} triad members`);
  if (!f.temperature) problems.push(`hue family ${f.slug} has no temperature`);
}
for (const f of families) if (rowsBySlugCount(f.slug) !== 12) problems.push(`family ${f.slug} has ${rowsBySlugCount(f.slug)} steps`);
function rowsBySlugCount(s) {
  return swatches.filter((x) => x.family === s).length;
}
for (const p of palettes) if (p.members.length !== 6) problems.push(`palette ${p.slug} has ${p.members.length} members`);
const seenName = new Map();
const seenHex = new Map();
for (const s of swatches) {
  if (seenName.has(s.name)) problems.push(`duplicate swatch name ${s.name}`);
  if (seenHex.has(s.hex)) problems.push(`duplicate swatch hex ${s.hex} (${seenHex.get(s.hex)} = ${s.name})`);
  seenName.set(s.name, s.name);
  seenHex.set(s.hex, s.name);
}
// The name → hex index in lib/color-names.ts keys on `foldColorName`, which
// strips case, punctuation and diacritics. Two swatches that fold to one key
// would silently make one of them unreachable by name — "Rosé" and a "Rose"
// both fold to "rose". Uniqueness of the NAME STRINGS above is not enough.
const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const folded = new Map();
for (const s of swatches) {
  if (folded.has(fold(s.name)))
    problems.push(`folded-name collision: "${folded.get(fold(s.name))}" ≡ "${s.name}"`);
  folded.set(fold(s.name), s.name);
}

// Two metallic ENGLISH words are also swatch names in the source: "Antique
// Gold" (araw-700) and "Gunmetal" (ulap-700). Harmless while metallics stay
// out of the naming index — the swatch owns the word — but a THIRD overlap
// should surface rather than accumulate silently, so the known two are listed
// and anything else fails.
const KNOWN_METALLIC_WORD_OVERLAP = ['antiquegold', 'gunmetal'];
for (const m of metallics)
  for (const w of [m.filipino, m.english])
    if (folded.has(fold(w)) && !KNOWN_METALLIC_WORD_OVERLAP.includes(fold(w)))
      problems.push(`metallic "${w}" collides with swatch "${folded.get(fold(w))}"`);

// A palette member or brand anchor that names a hex the swatch tables do not
// hold is a SECOND, COMPETING value for one colour — the exact failure that
// #556FDB/#546FDA Indigo nearly became. Both directions are checked: the hex
// must exist, and the name printed next to it must be that hex's name.
const byHexName = new Map(swatches.map((s) => [s.hex, s.name]));
for (const p of palettes) {
  for (const m of p.members) {
    if (!byHexName.has(m.hex)) problems.push(`palette ${p.slug}: ${m.hex} (${m.name}) is not a swatch`);
    else if (byHexName.get(m.hex) !== m.name)
      problems.push(`palette ${p.slug}: ${m.hex} is "${byHexName.get(m.hex)}", printed as "${m.name}"`);
  }
}
for (const a of anchors) {
  if (!byHexName.has(a.hex)) problems.push(`anchor ${a.token}: ${a.hex} is not a swatch`);
  else if (byHexName.get(a.hex) !== a.name)
    problems.push(`anchor ${a.token}: ${a.hex} is "${byHexName.get(a.hex)}", printed as "${a.name}"`);
  const ref = /^([a-z-]+)-(\d+)$/.exec(a.ref);
  const row = ref && swatches.find((s) => s.family === ref[1] && s.step === Number(ref[2]));
  if (!row) problems.push(`anchor ${a.token}: ref ${a.ref} resolves to no swatch`);
  else if (row.hex !== a.hex) problems.push(`anchor ${a.token}: ref ${a.ref} is ${row.hex}, not ${a.hex}`);
}
if (anchors.length === 0) problems.push('no brand anchors parsed');

// every family slug referenced by a complement/triad must exist
const slugs = new Set(families.map((f) => f.slug));
for (const f of families) {
  if (f.complement && !slugs.has(f.complement)) problems.push(`${f.slug}: complement ${f.complement} not a family`);
  for (const t of f.triad) if (!slugs.has(t)) problems.push(`${f.slug}: triad ${t} not a family`);
}
if (problems.length) {
  console.error('gen-color-vocabulary: REFUSING TO EMIT\n' + problems.map((p) => '  · ' + p).join('\n'));
  process.exit(1);
}

// ── emit ─────────────────────────────────────────────────────────────────
// Emit prettier-shaped literals: singleQuote:true, but double quotes when the
// string itself contains an apostrophe — the same rule prettier applies, so a
// regenerate does not fight `pnpm format`.
const q = (v) => {
  if (v === null || v === undefined) return 'null';
  const s = String(v);
  return s.includes("'") ? JSON.stringify(s) : `'${s.replace(/\\/g, '\\\\')}'`;
};
const arr = (a) => `[${a.map(q).join(', ')}]`;
const j = q;
const rowsBySlug = new Map();
for (const s of swatches) {
  if (!rowsBySlug.has(s.family)) rowsBySlug.set(s.family, []);
  rowsBySlug.get(s.family).push(s);
}

const out = `// ============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
//   regenerate:  node scripts/gen-color-vocabulary.mjs
//   source:      apps/web/scripts/color-system.md   (the owner's colour system)
//   generator:   apps/web/scripts/gen-color-vocabulary.mjs
//
// The Setnayan moodboard colour vocabulary: ${EXPECT.hueFamilies} hue families every 15°, ${EXPECT.neutralFamilies}
// neutral families, ${EXPECT.swatches} named swatches, ${EXPECT.metallics} metallics, ${EXPECT.palettes} curated palettes.
//
// 🔑 THE SHAPE IS THE POINT. The FAMILY name is Filipino (Rosas, Dagat,
// Takipsilim, Kalachuchi); the SWATCH names are universal wedding vocabulary
// (Blush Rose, Antique Rose, Old Rose, Rosewood, Claret). A supplier reads a
// word they already know; the system's spine stays Filipino. Do not "simplify"
// by translating either half into the other.
//
// ⚠ THIS MODULE IS DATA ONLY — no imports, no logic. It deliberately does not
// import from './color-space' (owned by another change in flight) or from
// './color-names' (which will consume it), so it can never be half of an import
// cycle and can never be broken by a change to the colour maths.
// ============================================================================

/** A finish is a SURFACE property, not a colour. Only metallics carry one. */
export type MetallicFinish = 'polished' | 'brushed' | 'satin' | 'matte' | 'iridescent';

export type FamilyTemperature = 'warm' | 'cool' | 'neutral';

/** The ${swatches.length / families.length}-step ladder every family runs, light → dark. The 500 step carries
 *  the family name. */
export type SwatchStep = ${[...new Set(swatches.map((s) => s.step))].sort((a, b) => a - b).join(' | ')};

export type SetnayanSwatch = {
  /** Universal wedding vocabulary — the word a supplier reads. Unique across all ${swatches.length}. */
  name: string;
  hex: string;
  /** Slug of the family in \`SETNAYAN_FAMILIES\` this step belongs to. */
  family: string;
  step: SwatchStep;
  /**
   * The text colour the system pairs with this swatch, verified ≥ 4.5:1 (WCAG
   * AA normal text) against it. Null for the neutral families, whose tables
   * publish no text-on column.
   */
  textOn: string | null;
};

export type SetnayanFamily = {
  slug: string;
  /** The Filipino name — the spine of the system. Also the ${'`500`'} step's swatch name. */
  filipino: string;
  english: string;
  kind: 'hue' | 'neutral';
  /** Position on the 24-spoke wheel, in degrees. Null for the neutral families. */
  degrees: number | null;
  /** What the Filipino word names in the world — "mango", "dusk", "mangrove". */
  gloss: string | null;
  /** Extra editorial note from the source, e.g. "Setnayan's signature gold". */
  note: string | null;
  temperature: FamilyTemperature | null;
  /** Mood words a couple or stylist would brief with — "romantic", "black-tie". */
  moods: readonly string[];
  /** Slug of the family opposite on the wheel. */
  complement: string | null;
  /** Slugs of the two families forming an equilateral triad with this one. */
  triad: readonly string[];
};

export type SetnayanMetallic = {
  slug: string;
  filipino: string;
  english: string;
  hex: string;
  finish: MetallicFinish;
  note: string;
};

export type SetnayanPalette = {
  slug: string;
  filipino: string;
  english: string;
  description: string;
  season: string;
  formality: string;
  members: readonly { hex: string; name: string }[];
};

/** A brand token pinned to one swatch, so the brand and the vocabulary cannot drift apart. */
export type SetnayanAnchor = { token: string; name: string; ref: string; hex: string };

// ── the ${families.length} families ───────────────────────────────────────────────────────────
export const SETNAYAN_FAMILIES: readonly SetnayanFamily[] = [
${families
  .map(
    (f) =>
      `  {
    slug: ${q(f.slug)},
    filipino: ${q(f.filipino)},
    english: ${q(f.english)},
    kind: ${q(f.kind)},
    degrees: ${f.degrees === null ? 'null' : f.degrees},
    gloss: ${q(f.gloss)},
    note: ${q(f.note)},
    temperature: ${q(f.temperature)},
    moods: ${arr(f.moods)},
    complement: ${q(f.complement)},
    triad: ${arr(f.triad)},
  },`,
  )
  .join('\n')}
];

// ── the ${swatches.length} named swatches ───────────────────────────────────────────────
//
// Grouped by family, in ladder order. Names are unique across the whole table
// and so are hexes — the generator refuses to emit if either stops being true.
export const SETNAYAN_SWATCHES: readonly SetnayanSwatch[] = [
${[...rowsBySlug.entries()]
  .map(([fam, rows]) => {
    const f = families.find((x) => x.slug === fam);
    return (
      `  // ${f.filipino} · ${f.english}${f.degrees === null ? ' (neutral)' : ` (${f.degrees}°)`}\n` +
      rows
        .map(
          (s) =>
            `  { name: ${j(s.name)}, hex: ${j(s.hex)}, family: ${j(s.family)}, step: ${s.step}, textOn: ${j(
              s.textOn,
            )} },`,
        )
        .join('\n')
    );
  })
  .join('\n')}
];

// ── the ${metallics.length} metallics ─────────────────────────────────────────────────────
//
// 🛑 DELIBERATELY NOT IN THE NAMING TABLE. A metallic is a FINISH — polished,
// brushed, satin, matte, iridescent — and a finish is not a property a hex can
// carry. Nothing in a hex distinguishes polished Ginto from a flat yellow paint
// at the same coordinates, so a nearest-match namer that could answer "Ginto"
// would be promising a couple a metal it cannot see. The source says this of
// itself: Perlas is "bridal detail, not a field color".
//
// They stay here as DATA because a palette builder legitimately needs them —
// "which metal goes with this palette" is a real question and these hexes are
// the honest answer to it. Reach for them by slug, never by proximity.
export const SETNAYAN_METALLICS: readonly SetnayanMetallic[] = [
${metallics
  .map(
    (m) =>
      `  {
    slug: ${q(m.slug)},
    filipino: ${q(m.filipino)},
    english: ${q(m.english)},
    hex: ${q(m.hex)},
    finish: ${q(m.finish)},
    note: ${q(m.note)},
  },`,
  )
  .join('\n')}
];

// ── the ${palettes.length} curated palettes ────────────────────────────────────────────────
//
// Ready-made theme starters, each 6 swatches drawn from the tables above. These
// belong to the MOOD BOARD / theme layer, not to naming — a palette is an
// authored recommendation, and the naming module answers a different question
// (what is this one colour called). Every member hex is a swatch in
// SETNAYAN_SWATCHES, so a starter can never introduce an unnamed colour.
export const SETNAYAN_PALETTES: readonly SetnayanPalette[] = [
${palettes
  .map(
    (p) =>
      `  {
    slug: ${q(p.slug)},
    filipino: ${q(p.filipino)},
    english: ${q(p.english)},
    description: ${q(p.description)},
    season: ${q(p.season)},
    formality: ${q(p.formality)},
    members: [
${p.members.map((m) => `      { hex: ${q(m.hex)}, name: ${q(m.name)} },`).join('\n')}
    ],
  },`,
  )
  .join('\n')}
];

// ── brand anchors ────────────────────────────────────────────────────────
export const SETNAYAN_ANCHORS: readonly SetnayanAnchor[] = [
${anchors.map((a) => `  { token: ${j(a.token)}, name: ${j(a.name)}, ref: ${j(a.ref)}, hex: ${j(a.hex)} },`).join('\n')}
];

// ── the naming table ─────────────────────────────────────────────────────
//
// Every swatch is a nameable entry: ${swatches.length} \`{ name, hex }\` pairs, structurally the
// same shape as \`NamedColor\` in ./color-names. This is what replaces the
// hand-curated \`WEDDING_NAMES\` table; \`CSS_NAMES\` stays the never-fails floor
// underneath it, unchanged.
//
// ⚠ METALLICS ARE NOT IN HERE, ON PURPOSE — see SETNAYAN_METALLICS above.
export const SETNAYAN_NAMES: readonly { name: string; hex: string }[] = SETNAYAN_SWATCHES.map(
  ({ name, hex }) => ({ name, hex }),
);
`;

writeFileSync(OUT, out);
console.log(
  `wrote ${OUT}\n  families ${families.length} (${hue.length} hue + ${neutral.length} neutral)\n  swatches ${swatches.length}\n  metallics ${metallics.length}\n  palettes ${palettes.length}\n  anchors ${anchors.length}`,
);
