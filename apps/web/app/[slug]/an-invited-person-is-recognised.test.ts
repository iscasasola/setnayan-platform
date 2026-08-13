/**
 * an-invited-person-is-recognised.test.ts — a person the couple put on the guest
 * list is not asked to prove it again, and the card that offers it has no side
 * effect.
 *
 * ─── WHAT THIS PROTECTS ─────────────────────────────────────────────────────
 * Guest identity on a public event page is a cookie with a HARD 60-day life
 * carrying exactly ONE `event_id`, and no sliding refresh. Save-the-dates go out
 * 6–12 months ahead, so the ORDINARY invited guest had no live session by the
 * wedding day and met `PrivateLanding` — *"Already invited? …scan your invitation
 * QR"* — addressed to somebody whose membership row we are holding. The page's
 * visibility gate now also admits a signed-in person holding a seat on that
 * event.
 *
 * ─── 🚨 AND THE FIRST ATTEMPT AT THIS WAS WORSE THAN THE PROBLEM ────────────
 * It pointed the invited board card at a `/{slug}/enter` GET route handler that
 * MINTED the guest cookie. A Next.js `<Link>` PREFETCHES its href, so a card
 * merely scrolling into view executed the mint — and because the cookie holds one
 * event, somebody invited to two weddings had it silently rewritten by looking at
 * their own board: standing at wedding A, B's card comes into view, and back at A
 * they are a stranger. **The exact lock-out the change existed to end.**
 *
 * This repo had already written the rule down, for sign-out:
 *   front-door-shell.tsx — "⚠ SIGN OUT IS A FORM, NOT A LINK … It would also be
 *   prefetchable, i.e. a row that can sign you out by being NEAR the pointer."
 *
 * 🔑 SO THE FIRST TEST BELOW IS THE GENERAL RULE, NOT THE SPECIFIC BUG: every
 * destination `eventBoardHref` can produce is resolved to a file on disk and must
 * be a `page.tsx`. A `route.ts` is forbidden outright — no reasoning about
 * whether *this* handler happens to be side-effect-free, because the next one
 * will not be.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { daysUntilEventDay, eventBoardHref } from '@/lib/event-board';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/web/app/[slug]
const APP = resolve(HERE, '..');
const WEBROOT = resolve(APP, '..');
const SLUG_PAGE = resolve(HERE, 'page.tsx');
const SEAT_LOOKUP = resolve(WEBROOT, 'lib', 'guest-membership-session.ts');
const CONNECT_ROUTE = resolve(APP, 'join', '[eventId]', 'connect', 'route.ts');
const LAUNCHER = resolve(APP, 'dashboard', '(launcher)', 'page.tsx');
const AUTOSURFACE = resolve(WEBROOT, 'lib', 'account-autosurface.ts');
const ACCOUNT_LINK = resolve(WEBROOT, 'lib', 'event-account-link.ts');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

function count(src: string, re: RegExp): number {
  return (src.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) ?? [])
    .length;
}

/** Resolve an app-relative href to the file Next.js would serve it from. */
function servedBy(href: string): { page: string; route: string; tail: string[] } {
  const segments = href.split('/').filter(Boolean);
  // The first segment of a board href is either a literal directory
  // (`dashboard`) or an event's own slug, which maps to the [slug] segment.
  const first = existsSync(resolve(APP, segments[0] ?? '')) ? segments[0]! : '[slug]';
  const tail = existsSync(resolve(APP, segments[0] ?? '')) ? segments.slice(1) : segments.slice(1);
  const base = resolve(APP, first, ...tail);
  return { page: resolve(base, 'page.tsx'), route: resolve(base, 'route.ts'), tail };
}

// ── 1 · THE GENERAL RULE: A CARD'S DESTINATION IS A PAGE, NEVER A HANDLER ────

