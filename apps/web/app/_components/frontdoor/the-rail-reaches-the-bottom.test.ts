/**
 * the-rail-reaches-the-bottom.test.ts — the app rail fills its column at every
 * page length, and lets go of that floor once it becomes a drawer.
 *
 * ─── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────
 * Owner, 2026-09-23, watching the live site: *"also times when the sidebar does
 * not fill the whole left side"* and *"times when the sidebar has a line and
 * most does not have a border"*. Both were the same defect, seen twice.
 *
 * `.fd-body` is a grid whose row is sized by its TALLEST item. On a short page
 * that is the content column, so the rail — which stretches to the row —
 * inherited the content's height, and the cream plus the `border-right`
 * hairline STOPPED partway down the screen. Measured live, `/dashboard/samahan`
 * in a 1204px window:
 *
 *   content column      549px
 *   rail                549px
 *   unpainted below     594px   ← half the left edge, painted with nothing
 *
 * It tracked page length exactly — `/dashboard` 1143 (full) · `library` 984 ·
 * `people` 896 · `samahan` 549 — which is why the border read as intermittent
 * rather than as missing. A short border does not look like a bug; it looks
 * like a design.
 *
 * 🔑 THE BUG WAS A CLAMP WITH ONLY ONE JAW. `.fd-rail` already set
 * `max-height: calc(100vh - var(--fd-bar))`, which held the rail DOWN on a long
 * page. Nothing held it UP on a short one. This file asserts the pair, because
 * either one alone is the shipped defect in one direction or the other.
 *
 * ⚠ AND IT ASSERTS THE PHONE'S FLOOR, WHICH IS A DIFFERENT NUMBER. Below 1024
 * the same rail is the hamburger drawer — `position: fixed; top: 0; bottom: 0`,
 * so it starts at the TOP of the screen rather than below the bar, and its
 * floor is the full viewport (`100dvh`). Owner, 2026-09-23: *"this also applies
 * to the hamburger menu on mobile view, since it serves the same purpose."* It
 * does, and measured live on 375x812 it already held — the open drawer is
 * 280x812 with `gapBelow: 0`. The floor is asserted anyway because it protects
 * the REASON that is true: drop either anchor and the drawer sizes to its
 * content, which is this file's defect on a phone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_SRC = readFileSync(join(HERE, 'front-door.css'), 'utf8');

/** Comments stripped, so prose about a rule can never satisfy a check for it.
 *  This file's own fix is explained at length in a CSS comment directly above
 *  the declaration it adds — without this, that comment would pass every
 *  assertion below on its own.
 *
 *  🔑 THE REPO'S ONE STRIPPER, NOT A LOCAL REGEX. `scripts/lint-one-comment-stripper.mjs`
 *  fails the build on a new home-grown one, and its baseline may only SHRINK.
 *  It BLANKS comments to spaces rather than deleting them, which is why the
 *  stripped text is the same LENGTH as the source — and which suits this file,
 *  because every helper below walks the string by index. */
const CSS = stripComments(CSS_SRC);

/** The declaration block for the Nth occurrence of a selector (0-based). */
function blockAt(selector: string, nth = 0): string | null {
  let from = 0;
  for (let i = 0; i <= nth; i++) {
    const at = CSS.indexOf(selector + ' {', from);
    if (at === -1) return null;
    from = at + 1;
    if (i === nth) {
      const open = CSS.indexOf('{', at);
      const close = CSS.indexOf('}', open);
      return close === -1 ? null : CSS.slice(open + 1, close);
    }
  }
  return null;
}

/** The body of the ONE `max-width: 1023.98px` block that names the app variant.
 *  Deliberately located the same way `rail-active.test.ts` locates it — if a
 *  second such block is ever added, both guards move together instead of
 *  disagreeing. */
