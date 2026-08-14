/**
 * doorway-palette.test.ts — the eight public doorways must wear the LOCKED
 * palette, and the colours they put together must be readable.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * Two guards already compute WCAG contrast in this repo and NEITHER could see
 * what was wrong on these eight pages:
 *
 *   • `lib/palette-lock.test.ts` checks the TOKEN DEFINITIONS in globals.css.
 *     Every token involved here is fine in isolation, so it was green — and
 *     right to be. It cannot see a hex a component typed instead of a token.
 *   • `scripts/lint-label-on-fill-contrast.mjs` checks CALL SITES, which is the
 *     other half — but by its own documented limit it judges only pairings
 *     where BOTH sides resolve to an OPAQUE colour. The doorway cards were
 *     `bg-white/60`: an alpha over an unknown parent, so every pairing on them
 *     was skipped.
 *
 * In that blind spot, on all eight public product pages at once:
 *
 *   1 · THE CARDS WERE WHITE ON A CREAM PAGE. `bg-white/60` composited over
 *       `bg-cream` is #FEFDFC — white in all but name — on a #FDFBF7 body. The
 *       lock says page and cards are both cream, separated by border + shadow.
 *   2 · THE STRUCK-THROUGH COLUMN FAILED AA at 3.06:1 (#9A8F86 on cream), in
 *       the one section whose entire job is the comparison. It shipped that way
 *       because the colour was hand-typed and nothing was looking.
 *
 * ─── WHAT THIS CHECKS, AND WHY IT IS NOT DECORATION ──────────────────────
 * Test 1 bans a raw colour literal in any doorway source. That is a check on
 * the ACT (typing a hex) rather than on a symptom, it has NO baseline, and it
 * is the mechanism that makes `DOORWAY_TONE` sharing real instead of merely
 * offered.
 *
 * Test 2 resolves the tokens the kit actually names OUT OF globals.css and
 * computes the contrast of the pairings it renders. Derived, never re-typed:
 * change `--m-slate-2` and the arithmetic re-runs. A hand-typed
 * `assert.equal(MUTED, '#6E6A62')` would be two humans agreeing with each other
 * — the failure mode this repo has been bitten by repeatedly.
 *
 * Test 3 proves the scan is not vacuous. Every assertion below passes trivially
 * if the file list comes back empty, which a renamed folder would do silently.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..'); // apps/web/app
const CSS = readFileSync(resolve(APP, 'globals.css'), 'utf8');

/** Same eight as `doorway-invariants.test.ts`, plus the kit they share. */
const DOORWAYS = [
  'papic',
  'panood',
  'pawebsite',
  'pa3d',
  'palogo',
  'alaala',
  'patiktok',
  'setnayan-ai',
] as const;

/** Strip comments — a docblock that QUOTES `#9A8F86` to explain why it is gone
 *  is not a use of it. (The docblocks in `_doorway.tsx` do exactly that.) */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

type Source = { path: string; src: string };

function sourcesFor(route: string): Source[] {
  const dir = join(APP, route);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ path: `app/${route}/${f}`, src: code(readFileSync(join(dir, f), 'utf8')) }));
}

/*
  🪤 THE KIT IS TWO FILES NOW, AND READING ONLY ONE MADE THIS GUARD GO RED ON
  CORRECT CODE. `DOORWAY_TONE` moved to `_doorway-tone.ts` on 2026-08-15 so that
  `/alaala` — which imports the tone and nothing else — would stop transitively
  pulling in the shared shell (`_doorway.tsx` now imports `AppRailShell`, which
  is `server-only` and carries `front-door.css`). This guard read `_doorway.tsx`
  alone and reported the tone "gone from the kit". Both halves are the kit.
*/
const KIT_REL = 'app/_components/marketing/_doorway.tsx';
const KIT_ABS = join(HERE, '_doorway.tsx');
const TONE_REL = 'app/_components/marketing/_doorway-tone.ts';
const TONE_ABS = join(HERE, '_doorway-tone.ts');

