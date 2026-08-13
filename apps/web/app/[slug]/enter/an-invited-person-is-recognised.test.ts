/**
 * an-invited-person-is-recognised.test.ts — the door the invited card points at
 * must EXIST, must let the right person through, and must let nobody else.
 *
 * ─── WHAT THIS PROTECTS ─────────────────────────────────────────────────────
 * Guest identity on a public event page is a cookie with a HARD 60-day life
 * carrying exactly ONE event id, and no sliding refresh. Save-the-dates go out
 * 6–12 months ahead. So the ORDINARY invited guest is unrecognised on the page
 * by the wedding day, and anyone invited to two events can only be recognised on
 * one at a time. `/{slug}/enter` re-mints their session from the
 * `event_members.guest_id` binding they already earned.
 *
 * Three regressions are possible and all three are silent:
 *   1. the card stops pointing at the hop (guarded next door, in
 *      two-levels-and-the-board.test.ts);
 *   2. the hop's GATES loosen, so somebody who is not that guest gets a cookie
 *      naming that guest;
 *   3. the hop stops existing, or moves, and the card becomes a 404 factory.
 *
 * 🔑 (3) IS THE ONE NOBODY WRITES A TEST FOR, so it is asserted from the HELPER
 * OUTWARD: take the path `eventBoardHref` actually returns and prove a Next.js
 * route file sits at it. A destination nothing serves is the "never proven
 * reachable" defect with a URL in front of it.
 *
 * The gate assertions are source-anchored because the gates ARE query-builder
 * links (`.eq('member_type','guest')`, `.is('deleted_at', null)`) — there is no
 * return value to assert without standing up Postgres, and a mocked client would
 * assert the mock. Each one is anchored to the ACT (the chained call) and was
 * mutation-checked with its occurrence count printed before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { eventBoardHref } from '@/lib/event-board';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE is apps/web/app/[slug]/enter, so two levels up is apps/web/app.
const APP = resolve(HERE, '..', '..');
const ENTER_ROUTE = resolve(HERE, 'route.ts');
const SEAT_LOOKUP = resolve(APP, '..', 'lib', 'guest-membership-session.ts');
const CONNECT_ROUTE = resolve(APP, 'join', '[eventId]', 'connect', 'route.ts');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

function count(src: string, re: RegExp): number {
  return (src.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) ?? [])
    .length;
}

// ── 1 · THE DOOR EXISTS WHERE THE CARD POINTS ───────────────────────────────

test('the path the invited card returns is served by a real route file', () => {
  const href = eventBoardHref({
    event_id: 'e1',
    slug: 'maria-and-jose',
    member_type: 'guest',
  });
  assert.ok(href, 'The invited card has no destination at all.');

  // '/maria-and-jose/enter' -> app/[slug]/enter/route.ts. The FIRST segment is
  // the event's own slug, so it maps to the [slug] dynamic segment; every
  // segment after it must exist literally on disk.
  const segments = href.split('/').filter(Boolean);
  assert.ok(segments.length >= 2, `Unexpected invited href shape: ${href}`);
  const tail = segments.slice(1); // drop the slug
  const routeFile = resolve(APP, '[slug]', ...tail, 'route.ts');
  const pageFile = resolve(APP, '[slug]', ...tail, 'page.tsx');
  assert.ok(
    existsSync(routeFile) || existsSync(pageFile),
    `The invited card points at "${href}" and NOTHING SERVES IT — expected ` +
      `app/[slug]/${tail.join('/')}/route.ts or /page.tsx. Every invited person ` +
      'would get a 404 from their own board.',
  );
});

test('the hop is not a reserved top-level word by accident', () => {
  // It lives UNDER the event's slug, so it needs no new reserved word — and it
  // must stay that way. A top-level `/enter` would be a word a shop could take.
  const href = eventBoardHref({ event_id: 'e1', slug: 'a-wedding', member_type: 'guest' });
  assert.ok(
    href!.startsWith('/a-wedding/'),
    `The hop moved out of the event's own namespace (${href}). A new top-level ` +
      'route word must be added to the reserved list or a business can claim it ' +
      'permanently — the /creators and /open-shop lesson of 2026-08-11.',
  );
});

// ── 2 · THE GATES ───────────────────────────────────────────────────────────

test('the seat lookup is scoped to the signed-in user and to a GUEST seat', () => {
  const src = read(SEAT_LOOKUP);
  assert.match(
    src,
    /\.eq\('user_id', userId\)/,
    'The seat lookup no longer narrows to the signed-in user. It would then hand ' +
      "out a cookie naming somebody else's seat.",
  );
  assert.match(
    src,
    /\.eq\('member_type', 'guest'\)/,
    'The seat lookup accepts any member_type. An organiser would be handed a ' +
      'guest cookie, and a vendor or coordinator a stance they do not have.',
  );
  assert.match(
    src,
    /\.not\('guest_id', 'is', null\)/,
    'The lookup accepts an UNBOUND membership. Such a row names no seat, so there ' +
      'is nothing legitimate to re-mint from.',
  );
});

test('leaving, and being removed, both close the door', () => {
  const src = read(SEAT_LOOKUP);
  assert.match(
    src,
    /\.is\('hidden_at', null\)/,
    "The person's own opt-out (Leave) no longer closes this door — they would be " +
      're-admitted to an event they left.',
  );
  assert.match(
    src,
    /\.is\('deleted_at', null\)/,
    'A seat the HOST removed still opens this door. That is the eviction path for ' +
      'a bound account, and it is the reason re-minting is safe at all.',
  );
});

test('a rejected read fails CLOSED, and is never mistaken for "no seat"', () => {
  // A REJECTED QUERY IS NOT A THROWN ERROR — Supabase resolves with { error }.
  // Without these checks a lost grant or a phantom column reads as "this person
  // has no seat" and silently restores the lock-out this module exists to end.
  const src = read(SEAT_LOOKUP);
  assert.match(
    src,
    /if \(membershipError \|\| !membership\?\.guest_id\) return null;/,
    'The membership read stopped checking its error.',
  );
  assert.match(
    src,
    /if \(seatError \|\| !seat\?\.qr_token\) return null;/,
    'The seat read stopped checking its error.',
  );
});

test('the session is minted with the CURRENT token, so rotation still bites', () => {
  const src = read(SEAT_LOOKUP);
  assert.match(
    src,
    /\.select\('guest_id, qr_token, events:event_id \( slug \)'\)/,
    'The lookup no longer reads the live qr_token. A stale token would put the ' +
      'minted cookie permanently at odds with GUEST_SESSION_TOKEN_CHECK, which ' +
      'compares it against the database.',
  );
  assert.match(
    read(ENTER_ROUTE),
    /qr_token: seat\.qrToken/,
    'The route mints a session without the seat\'s current token.',
  );
});

// ── 3 · THE ROUTE'S OWN REFUSALS ────────────────────────────────────────────

test('the route requires a signed-in account', () => {
  const src = read(ENTER_ROUTE);
  assert.match(src, /if \(!user\) \{/, 'The sign-in requirement is gone.');
  assert.match(
    src,
    /new URL\('\/login', url\.origin\)/,
    'A signed-out visitor is no longer sent to sign in.',
  );
});

test('no caller text is ever echoed into a redirect', () => {
  // The open redirect this route's SIBLING shipped to live prod: a slug of
  // `/example.com` becomes `//example.com`, which is protocol-relative, and the
  // browser leaves the site. Same guard, same file shape.
  const src = read(ENTER_ROUTE);
  assert.match(
    src,
    /const SAFE_SLUG = \/\^\[a-z0-9\]\[a-z0-9-\]\{0,99\}\$\//,
    'The slug allowlist is gone. Without it this route is a phishing primitive ' +
      'sent to people we trained to tap invitation links.',
  );
  assert.match(
    src,
    /if \(!slugIsSafe\) return NextResponse\.redirect\(new URL\('\/', url\.origin\)\)/,
    'An unsafe slug is no longer sent to the site root.',
  );
  assert.equal(
    count(src, /redirect\(new URL\(`\/\$\{slug\}`/),
    0,
    'The route builds a redirect from the QUERY-derived slug again. Every target ' +
      "after the event resolves must use the DATABASE's own spelling.",
  );
});

test('a person with no seat lands on the page a direct visit gives them', () => {
  const src = read(ENTER_ROUTE);
  assert.match(
    src,
    /if \(!seat\) \{\s*return NextResponse\.redirect\(new URL\(`\/\$\{event\.slug\}`, url\.origin\)\);/,
    'A viewer with no seat no longer falls back to the public page. Turning a ' +
      'refusal into a 404 discloses that the event exists; turning it into an ' +
      'admission is worse.',
  );
});

test('a renamed address still opens', () => {
  assert.match(
    read(ENTER_ROUTE),
    /resolveRenamedEventSlug\(admin, slug\)/,
    'The hop lost its forwarding. A bookmarked or shared link to a renamed event ' +
      'would dead-end — the same "wired into the obvious routes but not the ones ' +
      'carrying the real artefacts" miss that cost the printed QR its seat.',
  );
});

// ── 4 · THE FOURTH DOOR THAT SLAMMED, NOW SHUT ──────────────────────────────

test('the emailed sign-in link no longer lands a guest on the organiser dashboard', () => {
  // 🔴 THIS WAS LIVE. connectEventForUser writes member_type='guest', and this
  // route redirected to /dashboard/{eventId}, which admits 'couple' only — so
  // SUCCEEDING sent them to a 404 while FAILING sent them somewhere that worked.
  // Reachable from four shipped call sites, one of them the couple's own guest
  // list ("send them a sign-in link").
  const src = read(CONNECT_ROUTE);
  assert.equal(
    count(src, /`\/dashboard\/\$\{eventId\}`/),
    0,
    'The magic-link connect route sends a GUEST to /dashboard/{eventId} again. ' +
      'That layout admits organisers only: it is a 404 for every person this ' +
      'route exists to welcome.',
  );
  assert.match(
    src,
    /dest = `\/\$\{slug\}\/enter`/,
    'The connect route no longer hands a connected guest to the recognition hop.',
  );
  assert.match(
    src,
    /let dest = '\/dashboard';/,
    'The fallback for "no public address yet" is gone. 1 of 5 prod events has a ' +
      'null slug, so this branch is real, not defensive.',
  );
});
