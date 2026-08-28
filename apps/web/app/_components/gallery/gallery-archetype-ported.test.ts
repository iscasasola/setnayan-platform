import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE GALLERY ARCHETYPE IS PORTED, AND STAYS PORTED.
 *
 * Source of truth: prototypes/archetype_content_editorial_gallery_detail_2026-08-01.html
 * § 2, owner-approved 2026-08-04 with no changes requested. Its four route chips
 * name the surfaces; three of them render photographs and one is the promise
 * card that never has.
 *
 * ⚠ THE REGISTER NAMED THE WRONG FILE FOR ONE OF THEM, and that is why this list
 * is written out with what each surface IS. `your-photos-widget.tsx` has never
 * rendered a photograph; the guest's actual gallery is `photos-of-you-gallery`.
 */

const WEB = join(__dirname, '..', '..', '..');

/** The three that show photographs. Panel + credit + lightbox, all three. */
const GALLERIES = [
  {
    what: "the couple's Papic gallery",
    file: 'app/dashboard/[eventId]/studio/papic/_components/papic-gallery-grid.tsx',
  },
  {
    what: "the guest's own photographs on the invitation",
    file: 'app/[slug]/_components/photos-of-you-gallery.tsx',
  },
  {
    what: 'the wall on the day, mirrored to a guest phone',
    file: 'app/[slug]/_components/live-wall-block.tsx',
  },
] as const;

/** Shows no photographs — panel only, and that is the correct port. */
const PROMISE_CARD = 'app/[slug]/_components/your-photos-widget.tsx';

const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * Strip comments before matching — a REAL state machine, not a line-prefix
 * filter.
 *
 * 🪤 Every ported file here carries a comment naming the exact class it
 * removed (`text-ink`, `bg-cream`). A raw-source guard reads those as the defect
 * it just fixed and goes red on the paragraph explaining the fix — which is how
 * a guard learns to be ignored. And a line-prefix filter does not help: most
 * surviving lines of a block comment do not start with a marker.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code';
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (mode === 'code') {
      if (two === '//') { mode = 'line'; i += 2; continue; }
      if (two === '/*') { mode = 'block'; i += 2; continue; }
      if (src[i] === "'") mode = 'sq';
      else if (src[i] === '"') mode = 'dq';
      else if (src[i] === '`') mode = 'tpl';
      out += src[i]; i += 1; continue;
    }
    if (mode === 'line') { if (src[i] === '\n') { mode = 'code'; out += '\n'; } i += 1; continue; }
    if (mode === 'block') { if (two === '*/') { mode = 'code'; i += 2; } else i += 1; continue; }
    // inside a string literal
    if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
    if ((mode === 'sq' && src[i] === "'") || (mode === 'dq' && src[i] === '"') || (mode === 'tpl' && src[i] === '`')) {
      mode = 'code';
    }
    out += src[i]; i += 1;
  }
  return out;
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// ── RULE 1 · every one of the four sits on the obsidian surface ─────────────

test('all four gallery-archetype surfaces render on the obsidian panel', () => {
  for (const { what, file } of [...GALLERIES, { what: 'the promise card', file: PROMISE_CARD }]) {
    const code = stripComments(read(file));
    // 🪤 `\bsn-gal\b` IS NOT THIS TEST, AND THE FIRST CUT OF IT WAS DECORATION.
    // A hyphen is a non-word character, so `\b` matches inside `sn-gal-tile`
    // and `sn-gal-kick` — deleting the PANEL class left five other members of
    // the family behind and this assertion stayed green (mutation-proved, 1 → 0
    // occurrences, still passing). The panel class is the one NOT followed by a
    // hyphen. Same prefix trap as `f.event_dateX`.
    assert.ok(
      /\bsn-gal(?![-\w])/.test(code),
      `${what} (${file}) no longer renders on the obsidian panel`,
    );
  }
});

// ── RULE 2 · and none of them paints with a colour that fails on it ─────────

/**
 * 🚨 THE ONE THAT MATTERS. On a light-locked page nothing sets `html.dark`, so
 * every theme colour resolves to its LIGHT value on a dark island. Measured
 * against #17160F: ink 1.27:1 · mulberry 3.81:1 · mulberry-600 3.26:1 ·
 * mulberry-700 2.73:1. They do not look slightly wrong — they disappear.
 *
 * ⚠ `text-terracotta` measures 5.21:1 and would technically pass. It is banned
 * anyway: a surface where SOME theme tokens survive and others vanish is a
 * surface somebody has to remember the table for, and the table is what this
 * project keeps getting wrong.
 */
