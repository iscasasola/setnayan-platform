/**
 * rail-active.test.ts — the rail says where you are, and says it once.
 *
 * ─── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────
 * The front-door rail shipped with `Home` hardcoded `data-on="true"`. On the
 * one URL it rendered on that was accidentally correct. The moment the same
 * rail mounts inside the app — which is what One Shell does — a literal lights
 * "Home" on every page in the product, and NOTHING THROWS. There is no error,
 * no warning and no failing request; the only symptom is a rail that is wrong
 * everywhere, which reads as "this is broken" rather than "this is a bug".
 *
 * So this file checks two different things, and both are needed:
 *   1. BEHAVIOUR — the resolver picks the right row, and exactly one.
 *   2. WIRING — no row's active state is a literal, ever again. A perfect
 *      resolver nobody calls is the shape of bug this repo keeps paying for.
 *
 * ⚠ EVERY ASSERTION BELOW WAS MUTATION-TESTED, with the occurrence count of
 * the sabotaged string printed BEFORE and AFTER. An unmeasured mutation proves
 * nothing — a `perl -pe s///` without `/g`, or a regex that matches its own
 * sabotage as a substring, both report a pass while changing nothing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { activeRailKey, railMatchRows, type RailMatchRow } from './rail-active';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL_SRC = readFileSync(join(HERE, 'front-door-shell.tsx'), 'utf8');
const CSS_SRC = readFileSync(join(HERE, 'front-door.css'), 'utf8');
const APP_SHELL_SRC = readFileSync(join(HERE, 'app-rail-shell.tsx'), 'utf8');
const LAUNCHER_LAYOUT = readFileSync(
  join(HERE, '..', '..', 'dashboard', '(launcher)', 'layout.tsx'),
  'utf8',
);
const ACCOUNT_LAYOUT = readFileSync(
  join(HERE, '..', '..', 'dashboard', '(account)', 'layout.tsx'),
  'utf8',
);

/** Strip comments so a rule described in prose can never satisfy a check. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}
const SHELL = code(SHELL_SRC);
const APP_SHELL = code(APP_SHELL_SRC);

/*
  The rail as a signed-in owner-and-admin sees it — the widest row set, so a
  URL that wrongly matches two rows has the most chances to prove it.

  🔑 THE REAL LIST, NOT A COPY OF IT. An earlier cut declared these rows here,
  and a mutation that deleted `exact: true` from the SHIPPED list passed every
  test below — they were exercising the test's own array. Testing the primitive
  is not testing the caller. This calls the shipped builder.
*/
const ROWS: RailMatchRow[] = railMatchRows({
  signedIn: true,
  hasShop: true,
  isAdmin: true,
});

/* ── 0 · THE GUARD CANNOT SILENTLY READ NOTHING ───────────────────────── */

test('every source this file inspects is real and non-trivial', () => {
  const targets: Array<[string, string]> = [
    ['front-door-shell.tsx', SHELL_SRC],
    ['front-door.css', CSS_SRC],
    ['app-rail-shell.tsx', APP_SHELL_SRC],
    ['(launcher)/layout.tsx', LAUNCHER_LAYOUT],
    ['(account)/layout.tsx', ACCOUNT_LAYOUT],
  ];
  for (const [name, src] of targets) {
    assert.ok(src.length > 500, `${name} is missing or a stub — this guard is reading nothing.`);
  }
  // And the stripper must not have eaten the file: a comment-only read would
  // make every source assertion below vacuously pass.
  assert.ok(SHELL.includes('<Link'), 'comment stripping destroyed the shell source');
});

/* ── 1 · BEHAVIOUR — the right row, and exactly one ───────────────────── */

test('each URL lights the row a person would point at', () => {
  const cases: Array<[url: string, expected: string | null]> = [
    ['/', 'home'],
    ['/realstories', 'stories'],
    ['/realstories/a-wedding-in-cavite', 'stories'],
    ['/explore', 'find'],
    ['/dashboard', 'events'],
    ['/dashboard/library', 'alaala'],
    ['/dashboard/creator', 'story'],
    ['/vendor-dashboard', 'shop'],
    ['/vendor-dashboard/services', 'shop'],
    ['/admin', 'hq'],
    ['/admin/verify', 'hq'],
  ];
  for (const [url, expected] of cases) {
    assert.equal(activeRailKey(ROWS, url), expected, `${url} lit the wrong row`);
  }
});