function allSources(): Source[] {
  const kit = existsSync(KIT_ABS)
    ? [
        { path: KIT_REL, src: code(readFileSync(KIT_ABS, 'utf8')) },
        ...(existsSync(TONE_ABS)
          ? [{ path: TONE_REL, src: code(readFileSync(TONE_ABS, 'utf8')) }]
          : []),
      ]
    : [];
  return [...kit, ...DOORWAYS.flatMap(sourcesFor)];
}

/* ─── WCAG, computed from the real token values ──────────────────────────── */

/** `--m-slate-2:  #6E6A62;` → `#6E6A62`. Throws rather than guessing. */
function token(name: string): string {
  const m = CSS.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
  const hex = m?.[1];
  assert.ok(hex, `token --${name} is not defined as a hex in globals.css — renamed or deleted?`);
  return hex.toUpperCase();
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    assert.ok(Number.isFinite(v), `not a 6-digit hex colour: ${hex}`);
    return v / 255;
  }) as [number, number, number];
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(channels[0]) + 0.7152 * f(channels[1]) + 0.0722 * f(channels[2]);
}

function contrast(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

/* ─── 1 · NO RAW COLOUR LITERAL ──────────────────────────────────────────── */

test('no public doorway hand-types a colour — the palette comes from tokens', () => {
  // `bg-white/60` is a raw colour too: it is the exact one that put white cards
  // on a cream page, and it is invisible to a hex scan. Catch both spellings.
  const HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g;
  const NAMED = /\b(?:bg|text|border|decoration|ring|shadow|from|via|to)-white\b(?:\/\d+)?/g;

  const offences: string[] = [];
  for (const { path, src } of allSources()) {
    for (const m of src.match(HEX) ?? []) offences.push(`${path}: ${m}`);
    for (const m of src.match(NAMED) ?? []) offences.push(`${path}: ${m}`);
  }

  assert.deepEqual(
    offences,
    [],
    `A doorway hand-typed a colour instead of using a locked token:\n  ` +
      offences.join('\n  ') +
      `\n\nUse a \`--m-*\` token (or \`DOORWAY_TONE\` in _doorway.tsx). ` +
      `THERE IS NO BASELINE HERE ON PURPOSE — a baseline is a bill, not a ` +
      `decision, and every line in one would be a decision that a public page ` +
      `stops following the palette until further notice. \`white\` is banned ` +
      `alongside hexes because the page is CREAM: a white card is invisible as ` +
      `a hex and was the actual defect this guard was written for.`,
  );
});

/* ─── 2 · THE PAIRINGS THE KIT RENDERS ARE READABLE ──────────────────────── */

/**
 * ⚠ BOTH SIDES OF EVERY PAIRING BELOW ARE DERIVED FROM SOURCE, AND THE FIRST
 * DRAFT OF THIS TEST WAS NOT.
 *
 * That draft hand-wrote the surface for each pairing — `['step numeral (gold)
 * on a cream card', orange2, paper]`. A mutation that moved the step card from
 * `--m-paper` to `--m-paper-2` in the KIT landed cleanly (occurrences 0 → 1)
 * and this test STAYED GREEN, because the table still said `paper` while the
 * component said `paper-2`. Gold on paper-2 measures 4.42:1 and fails. The
 * guard would have been checking that I had typed the same word twice.
 *
 * So the surface is now read out of `DOORWAY_TONE` and the zebra out of the
 * kit's own ternary. Move a card to another surface and the arithmetic re-runs
 * against the surface the page will actually render.
 */
function toneEntry(name: string): string {
  /*
    🪤 READ FROM WHEREVER THE TONE ACTUALLY LIVES. This read `_doorway.tsx`
    only, and on 2026-08-15 `DOORWAY_TONE` moved to its own module — so
    `kit.indexOf('export const DOORWAY_TONE')` returned -1, `slice(-1)` handed
    back the LAST CHARACTER of the file, and every lookup failed with "gone from
    the kit" against code that was more correct than before. `.indexOf` → -1 →
    `.slice(-1)` is a silent, plausible-looking wrong answer, which is why this
    now asserts the anchor was found instead of slicing on it blindly.
  */
  const src = existsSync(TONE_ABS)
    ? readFileSync(TONE_ABS, 'utf8')
    : readFileSync(KIT_ABS, 'utf8');
  const at = src.indexOf('export const DOORWAY_TONE');
  assert.ok(
    at !== -1,
    'DOORWAY_TONE was not found in either half of the kit — this guard would ' +
      'otherwise slice from -1 and report every entry missing.',
  );
  const block = src.slice(at);
  const m = block.match(new RegExp(`\\b${name}:\\s*\\n?\\s*'([^']+)'`));
  const value = m?.[1];
  assert.ok(value, `DOORWAY_TONE.${name} is gone from the kit — renamed or deleted?`);
  return value;
}

/** `text-[var(--m-slate-2)] …` + prefix `text` → `#6E6A62`. */
function tokenIn(classes: string, prefix: string): string {
  const m = classes.match(new RegExp(`\\b${prefix}-\\[var\\(--([a-z0-9-]+)\\)\\]`));
  const name = m?.[1];
  assert.ok(name, `no \`${prefix}-[var(--…)]\` found in "${classes}" — did it stop using a token?`);
  return token(name);
}

/** The two alternating surfaces in the kit's differentiator, in source order. */
function zebraSurfaces(): [string, string] {
  const kit = code(readFileSync(KIT_ABS, 'utf8'));
  const row = kit.match(/i % 2 \? '([^']+)' : '([^']+)'/);
  assert.ok(row, 'the differentiator zebra ternary is gone from the kit');
  return [tokenIn(row![1] ?? '', 'bg'), tokenIn(row![2] ?? '', 'bg')];
}

test('every text/surface pairing the doorway kit renders clears AA', () => {
  const muted = tokenIn(toneEntry('muted'), 'text');
  const gold = tokenIn(toneEntry('gold'), 'text');
  const card = tokenIn(toneEntry('card'), 'bg');
  const closing = tokenIn(toneEntry('closingPanel'), 'bg');
  const [zebraOdd, zebraEven] = zebraSurfaces();
  // The page body is `bg-cream` (root layout) — the same value as --m-paper,
  // asserted here so a divergence surfaces rather than being assumed.
  const page = token('m-paper');
  const ink = token('m-ink');
  const ctaFill = token('m-mulberry');
  const ctaLabel = token('m-paper');

  const PAIRINGS: [string, string, string][] = [
    ['hero lede on the page', muted, page],
    ['hero kicker (gold) on the page', gold, page],
    ['step body on the card', muted, card],
    ['step numeral (gold) on the card', gold, card],
    ['struck-through half, odd row', muted, zebraOdd],
    ['struck-through half, even row', muted, zebraEven],
    ['affirmed half, odd row', ink, zebraOdd],
    ['closing body on the closing panel', muted, closing],
    ['closing heading on the closing panel', ink, closing],
    ['CTA label on terracotta', ctaLabel, ctaFill],
  ];

  const failures = PAIRINGS.filter(([, fg, bg]) => contrast(fg, bg) < AA).map(
    ([what, fg, bg]) => `${what}: ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}:1`,
  );

  assert.deepEqual(
    failures,
    [],
    `A doorway pairing is below the ${AA}:1 AA floor for normal text:\n  ` +
      failures.join('\n  ') +
      `\n\nEvery number here is COMPUTED — the tokens from globals.css, the ` +
      `surfaces from DOORWAY_TONE and the kit's own zebra — so this fails when ` +
      `either side moves. 🪤 Size against CREAM, never white: gold ` +
      `--m-orange-2 clears AA on --m-paper (4.79:1) and FAILS on --m-paper-2 ` +
      `(4.42:1). That is why the cards are --m-paper and only the zebra rows ` +
      `alternate. Do not "tidy" the two to one value.`,
  );
});

/* ─── 2b · THE PAGE THAT IS NOT ON THE KIT ───────────────────────────────── */

test('a doorway that pairs its OWN surface with gold keeps that pairing readable', () => {
  /**
   * 🚨 THIS EXISTS BECAUSE THE FIRST VERSION OF THIS FILE COULD NOT SEE
   * `/alaala`, AND `/alaala` SHIPPED THE EXACT FAILURE THIS FILE DOCUMENTS.
   *
   * The test above derives its surfaces from `DOORWAY_TONE` and the kit's own
   * zebra, which is strictly stronger than a hand-typed table — for the SEVEN
   * pages that mount the kit. `/alaala` deliberately does not, so the only
   * checks reaching it were the raw-hex scan (which `--m-paper-2` passes, it is
   * a perfectly legal token) and the vacuity check.
   *
   * In that gap it shipped `hover:bg-[var(--m-paper-2)]` on a card whose eyebrow
   * is `text-[var(--m-orange-2)]` — 4.42:1, below AA, on hover, on a live public
   * page. The kit's docblock states that number verbatim as the reason its cards
   * are `--m-paper`. The rule was written down and broken in the same commit.
   *
   * 🔑 GOLD HAS 0.29 OF HEADROOM ON CREAM (4.79 vs the 4.5 floor), so ANY
   * surface tint under gold text fails — including the kit's own
   * `hover:bg-[var(--m-ink)]/[0.04]`, which measures 4.47:1. A hover under gold
   * must move the border or the shadow, never the fill.
   *
   * This scans EVERY doorway's own JSX, including `hover:` variants, which the
   * pairing table cannot reach.
   */
  /**
   * ⚠ THE ALPHA FORM IS THE WHOLE POINT, AND THE FIRST DRAFT OF THIS TEST MISSED
   * IT — measured, by a mutation that landed (occurrences 2 → 3) and stayed
   * GREEN. `bg-[var(--m-ink)]/[0.04]` is the KIT's own card hover and the most
   * likely thing a future page copies in; under gold it measures 4.47:1 and
   * fails. Skipping alphas is precisely why `lint-label-on-fill-contrast.mjs`
   * could not see the original defect, so a guard written to close that blind
   * spot must not reproduce it.
   *
   * These alphas sit on the CREAM page, so they are composited against
   * `--m-paper` rather than guessed at — a known parent, unlike the general case
   * that lint rightly declines to judge.
   */
  const TINT =
    /\b(?:hover:|focus:|group-hover:)?bg-\[var\(--([a-z0-9-]+)\)\](?:\/\[?([\d.]+)%?\]?)?/g;
  const GOLDS = new Set(['m-orange', 'm-orange-2', 'm-orange-3']);
  const PAGE = token('m-paper');

  /** Composite `hex` at `alpha` over the cream page. */
  function composite(hex: string, alpha: number): string {
    const mix = (i: number) => {
      const f = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
      const b = parseInt(PAGE.slice(1 + i * 2, 3 + i * 2), 16);
      return Math.round(f * alpha + b * (1 - alpha));
    };
    return (
      '#' +
      [0, 1, 2]
        .map((i) => mix(i).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    );
  }

  const offences: string[] = [];
  for (const { path, src } of allSources()) {
    // An element that sets a gold text colour anywhere in the same className,
    // plus any surface token in that same className, is a pairing.
    for (const attr of src.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? []) {
      const goldHit = [...attr.matchAll(/text-\[var\(--([a-z0-9-]+)\)\]/g)]
        .map((m) => m[1] ?? '')
        .filter((t) => GOLDS.has(t));
      if (goldHit.length === 0) continue;
      for (const m of attr.matchAll(TINT)) {
        const surface = m[1];
        if (!surface) continue;
        const rawAlpha = m[2];
        const alpha = rawAlpha === undefined ? 1 : Number(rawAlpha) > 1 ? Number(rawAlpha) / 100 : Number(rawAlpha);
        if (!Number.isFinite(alpha)) continue;
        const bg = alpha === 1 ? token(surface) : composite(token(surface), alpha);
        for (const gold of goldHit) {
          const ratio = contrast(token(gold), bg);
          if (ratio < AA) {
            offences.push(
              `${path}: --${gold} on ${alpha === 1 ? `--${surface}` : `--${surface} @${alpha} over cream (${bg})`} = ${ratio.toFixed(2)}:1 (in "${m[0]}")`,
            );
          }
        }
      }
    }
    /**
     * The same pairing when the tint is on a PARENT and the gold on a CHILD —
     * the shape that actually shipped on `/alaala`: `hover:` on the `<Link>`,
     * the gold eyebrow on a `<span>` inside it. Two classNames, one hover.
     *
     * ⚠ SCOPED TO A WINDOW, NOT TO THE FILE. The first cut asked "does this file
     * render gold anywhere?", which flagged the kit's SECONDARY_CTA — a button
     * whose label is `--m-ink`, innocent — purely because a gold eyebrow exists
     * 200 lines away. That is the file-level-match defect this repo has paid for
     * before, and a guard that cries wolf teaches you to skim past the one time
     * it is right. The gold that a parent's hover actually sits under is the
     * gold in its own subtree, which in this markup is within a few hundred
     * characters.
     */
    const WINDOW = 400;
    for (const m of src.matchAll(
      /\b(?:hover|focus|group-hover):bg-\[var\(--([a-z0-9-]+)\)\](?:\/\[?([\d.]+)%?\]?)?/g,
    )) {
      const surface = m[1];
      if (!surface) continue;
      const rawAlpha = m[2];
      const alpha =
        rawAlpha === undefined ? 1 : Number(rawAlpha) > 1 ? Number(rawAlpha) / 100 : Number(rawAlpha);
      if (!Number.isFinite(alpha)) continue;
      const bg = alpha === 1 ? token(surface) : composite(token(surface), alpha);
      const subtree = src.slice(m.index ?? 0, (m.index ?? 0) + WINDOW);
      for (const gold of ['m-orange', 'm-orange-2', 'm-orange-3']) {
        if (!new RegExp(`text-\\[var\\(--${gold}\\)\\]`).test(subtree)) continue;
        const ratio = contrast(token(gold), bg);
        if (ratio < AA) {
          offences.push(
            `${path}: "${m[0]}" tints the surface under --${gold} text in the same block — ` +
              `${ratio.toFixed(2)}:1, below AA`,
          );
        }
      }
    }
  }

  assert.deepEqual(
    offences,
    [],
    `A doorway tints a surface underneath gold text, below the ${AA}:1 AA floor:\n  ` +
      offences.join('\n  ') +
      `\n\nGold clears AA on --m-paper (4.79:1) and on NOTHING darker: --m-paper-2 ` +
      `is 4.42:1 and even --m-ink at 4% opacity is 4.47:1. A hover under gold ` +
      `must move the BORDER or the SHADOW, not the fill.`,
  );
});

test('the two cream surfaces are genuinely different, or the zebra is a lie', () => {
  // If someone collapses --m-paper and --m-paper-2 to the same value the rows
  // above still pass contrast, and the differentiator silently becomes a flat
  // block — a regression that looks like a passing test.
  assert.notEqual(
    token('m-paper'),
    token('m-paper-2'),
    'the alternating differentiator rows need two distinguishable cream surfaces',
  );
});

/* ─── 3 · THE SCAN IS NOT VACUOUS ────────────────────────────────────────── */

test('the palette scan really read the kit and eight pages', () => {
  const sources = allSources();
  const paths = sources.map((s) => s.path);
  assert.ok(paths.includes(KIT_REL), 'the shared doorway kit was not scanned');
  for (const route of DOORWAYS) {
    assert.ok(
      paths.some((p) => p.startsWith(`app/${route}/`)),
      `/${route}: no source files scanned — the app root or the folder name is wrong`,
    );
  }
  const bytes = sources.reduce((n, s) => n + s.src.length, 0);
  assert.ok(bytes > 40_000, `scanned only ${bytes} chars — that is not eight real pages`);
});
