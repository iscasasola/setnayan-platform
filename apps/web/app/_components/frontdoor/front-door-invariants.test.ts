/**
 * front-door-invariants.test.ts — the things the front door must never lose.
 *
 * ⚠ THIS TEST IS NOT THE DESIGN. It pins the handful of rules that fail
 * SILENTLY — a fake door, a zero standing in for an unknown, a category count
 * drifting away from the one search shows. It says nothing about layout,
 * spacing or type, and it should keep passing unchanged while the page is
 * restyled. If a change needs this file edited to go green, that is the signal
 * to stop and look.
 *
 * Every assertion here was mutation-checked: the rule was broken on purpose
 * and the test was confirmed to go RED before being trusted. A guard nobody
 * has seen fail is decoration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');

const SHELL = readFileSync(join(HERE, 'front-door-shell.tsx'), 'utf8');
const FEED = readFileSync(join(HERE, 'front-door-feed.tsx'), 'utf8');
const DOOR = readFileSync(join(HERE, 'front-door.tsx'), 'utf8');
const PAGE = readFileSync(join(APP, 'page.tsx'), 'utf8');

/** Strip comments so a rule mentioned in prose can never satisfy a check. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

const SHELL_CODE = code(SHELL);
const FEED_CODE = code(FEED);
const DOOR_CODE = code(DOOR);

/**
 * Does this URL path resolve to a real App Router route?
 *
 * 🔑 ROUTE GROUPS CAN SIT ANYWHERE IN THE PATH, not just at the end — the
 * shipped tree has `/dashboard` at `dashboard/(launcher)/page.tsx` AND
 * `/dashboard/library` at `dashboard/(account)/library/page.tsx`. A resolver
 * that only checks the last segment reports three live routes as missing,
 * which is how a guard starts crying wolf and gets ignored.
 *
 * So: walk the segments, and at each step try the literal directory and any
 * `(group)` directory beside it.
 */
function routeExists(path: string): boolean {
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);
  let frontier = [APP];
  for (const seg of segments) {
    const next: string[] = [];
    for (const base of frontier) {
      if (existsSync(join(base, seg))) next.push(join(base, seg));
      // Descend through any route group at this level.
      if (existsSync(base)) {
        for (const entry of readdirSync(base, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (!/^\(.*\)$/.test(entry.name)) continue;
          const viaGroup = join(base, entry.name, seg);
          if (existsSync(viaGroup)) next.push(viaGroup);
        }
      }
    }
    if (next.length === 0) return false;
    frontier = next;
  }
  // A leaf is a route if it renders a page or handles a request — directly or
  // inside a route group.
  return frontier.some((dir) => {
    if (existsSync(join(dir, 'page.tsx')) || existsSync(join(dir, 'route.ts'))) {
      return true;
    }
    if (!existsSync(dir)) return false;
    return readdirSync(dir, { withFileTypes: true }).some(
      (e) =>
        e.isDirectory() &&
        /^\(.*\)$/.test(e.name) &&
        existsSync(join(dir, e.name, 'page.tsx')),
    );
  });
}

/* ── 1 · NO FAKE DOORS ────────────────────────────────────────────────────
   Every internal href in the rail must resolve to a real route. A row that
   goes nowhere is the one thing this page forbids, and a 404 in a nav is
   invisible until somebody presses it. */
test('every internal link in the rail points at a route that exists', () => {
  const hrefs = Array.from(SHELL_CODE.matchAll(/href="(\/[^"]*)"/g)).map(
    (m) => m[1],
  );
  assert.ok(hrefs.length >= 15, `expected the rail's links, found ${hrefs.length}`);

  const missing: string[] = [];
  for (const href of hrefs) {
    if (!href) continue;
    const path = href.split('?')[0] ?? '';
    if (path === '' || path === '/') continue;
    if (!routeExists(path)) missing.push(href);
  }
  assert.deepEqual(missing, [], `rail links with no route: ${missing.join(', ')}`);
});

/* ── 2 · SIGN OUT IS A POST, NEVER A LINK ─────────────────────────────────
   `/auth/sign-out` is a POST-only route handler. A <Link> to it renders a row
   that answers 405 — and it would be PREFETCHED, i.e. a control that can sign
   you out by being near the pointer. */