test('the deeper row wins — /dashboard never steals its own spokes', () => {
  /*
    🔑 THE REASON `exact` EXISTS. The shipped matcher is prefix-based by
    contract, so `/dashboard` matches every account spoke. Without the narrower
    rule, opening Alaala lights BOTH "your events" and "Alaala", and opening
    your settings lights "your events" — telling a person they are looking at
    their events while they read their own profile.
  */
  assert.equal(activeRailKey(ROWS, '/dashboard/library'), 'alaala');
  assert.equal(activeRailKey(ROWS, '/dashboard/creator'), 'story');
  assert.equal(
    activeRailKey(ROWS, '/dashboard/library/photos'),
    'alaala',
    'a sub-route of Alaala must stay on Alaala',
  );
});

test('a page the rail does not list lights NOTHING — never a fallback', () => {
  /*
    `null` is a real answer. Falling back to the first row would tell somebody
    on their profile page that they are on the front page, which is worse than
    saying nothing: a wrong "you are here" is followed, an absent one is not.
  */
  for (const url of ['/dashboard/profile', '/dashboard/notifications', '/pricing', '/login']) {
    assert.equal(activeRailKey(ROWS, url), null, `${url} should light no row`);
  }
});

test('exactly one row is ever active, for every URL the rail can meet', () => {
  const urls = [
    '/', '/realstories', '/explore', '/dashboard', '/dashboard/library',
    '/dashboard/creator', '/dashboard/profile', '/dashboard/people',
    '/vendor-dashboard/calendar', '/admin/payments', '/blog/x', '/help',
  ];
  for (const url of urls) {
    const lit = ROWS.filter((r) => activeRailKey(ROWS, url) === r.key);
    assert.ok(lit.length <= 1, `${url} lit ${lit.length} rows — a rail must name one place`);
  }
});

test('the trailing-slash rule is inherited, not re-implemented', () => {
  // `/budget` must not match `/budgets` — the bug the shipped matcher's own
  // docblock calls out. Proven here so a future "simplification" of
  // rail-active.ts that stops calling matchesPath goes red.
  const rows: RailMatchRow[] = [{ key: 'b', href: '/budget' }];
  assert.equal(activeRailKey(rows, '/budgets'), null);
  assert.equal(activeRailKey(rows, '/budget/2026'), 'b');
});

/* ── 2 · WIRING — no row's active state may be a literal ──────────────── */

