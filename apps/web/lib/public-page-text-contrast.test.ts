/**
 * public-page-text-contrast.test.ts — the public pages that DO NOT wear the
 * locked doorway palette must still be readable.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * `#9A8F86` measures 3.06:1 on cream — below the 4.5:1 AA floor for normal
 * text. design#6 (PR #4417) removed it from the eight doorways. The sweep
 * afterwards found the SAME colour still live on five other public routes,
 * where THREE guards were watching and none could see it:
 *
 *   • `app/_components/marketing/doorway-palette.test.ts` scans the eight
 *     doorways plus the kit they share, by an explicit route list. /tour and
 *     /why-setnayan are not on it, so it was green and right to be.
 *   • `lib/palette-lock.test.ts` checks the TOKEN DEFINITIONS in globals.css.
 *     A hex a component hand-types is not a token, so it cannot see it.
 *   • `scripts/lint-label-on-fill-contrast.mjs` checks call sites, but by its
 *     own documented limit judges only pairings where BOTH sides are OPAQUE.
 *     The cards here are `bg-white/50` — an alpha — so every pairing on them
 *     was skipped.
 *
 * It shipped on an `<h3>` SECTION HEADING (/why-setnayan), on an input
 * PLACEHOLDER (/tour/seating), and on captions and labels across the tour.
 * 🪤 `text-lg` IS NOT LARGE TEXT: WCAG's allowance needs ≥24px, or ≥18.66px
 * BOLD. `text-lg` is 18px at normal weight and takes the full 4.5:1 floor.
 *
 * ─── WHY THIS IS NOT A COPY OF THE DOORWAY GUARD ─────────────────────────
 * That guard bans the ACT — any raw colour literal, no baseline. It can,
 * because the doorways were ported to tokens in the same unit. THE TOUR TREE
 * HAS NOT BEEN PORTED: it carries its own pre-lock palette in ~290 hand-typed
 * hexes (`#1B1A17` ink, `#5F5E5A` body, `#8C6932` gold). Banning the act here
 * would fail on the first run and force a ~290-line baseline — "a bill, not a
 * decision". So this guard checks the OUTCOME instead: whatever colour a page
 * names for text, the arithmetic must come out readable.
 *
 * ⚠ AND IT IS DELIBERATELY NOT A BLIND CROSS-PRODUCT of every ink against
 * every surface. That was drafted and MEASURED FIRST, and it reports two
 * failures that are not real:
 *   • gold `#8C6932` on `--m-paper-2` = 4.48:1 — but gold text renders on the
 *     cream PAGE (4.86:1); the --m-paper-2 cards carry only ink and body.
 *   • body `#5F5E5A` on the `bg-[#1B1A17]/20` toggle TRACK = 4.02:1 — a
 *     switch track with no text on it at all.
 * A guard whose first act is to demand a baseline for things that are fine
 * teaches the next reader to add lines to the baseline. So the reference
 * surface is the one every one of these routes actually renders on, and
 * test 3 asserts that premise instead of assuming it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', 'app');
const CSS = readFileSync(resolve(APP, 'globals.css'), 'utf8');

/** The public routes with no palette guard of their own. */
const ROUTES = ['why-setnayan', 'tour'] as const;

const AA = 4.5;

/** Strip comments — a docblock that QUOTES a hex to explain why it is gone is
 *  not a use of it. (This file does exactly that, and so does `_doorway.tsx`.)
 *
 *  ⚠ Each comment is replaced by ITS OWN NEWLINES, not by nothing. The first
 *  draft deleted them, every line below a docblock shifted up, and the guard's
 *  first real failure pointed at `why-setnayan/page.tsx:232` — a line holding
 *  an unrelated FAQ block. A guard that reports the wrong line costs the next
 *  reader the time it was written to save. */
function code(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, '');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
}

type Source = { path: string; src: string };

/** Recursive, unlike the doorway guard's flat `readdirSync`: 9 of this defect's
 *  13 occurrences were in `_components/` subfolders a flat scan never opens. */
function sourcesUnder(route: string): Source[] {
  const walk = (dir: string, rel: string): Source[] => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((entry) => {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) return walk(abs, `${rel}/${entry}`);
      if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) return [];
      return [{ path: `${rel}/${entry}`, src: code(readFileSync(abs, 'utf8')) }];
    });
  };
  return walk(join(APP, route), `app/${route}`);
}

