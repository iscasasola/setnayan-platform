/**
 * ⭐ TWO FINISHED PAGES NOBODY COULD REACH, AND THREE LINKS THAT WENT NOWHERE.
 *
 * A feature audit found the same defect three times over on the guest side:
 *
 *   (a) `/[slug]/venue` — the 3D walk-through of the reception. Shipped, working,
 *       and NOTHING in the entire product linked to it. Only a guest who typed
 *       the address by hand would ever see it.
 *   (b) `/[slug]/pabuya` — the money-gift page (the digital money dance). Its one
 *       inbound link lived inside the COUPLE'S OWN DASHBOARD, which no guest
 *       opens. From a guest's side it did not exist.
 *   (c) the three cross-phase links at the foot of the post-wedding editorial,
 *       all three `href="#"`. ⚠ The third of them, "Watch the Film", looked like
 *       a link to a page that was never built. It is not — the film is a SECTION
 *       OF THAT SAME PAGE, and it simply had no `id` to scroll to. Deleting it
 *       would have removed a working destination. Check what a dead link NAMES
 *       before deciding it has nowhere to go.
 *
 * 🔑 THE RULE THIS FILE ENFORCES: **a doorway is gated on what the DESTINATION
 * demands, not on whether the route exists.** Both pages are reachable-but-
 * refusing in ordinary conditions — `/venue` says "the 3D venue isn't ready yet"
 * until the couple publishes the floor plan, `/pabuya` says "hasn't set up
 * e-gifts yet" until a destination is enabled. Linking without those checks
 * would trade an invisible page for a visible dead end, and a guest who is
 * turned away once stops tapping.
 *
 * Tested from three directions, because a pure function nobody calls is worth
 * nothing and a call site with the wrong facts is worse than none:
 *
 *   1. DECISION — the resolver draws each door only under the destination's own
 *                 conditions, and carries the personal token that makes the 3D
 *                 room show THIS guest's seat.
 *   2. WIRING   — the hub actually mounts both doors AND reads each gate fact
 *                 from the same source the destination reads it from.
 *   3. NO DEAD  — the editorial has no `href="#"` left anywhere in it.
 *      LINKS
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveGuestDoorways,
  type DoorwayInput,
} from '../app/[slug]/_lib/site-nav';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8');

/** Everything open: a published seating plan and a live, stocked money-gift page. */
function bothOpen(over: Partial<DoorwayInput> = {}): DoorwayInput {
  return {
    slug: 'cale-ice',
    guestToken: null,
    seatingSurfaceEnabled: true,
    seatingPublished: true,
    pabuyaRouteEnabled: true,
    enabledEgiftCount: 2,
    // The money-gift page's OWN visibility gate, which is not the one the
    // surfaces drawing this card apply. See doorways-before-the-day.test.ts.
    pabuyaViewerAllowed: true,
    ...over,
  };
}

// ── 1 · DECISION ────────────────────────────────────────────────────────────

test('both doors open when both destinations would let the guest in', () => {
  const d = resolveGuestDoorways(bothOpen());
  assert.equal(d.venueWalk, '/cale-ice/venue');
  assert.equal(d.pabuya, '/cale-ice/pabuya');
});

test('the 3D room carries the guest personal token — that is what shows THEIR seat', () => {
  const d = resolveGuestDoorways(bothOpen({ guestToken: 'abc123' }));
  assert.equal(d.venueWalk, '/cale-ice/venue?t=abc123');
});

test('a token with URL-hostile characters is encoded, never pasted raw', () => {
  const d = resolveGuestDoorways(bothOpen({ guestToken: 'a b&c=d' }));
  assert.equal(d.venueWalk, '/cale-ice/venue?t=a%20b%26c%3Dd');
});

test('a blank token is treated as no token, not as `?t=`', () => {
  assert.equal(resolveGuestDoorways(bothOpen({ guestToken: '   ' })).venueWalk, '/cale-ice/venue');
  assert.equal(resolveGuestDoorways(bothOpen({ guestToken: '' })).venueWalk, '/cale-ice/venue');
});

test('an UNPUBLISHED floor plan draws NO 3D door — the page would refuse the guest', () => {
  // This is the whole point. The route exists and returns 200; it just says
  // "the 3D venue isn't ready yet". A link to that is worse than no link.
  assert.equal(resolveGuestDoorways(bothOpen({ seatingPublished: false })).venueWalk, null);
});

