/**
 * ⭐ THE DOORS WERE BUILT ON THE ONE SURFACE NOBODY CAN REACH IN TIME.
 *
 * Three faults, all on the guest side, all confirmed against shipped code
 * before a line was written:
 *
 *  1. THE 3D ROOM AND THE MONEY-GIFT PAGE ARE ONLY REACHABLE ONCE IT IS TOO
 *     LATE. Both got cards on the day-of hub — and the only link to that hub
 *     appears when the wedding is LIVE or OVER. The 3D card's own copy reads
 *     "Look around the reception BEFORE YOU ARRIVE", printed on a surface you
 *     cannot open until you have arrived.
 *
 *  2. NOTHING EVER SAID "WE'LL BE STREAMING". The broadcast is loaded and
 *     rendered only inside the live window, so a relative overseas could not
 *     learn a livestream existed until it had already started — the one moment
 *     the news is no longer useful to them.
 *
 *  3. 🚨 AND THE MONEY-GIFT DOOR IS DRAWN UNDER A LAXER RULE THAN THE PAGE
 *     BEHIND IT ENFORCES. `/[slug]/pabuya` asks `canViewSlugEvent` against the
 *     RAW `events.landing_page_visibility` column. Both surfaces that draw its
 *     card decide what THEY render from `resolveEffectiveVisibility`, which
 *     additionally reports 'public' the instant a SCHEDULED launch falls due —
 *     before anything has written the column (that write is deferred to an
 *     `after()` task which is allowed to fail). In that window a stranger reads
 *     a fully public wedding page, taps "Send a blessing", and is redirected
 *     straight back to where they started with no explanation.
 *
 * 🔑 THE RULE, UNCHANGED FROM finished-pages-need-doorways.test.ts AND APPLIED
 * ONE LAYER FURTHER: a doorway is gated on what the DESTINATION demands. Fault
 * 3 is what happens when that is checked once and then quietly diverges — the
 * gate did not move, the surface's own gate did.
 *
 * ── WHAT WAS CHECKED AND FOUND *NOT* BROKEN ─────────────────────────────────
 * Neither destination refuses a visitor for being EARLY. `/venue` asks only
 * whether the floor plan is published; `/pabuya` asks its flag, its event-type
 * surface, its visibility and its enabled destinations. There is no date
 * anywhere in either gate, so the doors need no phase — a claim worth stating
 * because "it must be time-gated" is the assumption that would otherwise have
 * added a rule with nothing behind it.
 *
 * Tested from three directions, because a pure function nobody calls is worth
 * nothing and a call site with the wrong facts is worse than none:
 *
 *   1. DECISION — the resolvers draw each thing only under the destination's
 *                 own conditions.
 *   2. WIRING   — the event page really mounts the strip, resolves it above the
 *                 identity fork so both tiers get it, and asks each gate the way
 *                 the destination asks it (in particular: the RAW visibility
 *                 column, never the effective one).
 *   3. NO DOOR  — the broadcast notice contains no outbound link, because a
 *      TO NOWHERE  stream link saved weeks ahead cannot be known to be open.
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
  showBroadcastNotice,
  type BroadcastNoticeInput,
  type DoorwayInput,
} from '../app/[slug]/_lib/site-nav';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8');

/**
 * Strip comments before scanning source. 🪤 THE LESSON FROM THE LAST PASS: a
 * scan that reads its own explanatory prose reports the FIX as the defect and
 * keeps passing whatever the code does. Every source assertion below runs on
 * the stripped text.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Everything open: a published plan, a live stocked money-gift page, admitted viewer. */
function allOpen(over: Partial<DoorwayInput> = {}): DoorwayInput {
  return {
    slug: 'cale-ice',
    guestToken: null,
    seatingSurfaceEnabled: true,
    seatingPublished: true,
    pabuyaRouteEnabled: true,
    enabledEgiftCount: 2,
    pabuyaViewerAllowed: true,
    ...over,
  };
}

/** Months before the day, a broadcast staged, a viewer allowed to know. */
function noticeOpen(over: Partial<BroadcastNoticeInput> = {}): BroadcastNoticeInput {
  return {
    broadcastPlanned: true,
    liveMediaVisible: true,
    dayOfPhase: 'inactive',
    playerOnPage: false,
    eventDate: '2027-03-14',
    ...over,
  };
}

/** A fixed "today" so the calendar assertions below are not clock-dependent. */
const TODAY = new Date('2027-01-20T09:00:00.000Z');

// ── 1 · DECISION — the money-gift door and the page's own visibility ────────

test('a viewer the money-gift page would redirect gets no money-gift card', () => {
  // The scheduled-launch window: this page reads public, the raw column does
  // not, and /pabuya redirects. A card here is a visible dead end.
  assert.equal(resolveGuestDoorways(allOpen({ pabuyaViewerAllowed: false })).pabuya, null);
});

