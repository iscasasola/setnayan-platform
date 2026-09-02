import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STUDIO_APPS, studioDescription } from './studio-apps';
import { railToolsSignedIn, railToolsSignedOut } from '@/lib/studio-rail';
import { GENERIC_PROFILE, WEDDING_PROFILE } from './event-type-profile';

/**
 * THE STUDIO ROWS — one source, two behaviours.
 *
 * Owner, 2026-08-14: *"the side menu when signed out, it will be able to show
 * demo. when logged in, it will be different view."* and *"that is where we can
 * talk about the different apps."*
 *
 * ─── WHAT THIS PROTECTS ──────────────────────────────────────────────────
 * 1. THE DESCRIPTIONS ARE NOT WRITTEN TWICE. They already existed, one
 *    `PAGE_DESCRIPTION` per product page, feeding each page's `<meta>`, its
 *    OpenGraph card and its JSON-LD. The rail now reads the SAME record. A
 *    second hand-typed copy is not a mechanism, it is a future drift — the
 *    shape `llms.txt` already paid for with three weeks of green CI.
 * 2. A ROW NEVER OFFERS A DEMO THAT DOES NOT EXIST. Only three of them
 *    have one. `/setnayan-ai` in particular has NONE — its homepage pop-up is a
 *    savings comparator — and the owner named it, so the temptation to wire one
 *    is real and this is what refuses it.
 * 3. A SIGNED-IN ROW NEVER OPENS ONTO A REFUSAL. `monogram` is wedding-only and
 *    its page `redirect()`s away with no message, so a birthday organiser
 *    pressing "Logo Maker" would be silently dumped on their event page.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
/*
  🔑 The Studio product pages live in the `app/(shell)/` route group
  (2026-08-15) so the shared shell is mounted once, in a layout, and survives
  navigation. Invisible in the URL, present in the path — resolve through here.
*/
const SHELLED = join(APP, '(shell)');

function pageSource(key: string): string {
  return readFileSync(join(SHELLED, key, 'page.tsx'), 'utf8');
}

test('the anchor: there are eight Studio apps and each names a page', () => {
  /*
    🔄 SEVEN → EIGHT, 2026-08-21. Owner: *"pakanta is paid. so add this to the
    studio."* The count is deliberately still pinned rather than derived: a
    product appearing in this list is a decision to put a row in front of every
    stranger, and it must be made on purpose, not by an import.
  */
  assert.equal(STUDIO_APPS.length, 8, 'the Studio group is eight rows');
  for (const a of STUDIO_APPS) {
    assert.ok(a.href.startsWith('/'), `${a.key}: href is not a path`);
    assert.ok(a.description.length > 80, `${a.key}: description is a stub`);
    assert.ok(a.railLine.length > 10, `${a.key}: railLine is a stub`);
  }
});

/* ── 1 · ONE SOURCE, READ BY BOTH ──────────────────────────────────────── */

