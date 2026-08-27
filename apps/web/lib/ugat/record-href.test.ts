/**
 * record-href.test.ts — a found record opens the record, and a dead href
 * cannot come back.
 *
 * ── WHAT THIS IS GUARDING AGAINST ───────────────────────────────────────────
 * `UgatSearchHit.href` existed, was optional, and had ZERO readers for its
 * whole life: the console rendered each hit as a button that highlighted the
 * generic TYPE node, so searching a shop by name opened the word "Vendors".
 * A field nothing reads cannot be caught by a test that only calls the field's
 * own builder — so this file asserts BOTH halves:
 *
 *   1. every kind resolves to a destination that really exists on disk, and
 *   2. the component actually USES it.
 *
 * 🔑 THE SECOND HALF IS THE ONE THAT WOULD HAVE CAUGHT THE ORIGINAL BUG. A
 * guard that hand-feeds a record into `ugatRecordHref` and checks the string is
 * blind to the wiring being cut — which is exactly the state this code shipped
 * in. The source assertions below fail if the click handler stops reading the
 * href, or if `data.ts` stops building one.
 *
 * ⚠ DESTINATIONS ARE RESOLVED AGAINST THE REAL ROUTE TREE, NOT THE GENERATED
 * MAP. `ADMIN_ROUTES` deliberately EXCLUDES dynamic segments ("not a place, a
 * template" — scan-admin-routes.ts), so two of the five destinations
 * (/admin/users/[userId], /admin/vendors/[vendorProfileId]/edit) are absent
 * from it by design. Checking against it would have passed them by accident
 * while silently failing to check anything.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import {
  UGAT_RECORD_KINDS,
  ugatRecordHref,
  type UgatRecordKind,
  type UgatRecordRef,
} from './record-href';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..', '..');
const ADMIN_ROOT = join(WEB_ROOT, 'app', 'admin');
const CONSOLE_TSX = join(ADMIN_ROOT, 'ugat', '_components', 'ugat-console.tsx');
const DATA_TS = join(HERE, 'data.ts');

/**
 * One sample record per kind. Keyed by `UgatRecordKind`, so a sixth kind fails
 * to compile here until somebody adds a sample — the same forcing function the
 * exhaustive switch gives the implementation.
 */
const SAMPLE: Record<UgatRecordKind, UgatRecordRef> = {
  vendor: { kind: 'vendor', vendorProfileId: '11111111-2222-3333-4444-555555555555' },
  user: { kind: 'user', userId: '66666666-7777-8888-9999-000000000000' },
  event: { kind: 'event', publicId: 'S89E-ABCDEFGHJK', slug: 'ana-at-marco' },
  order: { kind: 'order' },
  taxonomy: { kind: 'taxonomy', tileId: 'photo-video', canonicalService: 'setnayan_photo' },
};