test('that refusal closes ONLY the money-gift door, never the 3D room', () => {
  // /venue applies no visibility gate of its own — it is scoped by the RPC.
  // Letting one page's rule shut another's door would hide a working surface.
  const d = resolveGuestDoorways(allOpen({ pabuyaViewerAllowed: false }));
  assert.equal(d.venueWalk, '/cale-ice/venue');
  assert.equal(d.pabuya, null);
});

test('an admitted viewer with the flag on and a stocked page gets the card', () => {
  assert.equal(resolveGuestDoorways(allOpen()).pabuya, '/cale-ice/pabuya');
});

test('being admitted does not override the flag or an empty page', () => {
  assert.equal(
    resolveGuestDoorways(allOpen({ pabuyaRouteEnabled: false })).pabuya,
    null,
    'the rollout switch is off — the route 404s',
  );
  assert.equal(
    resolveGuestDoorways(allOpen({ enabledEgiftCount: 0 })).pabuya,
    null,
    'no destination is enabled — the page is an apology',
  );
});

test('the 3D room needs no phase: an early guest gets the same link as a late one', () => {
  // Stated as a test because the tempting fix for "it is unreachable before the
  // day" is a phase gate, and neither destination has one to mirror.
  const early = resolveGuestDoorways(allOpen({ guestToken: 'tok' }));
  assert.equal(early.venueWalk, '/cale-ice/venue?t=tok');
});

// ── 2 · DECISION — "we'll be streaming" ─────────────────────────────────────

test('months before the day, a staged broadcast is announced', () => {
  // THE WHOLE POINT: `inactive` is "everything outside the day-of window",
  // which is where the relative deciding whether to book leave actually is.
  assert.equal(showBroadcastNotice(noticeOpen(), TODAY), true);
});

test('the day before, still announced', () => {
  assert.equal(showBroadcastNotice(noticeOpen({ dayOfPhase: 'pre' }), TODAY), true);
});

test('no staged broadcast, no promise', () => {
  assert.equal(showBroadcastNotice(noticeOpen({ broadcastPlanned: false }), TODAY), false);
});

test('a guests-only livestream is not announced to a stranger', () => {
  // `live_media_public` FALSE fences the stream to invited guests. Telling a
  // cookie-less visitor it exists leaks the very thing that was fenced —
  // announce features, hide content.
  assert.equal(showBroadcastNotice(noticeOpen({ liveMediaVisible: false }), TODAY), false);
});

test('the notice never stands beside the real player', () => {
  assert.equal(
    showBroadcastNotice(noticeOpen({ dayOfPhase: 'live', playerOnPage: true }), TODAY),
    false,
  );
});

test('after the day the sentence would be false, so it is not said', () => {
  assert.equal(showBroadcastNotice(noticeOpen({ dayOfPhase: 'post' }), TODAY), false);
  assert.equal(
    showBroadcastNotice(noticeOpen({ dayOfPhase: 'post', playerOnPage: false }), TODAY),
    false,
  );
});

test('a missing phase is treated as "not the day" and still announces', () => {
  // An event with no date resolves `inactive`; a null must not silently mute
  // the one sentence this whole change exists to say.
  assert.equal(showBroadcastNotice(noticeOpen({ dayOfPhase: null }), TODAY), true);
});

test('🚨 the week AFTER the wedding it does not come back', () => {
  // `post` expires ~2.5 days out and the clock says `inactive` again — the
  // SAME value it says months beforehand. Gated on the phase alone, the notice
  // returns on the Thursday after a Saturday wedding and tells that wedding's
  // guests it "will be streamed live" on a date that has passed. The bar had
  // this exact trap twice in two days; see navPhaseFor.
  assert.equal(
    showBroadcastNotice(
      noticeOpen({ dayOfPhase: 'inactive', eventDate: '2027-01-16' }),
      TODAY,
    ),
    false,
  );
});

test('on the wedding day itself it is still allowed', () => {
  // The hours around the day belong to dayOfPhase, which is timezone-exact.
  // The calendar check must not fire a few hours early because UTC rolled over.
  assert.equal(
    showBroadcastNotice(
      noticeOpen({ dayOfPhase: 'pre', eventDate: '2027-01-20' }),
      TODAY,
    ),
    true,
  );
});

test('a timestamp, not just a bare date, is read correctly', () => {
  assert.equal(
    showBroadcastNotice(
      noticeOpen({ eventDate: '2027-01-19T23:30:00.000Z' }),
      TODAY,
    ),
    false,
  );
});