test('no destination a board card can produce is a route handler', () => {
  // Every value eventBoardHref returns becomes the href of a <Link>, and App
  // Router prefetches those. A handler behind a card RUNS when the card scrolls
  // past. This forbids the shape, not one instance of it.
  const cases = [
    { event_id: 'e1', slug: 'maria-and-jose', member_type: 'guest' as const },
    { event_id: 'e1', slug: 'cale-ice', member_type: 'couple' as const },
  ];
  for (const c of cases) {
    const href = eventBoardHref(c);
    assert.ok(href, `No destination for ${c.member_type}.`);
    const { page, route, tail } = servedBy(href);
    assert.ok(
      !existsSync(route),
      `A board card points at "${href}", which is served by a ROUTE HANDLER ` +
        `(${route}). <Link> prefetches, so that handler runs when the card merely ` +
        'scrolls into view — the defect that silently rewrote which wedding a ' +
        "guest's single session named. Point cards at pages; put side effects " +
        'behind a form.',
    );
    // …and something must actually serve it. A destination nothing serves is the
    // "never proven reachable" defect with a URL in front of it.
    const dynamicOk = tail.length === 0 || existsSync(page);
    assert.ok(
      dynamicOk || existsSync(resolve(APP, '[slug]', 'page.tsx')),
      `Nothing serves "${href}".`,
    );
  }
});

test('the invited card opens the event\'s own public page', () => {
  assert.equal(
    eventBoardHref({ event_id: 'e1', slug: 'maria-and-jose', member_type: 'guest' }),
    '/maria-and-jose',
  );
  assert.equal(
    eventBoardHref({ event_id: 'e1', slug: 'x', member_type: 'couple' }),
    '/dashboard/e1',
  );
});

test('an invited event with no public page yet still gets NO link', () => {
  for (const slug of [null, undefined, '   ']) {
    assert.equal(
      eventBoardHref({ event_id: 'e1', slug, member_type: 'guest' }),
      null,
      `slug ${JSON.stringify(slug)} must yield null, never "/null".`,
    );
  }
});

// ── 2 · THE GATE ON THE PAGE ────────────────────────────────────────────────

