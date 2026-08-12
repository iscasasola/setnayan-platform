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
  const findRow = SHELL_CODE.indexOf('Find a supplier');
  assert.ok(findRow > -1, 'the Find a supplier row is missing');
  // The row must sit inside a signedIn branch.
  const before = SHELL_CODE.slice(0, findRow);
  const lastGate = before.lastIndexOf('account.signedIn');
  const lastClose = before.lastIndexOf(') : null}');
  assert.ok(
    lastGate > lastClose,
    'Find a supplier must render only when signed in',
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
  assert.ok(
    /composeFrontDoor/.test(FEED_CODE),
    'the feed must get its rail shapes from the shared composer',
  );
  assert.ok(
    /shape\.shopsHeading === 'trending'/.test(FEED_CODE),
    '"Trending" must be a verdict from the composer, never a typed string',
  );
  // The regression: assigning the heading unconditionally. The word may only
  // ever reach the screen through the composer's verdict.
  const heading = FEED_CODE.match(/const shopsHeading[\s\S]*?;/)?.[0] ?? '';
  assert.ok(heading.length > 0, 'shopsHeading assignment not found');
  assert.ok(
    /shape\./.test(heading),
    `shopsHeading must be computed from the composer, got: ${heading.slice(0, 120)}`,
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
  assert.ok(
    /newFrontDoorEnabled\(\)\s*\?/.test(src),
    'the branch must be decided by newFrontDoorEnabled(), not hardcoded',
  );
  assert.ok(/<FrontDoor\b/.test(src), 'the new front door branch is missing');
  assert.ok(
    /<HomeReskin\b/.test(src),
    'the retired page must stay mounted until the flip — deleting it before ' +
      'the owner has seen the replacement is the one irreversible step here',
  );
  // A tautology in the condition would make one branch dead while looking
  // considered — this repo has shipped exactly that (`|| true`) before.
  assert.ok(
    !/newFrontDoorEnabled\(\)\s*(\|\||&&)\s*(true|false)\b/.test(src),
    'the flag condition must not be neutered by a tautology',
  );
});

/* ── 10 · THE CATEGORY COUNT HAS ONE DEFINITION ───────────────────────────
   The rail and the search panel show the same number beside the same folder.
   Two private copies is how they drift, and the customer sees the mismatch
   before we do. */
test('the rail and explore both read the shared folder count', () => {
  assert.ok(
    /taxonomy-folder-counts/.test(DOOR_CODE),
    'the front door must import the shared count',
  );
  const explore = code(
    readFileSync(join(APP, 'explore', 'page.tsx'), 'utf8'),
  );
  assert.ok(
    /taxonomy-folder-counts/.test(explore),
    'explore must import the shared count, not recompute it',
  );
  assert.ok(
    !/const FOLDER_SERVICE_COUNT[^=]*=\s*Object\.values/.test(explore),
    'explore must no longer hold a private copy of the count',
  );
});
