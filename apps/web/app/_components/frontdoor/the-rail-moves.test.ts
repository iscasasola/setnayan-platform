import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE SIDEBAR MOVES WHEN IT CHANGES SHAPE.
 *
 * Owner, 2026-08-21: *"on the sidebar. when something add/ expands/collapses,
 * we want it to animate properly."*
 *
 * Measured before the change: `front-door.css` carried exactly ONE transition
 * in 1970 lines — the top bar's hide-on-scroll — so the rail's own changes were
 * all jump cuts. Nine categories under "Show more" appeared between two frames;
 * a wedding's sections replaced the Studio group the instant you opened it; the
 * phone drawer and its scrim blinked in and out separately.
 *
 * 🔑 THE ROUTE-CHANGE ANIMATION WILL NEVER COVER THIS. globals.css freezes the
 * chrome on purpose — `::view-transition-old(root)/-new(root){animation:none}`
 * — so the page slides and the rail holds still. That is the right call and it
 * is untouched; it is also why the rail's own changes have to carry their own
 * motion. Nothing else will ever give them any.
 *
 * ─── WHAT THIS GUARD IS ACTUALLY FOR ─────────────────────────────────────
 * Not "is there an animation" — a stylesheet full of transitions can still be
 * broken. It pins the four things that make this animation CORRECT rather than
 * merely present, each of which has a specific way of silently reverting:
 *
 *   1 · the reveal panel leaves the TAB ORDER when it is shut. A clipped row is
 *       still focusable; without `visibility` a keyboard visitor Tabs through
 *       nine invisible category links behind a button that says "Show more" —
 *       the same defect `display:none` exists to prevent on the drawer.
 *   2 · the reveal can actually CLOSE. A grid item's automatic minimum size is
 *       its content, so dropping `min-height: 0` leaves the 0fr track stuck at
 *       full height and the panel never shuts. It still looks animated.
 *   3 · the drawer's two halves agree on ONE number. The stylesheet animates
 *       and a `setTimeout` removes the element; two hand-typed durations drift
 *       into a drawer that vanishes mid-slide or hangs half-open.
 *   4 · `display: none` when the drawer is shut SURVIVES the animation work.
 *       That is the tab-order rule this file has already paid for once.
 *
 * 🪤 COMMENTS ARE STRIPPED BEFORE MATCHING. The prose above and in the source
 * names every retired shape; a raw-source guard would keep reporting the thing
 * it just fixed. Measured on the stripped source, and 0 is the true number.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments stripped, so the guard judges what RUNS, never what explains. */
function code(name: string): string {
  const src = readFileSync(join(HERE, name), 'utf8');
  assert.ok(src.length > 1000, `${name} is missing or a stub.`);
  return src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
}

const CSS = code('front-door.css');
const SHELL = code('front-door-shell.tsx');

/** The declarations of one CSS rule, by selector. */
function rule(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `no \`${selector}\` rule — the rail lost its motion.`);
  return CSS.slice(at, CSS.indexOf('}', at));
}

/* ─── 1 · "SHOW MORE" EXPANDS AND COLLAPSES, AND SHUTS THE TAB ORDER ────── */

test('the reveal panel leaves the tab order when it is shut', () => {
  const shut = rule('.fd-reveal');
  assert.match(
    shut,
    /visibility:\s*hidden/,
    'The collapsed reveal panel does not go `visibility: hidden`. Clipping a ' +
      'row does not unfocus it — Tab would walk a keyboard visitor through ' +
      'nine invisible category links sitting behind the "Show more" button.',
  );
  assert.match(
    shut,
    /visibility 0s var\(--sn-dur-elem\)/,
    'The visibility flip is not delayed to the END of the collapse, so it ' +
      'clips the animation it is riding on and the panel vanishes instead of ' +
      'closing.',
  );
  assert.match(
    rule(".fd-reveal[data-open='true']"),
    /visibility:\s*visible/,
    'The open reveal panel never becomes visible — the rows would animate ' +
      'open and stay unreachable.',
  );
});

test('the reveal panel can actually close', () => {
  assert.match(
    rule('.fd-reveal-in'),
    /min-height:\s*0/,
    "`.fd-reveal-in` lost `min-height: 0`. A grid item's automatic minimum " +
      'size is its content, so the 0fr track never reaches zero and the panel ' +
      'never shuts — while still looking animated.',
  );
  for (const sel of ['.fd-reveal', ".fd-reveal[data-open='true']"]) {
    assert.match(
      rule(sel),
      /transition:[^;]*grid-template-rows/,
      `${sel} does not transition \`grid-template-rows\`, so one direction of ` +
        'the toggle is a jump cut.',
    );
  }
});

