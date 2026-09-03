import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * THE PRODUCT DOORWAYS WEAR THE SHARED SHELL.
 *
 * Owner, 2026-08-15: *"still jumps out of the shell when the links on studio
 * are pressed."* Pressing a Studio row used to swap the whole furniture — the
 * app's rail for the marketing glass nav. The seven product pages now mount the
 * same shell as `/`.
 *
 * ─── THE ONE THAT MATTERS MOST ───────────────────────────────────────────
 * 🔴 `force-static` + the shared shell = A PERMANENTLY SIGNED-OUT RAIL,
 * CACHED, WITH NOTHING THROWN. Verified in the installed Next 15.5.21:
 * `next/dist/server/request/cookies.js` returns an EMPTY COOKIE JAR when
 * `workStore.forceStatic` is set, and that branch sits BEFORE the
 * `dynamicShouldError` throw and BEFORE every bailout. `headers.js` carries the
 * byte-identical hole. So the page builds green, stays edge-cached, and shows a
 * signed-in person a signed-out shell for an hour at a time. The only symptom is
 * an absence — the disease this repo keeps paying for.
 *
 * 🛑 THIS FILE ASSERTED "A LAYOUT CANNOT FIX IT FOR US: `dynamic` resolves
 * nested-most-wins and the children traversal completes before a parent
 * layout's component is created." THAT IS FALSE, and it was never tested — it
 * went into eleven files on one day. MEASURED in a scratch Next 15.5.21 build
 * from this repo's own node_modules: with the pages declaring nothing and
 * `force-dynamic` on a route-group layout alone, both child routes moved from
 * `○ (Static)` to `ƒ (Dynamic)` in the build table. The claim confuses the
 * layout's ELEMENT (created after the children traversal) with its CONFIG —
 * `create-component-tree.js` reads `layoutOrPageMod.dynamic` at :134 and sets
 * `workStore.forceDynamic` at :154, ~160 lines BEFORE traversing children at
 * :298. `app/(shell)/layout.tsx` now declares it once for all twenty routes.
 *
 * ─── AND THE TRAP THIS DELIBERATELY NEVER ENGAGES ────────────────────────
 * No `layout.tsx` is created under any doorway. A directory layout wraps EVERY
 * descendant, and beneath these seven live the paparazzo's camera, the guest
 * gallery whose URL is a bearer credential, the owner-locked live control room
 * ("nothing under and above it") and the program pop-out the host's OBS
 * WINDOW-CAPTURES AND BROADCASTS. Chrome on that last one goes out on the
 * wedding's live stream. The mount is a component imported by exactly seven
 * page files, so all sixteen descendants are out of reach BY CONSTRUCTION.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
/*
  🔑 THE SHELLED PUBLIC ROUTES LIVE IN A ROUTE GROUP. `app/(shell)/` mounts the
  shared shell once, in a layout, so it survives navigation. A route group is
  INVISIBLE in the URL and PRESENT in the filesystem path — `/explore` still
  serves from `app/(shell)/explore/page.tsx` — and that asymmetry is exactly
  what broke seventeen guards on 2026-08-15. Resolve route directories through
  this constant, never by joining APP directly.
*/
const SHELLED = join(APP, '(shell)');


/**
 * The rail's Studio rows — every one of them.
 *
 * ⚠ THIS COMMENT SAID "`/alaala` is NOT one — it keeps force-static", which
 * stopped being true on 2026-08-15. /alaala, /explore and /help now satisfy the
 * SAME shell contract without being Studio rows, so they live in
 * `SHELLED_PUBLIC` below rather than being folded in here. Widening this list
 * beyond the Studio rows would make it a lie about what a Studio row is.
 *
 * 🔴 IT WENT STALE, SILENTLY, AND THAT IS WHY IT IS NO LONGER DESCRIBED BY A
 * NUMBER. `/pakanta` joined the Studio group on 2026-08-21 and was never added
 * here, so for two weeks the one guard that checks a doorway is out of
 * NAV_ROUTES and free of a stray `force-static` simply did not look at it. The
 * list said "seven" while the group held eight, and nothing failed — a list that
 * stops matching reality is this repo's most-paid-for shape. Both missing
 * entries are added together: `pakanta` (2026-08-21) and `mood-board`
 * (2026-09-03, the first FREE doorway).
 *
 * 🔑 KEEP IT EQUAL TO `STUDIO_APPS` in `lib/studio-apps.ts`. It is written out
 * rather than imported so this file stays a filesystem guard with no app
 * imports — but adding a Studio row means adding it here in the same commit.
 */