test('every product page reads its description from this file, not its own copy', () => {
  /*
    🔑 THE DIRECTION IS THE MECHANISM. Lifting the strings here while leaving
    each page holding its own literal would be two hand-typed strings that must
    agree. The pages must READ.
  */
  for (const a of STUDIO_APPS) {
    const src = pageSource(a.key);
    assert.match(
      src,
      new RegExp(`studioDescription\\('${a.key}'\\)`),
      `/${a.key} does not read its description from lib/studio-apps.ts. Its ` +
        'search result and its rail row can now disagree about what it is.',
    );
    // …and it must not have quietly re-inlined one beside the import.
    assert.doesNotMatch(
      src.replace(/\/\*[\s\S]*?\*\//g, ''),
      /const PAGE_DESCRIPTION\s*=\s*\n?\s*'/,
      `/${a.key} has re-inlined a literal PAGE_DESCRIPTION. That is the exact ` +
        'drift this file exists to prevent.',
    );
  }
});

test('the description this file serves is the one the page renders', () => {
  // A page could import the helper and then pass something else to metadata.
  for (const a of STUDIO_APPS) {
    const src = pageSource(a.key);
    assert.match(
      src,
      /description: PAGE_DESCRIPTION/,
      `/${a.key} imports the shared description but does not use it for its ` +
        'metadata — read but never used.',
    );
    assert.equal(studioDescription(a.key), a.description);
  }
});

test('an unknown key throws rather than shipping a page with no description', () => {
  assert.throws(() => studioDescription('not-a-product'), /no Studio app/);
});

/* ── 2 · NO ROW OFFERS A DEMO THAT DOES NOT EXIST ──────────────────────── */

/** The demo overlays `HomeOverlays` actually renders. */
const MOUNTED_DEMOS = new Set(['papic-demo', 'panood-demo', 'plan3d-demo']);

test('only products with a real overlay carry a demo', () => {
  const withDemo = STUDIO_APPS.filter((a) => a.demo);
  assert.equal(withDemo.length, 3, 'exactly three Studio products have a demo');
  for (const a of withDemo) {
    assert.ok(
      MOUNTED_DEMOS.has(a.demo!.id),
      `${a.key} names the demo "${a.demo!.id}", which HomeOverlays does not render.`,
    );
  }
  const ai = STUDIO_APPS.find((a) => a.key === 'setnayan-ai');
  assert.equal(
    ai?.demo,
    undefined,
    'Setnayan AI has NO demo — its homepage pop-up was a savings comparator, ' +
      'never a live trial. The owner named it, so this assertion is the thing ' +
      'standing between that and a fake door.',
  );
});

test('the overlay ids the rail can emit are exactly the ones that are rendered', () => {
  const overlays = readFileSync(
    join(APP, '_components', 'home', 'HomeOverlays.tsx'),
    'utf8',
  );
  for (const a of STUDIO_APPS) {
    if (!a.demo) continue;
    assert.ok(
      overlays.includes(a.demo.id),
      `HomeOverlays does not mount "${a.demo.id}" — the page button would open nothing.`,
    );
  }
});

test('the Studio rows NAVIGATE — they never open the demo directly', () => {
  /*
    🔄 OWNER 2026-08-15: *"we still want a feature description instead of
    directly just going to the demo."* For one day the three rows with a demo
    were <button>s that opened a two-phone live demo in place, before anything
    had told a stranger what the product was. The row must land on the product's
    page; the demo lives there.
  */
  const shell = readFileSync(
    join(APP, '_components', 'frontdoor', 'front-door-shell.tsx'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(
    shell,
    /onClick=\{\(\) => openDemoOverlay/,
    'A Studio row opens the demo directly again. It must navigate to the ' +
      "product's page — the feature description comes first.",
  );
  assert.match(
    shell,
    /tools\.map\(\(t\) => \(\s*<Link/,
    'The Studio rows are no longer plain <Link>s. A row that is a <button> ' +
      'cannot be middle-clicked, opened in a new tab, or crawled.',
  );
});

test('a "try it" marker is backed by a real demo button on that page', () => {
  /*
    THE MARKER IS A PROMISE ABOUT ANOTHER PAGE. It says "this one is try-able",
    and the thing that has to keep that promise is the demo button on the
    product's own page. Both now read ONE field, so they cannot disagree — this
    asserts the page actually passes it.
  */
  for (const a of STUDIO_APPS) {
    const src = pageSource(a.key);
    if (a.demo) {
      /*
        TWO LEGAL WAYS TO KEEP THE PROMISE, and the page must use one of them.

        Every doorway that renders the shared kit passes the demo down to a
        "Try the demo" button. `/papic` does not: on 2026-08-29 the owner
        removed the buttons from that page and asked for the codes themselves
        ("QR codes should be ready for scan"), so it mounts the live session
        INLINE instead. That keeps the rail's promise more strongly than a
        button does — the demo is on the page, already running.

        The rule stays "the marker must be backed by something real". Only the
        list of what counts as real has grown, and it is an ALLOW-LIST keyed by
        page: a doorway that renders neither still fails, which is the fake
        door this test was written to catch.
      */
      const passesToKit = new RegExp(`demo=\\{studioApp\\('${a.key}'\\)\\?\\.demo\\}`).test(src);
      /*
        THE INLINE ALLOW-LIST, keyed by page — a map rather than a chain of
        `key === …` so adding one is a deliberate row, not a widening condition.

        `/pa3d` joined it 2026-09-02 (owner: *"follow the concept of papic"*).
        The reason is Papic's, and stronger: 3D Plan's premise IS the
        interaction. A page that argues "you should see the room" above a
        button that opens the room argues against itself, so the room is
        mounted on the page and stepping into it IS the demo.

        The rule is unchanged — the marker must be backed by something real,
        and a doorway that renders NEITHER still fails, which is the fake door
        this test exists to catch.
      */
      const INLINE_DEMO: Record<string, RegExp> = {
        papic: /<PapicScan\s*\/>/,
        pa3d: /<Pa3dRoom\s*\/>/,
      };
      const mountsInline = INLINE_DEMO[a.key]?.test(src) ?? false;
      assert.ok(
        passesToKit || mountsInline,
        `/${a.key} carries a "try it" marker in the rail but its page neither ` +
          'passes the demo to the doorway kit nor mounts a live demo of its ' +
          'own. The marker is a fake door.',
      );
    } else {
      assert.doesNotMatch(
        src,
        /demo=\{/,
        `/${a.key} has no demo in the source but its page passes one.`,
      );
    }
  }
});

test('signed out, every row says what the product is', () => {
  for (const t of railToolsSignedOut()) {
    assert.ok(
      t.line && t.line.length > 10,
      `${t.key} has no line. Seven bare names teach a stranger nothing — the ` +
        'owner asked for exactly this.',
    );
  }
});

/* ── 3 · SIGNED IN: A DOOR, NEVER A REFUSAL ────────────────────────────── */

test('exactly one event opens the tool for THAT event', () => {
  const rows = railToolsSignedIn({
    eventId: 'EVT123',
    count: 1,
    profile: WEDDING_PROFILE,
  });
  const papic = rows.find((r) => r.key === 'papic');
  assert.ok(papic!.href.includes('EVT123'), 'the Papic row does not open the event');
  assert.ok(
    !papic!.href.startsWith('/papic'),
    'a signed-in person is still being sent to the marketing page',
  );
  for (const r of rows) {
    assert.equal(r.line, null, 'signed in, the rail must not sell');
    assert.equal(r.demo, undefined, 'signed-in rows must never offer a demo');
  }
});

test('several events go to the picker, never to a guessed one', () => {
  const rows = railToolsSignedIn({ eventId: null, count: 3, profile: null });
  for (const r of rows) {
    assert.equal(
      r.href,
      '/dashboard',
      `${r.key} does not send a multi-event person to the board. Guessing one ` +
        "would open somebody's OTHER wedding.",
    );
  }
});

test('no events keeps the page that explains the product', () => {
  const rows = railToolsSignedIn({ eventId: null, count: 0, profile: null });
  for (const r of rows) {
    const app = STUDIO_APPS.find((a) => a.key === r.key)!;
    assert.equal(
      r.href,
      app.href,
      `${r.key} sends a person with no event somewhere other than the page ` +
        'that explains the product — which is what they actually need.',
    );
  }
});

test('a row whose surface the event type does not enable is DROPPED', () => {
  /*
    🔴 THE DEAD-CONTROL GUARD. `monogram` and `website` are wedding-only.
    `/dashboard/[id]/monogram` redirects away with NO message, so a birthday
    organiser pressing "Logo Maker" lands back on their event page having been told
    nothing — strictly worse than the marketing page it replaced.
  */
  const wedding = railToolsSignedIn({
    eventId: 'EVT1',
    count: 1,
    profile: WEDDING_PROFILE,
  }).map((r) => r.key);
  const generic = railToolsSignedIn({
    eventId: 'EVT1',
    count: 1,
    profile: GENERIC_PROFILE,
  }).map((r) => r.key);

  assert.ok(wedding.includes('palogo'), 'a wedding lost its monogram row');
  assert.ok(
    !generic.includes('palogo'),
    'Logo Maker survives on an event type with no monogram surface. That row ' +
      'redirects away with no message — a dead control.',
  );
  assert.ok(
    generic.length < wedding.length,
    'nothing was filtered for a generic event type; the surface gate is inert',
  );
});
