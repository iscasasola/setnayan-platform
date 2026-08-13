/**
 * guest-doors-are-not-dashboards — the one rule four surfaces broke.
 *
 * `app/dashboard/[eventId]/layout.tsx` admits `member_type = 'couple'` ONLY
 * (plus an accepted, non-removed `event_moderators` row). Every link that sends
 * a `member_type='guest'` membership to a `/dashboard/[eventId]/…` path is a
 * 404 shown to somebody who was just told they belong — which reads as the host
 * shutting them out, not as a bug.
 *
 * PR #4415 closed three such doors on the events board and put the answer in
 * `lib/event-board.ts` so the next surface would inherit it. It did not: an
 * adversarial pass on 2026-08-13 found FOUR more, on four different surfaces,
 * each re-deriving "where may this person go" locally and getting it wrong the
 * same way.
 *
 * ── WHAT THIS FILE GUARDS, AND WHY IN TWO LAYERS ────────────────────────────
 * 1. THE PREDICATE. `eventStance` / `eventBoardHref` / `eventAlbumHref` /
 *    `stanceClosedReason` must never hand an invited person a `/dashboard/`
 *    path, at any slug value.
 * 2. THE CALLERS. Testing the primitive is not testing the caller — the
 *    predicate was already correct and shipped on 2026-08-13 while all four of
 *    these surfaces ignored it. So each caller is asserted at SOURCE, sliced to
 *    the exact function that owns the decision.
 *
 * 🔑 A FILE-LEVEL COUNT CANNOT LOCALISE. `photos-tab.tsx` legitimately mentions
 * `/dashboard/` nowhere now, but `editorials-tab.tsx` MUST still build the
 * organiser's editor href — so a whole-file "no /dashboard/" assertion would be
 * either vacuous or wrong. Every assertion below is scoped to a single
 * function body via `sliceFunction`, so it fails for the component that
 * actually regressed and stays silent for its neighbours.
 *
 * 🪤 Sabotage-measured 2026-08-13: each assertion was broken in turn by editing
 * the real call site (not by renaming a symbol), the occurrence count was
 * printed before and after, and each test was confirmed RED. See the PR body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  eventStance,
  eventBoardHref,
  eventAlbumHref,
  stanceClosedReason,
} from './event-board';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** Every value of the shipped `public.member_type` enum. */
const MEMBER_TYPES = ['couple', 'guest', 'vendor', 'coordinator'] as const;

/**
 * Extract one function body by brace-matching from its declaration, so an
 * assertion is about ONE component and cannot be satisfied — or broken — by a
 * sibling, an import line, or a comment elsewhere in the file.
 *
 * 🪤 THE FIRST CUT OF THIS HELPER WAS ITSELF DECORATIVE, and it is worth
 * keeping the reason. It took the first `{` after the function name as the
 * body — but three of the four call sites here are React components taking a
 * DESTRUCTURED prop (`function AlbumCard({ album }: …)`), so the first brace is
 * the PARAMETER, and brace-matching returned `{ album }`. Every
 * "must NOT contain /dashboard/" assertion then passed against a
 * twelve-character string: green, and watching nothing.
 *
 * So the parameter list is skipped by paren-matching first, and `assertUsable`
 * below refuses a slice that is too small to be a body — a guard that cannot
 * see its subject must fail loudly, not quietly agree.
 */