test('NO rail row hardcodes its active state', () => {
  /*
    THE REGRESSION THIS CATCHES, in its real form: someone writes
    `data-on="true"` on a row (that is exactly what shipped), or replaces the
    resolver call with a constant. Both light the wrong row on every page and
    neither throws.

    Matching `data-on=` and requiring `{` is the whole check: an expression can
    be wrong, but a literal is wrong BY CONSTRUCTION.
    🪤 `data-on=` cannot collide with `data-open=` — the character after
    `data-on` there is `e`, not `=` — and that is asserted below rather than
    assumed, because a prefix collision is how two guards in this repo were
    silently blinded.
  */
  /*
    🪤 THE FIRST CUT OF THIS GUARD READ NOTHING AT ALL. It scanned for the JSX
    attribute `data-on=`, and there is no longer one anywhere: the value is
    produced once, as an object key inside `rowProps`. The guard's own
    "found none" assertion is what caught it — without that line it would have
    passed forever while checking an empty list, which is indistinguishable
    from a clean result. Both spellings are now checked, and both are counted.
  */
  // `noUncheckedIndexedAccess` types a capture group as `string | undefined`;
  // narrow rather than assert, so a regex that stops capturing shrinks this
  // list to zero and trips the "reading nothing" check below instead of
  // throwing somewhere less obvious.
  const produced = Array.from(SHELL.matchAll(/'data-on':\s*([^,\n]+)/g))
    .map((m) => m[1])
    .filter((v): v is string => v !== undefined);
  assert.ok(
    produced.length > 0,
    "no 'data-on' value is produced anywhere — this guard is reading nothing",
  );
  for (const expr of produced) {
    assert.match(
      expr,
      /activeKey/,
      `data-on is set from "${expr.trim()}" — a value the current URL cannot change ` +
        'is the exact bug One Shell closed: every page lights the same row, silently.',
    );
  }

  // And the literal must not come back as a plain JSX attribute on a row.
  assert.ok(
    !/\bdata-on=["']/.test(SHELL),
    'a rail row sets data-on to a quoted literal — this is the exact bug One Shell closed',
  );
  // The prefix-collision claim above, measured rather than trusted: a guard
  // blinded by a superstring is how `f.event_dateX` and `DISABLED_foo` got past.
  assert.equal(
    'data-open="false"'.match(/\bdata-on=/g),
    null,
    'data-on= unexpectedly matches inside data-open= — re-anchor this guard',
  );
});

test('the active row is decided by the resolver, not by a constant', () => {
  assert.ok(
    /activeRailKey\(/.test(SHELL),
    'the shell no longer calls activeRailKey — the rail cannot know where it is',
  );
  assert.ok(
    /const rowProps = \(key: string\) => \(\{[\s\S]{0,220}activeKey === key/.test(SHELL),
    "rowProps must derive data-on from the resolver's answer, not from a fixed value",
  );
  assert.ok(
    /'aria-current': activeKey === key/.test(SHELL),
    'the accessible half is missing — a rail that only LOOKS right is half right',
  );
});

test('every rail row that can be a page is declared to the resolver', () => {
  // A row rendered but never declared can never light: silent, and it looks
  // exactly like a rail that simply does not highlight that page.
  const declared = new Set(ROWS.map((r) => r.href));
  for (const href of ['/', '/realstories', '/explore', '/dashboard', '/dashboard/library',
    '/dashboard/creator', '/vendor-dashboard', '/admin']) {
    assert.ok(declared.has(href), `${href} is rendered as a row but never declared to the resolver`);
  }
});

/* ── 3 · ONE CHROME AT A TIME ─────────────────────────────────────────── */

test('the app variant renders the SAME bar — never a second one', () => {
  /*
    🔄 THIS ASSERTION WAS REVERSED ON 2026-08-14, DELIBERATELY. It used to
    require the top bar to be gated `{inApp ? null : (` — the slice-0 rule that
    the app variant renders no bar, because each signed-in surface carried its
    own and those bars were reachability contracts (sign-out lived in them).

    The owner then reported the consequence, over three screenshots: the events
    board had a wordmark and a search, Alaala had a wordmark alone, and inside
    a wedding there was neither. *"the issue is the top nav is not there?"*
    Three screens, three bars.

    🔑 THE OLD REASONING WAS RIGHT AND IS PRESERVED, NOT DISCARDED. Every one
    of those doors still exists — the surfaces now HAND them to this bar
    through `topBarSlot` instead of drawing their own. So what this guard
    protects is the same thing it always did (nobody loses a door), asserted
    from the other side: exactly ONE bar exists, and the surfaces feed it.
    `one-top-bar.test.ts` holds the full contract, including that no tree
    renders a `<header>` of its own any more.
  */
  const barIdx = SHELL.indexOf('<header className="fd-topbar">');
  assert.ok(barIdx > -1, 'the shell lost its top bar');
  const before = SHELL.slice(Math.max(0, barIdx - 400), barIdx);
  assert.ok(
    !/\{inApp \? null : \(\s*<>\s*$/.test(before),
    'the top bar is gated on the variant again — the app renders no bar, ' +
      'which is exactly the state the owner reported on 2026-08-14.',
  );
  assert.equal(
    (SHELL.match(/<header className="fd-topbar"/g) ?? []).length,
    1,
    'there must be exactly one top bar in this file. Two is a per-variant ' +
      'fork, and the two drift within a week.',
  );
});

test('the app variant does not bring the front door\'s hidden <h1> with it', () => {
  assert.ok(
    /\{\w+ \? null : \(\s*<h1 className="fd-sr-only"/.test(SHELL),
    'the sr-only <h1> is not gated on the variant — every account page would ' +
      'render two <h1>s, the defect the doorway work measured and closed.',
  );
});

test('the app variant lends its chrome and NOT its page styling', () => {
  /*
    `.fd` sets background, colour and typeface, and colour + font-family are
    INHERITED. Mounted around ~15 account pages unchanged, it would repaint all
    of them in the front door's system face — silently answering an OPEN owner
    decision about the chrome typeface. The unset must be real CSS, not a
    promise in a comment, so the comment stripper runs first.
  */
  const css = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = css.match(/\.fd\[data-chrome='app'\]\s*\{[^}]*\}/);
  assert.ok(block, "no .fd[data-chrome='app'] rule — the app variant inherits the page's styling");
  for (const decl of ['background: transparent', 'color: inherit', 'font-family: inherit']) {
    assert.ok(
      block[0].includes(decl),
      `the app variant does not unset "${decl}" — front-door styling leaks onto app pages`,
    );
  }
  // …and the rail itself must still be styled, or it is an unstyled list.
  assert.ok(
    /\.fd\[data-chrome='app'\] \.fd-rail\s*\{[^}]*background: var\(--fd-cream\)/.test(css),
    'the rail lost its own surface — it would float unstyled on the app wash',
  );
});

test('below 1024 the app variant paints nothing', () => {
  const css = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const narrow = css.match(/@media \(max-width: 1023\.98px\) \{[\s\S]*?\n\}/g) ?? [];
  const appNarrow = narrow.find((b) => b.includes("[data-chrome='app']"));
  assert.ok(appNarrow, 'no sub-1024 rule for the app variant — the rail would paint on phones');
  assert.ok(
    /\.fd\[data-chrome='app'\] \.fd-rail\s*\{[^}]*display: none/.test(appNarrow),
    'the app rail is not removed below 1024. The phone grammar is bottom-bar-only.',
  );
});

/* ── 4 · THE MOUNTS ───────────────────────────────────────────────────── */

test('both account layouts mount the shared rail', () => {
  for (const [name, src] of [
    ['(launcher)', LAUNCHER_LAYOUT],
    ['(account)', ACCOUNT_LAYOUT],
  ] as const) {
    const body = code(src);
    assert.ok(
      /import \{ AppRailShell \}/.test(body),
      `${name}/layout.tsx does not import the shared rail`,
    );
    /*
      🪤 ANCHORED ON `<AppRailShell` + A BOUNDARY, NOT ON `<AppRailShell>`.
      The literal closing bracket meant this guard passed only while the mount
      took NO PROPS — so the day the launcher started passing `topBarSlot` it
      reported a correctly-mounted rail as "imported but never rendered". A
      guard that fires on correct code teaches you to skim past the one time it
      is right, and this one would have been "fixed" by deleting it.
    */
    assert.ok(
      /<AppRailShell(?=[\s/>])/.test(body),
      `${name}/layout.tsx imports the rail but never renders it — imported is not mounted`,
    );
  }
});

test('the app shell asks for the app variant, and reads the nav registry', () => {
  /*
    🪤 THIS PINNED THE LITERAL `variant="app"`. `AppRailShell` now takes a
    `variant` prop (default 'app') so the public product doorways can mount the
    same shell as `variant="doorway"` — and the guard went red against that.
    What it always meant is that the shell is asked for a variant and the app's
    default is 'app'.
  */
  assert.ok(
    /variant=\{variant\}/.test(APP_SHELL),
    'the app mount does not pass a variant through to the shell',
  );
  assert.ok(
    /variant = 'app'/.test(APP_SHELL),
    "AppRailShell's variant no longer DEFAULTS to 'app' — every signed-in tree " +
      'would silently change chrome.',
  );
  assert.ok(
    /getNavSlotMap\(\)/.test(APP_SHELL),
    'labels bypass the nav registry — an admin rename would apply on the phone ' +
      'and not on the desktop, with no error anywhere',
  );
  assert.ok(
    /navLabels=\{navLabels\}/.test(APP_SHELL),
    'the resolved labels are fetched and then not passed — read but never used',
  );
});

test('mounting the rail did not strand the doors the surfaces already had', () => {
  /*
    🔑 THE REACHABILITY CONTRACT. `(account)/layout.tsx` carries the only
    account menu and the only sign-out on those spokes; the launcher's own rail
    carries the ⌘K command bar. The rail is added BESIDE them. This is the
    orphaned-doorway bug class the repo keeps re-learning, so it is pinned.
  */
  const body = code(ACCOUNT_LAYOUT);
  assert.ok(/<AccountSwitcher/.test(body), 'the account menu was removed from the spokes');
  assert.ok(/<UnreadBellBadge/.test(body), 'the notifications bell was removed from the spokes');
  /*
    ⚠ THE WORDMARK CHECK MOVED TO THE SHELL ON 2026-08-14 — it is no longer
    drawn by this layout. That is not the door being dropped: the shared bar
    draws one wordmark for all five signed-in trees and points it at
    `/dashboard` inside the app, which is the same destination this layout's
    own `<Wordmark />` had. Asserting it HERE after the move would demand a
    SECOND wordmark in a second bar — the very thing the owner reported.

    🔑 SO THE ASSERTION FOLLOWS THE DOOR RATHER THAN THE FILE. It is checked
    where the door now lives, and the layout is checked for the two controls it
    still owns. `one-top-bar.test.ts` additionally proves this layout renders
    no `<header>` of its own, so "the wordmark moved" cannot quietly become
    "the wordmark is drawn twice".
  */
  assert.ok(
    /<Link href=\{homeHref\} className="fd-wordmark fd-wordmark-app">/.test(SHELL) &&
      /const homeHref = variant === 'app' \? '\/dashboard' : '\/'/.test(SHELL),
    'the wordmark home link is gone from the shared bar — inside the app it ' +
      'is the only one-press home, and no spoke draws its own any more',
  );
});