test('the extra categories are rendered always, not concatenated in', () => {
  assert.doesNotMatch(
    SHELL,
    /const folders = moreOpen/,
    'The rail is back to rebuilding one list around the toggle. Rows created ' +
      'by the press are brand-new elements with nothing to tween — there is ' +
      'no animation to have.',
  );
  const panel = SHELL.slice(SHELL.indexOf('className="fd-reveal"'));
  assert.ok(
    panel.indexOf('moreFolders.map') !== -1 &&
      panel.indexOf('moreFolders.map') < panel.indexOf('</div>'),
    'The extra categories are not inside the `.fd-reveal` panel.',
  );
  assert.match(
    SHELL,
    /aria-expanded=\{moreOpen\}[\s\S]{0,120}aria-controls=/,
    'The "Show more" button announces nothing. It rebuilt the list around ' +
      'itself before; a panel needs `aria-expanded` + `aria-controls` or the ' +
      'press is silent to a screen reader.',
  );
});

/* ─── 2 · THE PHONE DRAWER SLIDES BOTH WAYS ─────────────────────────────── */

test('shut still means out of the tab order, animation or not', () => {
  assert.match(
    CSS,
    /\.fd-rail\[data-open='false'\] \{\s*display: none;/,
    'The drawer lost `display: none` when shut. That is the rule that takes ' +
      'a dozen focusable links out of the tab order — an animation must never ' +
      'be paid for with it.',
  );
});

test('the drawer has a closing state, in both halves', () => {
  assert.match(
    CSS,
    /\.fd-rail\[data-open='closing'\]/,
    'No closing state in CSS — `display: none` cannot be transitioned, so ' +
      'without it the drawer opens with motion and shuts with none.',
  );
  assert.match(
    SHELL,
    /data-open=\{railClosing \? 'closing'/,
    'The shell never emits `closing`, so the CSS rule above can never fire.',
  );
  assert.match(
    CSS,
    /\.fd-scrim\[data-closing='true'\]/,
    'The scrim does not fade out with the drawer — a dimmed page that blinks ' +
      'away under a sliding panel reads as two separate events.',
  );
});

test('the drawer animates and unmounts on ONE number', () => {
  assert.match(
    CSS,
    /var\(--fd-drawer-ms, var\(--sn-dur-control\)\)/,
    'The stylesheet types its own drawer duration instead of reading the one ' +
      'the component owns. The CSS and the `setTimeout` then drift: slower ' +
      'CSS cuts the slide off, faster CSS hangs the drawer half-open.',
  );
  assert.match(
    SHELL,
    /'--fd-drawer-ms': `\$\{RAIL_DRAWER_MS\}ms`/,
    'The shell stopped handing its timer value to the stylesheet.',
  );
  assert.match(
    SHELL,
    /}, RAIL_DRAWER_MS\);/,
    'The closing timer no longer reads the shared constant.',
  );
});

/* ─── 3 · A GROUP THAT ARRIVES ──────────────────────────────────────────── */

test('the group that pushes in arrives with motion', () => {
  assert.match(
    rule('.fd-rgroup'),
    /animation: fd-group-in/,
    'The arriving group has no entry animation. Opening a wedding swaps the ' +
      'Studio group for its sections between two frames.',
  );
  assert.match(
    SHELL,
    /<div className="fd-rgroup">\{railContext\}<\/div>/,
    'The context group is no longer wrapped, so there is no single element ' +
      'for its arrival to animate — it is a fragment of siblings.',
  );
  assert.equal(
    (SHELL.match(/className="fd-rgroup"/g) ?? []).length,
    3,
    'Expected exactly three animated rail groups — the context group and the ' +
      'two it displaces (Browse by category · Studio). A group that arrives ' +
      'without one is the only one that still snaps.',
  );
});

/* ─── 4 · THE NUMBERS ARE THE DESIGN SYSTEM'S ───────────────────────────── */

test('no duration or curve is hand-typed into the rail motion', () => {
  const from = CSS.indexOf('.fd-rgroup {');
  const to = CSS.indexOf('@keyframes fd-scrim-out');
  assert.ok(from !== -1 && to > from, 'the rail-motion section is gone');
  const section = CSS.slice(from, to);
  assert.deepEqual(
    /* `0s` is not a duration CHOICE — it is "at once", the structural half of
       the delayed `visibility` flip. Every real duration is a decision about
       how fast this product moves, and that decision is the token's. */
    (section.match(/\b\d+(\.\d+)?m?s\b/g) ?? []).filter((d) => d !== '0s'),
    [],
    'A duration is typed into the rail-motion block. Durations come from ' +
      '`--sn-dur-*` and curves from `--sn-ease*` (globals.css § motion) — a ' +
      'typed number is a second answer to how fast this product moves.',
  );
  assert.doesNotMatch(
    section,
    /cubic-bezier\(/,
    'A curve is typed into the rail-motion block instead of reading ' +
      '`--sn-ease` / `--sn-ease-out`.',
  );
});