test('an event with no date has not happened yet', () => {
  // Absent or unparseable must never SUPPRESS — an event with no date is not
  // in the past, and failing the other way would silently mute the notice.
  for (const d of [null, undefined, '', '   ', 'sometime in June']) {
    assert.equal(
      showBroadcastNotice(noticeOpen({ eventDate: d }), TODAY),
      true,
      `eventDate ${JSON.stringify(d)} wrongly read as past`,
    );
  }
});

// ── 3 · WIRING — the surface a guest actually has before the day ────────────

const BODY = stripComments(read('../app/[slug]/_components/site-body.tsx'));
const PAGE = stripComments(read('../app/[slug]/page.tsx'));
const HUB = stripComments(read('../app/[slug]/hub/page.tsx'));
const LOADERS = stripComments(read('../app/[slug]/_lib/loaders.ts'));
const STRIP_SRC = read('../app/[slug]/_components/guest-doorway-strip.tsx');

test('the event page mounts the doorway strip', () => {
  assert.ok(
    BODY.includes('<GuestDoorwayStrip'),
    'the pre-day surface stopped mounting the doors — they are hub-only again',
  );
});

test('the strip is mounted ONCE, in the shared shell, not inside one tier', () => {
  const mounts = BODY.match(/<GuestDoorwayStrip/g) ?? [];
  assert.equal(mounts.length, 1, 'two mounts means the two tiers can disagree');

  // Both tree builders are `const … = (…) => {` expressions defined BEFORE the
  // component's own `return (`. A mount after that point is therefore outside
  // both of them — which is the property that matters: a relative arriving on
  // a shared link with no cookie renders through the anonymous tree, and the
  // invited cousin through the guest tree, and this belongs to both.
  const shell = BODY.indexOf('  return (\n    <InvitationShell');
  const mount = BODY.indexOf('<GuestDoorwayStrip');
  assert.ok(shell >= 0, 'the shell return moved — this scan is now blind');
  assert.ok(
    mount > shell,
    'the strip moved inside one identity tree — the other tier loses it',
  );
});

test('the strip renders BELOW the invitation, not above the hero', () => {
  // The supplier doorway is a top banner because it addresses someone who is
  // not here for the invitation. These are for guests, and a stack of utility
  // cards before the couple's names would be the first thing every visitor saw
  // on every wedding page.
  const fork = BODY.indexOf("identity.kind === 'anonymous' ? anonymousTree(identity)");
  const mount = BODY.indexOf('<GuestDoorwayStrip');
  assert.ok(fork >= 0, 'the identity fork moved — this scan is now blind');
  assert.ok(mount > fork, 'the strip jumped above the hero');
});