function narrowAppBlock(): string {
  // ⚠ NOT THE FIRST SUCH BLOCK — the file has several sub-1024 media queries and
  // the earliest belong to the front door. Take the one that NAMES the app
  // variant, which is the one the trap note says must be unique.
  let from = 0;
  for (;;) {
    const at = CSS.indexOf('@media (max-width: 1023.98px)', from);
    assert.notEqual(at, -1, 'no sub-1024 media block names the app variant');
    const open = CSS.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < CSS.length; i++) {
      if (CSS[i] === '{') depth++;
      else if (CSS[i] === '}') {
        depth--;
        if (depth === 0) {
          const body = CSS.slice(open + 1, i);
          if (body.includes("[data-chrome='app']")) return body;
          from = i;
          break;
        }
      }
    }
  }
}

/** The first capture group of a match, asserted present. `noUncheckedIndexedAccess`
 *  types `m[1]` as `string | undefined`, and scattering `!` through a guard is
 *  exactly how a guard starts lying — an assert says the same thing and fails
 *  loudly instead. */
function group1(m: RegExpMatchArray | null, what: string): string {
  assert.ok(m, `${what}: no match`);
  const g = m[1];
  assert.ok(g !== undefined, `${what}: matched but captured nothing`);
  return g;
}

test('the anchor: the stylesheet is real and the stripper did not eat it', () => {
  assert.ok(CSS_SRC.length > 20000, 'front-door.css is missing or truncated');
  assert.ok(CSS.includes('.fd-rail'), 'comment stripping destroyed the source');
  assert.ok(
    CSS.includes(".fd[data-chrome='app']"),
    'the app-variant scope is gone from the stripped source',
  );
});

test('the rail is clamped in BOTH directions, by the same expression', () => {
  const base = blockAt('.fd-rail');
  assert.ok(base, '.fd-rail base rule is gone');
  assert.match(
    base,
    /max-height:\s*calc\(100vh\s*-\s*var\(--fd-bar\)\)/,
    'The base `.fd-rail` lost its `max-height`. On a long page the rail would ' +
      'grow to the full document height and stop being a sticky rail at all.',
  );

  const app = blockAt(".fd[data-chrome='app'] .fd-rail");
  assert.ok(app, "the desktop `.fd[data-chrome='app'] .fd-rail` rule is gone");
  assert.match(
    app,
    /min-height:\s*calc\(100vh\s*-\s*var\(--fd-bar\)\)/,
    'THE RAIL LOST ITS FLOOR. `.fd-body` sizes its row from the tallest item, ' +
      'so without this the rail collapses to the CONTENT height on any short ' +
      'page and the cream + hairline stop partway down the screen — measured ' +
      '594px of unpainted left column on /dashboard/samahan, 2026-09-23.',
  );
});

test('the floor reads the token, never a px literal', () => {
  /*
    The same trap `front-door-geometry.test.ts` closed for the sticky offsets:
    `--fd-bar` is 56px on the front door and 61px in app chrome, MEASURED from
    the account cluster rather than derived. A hand-typed `calc(100vh - 61px)`
    here would be correct today and silently wrong the next time that cluster's
    height moves — and a rail one bar-height off reads as a tight layout, not
    as a bug.
  */
  const app = blockAt(".fd[data-chrome='app'] .fd-rail");
  assert.ok(app);
  const floor = group1(app.match(/min-height:\s*([^;]+);/), 'the app rail floor');
  assert.doesNotMatch(
    floor,
    /\d+px/,
    `The rail's floor hard-codes a pixel value (\`${floor.trim()}\`). ` +
      'It must read `var(--fd-bar)`, which is the only place the bar height ' +
      'is measured.',
  );
});