test("the event page admits a signed-in person holding a seat", () => {
  const src = read(SLUG_PAGE);
  assert.match(
    src,
    /isSeatHolder =\s*\(await findGuestSeatForUser\(event\.event_id, user\.id\)\) !== null;/,
    'The private gate no longer consults the seat. Every invited guest whose ' +
      '60-day cookie lapsed is told to scan a QR again — on a page they are on ' +
      'the guest list for.',
  );
  assert.match(
    src,
    /if \(!guestSessionMatches && !isAuthedHost && !isSeatHolder\) \{/,
    'The seat check exists but the refusal does not honour it — the same trap ' +
      'with an extra variable.',
  );
});

test('the seat lookup MINTS NOTHING — the side effect is gone, not moved', () => {
  const src = readFileSync(SEAT_LOOKUP, 'utf8');
  assert.equal(
    count(stripComments(src), /setGuestSession/),
    0,
    'The seat lookup writes a session again. It is called from a PAGE RENDER ' +
      '(which cannot set cookies) and previously from a link-reachable handler ' +
      '(which prefetch executed). Neither may write.',
  );
  assert.ok(
    !existsSync(resolve(HERE, 'enter', 'route.ts')),
    'The /{slug}/enter route handler is back. A <Link>-reachable GET that mints ' +
      "a guest session rewrites which event a person's single cookie names when " +
      'a card scrolls past.',
  );
});

test('the seat lookup is scoped to the signed-in user and to a GUEST seat', () => {
  const src = read(SEAT_LOOKUP);
  assert.match(
    src,
    /\.eq\('user_id', userId\)/,
    'The lookup no longer narrows to the signed-in user — it would admit a viewer ' +
      "to somebody else's private event.",
  );
  assert.match(
    src,
    /\.eq\('member_type', 'guest'\)/,
    'The lookup accepts any member_type.',
  );
  assert.match(
    src,
    /\.not\('guest_id', 'is', null\)/,
    'The lookup accepts an UNBOUND membership, which names no seat.',
  );
});

test('leaving, and being removed, both close the door', () => {
  const src = read(SEAT_LOOKUP);
  assert.match(
    src,
    /\.is\('hidden_at', null\)/,
    "The person's own opt-out (Leave) no longer closes this door.",
  );
  assert.match(
    src,
    /\.is\('deleted_at', null\)/,
    'A seat the HOST removed still opens this door. That is the eviction path, ' +
      'and it is the reason admitting a seat-holder is safe at all.',
  );
});

test('a rejected read fails CLOSED, and is never mistaken for "no seat"', () => {
  const src = read(SEAT_LOOKUP);
  assert.match(
    src,
    /if \(membershipError \|\| !membership\?\.guest_id\) return null;/,
    'The membership read stopped checking its error. A lost grant would read as ' +
      '"no seat" and silently restore the lock-out.',
  );
  assert.match(
    src,
    /if \(seatError \|\| !seat\?\.qr_token\) return null;/,
    'The seat read stopped checking its error.',
  );
});

// ── 3 · THE FOURTH DOOR THAT SLAMMED, NOW SHUT ──────────────────────────────

test('the emailed sign-in link no longer lands a guest on the organiser dashboard', () => {
  // 🔴 THIS WAS LIVE. connectEventForUser writes member_type='guest', and this
  // route redirected to /dashboard/{eventId}, which admits 'couple' only — so
  // SUCCEEDING sent them to a 404 while FAILING sent them somewhere that worked.
  const src = read(CONNECT_ROUTE);
  assert.equal(
    count(src, /`\/dashboard\/\$\{eventId\}`/),
    0,
    'The magic-link connect route sends a GUEST to /dashboard/{eventId} again — a ' +
      '404 for every person it exists to welcome.',
  );
  assert.match(
    src,
    /dest = `\/\$\{slug\}`/,
    "The connect route no longer sends a connected guest to the event's page.",
  );
  assert.match(
    src,
    /let dest = '\/dashboard';/,
    'The fallback for "no public address yet" is gone. 1 of 5 prod events has a ' +
      'null slug, so this branch is real, not defensive.',
  );
});

// ── 4 · THE GREETING COUNTS WHAT THE BOARD SHOWS ────────────────────────────

test('"set up your first event" cannot print above events you were invited to', () => {
  // Found by the same adversarial pass: `noEvents` read the ORGANISER-only set
  // while the shelves below render the MERGED set. Before invited events reached
  // the board the two were one list and could not contradict each other.
  const src = read(LAUNCHER);
  assert.match(
    src,
    /const noEvents = boardEvents\.length === 0;/,
    'The greeting counts the organiser-only set again, so somebody whose only ' +
      'events are invitations is told to set up their first one — directly above ' +
      'them.',
  );
  assert.match(
    src,
    /activeCount: upcoming\.length,/,
    'The "in motion" tile counts the organiser-only set again, so it reads 0 over ' +
      'a board full of invitations.',
  );
});

// ── 5 · AN AUTO-SURFACED MEMBERSHIP NAMES ITS SEAT ──────────────────────────

test('an auto-surfaced membership records WHICH SEAT it is about', () => {
  // 🎟 It did not. `maybeAutoSurfaceEventForGuest` inserted member_type='guest'
  // with a NULL guest_id, so the seat-holder gate (which requires a non-null
  // guest_id) could never admit it: the "You were added" card and the board's
  // invited card both landed the person on a lock screen telling them to scan an
  // invitation QR they were never sent — for an event a couple had just added
  // them to. `guestId` was a parameter all along.
  assert.match(
    read(AUTOSURFACE),
    /member_type: 'guest',\s*guest_id: guestId,/,
    'The auto-surfaced membership stopped recording its seat. Every card it puts ' +
      'on that board then opens onto a lock screen.',
  );
});

// ── 6 · ONE CLOCK ON THE CARD ───────────────────────────────────────────────

test('the countdown and the shelf reduce "now" with the SAME clock', () => {
  // 🔴 THEY DID NOT, and it was live for the length of one PR: the shelf used
  // Asia/Manila while the countdown used the SERVER clock (UTC on Vercel), so
  // between Manila 00:00 and 08:00 they disagreed by a day and the card read
  // "Tomorrow" ON THE MORNING OF THE WEDDING. Correct on a PH laptop, wrong in
  // production — which is why nobody would have caught it by looking.
  const src = read(LAUNCHER);
  assert.match(
    src,
    /const days = daysUntilEventDay\(event\.event_date, todayISO\);/,
    'The countdown went back to a helper that reduces "now" with the server ' +
      "clock, while the shelf reduces it in the venue's. Two clocks on one card.",
  );
  assert.equal(
    count(src, /daysUntilEvent\(event\.event_date\)/),
    0,
    'The server-clock countdown is back.',
  );
  assert.ok(
    count(src, /todayISO=\{todayISO\}/) >= 5,
    'A card composition stopped being given the board\'s day, so it will fall ' +
      'back to some other clock.',
  );
});

test('the day arithmetic has no ambient timezone to disagree with', () => {
  // Both sides are day STRINGS parsed identically — so this holds whatever TZ
  // the test process runs under, which is the entire point.
  assert.equal(daysUntilEventDay('2026-12-12', '2026-12-12'), 0);
  assert.equal(daysUntilEventDay('2026-12-12', '2026-12-11'), 1);
  assert.equal(daysUntilEventDay('2026-12-11', '2026-12-12'), -1);
  assert.equal(daysUntilEventDay('2027-01-01', '2026-12-31'), 1, 'across a year boundary');
  // Real calendar arithmetic, not a naive ±1: 2028 IS a leap year, so 28 Feb to
  // 1 Mar is TWO days. (My first version of this assertion said 1 and was wrong —
  // the function was right.)
  assert.equal(daysUntilEventDay('2028-02-29', '2028-02-28'), 1, 'the leap day itself');
  assert.equal(daysUntilEventDay('2028-03-01', '2028-02-28'), 2, 'across a leap day');
  assert.equal(daysUntilEventDay('2027-03-01', '2027-02-28'), 1, 'non-leap year');
  assert.equal(daysUntilEventDay(null, '2026-12-12'), null);
  assert.equal(daysUntilEventDay('nonsense', '2026-12-12'), null);
});

// ── 7 · THE BOARD IS REACHABLE FOR SOMEBODY WHO ONLY HAS INVITATIONS ───────

test('a supplier or admin invited to a wedding can still reach the board', () => {
  // The console-user redirect had no hub escape and read the ORGANISER-only set,
  // so a photographer with a shop and no event of her own was bounced to
  // create-event — including when a client had just invited her and a card was
  // waiting on this very board.
  assert.match(
    read(LAUNCHER),
    /if \(active\.length === 0 && hasConsole && !wantsHub && boardEvents\.length === 0\) \{/,
    'The console redirect fires again for somebody whose board is not empty, or ' +
      'ignores an explicit hub request — making the shelves unreachable for them.',
  );
});

// ── 8 · CONNECTING MUST ANSWER THE QUESTION THAT WAS ASKED ──────────────────

test('the cookie path cannot report success for a DIFFERENT wedding', () => {
  // 🚨 It could. `linkGuestSessionToUser` links whatever event the BROWSER's
  // cookie names — not necessarily the eventId asked about — and
  // `guest_already_claimed` links nothing at all; both were returned as
  // `connected: true`. So the couple's "send them a sign-in link" could report a
  // connection it had not made, and the caller then sent the person to an event
  // they hold no seat on.
  const src = read(ACCOUNT_LINK);
  assert.match(
    src,
    /if \(viaCookie\.linked \|\| viaCookie\.reason === 'guest_already_claimed'\) \{[\s\S]{0,400}?\.eq\('event_id', eventId\)/,
    'The cookie path reports success without checking a membership for THIS ' +
      'event. It then claims a connection it may not have made.',
  );
});

// ── 9 · A DEAD CARD SHEDS EVERY AFFORDANCE, NOT TWO NAMED CLASSES ──────────

test('a linkless card keeps no hover affordance either', () => {
  // The first cut stripped `sn-press` and `sn-lift-4` and left
  // `hover:border-mulberry/30`, so a dead card still lit its border under the
  // pointer. A named list is a bill you keep paying.
  const src = read(LAUNCHER);
  assert.match(
    src,
    /const isHoverAffordance = \(c: string\) => c\.startsWith\('hover:'\);/,
    'The hover-variant strip is gone, so a card with nowhere to go lights up ' +
      'under the pointer again.',
  );
  assert.match(
    src,
    /!isHoverAffordance\(c\)/,
    'The hover strip exists but the filter does not use it.',
  );
});