test('the strip stands down for the full-bleed Save-the-Date film', () => {
  assert.match(
    BODY,
    /\{plan\.fullBleed \? null : \(\s*<GuestDoorwayStrip/,
    'cards under a full-screen film are debris; the guard is gone',
  );
});

test('the page decides both things with the tested resolvers, not by hand', () => {
  assert.ok(BODY.includes('resolveGuestDoorways('), 'the doors stopped asking the rules');
  assert.ok(BODY.includes('showBroadcastNotice('), 'the notice stopped asking the rules');
});

test('the personal token reaches the 3D room from the guest tier', () => {
  assert.match(
    BODY,
    /identity\.kind === 'guest' \? identity\.guest\.qr_token : null/,
    'without the token the 3D room opens anonymised — no seat, no tablemates',
  );
});

test('the event date reaches the notice resolver', () => {
  // Without it, `inactive` cannot tell "months before" from "the week after"
  // and the notice returns after the wedding.
  assert.match(BODY, /eventDate: event\.event_date,/);
});

test('the notice is suppressed by the player the OTHER tier renders', () => {
  // Both trees mount the player whenever the couple's links resolve — the
  // player follows the broadcast, not the calendar (owner-ruled 2026-09-02),
  // so no dayOfPhase gate belongs in this expression any more. If it drifts
  // from theirs, one tier shows the promise and the player.
  assert.match(BODY, /playerOnPage:\s*plan\.liveMediaVisible && Boolean\(watchLive\)/);
});

// ── The facts: each read the way the DESTINATION reads it ──────────────────

test('the page resolves the doorway facts and hands them to the body', () => {
  assert.ok(PAGE.includes('loadDoorwayFacts('), 'the page stopped reading the gates');
  assert.match(PAGE, /doorwayFacts,/, 'the facts never reach SiteBody');
});

test('the money-gift door asks the RAW visibility column, not the effective one', () => {
  // 🚨 THE DEFECT THIS FILE EXISTS FOR. `resolveEffectiveVisibility` is what
  // this page renders under; `canViewSlugEvent` on the RAW column is what
  // /pabuya enforces. Drawing the card from the first produces a card that
  // redirects. Asserted on BOTH surfaces that draw it.
  for (const [name, src] of [
    ['app/[slug]/page.tsx', PAGE],
    ['app/[slug]/hub/page.tsx', HUB],
  ] as const) {
    assert.match(
      src,
      /const rawVisibility = event\.landing_page_visibility \?\? 'private';/,
      `${name} stopped reading the raw visibility column`,
    );
    assert.match(
      src,
      /pabuyaViewerAllowed =[\s\S]{0,200}canViewSlugEvent\(event\.event_id, rawVisibility\)/,
      `${name} stopped asking the money-gift page's own question`,
    );
    assert.match(
      src,
      /pabuyaViewerAllowed/,
      `${name} stopped passing the answer to the resolver`,
    );
  }
});

test('the doorway facts come from the destinations own readers', () => {
  assert.match(
    LOADERS,
    /fetchEgiftMethods\(admin, eventId, \{ enabledOnly: true \}\)/,
    '"is anything behind this door" must be answered by the reader that will ' +
      'stand there — the same function, client and filter /pabuya uses',
  );
  assert.ok(
    LOADERS.includes('eventSeatingPublished(admin, eventId)'),
    'the 3D door stopped asking whether the plan is published',
  );
  assert.ok(
    LOADERS.includes("surfaceEnabled(\n      await resolveProfile(eventType ?? 'wedding'),\n      'seating',\n    )"),
    'the 3D door stopped asking the seating-surface question the RPC asks',
  );
});

test('the broadcast fact is reduced by the SAME reducer the player is built from', () => {
  // The player follows the broadcast, not the calendar (owner-ruled
  // 2026-09-02): `watchLive` and `broadcastPlanned` are now resolved from the
  // SAME `resolveWatchLinks(watchUrls)` call, on every render — not a second,
  // narrower reduction taken only outside the live window.
  assert.match(LOADERS, /watchLive = resolveWatchLinks\(watchUrls\)/);
  assert.match(
    LOADERS,
    /const broadcastPlanned = watchLive !== null;/,
    'a stored URL the player would refuse must not become a promise',
  );
});

test('the broadcast fact is resolved regardless of dayOfPhase', () => {
  // ⭐ THE PLAYER FOLLOWS THE BROADCAST, NOT THE CALENDAR (owner-ruled
  // 2026-09-02). `panood_watch_url` self-clears when the host ends the
  // broadcast (endPanoodBroadcast), so it needs no calendar gate to stay
  // trustworthy — this used to read `else if (dayOfPhase !== 'post')`, hiding
  // a genuinely live stream whenever the date said it wasn't the day.
  assert.doesNotMatch(
    LOADERS,
    /\} else if \(dayOfPhase !== 'post'\) \{/,
    'the watch-link read is still gated on the calendar',
  );
});

// ── 4 · NO DOOR TO NOWHERE — the notice must not link out ──────────────────

/** The JSX the notice actually renders, comments removed. */
function noticeBlock(): string {
  const start = STRIP_SRC.indexOf('{broadcast ? (');
  assert.ok(start >= 0, 'the broadcast branch is gone from the strip');
  const end = STRIP_SRC.indexOf(') : null}', start);
  assert.ok(end > start, 'the broadcast branch has no closing — the scan is blind');
  return stripComments(STRIP_SRC.slice(start, end));
}

test('the "we\'ll be streaming" notice carries no outbound link', () => {
  // A YouTube or Facebook URL saved weeks ahead cannot be known to be open: a
  // scheduled premiere shows a countdown, a link typed for a stream not yet
  // created shows "video unavailable", and nothing here can tell them apart
  // (the Google account that could answer is suspended). The only promise made
  // is about the page the reader already has open.
  const block = noticeBlock();
  assert.ok(!block.includes('href'), 'the notice grew a link that may dead-end');
  assert.ok(!block.includes('<Link'), 'the notice grew a link that may dead-end');
  assert.ok(!block.includes('<a '), 'the notice grew a link that may dead-end');
});

test('…and that scan can actually see a link', () => {
  // 🪤 The companion the last pass was missing: a guard that cannot fail is
  // worse than no guard. Plant one and prove the check catches it.
  const planted = noticeBlock().replace(
    'Watching from afar',
    'Watching from afar</span><a href="https://youtu.be/x">Watch</a><span>',
  );
  assert.ok(planted.includes('href'), 'the planted link did not land');
  assert.ok(
    planted.includes('<a ') && !noticeBlock().includes('<a '),
    'the scan cannot distinguish a linked notice from an unlinked one',
  );
});

test('the two doors ARE links — the notice being text is a ruling, not a style', () => {
  // The distinction is the whole point: the pages behind the cards have already
  // answered yes, so those are real links.
  assert.match(STRIP_SRC, /<Link\s+href=\{href\}/, 'the doors stopped being doors');
});