test('an event type WITHOUT seating draws no 3D door', () => {
  // public_venue_scene asks event_type_profiles the same question and answers
  // {published:false} when seating is not one of the type's surfaces.
  assert.equal(
    resolveGuestDoorways(bothOpen({ seatingSurfaceEnabled: false })).venueWalk,
    null,
  );
});

test('the money-gift door stays shut while the rollout switch is off', () => {
  // PABUYA_PUBLIC_ROUTE_ENABLED unset ⇒ the route notFound()s. A door onto a 404
  // is the exact defect being fixed, inverted.
  assert.equal(resolveGuestDoorways(bothOpen({ pabuyaRouteEnabled: false })).pabuya, null);
});

test('the money-gift door stays shut when the couple has enabled NOTHING', () => {
  // The page renders "hasn't set up e-gifts yet". That is an apology, not a page.
  assert.equal(resolveGuestDoorways(bothOpen({ enabledEgiftCount: 0 })).pabuya, null);
});

test('one enabled destination is enough to open the money-gift door', () => {
  assert.equal(resolveGuestDoorways(bothOpen({ enabledEgiftCount: 1 })).pabuya, '/cale-ice/pabuya');
});

test('the two doors are independent — neither drags the other open or shut', () => {
  const onlyVenue = resolveGuestDoorways(bothOpen({ pabuyaRouteEnabled: false }));
  assert.ok(onlyVenue.venueWalk);
  assert.equal(onlyVenue.pabuya, null);

  const onlyPabuya = resolveGuestDoorways(bothOpen({ seatingPublished: false }));
  assert.equal(onlyPabuya.venueWalk, null);
  assert.ok(onlyPabuya.pabuya);
});

test('no slug means no doors — we will not build `/null/venue`', () => {
  for (const slug of [null, undefined, '', '   ']) {
    const d = resolveGuestDoorways(bothOpen({ slug }));
    assert.equal(d.venueWalk, null, `slug ${JSON.stringify(slug)} produced a venue href`);
    assert.equal(d.pabuya, null, `slug ${JSON.stringify(slug)} produced a pabuya href`);
  }
});

// ── 2 · WIRING ──────────────────────────────────────────────────────────────
//
// The hub page is an async server component that reads the database on every
// render, so it is asserted as SOURCE. What matters is not that the strings are
// present but that each gate fact comes from the reader the destination itself
// uses — the failure mode here is a doorway drawn from a cheaper, differently-
// permitted query that disagrees with the page behind it.

const HUB = '../app/[slug]/hub/page.tsx';
/** Comments are not wiring. Read the code, not the prose describing it. */
const hubSource = () => stripComments(read(HUB));

test('WIRING — the hub mounts BOTH doors, each gated on its OWN resolved href', () => {
  const hub = hubSource();
  assert.ok(hub.includes('resolveGuestDoorways('), 'the hub stopped resolving the doorways');
  // Presence of the string is not enough — a door whose href is still read but
  // whose condition has been swapped for anything else is a door nobody sees.
  // Assert the CONDITION and the HREF are the same resolved value.
  for (const key of ['venueWalk', 'pabuya'] as const) {
    assert.ok(
      new RegExp(`\\{doorways\\.${key} \\? \\(`).test(hub),
      `the ${key} door is not rendered under its own condition`,
    );
    assert.ok(
      new RegExp(`href=\\{doorways\\.${key}\\}`).test(hub),
      `the ${key} door does not link to its resolved destination`,
    );
  }
});

test('WIRING — the 3D door is gated on the floor plan being PUBLISHED', () => {
  const hub = hubSource();
  assert.ok(
    hub.includes('eventSeatingPublished('),
    'the hub must ask whether the couple published the plan — the RPC own gate',
  );
  assert.ok(
    /surfaceEnabled\(eventTypeProfile, 'seating'\)/.test(hub),
    "the hub must ask whether this event type has seating at all",
  );
});

test('WIRING — the money-gift door is gated on the switch AND on enabled rows', () => {
  const hub = hubSource();
  assert.ok(hub.includes('isPabuyaPublicRouteEnabled('), 'the rollout switch is not consulted');
  assert.ok(
    /fetchEgiftMethods\(\s*admin,\s*event\.event_id,\s*\{\s*enabledOnly:\s*true\s*\}\s*\)/.test(hub),
    'the count must come from the SAME reader + filter the public page uses',
  );
});

test('WIRING — the personal token is handed to the 3D room', () => {
  const hub = hubSource();
  assert.ok(
    /guestToken:\s*guest\?\.qr_token/.test(hub),
    'without the token the 3D room cannot show this guest their own seat',
  );
});