test('the drawer fills the whole screen, by the viewport and not by luck', () => {
  /*
    Owner, 2026-09-23: *"this also applies to the hamburger menu on mobile view,
    since it serves the same purpose."* It does, and it already did — measured
    live on 375x812, the open drawer is 280x812 with `gapBelow: 0`, because
    `top: 0; bottom: 0` sizes it. So this assertion is not protecting today's
    pixels; it is protecting the REASON they are right.

    🔑 THE THREE CANDIDATE VALUES HERE ARE NOT INTERCHANGEABLE, and only one is
    true of a drawer:
      · `calc(100vh - var(--fd-bar))` — the desktop column's floor, which
        starts BELOW the bar. On a drawer pinned to the top of the screen it
        stops one bar-height short of the bottom.
      · `0` — what this file shipped with for one commit. "No floor here" is the
        desktop defect's premise, not its fix: drop `bottom: 0` and the drawer
        sizes to its content, and a phone's left edge stops halfway down.
      · `100dvh` — the full viewport, which is what `top: 0; bottom: 0` already
        means. `dvh` and not `vh`, because on a phone `100vh` is the viewport at
        its TALLEST and a `vh` floor pushes the drawer under the browser chrome.
  */
  const narrow = narrowAppBlock();
  const railRule = narrow.match(
    /\.fd\[data-chrome='app'\]\s+\.fd-rail\s*\{([^}]*)\}/,
  );
  assert.ok(
    railRule,
    "the sub-1024 block no longer has a `.fd[data-chrome='app'] .fd-rail` rule",
  );
  const rule = group1(railRule, 'the sub-1024 drawer rule');
  const raw = rule.match(/min-height:\s*([^;]+);/);
  assert.ok(
    raw,
    'The drawer has no floor at all. If `bottom: 0` is ever dropped it will ' +
      'size to its content and stop halfway down the screen — the desktop ' +
      'defect, on a phone.',
  );
  const floor = group1(raw, 'the drawer floor');
  assert.match(
    floor,
    /100dvh/,
    `The drawer's floor is \`${floor.trim()}\`. It must be the FULL ` +
      'viewport: `calc(100vh - var(--fd-bar))` stops a bar-height short ' +
      '(the drawer starts at the top of the screen, not below the bar), and ' +
      '`0` is no floor at all.',
  );
  assert.doesNotMatch(
    floor,
    /(?<!d)vh/,
    `The drawer's floor uses \`vh\` (\`${floor.trim()}\`). On a phone ` +
      '`100vh` is the viewport at its tallest, so the drawer would run under ' +
      'the browser chrome. Use `dvh`.',
  );
});

test('the desktop column and the phone drawer do NOT share one expression', () => {
  /*
    The two floors look like duplication and are not. A later reader tidying
    them into one value breaks whichever surface did not win — which is why
    each one's own assertion above names all three candidates and rejects two.
  */
  const app = blockAt(".fd[data-chrome='app'] .fd-rail");
  const narrow = narrowAppBlock().match(
    /\.fd\[data-chrome='app'\]\s+\.fd-rail\s*\{([^}]*)\}/,
  );
  assert.ok(app, "the desktop `.fd[data-chrome='app'] .fd-rail` rule is gone");
  const desktop = group1(app.match(/min-height:\s*([^;]+);/), 'desktop floor').trim();
  const phone = group1(
    group1(narrow, 'the sub-1024 drawer rule').match(/min-height:\s*([^;]+);/),
    'phone floor',
  ).trim();
  assert.notEqual(
    desktop,
    phone,
    `Both surfaces now floor at \`${desktop}\`. The desktop rail starts BELOW ` +
      'the bar and the phone drawer starts at the TOP of the screen, so one ' +
      'value cannot be right for both.',
  );
});

test('the release lives in the ONE sub-1024 block, not a second one', () => {
  /*
    🪤 Copied deliberately from the trap note at the foot of that media query.
    A second `@media (max-width: 1023.98px)` block naming the app variant was
    added on 2026-08-14 and immediately broke a shipped guard: `rail-active`
    finds the FIRST narrow block naming the variant and asserts against it. The
    rule was still there, in the other block — correct code, red guard, and the
    next reader "fixes" the guard.
  */
  const blocks = CSS.split('@media (max-width: 1023.98px)').slice(1);
  const naming = blocks.filter((b) => {
    const open = b.indexOf('{');
    let depth = 0;
    for (let i = open; i < b.length; i++) {
      if (b[i] === '{') depth++;
      else if (b[i] === '}') {
        depth--;
        if (depth === 0) return b.slice(0, i).includes("[data-chrome='app']");
      }
    }
    return b.includes("[data-chrome='app']");
  });
  assert.equal(
    naming.length,
    1,
    `${naming.length} sub-1024 media blocks name the app variant. There must ` +
      'be exactly one — `rail-active.test.ts` reads the first it finds.',
  );
});