const BANNED_ON_OBSIDIAN = [
  'text-ink',
  'bg-cream',
  'text-cream',
  'bg-ink/',
  'text-mulberry',
  'bg-mulberry',
  'text-terracotta',
  'bg-terracotta',
  'border-ink/',
];

test('no obsidian surface paints with a theme colour that fails on it', () => {
  for (const { what, file } of [...GALLERIES, { what: 'the promise card', file: PROMISE_CARD }]) {
    const code = stripComments(read(file));
    for (const banned of BANNED_ON_OBSIDIAN) {
      assert.equal(
        count(code, banned),
        0,
        `${what} (${file}) still uses \`${banned}\`, which is unreadable on obsidian`,
      );
    }
  }
});

// ── RULE 3 · every gallery credits its tiles ────────────────────────────────

test('every gallery names who took each frame', () => {
  for (const { what, file } of GALLERIES) {
    const code = stripComments(read(file));
    assert.ok(
      count(code, '<GalleryCredit') >= 1,
      `${what} (${file}) stopped crediting its tiles — "credit is a feature", archetype § 2`,
    );
  }
});

// ── RULE 4 · every gallery opens a frame ────────────────────────────────────

test('every gallery opens a tile into the shared lightbox', () => {
  for (const { what, file } of GALLERIES) {
    const code = stripComments(read(file));
    assert.ok(
      count(code, 'GalleryLightbox') >= 1,
      `${what} (${file}) no longer opens the shared lightbox`,
    );
  }
});

test('the lightbox is SHARED — nobody grows a private copy of it', () => {
  // Three surfaces drew their own overlay once; a fourth private copy is how
  // they drift apart again.
  for (const { file } of GALLERIES) {
    const code = stripComments(read(file));
    assert.equal(
      count(code, 'useModalA11y'),
      0,
      `${file} is building its own modal instead of using <GalleryLightbox>`,
    );
  }
});

// ── RULE 5 · the tokens exist, and every one of them is measured ───────────

/**
 * 🔑 THE TOKEN LIST IS DERIVED FROM THE FILE, NEVER HAND-TYPED. A hand-written
 * list is a list of the tokens somebody thought of, so a new one added to the
 * palette would never be measured. Every `--sn-ob-*` that is not the page itself
 * has to clear AA against the page.
 */
test('every obsidian token is measured against the obsidian page, and clears AA', () => {
  const css = read('app/globals.css');
  const tokens = new Map<string, string>();
  for (const m of css.matchAll(/--sn-ob-([a-z]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    tokens.set(m[1]!, m[2]!);
  }
  assert.ok(tokens.size >= 7, `expected the obsidian palette, found ${tokens.size} tokens`);
  const page = tokens.get('page');
  assert.ok(page, '--sn-ob-page is gone; the whole surface has no ground');

  const lum = (hex: string) =>
    (([r, g, b]) => 0.2126 * r! + 0.7152 * g! + 0.0722 * b!)(
      hex
        .replace('#', '')
        .match(/../g)!
        .map((h) => parseInt(h, 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)),
    );
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  // 'card' is a SURFACE, not ink — it is measured as a background below.
  for (const [name, hex] of tokens) {
    if (name === 'page' || name === 'card') continue;
    const onPage = ratio(hex, page!);
    assert.ok(
      onPage >= 4.5,
      `--sn-ob-${name} (${hex}) measures ${onPage.toFixed(2)}:1 on the obsidian page — below the 4.5:1 AA floor`,
    );
    const card = tokens.get('card');
    if (card) {
      const onCard = ratio(hex, card);
      assert.ok(
        onCard >= 4.5,
        `--sn-ob-${name} (${hex}) measures ${onCard.toFixed(2)}:1 on the raised card — below AA`,
      );
    }
  }
});

// ── RULE 6 · the one thing this port was told not to touch ──────────────────

test('the galleries HUB is left alone — it is three links, not a gallery', () => {
  // Whether the archetype governs a page that is a hub of three source rows is
  // an OWNER decision, explicitly not an engineering one. This fails if a future
  // session quietly answers it by porting the page.
  const hub = read('app/dashboard/[eventId]/galleries/page.tsx');
  assert.equal(
    count(stripComments(hub), 'sn-gal'),
    0,
    'the galleries hub was given the gallery skin — that was an owner decision, not a port',
  );
});