const DOORWAYS = [
  'setnayan-ai',
  'pawebsite',
  'papic',
  'panood',
  'patiktok',
  'pa3d',
  'mood-board',
  'pakanta',
  'palogo',
] as const;

/**
 * Public pages that wear the shared shell WITHOUT being Studio doorways
 * (2026-08-15). Same three-part contract — force-dynamic, a loading boundary,
 * and out of NAV_ROUTES — enforced separately so each set keeps its own name
 * and its own count.
 *
 * 🔑 THE CONTRACT IS THREE THINGS AND ALL THREE ARE LOAD-BEARING. Without
 * force-dynamic the shell's session read gets a silently EMPTY cookie jar and
 * the page caches signed-out forever. Without the loading boundary the route
 * prefetches an empty tree and the rail press becomes a blank wait. Still in
 * NAV_ROUTES, the old fixed glass nav renders ON TOP of the shell's bar.
 * Any one missing looks fine in a browser on a fast connection while signed in.
 */
const SHELLED_PUBLIC = ['explore', 'help', 'alaala'] as const;

/**
 * NAV_ROUTES as the file actually declares it.
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST, and that is not cosmetic: one apostrophe in
 * prose ("Google's OAuth reviewer") inside the literal made the naive
 * `/'([^']+)'/g` sweep miss eight real routes AND invent a comment fragment as
 * a route. Measured: 26 "routes" from raw source vs 25 from stripped, differing
 * by eight in one direction and six in the other.
 *
 * 🔑 EXTRACTED 2026-08-15 so the two tests that need it share ONE parser. It
 * was inlined in a single test; the second caller would have been a copy, and
 * a copied parser is two things that must be fixed together forever.
 */