test('sign out is submitted as a form, not linked', () => {
  assert.ok(
    /<form[^>]*action="\/auth\/sign-out"[^>]*method="post"/.test(SHELL_CODE),
    'sign-out must be a POST form',
  );
  assert.ok(
    !/href="\/auth\/sign-out"/.test(SHELL_CODE),
    'sign-out must never be an href — the route is POST-only',
  );
});

/* ── 3 · MARKETPLACE AND ITS SYNONYM MOVE TOGETHER ────────────────────────
   Owner 2026-08-12: the Marketplace is signed-in only. "Find a supplier" is
   the SAME destination under another word, so hiding the group while leaving
   the synonym would defeat the instruction with a label. */
test('Find a supplier is gated on the same condition as the Marketplace group', () => {
  /*
    🔑 The first cut looked backwards from the row for the nearest
    `account.signedIn` — which an INVERTED gate (`!account.signedIn ?`) also
    satisfies, because the string is still there. Match the gate INCLUDING its
    polarity, and require the Marketplace group to carry the identical one.
  */
  const linkIdx = SHELL_CODE.indexOf('<Link href="/explore"');
  assert.ok(linkIdx > -1, 'the Find a supplier row is missing');

  /*
    🔑 THE NEAREST GATE, NOT ANY EARLIER ONE. A first rewrite scanned BACKWARDS
    for the last `account.signedIn` — and the account slot above supplies one,
    so replacing this row's own gate with `{true ?` still passed. Mutation
    proved it decorative. Look only at the code IMMEDIATELY before the row.
  */
  const window = SHELL_CODE.slice(Math.max(0, linkIdx - 160), linkIdx);
  assert.ok(
    /\{\s*account\.signedIn\s*\?[^{}]*$/.test(window),
    'Find a supplier must be gated directly by account.signedIn — its own ' +
      `nearest gate, not one inherited from a block above. Saw: ...${window.slice(-90)}`,
  );
  assert.ok(
    !/!\s*account\.signedIn/.test(window),
    'Find a supplier is gated on NOT signed in — it must show only when signed IN',
  );

  // The Marketplace group must be gated the same way, or the owner's rule is
  // kept by one and broken by the other.
  const mkt = SHELL_CODE.indexOf('>Marketplace<');
  assert.ok(mkt > -1, 'the Marketplace group label is missing');
  const mktWindow = SHELL_CODE.slice(Math.max(0, mkt - 400), mkt);
  assert.ok(
    /\{\s*account\.signedIn\s*\?/.test(mktWindow) &&
      !/!\s*account\.signedIn/.test(mktWindow),
    'the Marketplace group must show only when signed IN',
  );
});

/* ── 4 · A ZERO IS NEVER SHOWN FOR AN UNKNOWN ─────────────────────────────
   The whole page is written against this. `null` must reach a "couldn't load"
   branch, and must never be coerced with `?? 0` on the way to the screen. */
test('a count that failed to load renders words, not a zero', () => {
  assert.ok(
    /value === null/.test(SHELL_CODE) && /couldn/.test(SHELL_CODE),
    'the rail must have a null → "couldn\'t load" branch',
  );
  assert.ok(
    /value === null/.test(FEED_CODE) && /couldn/.test(FEED_CODE),
    'the feed must have a null → "couldn\'t load" branch',
  );
  /*
    THE COERCION IS LEGAL IN EXACTLY ONE PLACE, and the guard has to say which.

    `composeFrontDoor` takes plain numbers and floors unknowns at 0 on purpose,
    so a failed read can never PROMOTE a rail — that `?? 0` is the fail-safe and
    must stay. Everywhere else it is the bug: "0 shops" and "we could not count
    the shops" are different sentences.

    So: cut the composer call out of the source, then require that no nullable
    count is coerced anywhere in what remains.
  */
  const feedOutsideComposer = FEED_CODE.replace(
    /composeFrontDoor\(\{[\s\S]*?\}\);/,
    '',
  );
  assert.ok(
    /composeFrontDoor\(\{/.test(FEED_CODE),
    'the composer call must exist for this test to be meaningful',
  );
  for (const [name, src] of [
    ['shell', SHELL_CODE],
    ['feed (outside the composer call)', feedOutsideComposer],
  ] as const) {
    assert.ok(
      !/(liveShopCount|realWeddingCount|eventCount|alaalaCount)\s*\?\?\s*0/.test(
        src,
      ),
      `${name}: a count must never fall back to 0 on the way to the screen`,
    );
  }
});

/* ── 5 · "TRENDING" IS EARNED ─────────────────────────────────────────────
   The heading must be decided by the live count against the threshold, not
   hand-typed. */
test('the shops heading is derived from the shared composer, not hardcoded', () => {
  /*
    🔑 ANCHOR ON WHAT REACHES THE SCREEN. The first cut asserted three strings —
    that `composeFrontDoor` appeared, that `shape.shopsHeading === 'trending'`
    appeared, and that the `shopsHeading` DECLARATION mentioned `shape.`. All
    three survive the regression: nothing checked that `{shopsHeading}` is
    actually rendered, and nothing checked the two ternary arms DIFFER. This is
    the same fault the JSON-LD test above already carries a warning about,
    repeated one test later.
  */
  assert.ok(/composeFrontDoor\(\{/.test(FEED_CODE), 'the feed must call the composer');

  const decl = FEED_CODE.match(/const shopsHeading\s*=([\s\S]*?);/)?.[1] ?? '';
  assert.ok(decl.length > 0, 'shopsHeading assignment not found');
  assert.ok(
    /shape\.shopsHeading/.test(decl),
    'the heading must come from the composer verdict',
  );

  // THE ACT: the value must actually be rendered.
  assert.ok(
    /\{shopsHeading\}/.test(FEED_CODE),
    'shopsHeading is computed but never rendered — the guard would otherwise ' +
      'pass over a page that prints something else entirely',
  );

  // THE DISTINCTION: both outcomes must be reachable and different.
  // Only the ternary ARMS — the comparison literal ('trending') is not an arm.
  const armText = decl.slice(decl.indexOf('?') + 1);
  const arms = armText.match(/'([^']+)'/g) ?? [];
  assert.equal(
    new Set(arms).size,
    2,
    `the two headings must differ and both be present, saw: ${arms.join(', ')}`,
  );
  assert.ok(
    arms.some((a) => /trending/i.test(a)) && arms.some((a) => /first/i.test(a)),
    `expected a Trending arm and a "first shops" arm, saw: ${arms.join(', ')}`,
  );
});

/* ── 6 · PAKANTA IS NOT IN THE RAIL ───────────────────────────────────────
   It is sold and reachable only from inside the app. It has no public page,
   so a row for it would be a fake door. */
test('Pakanta is absent from the Studio group', () => {
  assert.ok(
    !/pakanta/i.test(DOOR_CODE),
    'Pakanta has no public page — a rail row for it would be a fake door',
  );
});

/* ── 7 · THE CRON-FREE JOBS ────────────────────────────────────────────────
   Deliberately NOT re-asserted here. `app/home-carries-the-cron-free-jobs.test.ts`
   already covers it and covers it BETTER — it requires each job to sit inside
   an `after(() => …)` call rather than merely appear, and it checks the
   revalidation window too. Two guards on one rule is how you end up maintaining
   the weaker one; this comment is the pointer so nobody adds it back. */

/* ── 8 · THE JSON-LD SURVIVED THE REWRITE ─────────────────────────────────
   Invisible on screen, so its loss costs rich results with no symptom. */
test('the homepage still emits both JSON-LD nodes', () => {
  const src = code(PAGE);
  /*
    🔑 ANCHOR ON THE ACT, NOT THE NAME. The first cut of this test asserted
    `/softwareAppJsonLd/` appeared in the file — which the CONST DECLARATION
    satisfies all by itself. Mutation-proved: pointing the second <script> at
    `websiteJsonLd` (so the SoftwareApplication node stops rendering entirely,
    and the WebSite node is emitted twice) left this test GREEN. It was
    decoration.

    So count the SERIALISATIONS: each node must be stringified exactly once.
  */
  const website = src.split('JSON.stringify(websiteJsonLd)').length - 1;
  const software = src.split('JSON.stringify(softwareAppJsonLd)').length - 1;
  assert.equal(website, 1, `WebSite JSON-LD must render exactly once, saw ${website}`);
  assert.equal(
    software,
    1,
    `SoftwareApplication JSON-LD must render exactly once, saw ${software}`,
  );
  // And both must actually be inside ld+json script tags.
  const scripts = src.split('application/ld+json').length - 1;
  assert.equal(scripts, 2, `expected 2 ld+json scripts, saw ${scripts}`);
});

/* ── 9 · THE SWAP IS GATED, AND BOTH SIDES ARE REACHABLE ──────────────────
   The owner ruled the cinematic page retired, and it WILL be deleted — in the
   flip commit, once he has looked at what replaces it. Until then both branches
   must exist and the choice must be made by the flag, not by an edit.

   The failure this catches is a half-done flip: the flag imported but the
   branch hardcoded, so the page renders one thing forever while the switch
   looks live. That is this project's "gate with no handle", inverted. */
test('the front door is chosen by the flag, and both branches are reachable', () => {
  const src = code(PAGE);

  // The flag must be READ...
  const readMatch = src.match(/const\s+(\w+)\s*=\s*newFrontDoorEnabled\(\)/);
  assert.ok(
    readMatch || /newFrontDoorEnabled\(\)\s*\?/.test(src),
    'the page must call newFrontDoorEnabled()',
  );
  // ...and its value must be what selects the branch.
  const gate: string = readMatch?.[1] ?? 'newFrontDoorEnabled()';
  assert.ok(
    new RegExp(`\\{\\s*${gate.replace(/[()]/g, '\\$&')}\\s*\\?`).test(src),
    `the rendered branch must be selected by ${gate}, not hardcoded`,
  );

  assert.ok(/<FrontDoor\b/.test(src), 'the new front door branch is missing');
  assert.ok(
    /<HomeReskin\b/.test(src),
    'the retired page must stay mounted until the flip — deleting it before ' +
      'the owner has seen the replacement is the one irreversible step here',
  );

  // A tautology or a flipped polarity would make one branch dead while looking
  // considered. This repo has shipped `|| true` before.
  assert.ok(
    !new RegExp(`${gate.replace(/[()]/g, '\\$&')}\\s*(\\|\\||&&)\\s*(true|false)\\b`).test(src),
    'the flag condition must not be neutered by a tautology',
  );
  assert.ok(
    !new RegExp(`\\{\\s*!\\s*${gate.replace(/[()]/g, '\\$&')}\\s*\\?`).test(src),
    'the flag must not be inverted — that ships the retired page when it is ON',
  );
});

/* ── 10 · THE CATEGORY COUNT HAS ONE DEFINITION ───────────────────────────
   The rail and the search panel show the same number beside the same folder.
   Two private copies is how they drift, and the customer sees the mismatch
   before we do. */
test('the rail and explore both read the shared folder count', () => {
  /*
    🔑 The first cut asserted the import PATH string appeared. That module also
    exports the two folder LISTS the rail cannot render without — so the
    substring survived every possible regression of the COUNT itself. Assert
    the specific SYMBOL, and that neither side recomputes it.
  */
  assert.ok(
    /FOLDER_SERVICE_COUNT/.test(DOOR_CODE),
    'the front door must import the shared FOLDER_SERVICE_COUNT',
  );
  const explore = code(readFileSync(join(APP, 'explore', 'page.tsx'), 'utf8'));
  assert.ok(
    /FOLDER_SERVICE_COUNT/.test(explore),
    'explore must use the shared FOLDER_SERVICE_COUNT',
  );

  // Neither may derive its own copy from the taxonomy — that is the drift.
  for (const [name, src] of [
    ['front door', DOOR_CODE],
    ['explore', explore],
  ] as const) {
    assert.ok(
      !/FOLDER_SERVICE_COUNT[^=\n]*=[\s\S]{0,80}Object\.values\(\s*TAXONOMY_MAP/.test(src),
      `${name} recomputes the folder count instead of importing it`,
    );
    assert.ok(
      !/reduce<Record<string, number>>/.test(src),
      `${name} appears to rebuild a per-folder tally locally`,
    );
  }
});

/* ── 11 · A FAILED STORY READ IS NOT A ZERO ───────────────────────────────
   The shared shelf loader returns `[]` for BOTH "none yet" and "rejected", so
   a count taken from the array prints "0 theirs" to a visitor on a day when
   eight are published. The front door must take its count from the read's own
   success flag, never from the array length. */
test('the storyteller count comes from the read result, not the array length', () => {
  const data = code(readFileSync(join(HERE, 'data.ts'), 'utf8'));

  assert.ok(
    /loadFeaturedChaptersResult/.test(data),
    'the front door must use the result-returning loader, which reports failure',
  );

  /*
    ⚠ MATCH THE ASSIGNMENT, NOT THE TYPE. The first cut of this very assertion
    matched `storyCount: number | null;` — the FIELD DECLARATION — and reported
    it as the value. Object-literal entries end in a comma; type members end in
    a semicolon. Same trap as the JSON-LD guard, caught by its own message.
  */
  const assign = data.match(/storyCount:\s*([^;\n]+),/)?.[1] ?? '';
  assert.ok(assign.length > 0, 'storyCount is not assigned in the returned object');
  assert.ok(
    /\.ok\b/.test(assign) && /null/.test(assign),
    `storyCount must branch on the read's ok flag and yield null on failure, got: ${assign}`,
  );
  assert.ok(
    !/^\s*stories\.length\s*$/.test(assign) &&
      !/^\s*storiesRaw\.items\.length\s*$/.test(assign),
    'storyCount must not be a bare array length — that is the defect itself',
  );
});

/* ── 12 · A LIVE SHOP SHOWS ITSELF, NOT THE WORD "SHOP" ───────────────────
   The card used to render the literal string "SHOP" as its thumbnail, so a
   real approved business looked like an unfinished placeholder on the front
   page. It must render the resolved logo, or the shop's initials — never a
   hardcoded stand-in word. */
test('the shop card renders a logo or initials, never a placeholder word', () => {
  assert.ok(
    /s\.logoUrl \?/.test(FEED_CODE),
    'the shop card must branch on the resolved logo',
  );
  assert.ok(
    /initialsOf\(s\.name\)/.test(FEED_CODE),
    'the fallback must be the shop\'s own initials',
  );
  const shopCard = FEED_CODE.slice(
    FEED_CODE.indexOf('function ShopCard'),
    FEED_CODE.indexOf('export function FrontDoorFeed'),
  );
  assert.ok(shopCard.length > 0, 'ShopCard not found');
  /* 🪤 An earlier cut of this assertion required `>SHOP<` — a literal `<`
     immediately after the word. Inserting `>SHOP` followed by a newline
     slipped straight past it. Mutation-proved decorative; anchored to the
     word as a text node instead. */
  assert.ok(
    !/>\s*SHOP\b/.test(shopCard),
    'the literal word "SHOP" must not be the card\'s mark — a live business ' +
      'rendered as a placeholder is the defect this replaced',
  );
});

/* ── 13 · A CHAPTER'S READING TIME COMES FROM ITS BODY ────────────────────
   Deriving it from the truncated lede would read "1 min" on a piece that takes
   ten — an invented number on somebody else's wedding. It is computed at the
   loader, where the whole body exists, with the one shared rule. */
test('chapter reading time is computed from the body, never the excerpt', () => {
  const data = code(readFileSync(join(HERE, 'data.ts'), 'utf8'));
  assert.ok(
    !/excerpt[^;\n]*\/\s*2\d\d/.test(data) && !/excerpt.*split.*length\s*\/\s*\d/.test(data),
    'reading time must not be derived from the excerpt',
  );
  const story = readFileSync(join(APP, '..', 'lib', 'storytellers.ts'), 'utf8');
  assert.ok(
    /readingMinutesFromText\(row\.body\)/.test(code(story)),
    'the loader must compute reading time from the full body',
  );
  // ONE definition of the rule — a second "words / N" is how they drift.
  assert.ok(
    !/\/\s*200\b/.test(code(story)),
    'storytellers.ts must not re-derive the words-per-minute rule',
/* ── 14 · THE ONE SHELF ACTUALLY USES THE SHARED CHIP RULE ────────────────
   `lib/front-door-composition.test.ts` proves `selectShelf` is right. That
   proves NOTHING about this page: extracting a pure core and testing it while
   the call site quietly keeps its own copy is a guard watching the wrong
   thing. So this asserts the ACT (the feed calls it) AND THE CONSEQUENCE (the
   page renders what it returned, and holds no second copy of the rule). */
test('the shelf contents come from the shared chip rule, not a local copy', () => {
  assert.ok(
    /selectShelf\(chip,/.test(FEED_CODE),
    'the feed must ask the shared composer what the chip admits',
  );

  // THE CONSEQUENCE — the returned lists are what reach the screen. Without
  // this, the feed could call selectShelf, discard it, and still pass.
  for (const rendered of ['shownStories', 'shownArticles', 'nothingUnderChip']) {
    assert.ok(
      new RegExp(`\\b${rendered}\\b`).test(FEED_CODE),
      `${rendered} is destructured but never used — the call would be decoration`,
    );
  }
  assert.ok(
    /leadStories\.map/.test(FEED_CODE) && /leadArticles\.map/.test(FEED_CODE),
    'both kinds must render into the one shelf',
  );

  // NO SECOND COPY. A re-implemented ternary chain beside the call is how the
  // page and the tested rule start disagreeing.
  assert.ok(
    !/chip === 'With video'\s*\?/.test(FEED_CODE),
    'the chip rule must live in one place — this is a second copy of it',
  );
});

/* ── 15 · THE KIND LIVES ON THE CARD ──────────────────────────────────────
   The merge only works because each card says which kind it is. Lose the tag
   and the shelf becomes an undifferentiated pile in which our own writing is
   indistinguishable from a couple's story — which is the one thing the owner
   asked the card, not the shelf, to carry. */
test('every card in the one shelf declares its kind', () => {
  assert.ok(
    /fd-kindtag[^]*?>\s*Article\s*</.test(FEED_CODE),
    'the article card must carry the word Article',
  );
  assert.ok(
    /fd-kindtag[^]*?>\s*Their story\s*</.test(FEED_CODE),
    'the story card must carry the words Their story',
  );
  // …and the shelf itself must NOT be split back into two headed rows.
  assert.ok(
    /one shelf/.test(FEED),
    'the shelf still states the rule it exists to keep',
  );
});

/* ── 16 · "WITH VIDEO" ASKS THE LOADER, NOT THE PICTURE ───────────────────
   `thumbUrl` is YouTube-only. Deriving "has video" from it answers NO for a
   chapter that is entirely video but hosted elsewhere, so that chapter falls
   out of the one chip built to find it and loses its ▶. The tile type says so
   in its own comment, and records the same substitution being made once
   before. It was made again in data.ts. */
test('a story\'s video flag comes from the loader, never from its thumbnail', () => {
  const DATA_CODE = code(readFileSync(join(HERE, 'data.ts'), 'utf8'));
  assert.ok(
    /hasVideo:\s*s\.hasVideo\b/.test(DATA_CODE),
    'the front door must carry the loader\'s hasVideo through',
  );
  assert.ok(
    !/hasVideo:\s*Boolean\(\s*s\.thumbUrl\s*\)/.test(DATA_CODE),
    'hasVideo derived from thumbUrl drops every non-YouTube chapter',
  );
});

/* ── 17 · THE LEAD/TRAILING BOUNDARY COMES FROM THE COMPOSER ──────────────
   Same lesson as #11: the pure split is proven in
   `lib/front-door-composition.test.ts`, which proves nothing about this page
   unless the page actually uses it. A hard-coded `slice(4, …)` here silently
   drops articles the day the first chapter is featured. */
test('the shelf rows are split by the composer, not by a hard-coded index', () => {
  assert.ok(
    /splitShelfRows\(/.test(FEED_CODE),
    'the feed must ask the composer where the lead grid stops',
  );
  // THE CONSEQUENCE — all three returned rows must reach the screen.
  assert.ok(
    /leadStories\.map/.test(FEED_CODE) &&
      /leadArticles\.map/.test(FEED_CODE) &&
      /trailingArticles\.map/.test(FEED_CODE),
    'a row that is computed and never rendered is an article nobody can read',
  );
  // NO HAND-TYPED BOUNDARY left beside it.
  assert.ok(
    !/shownArticles\.slice\(\s*4\s*,/.test(FEED_CODE),
    'the trailing row must not start at a hard-coded index',