// ── 3 · NO DEAD LINKS ───────────────────────────────────────────────────────

/**
 * Comments talk ABOUT the dead links (this fix documents them at length), so a
 * naive substring scan reports its own explanation as a defect. Strip block
 * comments — which covers JSDoc and JSX `{/* … *␀/}` alike — then drop whole-line
 * `//` comments. `//` is only treated as a comment at the start of a trimmed
 * line, so a `https://` inside real markup can never eat the rest of that line.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

test('the editorial has no `href="#"` left — that is what the three dead links were', () => {
  const editorial = stripComments(
    read('../app/[slug]/_components/editorial/editorial-content.tsx'),
  );
  const dead = editorial.split('\n').filter((l) => l.includes('href="#"'));
  assert.deepEqual(dead, [], `dead links still in the editorial:\n${dead.join('\n')}`);
});

test('the dead-link scan can still SEE a dead link (the guard is not vacuous)', () => {
  // 🪤 A guard that cannot go red is worse than no guard. Feed the scan the
  // exact shape it is hunting and prove it catches it.
  const planted = stripComments(
    ['<a href="#" className="x">The Invitation (RSVP)</a>', '// href="#" in a comment'].join('\n'),
  );
  assert.ok(planted.includes('href="#"'), 'the scan would not notice a real dead link');
  assert.equal(
    planted.split('\n').filter((l) => l.includes('href="#"')).length,
    1,
    'the scan must see the markup and ignore the comment',
  );
});

test('the editorial cross-phase links point at destinations that exist', () => {
  const editorial = read('../app/[slug]/_components/editorial/editorial-content.tsx');
  assert.ok(editorial.includes('href={`/${slug}`}'), 'the RSVP link lost its destination');
  assert.ok(editorial.includes('href={`/${slug}/hub`}'), 'the wedding-day link lost its destination');
  // The third link's destination was never missing — "Watch the Film" is a
  // SECTION OF THIS PAGE (the Live Studio broadcast replay). It had no id to
  // aim at, so the anchor and the section must be named from ONE constant;
  // two hand-typed strings would drift apart with CI still green.
  assert.ok(
    editorial.includes("const WATCH_FILM_ANCHOR_ID = 'watch-the-film'"),
    'the film anchor id is no longer declared in one place',
  );
  assert.ok(
    editorial.includes('id={WATCH_FILM_ANCHOR_ID}'),
    'the film SECTION lost the id the footer link scrolls to',
  );
  assert.ok(
    editorial.includes('href={`#${WATCH_FILM_ANCHOR_ID}`}'),
    'the film LINK is not aimed at the section id',
  );
});

test('each editorial footer link is drawn only when its destination is really there', () => {
  const editorial = read('../app/[slug]/_components/editorial/editorial-content.tsx');
  // A curated sample has no event row ⇒ no slug ⇒ no route links. An edition
  // where the couple never broadcast has no film section ⇒ no film link. The
  // footer getting shorter is the correct behaviour; a dead link is not.
  assert.ok(
    /\{slug \|\| watchFilmShown \?/.test(editorial),
    'the footer link row must not render when nothing in it has a destination',
  );
  // 🪤 Checking that the CONDITION appears somewhere is not checking that the
  // LINK is under it — `{slug || watchFilmShown ?` on the row above already
  // contains that substring, so a looser assertion passes while the film link
  // renders unconditionally. Each anchor is matched together with the guard
  // immediately above it.
  const guardedBy = (cond: string, href: string) =>
    new RegExp(`\\{${cond} \\?\\s*\\(\\s*<a\\s+href=\\{${href}\\}`).test(editorial);
  assert.ok(
    guardedBy('watchFilmShown', '`#\\$\\{WATCH_FILM_ANCHOR_ID\\}`'),
    'the film link is not guarded by the film section actually rendering',
  );
  assert.ok(guardedBy('slug', '`/\\$\\{slug\\}`'), 'the RSVP link is not guarded by the slug');
  assert.ok(
    guardedBy('slug', '`/\\$\\{slug\\}/hub`'),
    'the wedding-day link is not guarded by the slug',
  );
  // ONE resolution of "did the film section render", shared by the section and
  // the link. Deriving it twice is how a footer link scrolls to nothing.
  const decls = editorial.match(/const watchFilmShown =/g) ?? [];
  assert.equal(decls.length, 1, 'watchFilmShown must be resolved exactly once');
});
