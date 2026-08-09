/**
 * GUARD — the Setnayan NAME cannot disappear from the homepage again.
 *
 * WHY THIS EXISTS. Google refused OAuth brand verification on 2026-07-25 on two
 * counts. The second one — "the app name on your consent screen does not match
 * your homepage" — was still true on 2026-08-09, measured against the live HTML:
 *
 *   • The top of `/` rendered the glyph ALONE. The nav button carried
 *     aria-label="Home", the mark inside it carried aria-hidden="true", and the
 *     title-case string "Setnayan" appeared nowhere above the fold.
 *   • `<meta property="og:site_name">` was MISSING from `/` and present on every
 *     other public page. The homepage's `metadata.openGraph` override was a
 *     three-key object, and next/dist/lib/metadata/resolve-metadata.js REPLACES
 *     openGraph wholesale (`case 'openGraph': target.openGraph = …`) instead of
 *     merging it — so the root layout's siteName, type, locale and 1200×630
 *     og:image were silently deleted on the one page that matters most, while
 *     twitter:card quietly degraded to the tiny "summary" thumbnail.
 *
 * Neither failure could throw, log, or fail typecheck: a shorter object is a
 * valid object, and a missing meta tag renders as nothing at all.
 *
 * 🔑 WHY THIS TEST STRIPS COMMENTS FIRST. Both source files now carry long
 * comments explaining the bug — comments that contain the very strings this
 * guard looks for. A naive whole-file grep would match its own justification and
 * pass forever after the code was deleted. Every assertion below runs against
 * comment-stripped source, and the nav assertion is scoped to the rendered
 * <nav> element rather than the file. Mutation-tested 2026-08-09: deleting the
 * wordmark, lower-casing it, deleting siteName, and moving the name into a
 * comment all turn this file red.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const HOME_PAGE = path.join(import.meta.dirname, 'page.tsx');
const HOME_RESKIN = path.join(
  import.meta.dirname,
  '_components',
  'home',
  'HomeReskin.tsx',
);

/**
 * Remove `/* *\/` blocks and `//` line comments so no assertion can be satisfied
 * by prose. `//` inside a URL (`https://…`) is preserved by requiring the slashes
 * not to follow a colon — the source quotes several Google scope URLs.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function read(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

/** The `export const metadata = { … }` object literal, brace-matched. */
function metadataBlock(src: string): string {
  const start = src.indexOf('export const metadata');
  assert.notEqual(
    start,
    -1,
    'app/page.tsx no longer exports a `metadata` object. The homepage is the URL ' +
      'handed to Google OAuth review; it cannot ship without one.',
  );
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail('Unbalanced braces in app/page.tsx metadata object.');
}

/** The rendered `<nav className="hr-nav">…</nav>` element, brace-free of prose. */
function homeNavMarkup(src: string): string {
  const start = src.indexOf('<nav className="hr-nav">');
  assert.notEqual(
    start,
    -1,
    'The homepage nav (<nav className="hr-nav">) is gone from HomeReskin.tsx. It is ' +
      'where the visible app name lives; if the nav moved, move this guard with it.',
  );
  const end = src.indexOf('</nav>', start);
  assert.notEqual(end, -1, 'Unterminated <nav> in HomeReskin.tsx.');
  return src.slice(start, end);
}

test('the homepage nav renders the visible title-case wordmark "Setnayan"', () => {
  const nav = homeNavMarkup(read(HOME_RESKIN));

  assert.match(
    nav,
    /className="hr-wordmark"\s*>\s*Setnayan\s*</,
    'The visible <span className="hr-wordmark">Setnayan</span> is missing from the ' +
      'homepage nav. Google\'s OAuth "App Homepage" checklist requires the consent-' +
      'screen app name to be visible on the homepage; without this the page shows ' +
      'only the glyph and brand verification fails the same way it did 2026-07-25. ' +
      'It must be TEXT — an image or an aria-label does not satisfy the check.',
  );
});

test('the wordmark is exactly "Setnayan", not an all-caps or styled variant', () => {
  const nav = homeNavMarkup(read(HOME_RESKIN));
  const match = /className="hr-wordmark"\s*>\s*([^<]*?)\s*</.exec(nav);
  assert.ok(match, 'hr-wordmark span not found — see the previous test.');
  assert.equal(
    match[1],
    'Setnayan',
    'The homepage wordmark must read exactly "Setnayan" in title case, matching the ' +
      'OAuth consent-screen app name character for character. "SETNAYAN" was the ' +
      'original 2026-07-25 rejection: the caps wordmark did not read as a match.',
  );
});

test('the homepage does not drop og:site_name when it overrides openGraph', () => {
  const meta = metadataBlock(read(HOME_PAGE));

  assert.match(
    meta,
    /siteName:\s*'Setnayan'/,
    "app/page.tsx overrides `openGraph` without `siteName: 'Setnayan'`. Next REPLACES " +
      'the openGraph object rather than merging it, so the root layout\'s og:site_name ' +
      'is deleted on `/` — the exact live defect measured 2026-08-09. An openGraph ' +
      'override on this page must be COMPLETE, never a patch.',
  );
  assert.match(
    meta,
    /applicationName:\s*'Setnayan'/,
    'app/page.tsx must state `applicationName: \'Setnayan\'` itself. It renders ' +
      '<meta name="application-name">, one of the two machine-readable places the ' +
      "app's name lives, and inheriting it means a layout edit can remove it from " +
      'the reviewer-facing URL without touching this file.',
  );
});

test('the homepage openGraph/twitter override keeps the large brand card', () => {
  const meta = metadataBlock(read(HOME_PAGE));

  assert.match(
    meta,
    /card:\s*'summary_large_image'/,
    "The homepage twitter override must restate `card: 'summary_large_image'`. " +
      'Overriding `twitter` wholesale dropped it, and Next auto-filled the tiny ' +
      '"summary" thumbnail instead — measured live on 2026-08-09.',
  );
  assert.equal(
    (meta.match(/\/brand\/og-card\.webp/g) ?? []).length >= 2,
    true,
    'The 1200×630 brand card must be restated in BOTH the openGraph and twitter ' +
      'overrides on the homepage. Overriding either object drops the layout\'s image.',
  );
});