function sliceFunction(relPath: string, fnName: string): string {
  const src = readFileSync(join(WEB, relPath), 'utf8');
  const declaration = new RegExp(
    `(?:export\\s+)?(?:async\\s+)?function\\s+${fnName}\\s*\\(`,
  );
  const start = src.search(declaration);
  assert.notEqual(
    start,
    -1,
    `ANCHOR NOT FOUND: ${fnName} in ${relPath}. This is a FAILURE, not a pass — ` +
      `the guard cannot watch a function it cannot find. Re-point it or delete it.`,
  );

  // 1. Skip the parameter list by paren-matching.
  const paramOpen = src.indexOf('(', start);
  assert.notEqual(paramOpen, -1, `no parameter list for ${fnName} in ${relPath}`);
  let parens = 0;
  let paramClose = -1;
  for (let i = paramOpen; i < src.length; i++) {
    if (src[i] === '(') parens++;
    else if (src[i] === ')') {
      parens--;
      if (parens === 0) {
        paramClose = i;
        break;
      }
    }
  }
  assert.notEqual(paramClose, -1, `unbalanced parens for ${fnName} in ${relPath}`);

  // 2. The body is the next brace after the (possibly typed) return annotation.
  const open = src.indexOf('{', paramClose);
  assert.notEqual(open, -1, `no body brace for ${fnName} in ${relPath}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        const body = stripComments(src.slice(open, i + 1));
        assertUsable(body, relPath, fnName);
        return body;
      }
    }
  }
  assert.fail(`unbalanced braces reading ${fnName} from ${relPath}`);
}

/**
 * Comments are PROSE, not behaviour. Every assertion below runs against the
 * stripped body.
 *
 * 🪤 Measured 2026-08-13: two of these guards went red against CORRECT code
 * because the fix's own comment quoted the defect it removed — "the old
 * `publicHref ?? editorHref` sent a guest…" is a sentence, and the guard read
 * it as the act. The same blindness works the other way: a guard satisfied by
 * a comment is a guard that passes after the code is deleted.
 *
 * Deliberately simple: block comments, then `//` to end of line ONLY when it
 * follows start-of-line or whitespace — which every real line comment does, and
 * a path or URL never does.
 *
 * 🪤 The first cut keyed on "not preceded by `:`" to protect `https://`. A
 * mutation run then produced the literal `` `/dashboard//studio/papic` `` and
 * this function ATE IT from `//studio` onward, leaving `/dashboard` — so the
 * guard below, which looks for `/dashboard/` with its trailing slash, went
 * green against sabotaged code. A comment-stripper that eats code is a guard
 * that passes on the regression. Not a JS parser, and it does not claim to be.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

/**
 * A slice too small to be a function body means the extractor missed — which
 * would make every negative assertion below vacuously true. Fail instead.
 */
function assertUsable(body: string, relPath: string, fnName: string): void {
  assert.ok(
    body.length > 200 && body.includes('\n') && /\breturn\b/.test(body),
    `SLICE TOO SMALL for ${fnName} in ${relPath} (${body.length} chars) — the ` +
      `extractor missed the body, so every assertion against it would pass ` +
      `while watching nothing.`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LAYER 1 — the predicate
// ───────────────────────────────────────────────────────────────────────────

test('an invited person is NEVER handed a /dashboard/ path, at any slug', () => {
  for (const slug of ['maria-and-jose', null, undefined, '', '   ']) {
    for (const href of [
      eventBoardHref({ event_id: 'E1', slug, member_type: 'guest' }),
      eventAlbumHref({ event_id: 'E1', slug, member_type: 'guest' }),
    ]) {
      assert.ok(
        href === null || !href.startsWith('/dashboard/'),
        `invited href leaked into the organiser shell: ${href} (slug=${JSON.stringify(slug)})`,
      );
    }
  }
});

test('a blank-ish slug is NO LINK, never `/` and never `/null`', () => {
  for (const slug of [null, undefined, '', '   ']) {
    assert.equal(eventBoardHref({ event_id: 'E1', slug, member_type: 'guest' }), null);
    assert.equal(eventAlbumHref({ event_id: 'E1', slug, member_type: 'guest' }), null);
  }
});

test('the organiser still reaches the shell — the fix must not close a real door', () => {
  assert.equal(
    eventBoardHref({ event_id: 'E1', slug: null, member_type: 'couple' }),
    '/dashboard/E1',
  );
  assert.equal(
    eventAlbumHref({ event_id: 'E1', slug: null, member_type: 'couple' }),
    '/dashboard/E1/studio/papic',
  );
});

test('vendor + coordinator get NO href from either helper (named, not guessed)', () => {
  for (const member_type of ['vendor', 'coordinator'] as const) {
    assert.equal(eventBoardHref({ event_id: 'E1', slug: 's', member_type }), null);
    assert.equal(eventAlbumHref({ event_id: 'E1', slug: 's', member_type }), null);
  }
});

test('every member_type is answered — no silent ELSE branch', () => {
  for (const member_type of MEMBER_TYPES) {
    const stance = eventStance(member_type);
    assert.ok(
      stance === 'organiser' || stance === 'invited' || stance === null,
      `unhandled stance for ${member_type}`,
    );
    assert.ok(stanceClosedReason(member_type).length > 0);
  }
});

test('an invited person is never told to ask to be added — they already were', () => {
  const invited = stanceClosedReason('guest');
  assert.ok(
    !/ask an organizer to add you/i.test(invited),
    `an added person must not be told to get added: "${invited}"`,
  );
  assert.match(invited, /invited/i);
});

test('the album href resolves to a PAGE, never a route handler', () => {
  // App Router <Link> prefetches, so a side effect behind a card runs when the
  // card scrolls past. Both static destinations must be page.tsx files.
  for (const rel of [
    'app/dashboard/[eventId]/studio/papic/page.tsx',
    'app/[slug]/page.tsx',
  ]) {
    assert.ok(existsSync(join(WEB, rel)), `destination is not a page: ${rel}`);
  }
  for (const rel of [
    'app/dashboard/[eventId]/studio/papic/route.ts',
    'app/[slug]/route.ts',
  ]) {
    assert.ok(
      !existsSync(join(WEB, rel)),
      `destination resolved to a ROUTE HANDLER, which <Link> would prefetch: ${rel}`,
    );
  }
});

// ───────────────────────────────────────────────────────────────────────────
// LAYER 2 — the four callers, each sliced to the function that decides
// ───────────────────────────────────────────────────────────────────────────

test('SITE 1 · AlbumCard builds no destination of its own', () => {
  const body = sliceFunction(
    'app/dashboard/(account)/library/_components/photos-tab.tsx',
    'AlbumCard',
  );
  assert.ok(
    !body.includes('/dashboard/'),
    'AlbumCard is hand-building a dashboard path again — it renders for ' +
      'member_type=guest too, and that shell admits couples only.',
  );
  assert.ok(
    body.includes('album.href') || /\bhref\b/.test(body),
    'AlbumCard must consume the precomputed href',
  );
  // The consequence, not just the call: a null href must render no <Link>.
  assert.match(
    body,
    /href \?/,
    'AlbumCard must branch on href — an unconditional <Link> is the defect',
  );
});

test('SITE 1 · the album destination comes from eventAlbumHref', () => {
  const body = sliceFunction(
    'app/dashboard/(account)/library/_data/photos-albums.ts',
    'getPhotosAlbums',
  );
  assert.ok(
    body.includes('eventAlbumHref('),
    'the Library album destination must be decided by lib/event-board, not locally',
  );
  // 🪤 The share slug is EFFECTIVELY-PUBLIC-gated; reusing it for navigation
  // would silently strip the link from invited people on unlisted events.
  assert.ok(
    body.includes('addressByEvent'),
    'the card href must use the raw address map, not the share-gated slug map',
  );
  assert.ok(
    !/eventAlbumHref\(\{[^}]*slug:\s*slugByEvent/s.test(body),
    'eventAlbumHref is being fed the SHARE-GATED slug — two questions, two values',
  );
});

test('SITE 2 · the nudge notification does not point at the organiser shell', () => {
  const body = sliceFunction(
    'app/dashboard/[eventId]/alaala/assignments/actions.ts',
    'dispatchNudgeEmail',
  );
  const relatedUrl = body.match(/relatedUrl:.*/)?.[0] ?? '';
  assert.notEqual(relatedUrl, '', 'relatedUrl assignment not found');
  assert.ok(
    !relatedUrl.includes('/dashboard/'),
    `this notification is delivered to the account resolved BY guest_id — by ` +
      `construction an invited person. It must not link into the couple's ` +
      `dashboard. Found: ${relatedUrl}`,
  );
  assert.ok(
    relatedUrl.includes('slug'),
    'the in-app twin must point where the email points: the event page',
  );
});

test('SITE 3 · the samahan Events row links by member_type, not by membership', () => {
  const body = sliceFunction(
    'app/dashboard/(account)/samahan/[communityId]/page.tsx',
    'EventsTab',
  );
  assert.ok(
    body.includes('eventBoardHref('),
    'the row destination must come from lib/event-board.eventBoardHref',
  );
  assert.ok(
    !/href=\{`\/dashboard\//.test(body),
    'the row is hand-building /dashboard/ again — an invited membership 404s there',
  );
  // The arrow MEANS "you can open this". It must follow the href, not the
  // membership — that mismatch is what made the row lie.
  assert.ok(
    !/\bisMember\b/.test(body),
    'isMember answered the wrong question; the row must branch on href',
  );
  // 🪤 Found by mutation: hardcoding the old sentence here passed every other
  // assertion in this file. The LINK was fixed and the COPY still told an
  // invited person to go get herself added — a different wrong answer to the
  // same question, on the same row.
  assert.ok(
    body.includes('stanceClosedReason('),
    'the row must ask lib/event-board for its closed-reason copy — an invited ' +
      'person must not be told to ask to be added, because she already was',
  );
  const hardcoded = body.match(/'Ask an organizer to add you[^']*'/g) ?? [];
  assert.ok(
    hardcoded.length <= 1,
    `the ask-to-be-added sentence is hardcoded ${hardcoded.length} times; it is ` +
      `correct ONLY for a viewer with no membership at all`,
  );
});

test('SITE 3 · the memberships read carries member_type', () => {
  const body = sliceFunction('lib/communities.ts', 'fetchViewerEventMemberships');
  assert.match(
    body,
    /\.select\(\s*'event_id,\s*member_type'\s*\)/,
    'the read must fetch member_type — without it the caller cannot tell an ' +
      'invited membership from an organising one (RLS IS A FLOOR, NOT A SCOPE)',
  );
});

test('SITE 4 · an attended editorial never falls back to the host editor', () => {
  const body = sliceFunction(
    'app/dashboard/(account)/library/_components/editorials-tab.tsx',
    'EditorialCard',
  );
  assert.ok(
    !/publicHref\s*\?\?\s*editorHref/.test(body),
    'the attended branch is falling back to the organiser-only editorial editor ' +
      'again — for a slug-less event that is a guaranteed 404',
  );
  // editorHref must survive for the OWNED branch — this is the assertion that
  // stops the guard from being satisfied by deleting the wrong thing.
  assert.ok(
    body.includes('const editorHref'),
    'the organiser still needs their editor link',
  );
  assert.match(
    body,
    /primaryHref \?/,
    'a null primaryHref must render no <Link> rather than a broken one',
  );
});

test('SITE 4 · the "View editorial" BUTTON is gated too, not just the tile', () => {
  // 🪤 Found by mutation, not by reading: replacing the button's `publicHref ?`
  // test with `true ?` restored the broken link and every other assertion in
  // this file stayed green. The card carries the destination TWICE — the hero
  // tile and the button — exactly as photos-tab did. One gate per rendering
  // site, or the second one is the defect.
  const body = sliceFunction(
    'app/dashboard/(account)/library/_components/editorials-tab.tsx',
    'EditorialCard',
  );
  const hrefBindings = [...body.matchAll(/href=\{([^}]*)\}/g)].map((m) =>
    (m[1] ?? '').trim(),
  );
  assert.ok(hrefBindings.length > 0, 'no href bindings found in EditorialCard');
  for (const binding of hrefBindings) {
    assert.ok(
      !binding.includes('??'),
      `an href binding still falls back with ?? — that is how a guest reaches ` +
        `the organiser-only editor: href={${binding}}`,
    );
  }
  // Every <Link> in this card must sit behind a truthiness test on the value it
  // renders, so a null destination renders text instead of a dead link.
  const linkGuards = body.match(/(publicHref|primaryHref) \?/g) ?? [];
  assert.ok(
    linkGuards.length >= 2,
    `expected BOTH the hero tile and the button to be gated on a non-null ` +
      `destination; found ${linkGuards.length} gate(s)`,
  );
});