const SOURCES: Source[] = ROUTES.flatMap(sourcesUnder);

/* ─── COLOUR PLUMBING ────────────────────────────────────────────────────── */

/** `--m-slate-2:   #6E6A62;` → `#6E6A62`. Throws rather than guessing.
 *  Reads the FIRST definition, which is the `:root` one; the later
 *  `.sn-sidebar` fork re-points tokens to `var(...)`, not to a hex, and is
 *  scoped to dashboard chrome that these public routes never render inside. */
function token(name: string): string {
  const m = CSS.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
  assert.ok(m?.[1], `token --${name} is not defined as a hex in globals.css — renamed or deleted?`);
  return m[1]!.toUpperCase();
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
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Light vs dark ink/surface. Both families exist on these routes: the tour
 *  ribbon is light text on `#1B1A17`, everything else is dark on cream. */
const isDark = (hex: string) => relativeLuminance(hex) < 0.5;

/** `#9A8F86` stays as-is; `var(--m-slate-2)` resolves out of globals.css. */
function resolveColour(raw: string): string | null {
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  const v = raw.match(/^var\(--([a-z0-9-]+)\)$/);
  return v ? token(v[1]!) : null; // anything else (a JS expression) is not statically knowable
}

/* ─── WHAT THE PAGES NAME ────────────────────────────────────────────────── */

type Use = { path: string; line: number; raw: string; hex: string };

/** Every `text-[…]` / `placeholder:text-[…]`. The lookbehind keeps
 *  `accent-[#1B1A17]` and `decoration-[…]` out — those are not text. */
const TEXT_RE = /(?<![\w-])(?:placeholder:)?text-\[(#[0-9A-Fa-f]{6}|var\(--[a-z0-9-]+\))\]/g;

/** Opaque backgrounds only. `bg-[#A9834B]/15` is an alpha tint over an unknown
 *  parent — the same blind spot `lint-label-on-fill-contrast.mjs` documents —
 *  and is excluded rather than guessed at. */
const OPAQUE_BG_RE = /(?<![\w-])bg-\[(#[0-9A-Fa-f]{6}|var\(--[a-z0-9-]+\))\](?!\/|\[)/g;

function scan(re: RegExp): Use[] {
  const out: Use[] = [];
  for (const { path, src } of SOURCES) {
    const lines = src.split('\n');
    lines.forEach((text, i) => {
      for (const m of text.matchAll(new RegExp(re.source, 'g'))) {
        const hex = resolveColour(m[1]!);
        if (hex) out.push({ path, line: i + 1, raw: m[1]!, hex });
      }
    });
  }
  return out;
}

const TEXT_USES = scan(TEXT_RE);
const OPAQUE_BGS = scan(OPAQUE_BG_RE);

/* ─── 1 · DARK TEXT ON THE CREAM PAGE ────────────────────────────────────── */

test('every dark text colour on these public routes clears AA on the cream page', () => {
  // The page background, derived — not typed. Test 3 proves no route overrides it.
  const page = token('m-paper');
  assert.ok(!isDark(page), 'the page background resolved dark — --m-paper moved?');

  const failures = TEXT_USES.filter((u) => isDark(u.hex))
    .filter((u) => contrast(u.hex, page) < AA)
    .map((u) => `${u.path}:${u.line}  ${u.raw} on ${page} = ${contrast(u.hex, page).toFixed(2)}:1`);

  assert.deepEqual(
    [...new Set(failures)],
    [],
    `Text below the ${AA}:1 AA floor on the cream page:\n  ` +
      [...new Set(failures)].join('\n  ') +
      `\n\nEvery number is COMPUTED from globals.css, so this re-runs when a ` +
      `token moves. THERE IS NO BASELINE — these are PUBLIC pages and a line ` +
      `in one would say a public page stops being readable until further ` +
      `notice. On cream, --m-slate-2 (#6E6A62) clears at 5.21:1 and is what ` +
      `the doorways moved to. 🪤 NOT --m-slate-3 (#8A857B): it is 3.55:1 and ` +
      `fails the same way. 🪤 text-lg is NOT large text — WCAG needs ≥24px, ` +
      `or ≥18.66px BOLD.`,
  );
});

/* ─── 2 · LIGHT TEXT ON THE DARK PANELS ──────────────────────────────────── */

/**
 * ⚠ PER-ROUTE, AND THE FIRST DRAFT WAS NOT — it took the lightest dark surface
 * across BOTH trees at once and reported the /tour ribbon's `#FBF6EA` against
 * the /why-setnayan mulberry CTA at 4.42:1. Those are two different routes;
 * that pairing cannot render. Widening a worst case past the boundary the
 * markup actually has is how a guard earns its first baseline line.
 */
test('every light text colour clears AA on the lightest dark panel of ITS OWN route', () => {
  const failures: string[] = [];

  for (const route of ROUTES) {
    const here = (u: { path: string }) => u.path.startsWith(`app/${route}/`);
    const darkSurfaces = OPAQUE_BGS.filter((b) => isDark(b.hex)).filter(here);
    const lightInks = TEXT_USES.filter((u) => !isDark(u.hex)).filter(here);
    if (darkSurfaces.length === 0 || lightInks.length === 0) continue;

    // Worst case for light-on-dark is the LIGHTEST dark surface, so clearing it
    // clears the rest. Derived from what the route names, so adding a paler
    // panel re-runs the arithmetic instead of quietly widening the tolerance.
    const worst = darkSurfaces.reduce((a, b) =>
      relativeLuminance(b.hex) > relativeLuminance(a.hex) ? b : a,
    );

    for (const u of lightInks) {
      if (contrast(u.hex, worst.hex) >= AA) continue;
      failures.push(
        `${u.path}:${u.line}  ${u.raw} on ${worst.hex} (${worst.path}:${worst.line}) = ` +
          `${contrast(u.hex, worst.hex).toFixed(2)}:1`,
      );
    }
  }

  assert.deepEqual(
    [...new Set(failures)],
    [],
    `Light text below the ${AA}:1 AA floor on a dark panel of the same route:\n  ` +
      [...new Set(failures)].join('\n  '),
  );
});

/* ─── 3 · THE PREMISE BEHIND TEST 1 ──────────────────────────────────────── */

test('no route sets its own page background — cream is the real reference surface', () => {
  // Test 1 sizes every dark ink against --m-paper. That is only sound because
  // each of these routes renders on the root layout's `bg-cream` body: not one
  // <main> carries a fill of its own. If that stops being true the reference is
  // wrong and test 1 would be measuring a surface the page never shows.
  const offences: string[] = [];
  for (const { path, src } of SOURCES) {
    for (const m of src.matchAll(/<main\b[^>]*className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = m[1] ?? m[2] ?? '';
      const fill = classes.match(/(?<![\w-])bg-[\w[\]#/().-]+/);
      if (fill) offences.push(`${path}: <main …${fill[0]}…>`);
    }
  }
  assert.deepEqual(
    offences,
    [],
    `A route set its own page background:\n  ` +
      offences.join('\n  ') +
      `\n\nTest 1 above measures every dark text colour against --m-paper ` +
      `because these routes inherit \`bg-cream\` from the root layout. Give a ` +
      `<main> its own fill and that reference is a fiction. Either drop the ` +
      `fill, or teach test 1 to resolve the surface per route.`,
  );
});

/* ─── 4 · THE SCAN IS NOT VACUOUS ────────────────────────────────────────── */

test('the contrast scan really read both route trees, including _components', () => {
  // Every assertion above passes trivially on an empty file list, which a
  // renamed folder — or the doorway guard's flat, non-recursive readdir —
  // would produce silently.
  for (const route of ROUTES) {
    assert.ok(
      SOURCES.some((s) => s.path.startsWith(`app/${route}/`)),
      `/${route}: no source files scanned — the app root or the folder name is wrong`,
    );
  }
  assert.ok(
    SOURCES.some((s) => /\/_components\//.test(s.path)),
    'no _components/ file was scanned — the walk stopped being recursive, which is ' +
      'how 9 of this defect\'s 13 occurrences would go unseen',
  );
  const bytes = SOURCES.reduce((n, s) => n + s.src.length, 0);
  assert.ok(bytes > 40_000, `scanned only ${bytes} chars — that is not two real route trees`);
  assert.ok(TEXT_USES.length > 50, `found only ${TEXT_USES.length} text colours — the class regex stopped matching`);
  assert.ok(OPAQUE_BGS.length > 5, `found only ${OPAQUE_BGS.length} opaque surfaces — the bg regex stopped matching`);
});