/** Every routable page in the admin tree, as segment arrays. `[x]` = wildcard. */
function adminRoutePatterns(): string[][] {
  const out: string[][] = [];
  const walk = (dir: string, segments: string[]) => {
    if (existsSync(join(dir, 'page.tsx'))) out.push(['admin', ...segments]);
    for (const name of readdirSync(dir)) {
      // `_private` folders and files are not routes; nor is anything hidden.
      if (name.startsWith('_') || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      walk(full, [...segments, name]);
    }
  };
  walk(ADMIN_ROOT, []);
  return out;
}

const PATTERNS = adminRoutePatterns();

/** The path half of an href — the query string is not part of the route. */
function bareSegments(href: string): string[] {
  const path = href.split('?')[0]?.split('#')[0] ?? '';
  return path.split('/').filter(Boolean);
}

function resolvesToARealPage(href: string): boolean {
  const got = bareSegments(href);
  return PATTERNS.some(
    (pattern) =>
      pattern.length === got.length &&
      pattern.every((seg, i) => (seg.startsWith('[') && seg.endsWith(']')) || seg === got[i]),
  );
}

test('the route scan found the admin tree at all', () => {
  // A resolver that silently found nothing would pass every "does not resolve"
  // assertion below by making the haystack empty — an empty list is not an
  // answer. Both anchors are real pages that must always exist.
  assert.ok(PATTERNS.length > 50, `only ${PATTERNS.length} admin pages found — the scan collapsed`);
  assert.ok(resolvesToARealPage('/admin/users/abc'), 'the [userId] page did not resolve');
  assert.ok(resolvesToARealPage('/admin/money'), '/admin/money did not resolve');
  assert.ok(!resolvesToARealPage('/admin/nonsense-page-xyz'), 'the resolver accepts anything');
});

test('EVERY record kind has a destination, and it is a page that exists', () => {
  const missing: string[] = [];
  for (const kind of UGAT_RECORD_KINDS) {
    const href = ugatRecordHref(SAMPLE[kind]);
    assert.ok(href.length > 0, `${kind}: empty href`);
    assert.ok(href.startsWith('/'), `${kind}: "${href}" is not site-relative`);
    if (!resolvesToARealPage(href)) missing.push(`${kind} -> ${href}`);
  }
  assert.deepEqual(missing, [], `record kinds pointing at a page that does not exist: ${missing}`);
});

test('a kind with no destination is a compile error AND a thrown one', () => {
  // The `never` arm. Reaching it in TypeScript is impossible, which is the
  // point; this proves the runtime half is real rather than decorative.
  assert.throws(
    () => ugatRecordHref({ kind: 'papic-clip' } as unknown as UgatRecordRef),
    /no destination for/,
    'an unknown kind returned a destination instead of throwing',
  );
});

test('the destinations are per-RECORD, not the list page', () => {
  // The original bug was not a missing href — it was an href pointing at a list.
  // Four of the five did. These are the exact strings that used to ship.
  const wasAList: Record<string, string> = {
    user: '/admin/users',
    taxonomy: '/admin/taxonomy',
  };
  for (const [kind, listHref] of Object.entries(wasAList)) {
    const href = ugatRecordHref(SAMPLE[kind as UgatRecordKind]);
    assert.notEqual(href, listHref, `${kind} fell back to the list page ${listHref}`);
  }
  // The two that name the record in the PATH must carry the id given to them.
  assert.match(ugatRecordHref(SAMPLE.vendor), /11111111-2222-3333-4444-555555555555/);
  assert.match(ugatRecordHref(SAMPLE.user), /66666666-7777-8888-9999-000000000000/);
  // The two that name it in a QUERY must carry the term, encoded.
  assert.match(ugatRecordHref(SAMPLE.event), /[?&]q=S89E-ABCDEFGHJK/);
  assert.match(ugatRecordHref(SAMPLE.taxonomy), /[?&]open=photo-video/);
});

test('a taxonomy leaf with no tile still opens somewhere real', () => {
  const href = ugatRecordHref({
    kind: 'taxonomy',
    tileId: null,
    canonicalService: 'setnayan_photo',
  });
  assert.ok(resolvesToARealPage(href), `${href} does not resolve`);
  assert.match(href, /[?&]q=setnayan_photo/);
});

test('an event with neither a public id nor a slug still opens somewhere real', () => {
  const href = ugatRecordHref({ kind: 'event', publicId: null, slug: null });
  assert.ok(resolvesToARealPage(href), `${href} does not resolve`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE WIRING. Everything above passes with the href unread — which is exactly
   how this shipped. These read the real files.
   ═══════════════════════════════════════════════════════════════════════════ */

test('the search hit is a link to the record, and nothing highlights a type node', () => {
  const src = stripComments(readFileSync(CONSOLE_TSX, 'utf8'));

  const usesHref = (src.match(/href=\{h\.href\}/g) ?? []).length;
  assert.equal(usesHref, 1, `expected the hit to render href={h.href} once, found ${usesHref}`);

  // The defect, by name. If either of these comes back, a hit stopped opening
  // its record and went back to opening a diagram of its own type.
  const openRecord = (src.match(/onOpenRecord/g) ?? []).length;
  assert.equal(openRecord, 0, `onOpenRecord is back in the omnibox (${openRecord} references)`);
  const typeNodeOnHit = (src.match(/h\.typeNodeId/g) ?? []).length;
  assert.equal(typeNodeOnHit, 0, `a hit is reading typeNodeId again (${typeNodeOnHit})`);
});

test('the table row opens its own record instead of throwing the id away', () => {
  const src = stripComments(readFileSync(CONSOLE_TSX, 'utf8'));
  const usesRowHref = (src.match(/r\.href/g) ?? []).length;
  assert.ok(
    usesRowHref >= 2,
    `the row must test AND use r.href; found ${usesRowHref} reference(s)`,
  );
  // The fallback for the three tables with no admin page of their own must
  // survive — deleting it would strand services / threads / samahan rows.
  assert.match(
    src,
    /onRowOpen\(TYPE_NODE\[r\.type\]\)/,
    'the type-card fallback for tables with no record page is gone',
  );
});

test('every search hit is built through the resolver, and href is REQUIRED', () => {
  const src = stripComments(readFileSync(DATA_TS, 'utf8'));

  // Five hit kinds + four table kinds that have a record page.
  const built = (src.match(/ugatRecordHref\(/g) ?? []).length;
  assert.ok(built >= 5, `only ${built} destinations are built through the resolver`);

  // The structural guarantee. Optional again = a hit can ship with nowhere to
  // go, which is the whole defect, and the compiler stops complaining about it.
  assert.match(
    src,
    /export interface UgatSearchHit\b[\s\S]*?\bhref: string;/,
    'UgatSearchHit.href is no longer a required string',
  );
  assert.doesNotMatch(
    src,
    /export interface UgatSearchHit\b[\s\S]*?\bhref\?:/,
    'UgatSearchHit.href went back to being optional',
  );

  // The list pages the hrefs used to point at must not creep back in as
  // literals beside the resolver.
  for (const listHref of ["'/admin/users'", "'/admin/taxonomy'", "'/admin/payments'"]) {
    assert.ok(
      !src.includes(`href: ${listHref}`),
      `a hit or row went back to the list page ${listHref}`,
    );
  }
});