function navRoutes(): string[] {
  const src = code(read(join(HERE, 'site-chrome.tsx')));
  const block = /const NAV_ROUTES = new Set<string>\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(block, 'NAV_ROUTES not found — this guard would pass vacuously.');
  return [...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

/** Source with comments stripped — a directive named in prose is not a
 *  directive, and this file's own notes quote both of them. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

test('the anchor: every doorway page exists', () => {
  for (const d of DOORWAYS) {
    const p = join(SHELLED, d, 'page.tsx');
    assert.ok(existsSync(p) && read(p).length > 500, `${p} is missing or a stub`);
  }
});

/* ── 1 · NOT ONE OF THEM MAY BE force-static ───────────────────────────── */

test('the group layout carries force-dynamic, and no page re-declares it', () => {
  /*
    🔄 THIS TEST INVERTED ON 2026-08-15, and the inversion is the point.

    It used to require force-dynamic on EVERY doorway page, because this file
    asserted "a layout cannot fix it for us". That was FALSE and never tested.
    Measured in a scratch Next 15.5.21 build from this repo's node_modules:
    with the pages declaring nothing and `force-dynamic` on a route-group layout
    alone, both child routes moved from `○ (Static)` to `ƒ (Dynamic)`.

    So the rule is now the opposite: the directive lives in ONE place, and a
    page re-declaring it is the defect — twenty copies of a rule is twenty
    places for it to disagree with itself, which is how /privacy ended up the
    single shelled page carrying `revalidate = 3600` under a session-reading
    shell.

    🔴 WHAT IT PROTECTS IS UNCHANGED: the shell reads the session, and
    `next/dist/server/request/cookies.js` returns an EMPTY COOKIE JAR when
    `workStore.forceStatic` is set — before the `dynamicShouldError` throw and
    before every bailout. Miss this and the page builds green, stays cached, and
    shows every visitor a signed-out rail. The only symptom is an absence.
  */
  const layout = code(read(join(SHELLED, 'layout.tsx')));
  assert.match(
    layout,
    /^export const dynamic = 'force-dynamic';/m,
    'app/(shell)/layout.tsx lost force-dynamic. Every route in the group ' +
      'mounts a session-reading shell; without it they cache signed-out.',
  );
  assert.doesNotMatch(
    layout,
    /^export const revalidate/m,
    'app/(shell)/layout.tsx declares revalidate alongside force-dynamic.',
  );

  for (const d of DOORWAYS) {
    const src = code(read(join(SHELLED, d, 'page.tsx')));
    assert.doesNotMatch(
      src,
      /^export const dynamic = 'force-static';/m,
      `/${d} declares force-static. It is inside app/(shell)/, whose layout ` +
        'mounts a session-reading shell.',
    );
    assert.doesNotMatch(
      src,
      /^export const revalidate/m,
      `/${d} declares revalidate. The group layout is force-dynamic; a page ` +
        'that re-declares caching here is the /privacy defect returning.',
    );
  }
});

test('the shelled public pages keep all three halves of the contract', () => {
  /*
    /explore, /help and /alaala are not Studio doorways but sit in the same
    group and owe the same things. The three halves CHANGED SHAPE on 2026-08-15
    when the shell moved into `app/(shell)/layout.tsx`:
      was:  each page declares force-dynamic · has a loading.tsx · mounts the shell
      now:  the LAYOUT declares force-dynamic and mounts the shell (asserted
            above); each page still needs its own loading boundary, and none may
            re-declare caching or mount a second shell.
    A half-conversion is the failure mode that looks completely fine in a
    browser on a fast connection while signed in.
  */
  for (const r of SHELLED_PUBLIC) {
    const src = code(read(join(SHELLED, r, 'page.tsx')));
    assert.doesNotMatch(
      src,
      /^export const (dynamic|revalidate)/m,
      `/${r} re-declares a route directive. The group layout owns it.`,
    );
    assert.ok(
      !src.includes('<AppRailShell'),
      `/${r} mounts its own AppRailShell. The layout already does — a second ` +
        'mount is two bars, two rails, and the shell stops surviving navigation.',
    );
    assert.ok(
      existsSync(join(SHELLED, r, 'loading.tsx')),
      `/${r} has no loading.tsx. A dynamic route without one prefetches an ` +
        'EMPTY tree (162 bytes, measured), so the rail press that points here ' +
        'becomes a wait on a blank frame.',
    );
  }

  const listed = navRoutes();
  for (const r of SHELLED_PUBLIC) {
    assert.ok(
      !listed.includes(`/${r}`),
      `/${r} is still a NAV_ROUTE, so the marketing glass nav renders ON TOP ` +
        'of the shared bar: fixed/z-60 over sticky, two Home links, two Sign-ins.',
    );
  }
});

test('/alaala wears the shell but is still NOT on the doorway kit', () => {
  /*
    🔄 THIS TRIPWIRE FIRED AND WAS RE-AIMED, NOT DELETED (2026-08-15).

    It used to pin /alaala to `force-static`, to stop a pattern-matching sweep
    converting it and paying the cache for a page that mounted no shell. On
    2026-08-15 the page was converted DELIBERATELY — it now wears the shared
    shell by wrapper — so that assertion had done its job and become false.

    🔑 THE HALF THAT STILL NEEDS GUARDING IS THE OTHER ONE. Wearing the shared
    CHROME and being ported onto `DoorwayPage` are two different questions, and
    the page's own docblock explains at length why the second is refused:
    `DoorwayProps.closing` takes ONE href (so porting deletes the live "Read the
    whole story" CTA) and `DoorwayStep` has no href at all (so it strips the
    links off all five pillar cards). That is redrawing, which the port rules
    forbid. A future sweep that sees `<AppRailShell>` here could easily conclude
    the page is "already halfway" and finish the job.
  */
  const src = code(read(join(SHELLED, 'alaala', 'page.tsx')));
  assert.ok(
    !src.includes('<DoorwayPage'),
    '/alaala was ported onto DoorwayPage. That deletes the "Read the whole ' +
      'story" CTA (closing takes one href) and strips the hrefs off all five ' +
      'pillar cards (DoorwayStep has none). Wrap it, do not port it.',
  );
  /*
    🔄 HOW IT WEARS THE SHELL CHANGED ON 2026-08-15. It used to mount
    `<AppRailShell>` itself; now it sits inside `app/(shell)/`, whose layout
    mounts it once so the chrome survives navigation. So the assertion is that
    the page IS in the group — mounting its own would be the regression, not
    the requirement.
  */
  assert.ok(
    existsSync(join(SHELLED, 'alaala', 'page.tsx')),
    '/alaala left app/(shell)/, so nothing mounts its chrome — it has also ' +
      'left NAV_ROUTES, so it would render bare.',
  );
  assert.ok(
    !src.includes('<AppRailShell'),
    '/alaala mounts its own AppRailShell on top of the group layout: two bars, ' +
      'two rails, and the shell stops surviving navigation.',
  );
});

/* ── 2 · THE MOUNT, AND WHERE IT IS NOT ────────────────────────────────── */

test('the shell is mounted exactly once for the whole public group', () => {
  /*
    🔄 REPOINTED 2026-08-15. This used to assert that `_doorway.tsx` mounted
    `<AppRailShell variant="doorway">` exactly once. It no longer mounts it at
    all: the shell moved to `app/(shell)/layout.tsx` so it SURVIVES navigation.
    Mounted in a component it sat inside the subtree Next swaps — measured on
    the live site, the document survived a click but `.fd-topbar` and `.fd-rail`
    did not.

    🔑 WHAT STILL NEEDS GUARDING IS "EXACTLY ONCE". Two mounts is two bars and
    two rails, and it silently undoes the persistence: the inner one is inside
    the swapped subtree again.
  */
  const layout = code(read(join(SHELLED, 'layout.tsx')));
  const mounts = [...layout.matchAll(/<AppRailShell\b/g)].length;
  assert.equal(
    mounts,
    1,
    `app/(shell)/layout.tsx mounts AppRailShell ${mounts} times; it must be 1.`,
  );
  assert.match(
    layout,
    /variant="doorway"/,
    'The group layout must mount the DOORWAY variant. The app variant points ' +
      'the wordmark at /dashboard, which 307s a signed-out visitor to /login — ' +
      'a login trap for a stranger arriving from Google.',
  );

  const doorway = code(read(join(HERE, '_doorway.tsx')));
  assert.ok(
    !doorway.includes('<AppRailShell'),
    '_doorway.tsx mounts the shell again beneath the group layout. That is a ' +
      'second bar and a second rail, and it puts the shell back inside the ' +
      'subtree that gets swapped on navigation.',
  );

  const legal = code(read(join(APP, '_components', 'legal', 'legal-chrome.tsx')));
  assert.ok(
    !legal.includes('<AppRailShell'),
    'legal-chrome.tsx mounts the shell again beneath the group layout.',
  );
});

test('no layout.tsx exists under any doorway — the descendants are unreachable', () => {
  /*
    THIS IS THE WHOLE OF TRAP 2. `/papic/seat/[token]` is the paparazzo's
    camera ("LOGIN-FREE … no dashboard chrome"); `/panood/control/[eventId]` is
    the owner-locked controller; `/panood/program/[eventId]` is the pop-out the
    host's OBS captures and BROADCASTS.
  */
  for (const d of DOORWAYS) {
    assert.ok(
      !existsSync(join(SHELLED, d, 'layout.tsx')),
      `app/${d}/layout.tsx exists. A directory layout wraps EVERY descendant — ` +
        'including surfaces built to have no chrome at all, one of which goes ' +
        "out on a wedding's live stream.",
    );
  }
});

/* ── 3 · ONE CHROME, NOT TWO ───────────────────────────────────────────── */

test('no doorway is still a NAV_ROUTE', () => {
  /*
    🪤 STRIP COMMENTS FIRST — ONE APOSTROPHE BLINDED THIS TO EIGHT ROUTES.
    `site-chrome.tsx` contains the words "Google's OAuth reviewer" inside a
    comment in this very block. Run over RAW source, `/'([^']+)'/g` treats that
    apostrophe as an opening quote and swallows everything to the next one — so
    the parser returned an entire comment paragraph AS A ROUTE and never saw
    `/privacy/google-access`, `/terms`, `/refunds`, `/cookies`,
    `/acceptable-use`, `/help`, `/download` or `/waitlist`. Six of those are
    conversion targets, and the guard would have reported them absent from
    NAV_ROUTES while they sat right there.

    Measured: 26 "routes" from raw source, 25 from stripped — and the two sets
    differ by eight in one direction and six in the other. The file already
    ships a comment stripper (`code`) that every other assertion here uses;
    this one simply did not call it.
  */
  const listed = navRoutes();
  /*
    🪤 THIS WAS `>= 20` AND IT FAILED THE DAY NINE ROUTES LEFT ON PURPOSE.
    A count floor tuned to today's size cries wolf every time the set shrinks
    deliberately — and the honest response is always to lower the number, which
    ends with a floor of 0 guarding nothing. A POSITIVE CONTROL cannot be
    satisfied by a broken parser: it has to find a route that is really there.
  */
  /*
    ⚠ REPOINTED 2026-08-15, NOT SOFTENED. This named /help and /explore as the
    two "stable members" — and both were converted to the shared shell on that
    date, so the control would have gone red for the WRONG reason while its own
    message blamed the parser. A positive control has to name routes with a
    REASON not to convert, or it re-fires every slice: /download and /waitlist
    are pure marketing endpoints with no product surface behind them and nobody
    has ever asked for them to be shelled.
  */
  assert.ok(
    listed.includes('/download') && listed.includes('/waitlist'),
    `NAV_ROUTES parser did not find /download and /waitlist, both stable ` +
      `members with no reason to convert — it is broken and every assertion ` +
      `below would pass vacuously. Found ` +
      `${listed.length}: ${listed.slice(0, 6).join(', ')}`,
  );
  for (const d of DOORWAYS) {
    assert.ok(
      !listed.includes(`/${d}`),
      `/${d} is still a NAV_ROUTE, so the marketing glass nav renders ON TOP ` +
        'of the shared bar: fixed/z-60 over sticky/z-20, two Home links, two ' +
        'Sign-ins.',
    );
  }
});

/* ── 4 · THE DEMO STAYS REACHABLE ──────────────────────────────────────── */

test('the overlay host is mounted where a demo button can be pressed', () => {
  const src = code(read(join(HERE, '_doorway.tsx')));
  assert.match(
    src,
    /<DemoOverlayHost\b/,
    'DoorwayPage no longer mounts the overlay host. These pages left ' +
      'NAV_ROUTES, so SiteChrome does not run here — every "Try the demo" ' +
      'button becomes a fake door, silently.',
  );
});

test('the demo button asks whether anything is listening, not which route it is on', () => {
  const src = code(read(join(HERE, 'try-the-demo-button.tsx')));
  assert.match(
    src,
    /demoOverlayAvailable\(\)/,
    'The button gates on something other than the bus. `isNavRoute` was right ' +
      'until the doorways left NAV_ROUTES — then it hid the button on exactly ' +
      'the seven pages whose job is to offer the demo.',
  );
  assert.doesNotMatch(
    src,
    /isNavRoute/,
    'The button still asks the route. That predicate is now false on every ' +
      'doorway.',
  );
});

/* ── 5 · THE PRESS STAYS INSTANT ───────────────────────────────────────── */

test('every doorway has a loading boundary', () => {
  /*
    A force-dynamic route with NO `loading.tsx` prefetches an EMPTY tree.
    Measured on this app: a force-static doorway prefetched 72,197 bytes; a
    force-dynamic route without a boundary prefetched 162 bytes; with one,
    58,473. Without these files the exact click the owner complained about
    stops being instant.
  */
  let found = 0;
  for (const d of DOORWAYS) {
    const p = join(SHELLED, d, 'loading.tsx');
    if (existsSync(p)) found++;
    assert.ok(
      existsSync(p),
      `app/(shell)/${d}/loading.tsx is missing. This route is force-dynamic, ` +
        'so without a loading boundary its prefetch is an empty tree and the ' +
        'press waits on a blank frame.',
    );
  }
  /*
    🔄 THE FLOOR IS DERIVED, NOT TYPED (2026-09-03). It was the literal `7`,
    which is a number about the SIZE of DOORWAYS written down somewhere the
    list cannot reach — so it went wrong the moment the list grew, and it went
    wrong in the direction that says "too many boundaries", which is not a
    thing. Its job is only non-vacuity: prove the loop above really ran over
    every doorway rather than over an empty array. `DOORWAYS.length` says that
    and cannot rot.
  */
  assert.equal(found, DOORWAYS.length);
  assert.ok(DOORWAYS.length > 0, 'DOORWAYS is empty — this guard checked nothing');
});

/* ── 6 · THE SHELL BRINGS NO SECOND LANDMARK OR HEADING ────────────────── */

test('the doorway variant yields the <main> and the <h1> to the page', () => {
  /*
    🔑 `doorway-invariants.test.ts` IS STRUCTURALLY BLIND TO THIS. Its
    `sourcesFor()` reads only a route's OWN directory, so an <h1> or <main>
    contributed by a shared shell is invisible to the guard written to count
    exactly those. This reads the shell and the archetype TOGETHER.
  */
  const shell = code(read(join(APP, '_components', 'frontdoor', 'front-door-shell.tsx')));
  const doorway = code(read(join(HERE, '_doorway.tsx')));

  assert.match(
    shell,
    /const ownsMain = variant !== 'front-door'/,
    'The shell decides its landmark from something other than the variant.',
  );
  assert.match(
    shell,
    /const ownsHeading = variant !== 'front-door'/,
    'The shell decides its sr-only heading from something other than the variant.',
  );
  // The archetype owns exactly one of each; the shell must add none.
  assert.equal(
    (doorway.match(/<main\b/g) ?? []).length,
    1,
    'DoorwayPage must render exactly one <main>.',
  );
  assert.equal(
    (shell.match(/<main\b/g) ?? []).length,
    0,
    'The shell hardcodes a literal <main>; its tag must come from the variant.',
  );
});

test('the doorway wordmark is not a login trap', () => {
  const shell = code(read(join(APP, '_components', 'frontdoor', 'front-door-shell.tsx')));
  assert.match(
    shell,
    /const homeHref = variant === 'app' \? '\/dashboard' : '\/'/,
    "Only the signed-in app may point the wordmark at /dashboard. On a public " +
      'doorway that 307s to /login — a stranger arriving from Google presses ' +
      'the logo and lands on a sign-in screen.',
  );
});

test('EVERY variant keeps a way to open the rail on a phone', () => {
  /*
    🔴 THIS TEST USED TO PIN `const hasRailDrawer = variant !== 'app'` — it
    guarded the doorway and, by naming the exact line that EXCLUDED the app,
    froze the hole the owner then found. On 2026-08-29, measured live at 375px:
    `/papic` rendered the menu button, `/dashboard` rendered none and its rail
    computed `display: none`, so four signed-in trees had the bottom bar's five
    destinations as the whole of navigation. Owner: *"hamburger menu
    disappeared on other parts of the shell. keep it visible across."*

    🔑 THE GUARD IS NOW ABOUT THE ABSENCE OF A GATE, which is the only shape
    that cannot freeze the next hole: the button must not be conditional on the
    variant at all. Width is still a condition, and it is CSS
    (`fd-only-narrow`) — a real mount condition, not a style.
  */
  const shell = code(read(join(APP, '_components', 'frontdoor', 'front-door-shell.tsx')));

  const button = /<button\b[\s\S]*?aria-label="Menu"[\s\S]*?<\/button>/.exec(shell);
  assert.ok(button, 'the shell renders no Menu button at all — no variant can open the rail.');
  assert.match(
    button![0],
    /className="fd-iconbtn fd-only-narrow"/,
    'the Menu button lost `fd-only-narrow`. At >=1024 the rail is already on ' +
      'screen and pressing it mounts the scrim, whose styles live only inside ' +
      'the <1024 media query — unstyled it collapses the page grid.',
  );
  assert.match(
    button![0],
    /aria-controls=\{railId\}/,
    'the Menu button no longer names the rail it opens.',
  );

  /*
    …and nothing between the bar's left cluster and the button may re-introduce
    a variant test. `fd-topleft` is where the gate lived.
  */
  const topleft = shell.slice(
    shell.indexOf('<div className="fd-topleft">'),
    shell.indexOf('aria-label="Menu"'),
  );
  assert.ok(
    topleft.length > 0 && !/\b(inApp|variant)\b/.test(topleft),
    'the Menu button is gated on the variant again. Every variant\'s rail is ' +
      'off-canvas below 1024, so every variant needs the control that opens it.',
  );
  assert.ok(
    !/hasRailDrawer/.test(shell),
    'the `hasRailDrawer` variant gate is back. It is what left /dashboard, an ' +
      'event, a shop and the admin with no way to open the rail on a phone.',
  );
});

/* ── 7 · THE GROUP DOES NOT CHANGE SHAPE AS YOU MOVE ───────────────────── */

test('the Studio rows depend on WHO is looking, not on which page', () => {
  /*
    Owner 2026-08-15: *"same as studio and its sub mene also"* — pressing a
    Studio row visibly changed the Studio group itself. Measured live before the
    fix: seven descriptions and three "try it" markers on `/`, ZERO of each on
    `/papic`, because the app mount asked for the signed-IN rows unconditionally
    while the front door asked for the signed-OUT ones. `railToolsSignedIn` sets
    `line: null` BY DESIGN, so the function was right and the caller never asked
    the question.

    Both mounts must branch on the same thing, or the group changes shape as a
    person moves between two pages that are supposed to be one shell.
  */
  for (const [name, rel] of [
    ['app-rail-shell', join(APP, '_components', 'frontdoor', 'app-rail-shell.tsx')],
    ['front-door', join(APP, '_components', 'frontdoor', 'front-door.tsx')],
  ] as const) {
    const src = code(read(rel));
    assert.match(
      src,
      /account\.signedIn\s*\?\s*railToolsSignedIn\([\s\S]{0,40}?\)\s*:\s*railToolsSignedOut\(\)/,
      `${name} does not branch the Studio rows on account.signedIn. One mount ` +
        'handing out signed-in rows while the other hands out signed-out ones ' +
        'is what made the group change shape when a row was pressed.',
    );
  }
});

/* ── 8 · THE RAIL CARRIES WHAT THE FOOTER USED TO ──────────────────────── */

test('the stranded footer destinations are reachable from the rail', () => {
  /*
    🔴 A REGRESSION THAT SHIPPED AND WAS NOT MEASURED. Leaving `NAV_ROUTES` also
    leaves `isMarketingRoute`, which `site-footer-chrome.tsx` gates on — so the
    seven doorways lost the shared FOOTER along with the glass nav. Measured
    live afterwards: `/about` still shipped a Download link and Cookie settings;
    `/papic` shipped neither. `href="/download"` existed in exactly two files
    app-wide, both gated by `isMarketingRoute`, so a converted page had NO ROUTE
    AT ALL to the download page.

    The rail is the only chrome those pages have now, so the rail must carry
    them.
  */
  const shell = code(read(join(APP, '_components', 'frontdoor', 'front-door-shell.tsx')));
  for (const href of ['/refunds', '/download', '/blog', '/creators', '/vendors']) {
    assert.match(
      shell,
      new RegExp(`<Link href="${href}">`),
      `The rail's small print has lost ${href}. On a converted page the rail is ` +
        'the only chrome, so a destination missing from it is unreachable.',
    );
  }
});

/* ── 9 · "+ CREATE" CREATES ────────────────────────────────────────────── */

test('the gold button opens the create flow, not the board', () => {
  /*
    Owner 2026-08-15: *"create should allow me to create an event."* It pointed
    at `/dashboard`, which for somebody with exactly one upcoming event
    redirects back INTO that event — so the button landed you on the page you
    were already on.
  */
  const shell = code(read(join(APP, '_components', 'frontdoor', 'front-door-shell.tsx')));
  assert.match(
    shell,
    /<Link href="\/dashboard\/create-event" className="fd-btn-gold">/,
    'The gold button no longer opens the create flow.',
  );
  /*
    …and the way OUT of that flow must not re-fire the board's auto-jump.
    `?hub=1` is the only escape from it.
  */
  const createPage = code(read(join(APP, 'dashboard', '(account)', 'create-event', 'page.tsx')));
  assert.match(
    createPage,
    /'\/dashboard\?hub=1'/,
    "The create page's back link dropped `?hub=1`, so leaving it dumps a " +
      'one-event couple INSIDE their wedding rather than on their board.',
  );
});
