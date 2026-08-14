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
 * A LAYOUT CANNOT FIX IT FOR US: `dynamic` resolves nested-most-wins and the
 * children traversal completes before a parent layout's component is created.
 * It is seven separate edits, and missing one is invisible. So this counts.
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

/** The seven rail Studio rows. `/alaala` is NOT one — it keeps force-static. */
const DOORWAYS = [
  'setnayan-ai',
  'pawebsite',
  'papic',
  'panood',
  'patiktok',
  'pa3d',
  'palogo',
] as const;

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

test('the anchor: all seven doorway pages exist', () => {
  for (const d of DOORWAYS) {
    const p = join(APP, d, 'page.tsx');
    assert.ok(existsSync(p) && read(p).length > 500, `${p} is missing or a stub`);
  }
});

/* ── 1 · NOT ONE OF THEM MAY BE force-static ───────────────────────────── */

test('every doorway is force-dynamic, and NONE is force-static', () => {
  let dynamicCount = 0;
  let staticCount = 0;
  for (const d of DOORWAYS) {
    const src = code(read(join(APP, d, 'page.tsx')));
    const isDynamic = /^export const dynamic = 'force-dynamic';/m.test(src);
    const isStatic = /^export const dynamic = 'force-static';/m.test(src);
    if (isDynamic) dynamicCount++;
    if (isStatic) staticCount++;
    assert.ok(
      isDynamic,
      `/${d} is not force-dynamic. It mounts the shared shell, which reads the ` +
        'session — and on a static page that read returns an EMPTY cookie jar ' +
        'without throwing, so it would serve a cached, permanently signed-out ' +
        'rail for an hour at a time.',
    );
    assert.ok(!isStatic, `/${d} declares force-static.`);
  }
  assert.equal(dynamicCount, 7, 'all seven must be force-dynamic');
  assert.equal(staticCount, 0, 'none may be force-static');
});

test('/alaala is deliberately NOT converted', () => {
  /*
    It is a rail row that still jumps out, and that is a NAMED gap rather than
    an oversight: it does not render `DoorwayPage`, so it needs its own work.
    Asserting it here stops a future sweep converting it by pattern-match and
    silently paying the cache for a page that gains nothing.
  */
  const src = code(read(join(APP, 'alaala', 'page.tsx')));
  assert.match(
    src,
    /^export const dynamic = 'force-static';/m,
    '/alaala lost force-static. It does not mount the shell, so it pays the ' +
      'cache for nothing.',
  );
});

/* ── 2 · THE MOUNT, AND WHERE IT IS NOT ────────────────────────────────── */

test('DoorwayPage mounts the shell exactly once, in the doorway variant', () => {
  const src = code(read(join(HERE, '_doorway.tsx')));
  assert.equal(
    (src.match(/<AppRailShell\b/g) ?? []).length,
    1,
    'DoorwayPage must mount the shared shell exactly once.',
  );
  assert.match(
    src,
    /<AppRailShell variant="doorway">/,
    'The shell must be mounted in the `doorway` variant. `app` drops the ' +
      'hamburger — and the rail is display:none below 1024, so a phone would ' +
      'get a product page with NO navigation — and points the wordmark at ' +
      '/dashboard, which redirects a stranger to /login.',
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
      !existsSync(join(APP, d, 'layout.tsx')),
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
  const src = code(read(join(HERE, 'site-chrome.tsx')));
  const block = /const NAV_ROUTES = new Set<string>\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(block, 'NAV_ROUTES not found — this guard would pass vacuously.');
  const listed = [...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(
    listed.length >= 20,
    `NAV_ROUTES parsed only ${listed.length} entries — the parser is broken and ` +
      'every assertion below would pass vacuously.',
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
    const p = join(APP, d, 'loading.tsx');
    if (existsSync(p)) found++;
    assert.ok(
      existsSync(p),
      `app/${d}/loading.tsx is missing. This route is force-dynamic, so ` +
        'without a loading boundary its prefetch is an empty tree and the ' +
        'press waits on a blank frame.',
    );
  }
  assert.equal(found, 7);
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

test('the doorway keeps a way to open the rail on a phone', () => {
  const shell = code(read(join(APP, '_components', 'frontdoor', 'front-door-shell.tsx')));
  assert.match(
    shell,
    /const hasRailDrawer = variant !== 'app'/,
    'The hamburger is gated on something other than the variant. The rail is ' +
      'display:none below 1024, so without the drawer a phone gets a product ' +
      'page with no navigation at all.',
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
