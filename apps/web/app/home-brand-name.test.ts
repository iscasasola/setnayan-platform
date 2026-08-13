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
/*
  🚨 THIS POINTED AT `_components/home/HomeReskin.tsx` UNTIL 2026-08-13, AND
  THAT IS HOW IT FAILED. The front door replaced that page on `/` and rendered
  the wordmark in ALL CAPS — the exact variant Google rejected on 2026-07-25 —
  while this guard went on reading the retired file and passing. A guard that
  outlives the page it guards does not protect anything; it only reports that
  something which no longer runs is still correct.

  Pointed at the live shell, and the assertions below are rewritten for how it
  renders: the visible text is title-case "Setnayan" and the capitals come from
  `text-transform: uppercase` in front-door.css, so the design is unchanged and
  the STRING matches the consent screen.
*/
const FRONT_DOOR_SHELL = path.join(
  import.meta.dirname,
  '_components',
  'frontdoor',
  'front-door-shell.tsx',
);
const FRONT_DOOR_CSS = path.join(
  import.meta.dirname,
  '_components',
  'frontdoor',
  'front-door.css',
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

/** The rendered `<header className="fd-topbar">…</header>`, prose stripped. */
function topBarMarkup(src: string): string {
  const start = src.indexOf('<header className="fd-topbar">');
  assert.notEqual(
    start,
    -1,
    'The front door top bar (<header className="fd-topbar">) is gone from ' +
      'front-door-shell.tsx. It is where the visible app name lives; if the bar ' +
      'moved, move this guard with it — do NOT leave it reading a file that no ' +
      'longer renders, which is exactly how this guard failed once already.',
  );
  const end = src.indexOf('</header>', start);
  assert.notEqual(end, -1, 'Unterminated <header> in front-door-shell.tsx.');
  return src.slice(start, end);
}

test('the front door renders the visible title-case wordmark "Setnayan"', () => {
  const bar = topBarMarkup(read(FRONT_DOOR_SHELL));

  assert.match(
    bar,
    /className="fd-wordmark"\s*>\s*Setnayan\s*</,
    'The visible <Link className="fd-wordmark">Setnayan</Link> is missing from the ' +
      'front door top bar. Google\'s OAuth "App Homepage" checklist requires the ' +
      'consent-screen app name to be visible on the homepage; without this the page ' +
      'shows only the glyph and brand verification fails the same way it did ' +
      '2026-07-25. It must be TEXT — an image or an aria-label does not satisfy it.',
  );
});

test('the wordmark is exactly "Setnayan", not an all-caps or styled variant', () => {
  const bar = topBarMarkup(read(FRONT_DOOR_SHELL));
  const match = /className="fd-wordmark"\s*>\s*([^<]*?)\s*</.exec(bar);
  assert.ok(match, 'fd-wordmark link not found — see the previous test.');
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

test('the capitals come from CSS, so the markup keeps the exact app name', () => {
  /*
    The approved prototype draws the wordmark in CAPITALS and that look is
    preserved — but by `text-transform`, not by typing SETNAYAN into the markup.
    Both halves matter and each fails differently:
      • drop the CSS rule → the design changes;
      • type the caps into the markup → the 2026-07-25 OAuth brand rejection
        comes back, and it comes back SILENTLY, because nothing renders wrong.
  */
  const css = readFileSync(FRONT_DOOR_CSS, 'utf8');
  const start = css.indexOf('.fd-wordmark {');
  assert.notEqual(start, -1, '.fd-wordmark rule is gone from front-door.css.');
  const block = css.slice(start, css.indexOf('}', start));
  assert.match(
    block.replace(/\/\*[\s\S]*?\*\//g, ''),
    /text-transform:\s*uppercase/,
    'The wordmark\'s capitals must come from CSS. Without this the front door ' +
      'renders title case where the approved design shows caps — and the fix ' +
      'somebody reaches for is typing SETNAYAN into the markup, which is the ' +
      'rejected variant.',
  );
});
