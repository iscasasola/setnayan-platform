/**
 * The guest-side receiver for coordinator announcements.
 *
 * ── WHAT THIS PROTECTS ──────────────────────────────────────────────────────
 * The composer shipped months before this, and the privacy control for it is
 * ACTIVE in production — but nothing on the guest site ever read what it wrote.
 * A coordinator could type "phones down, the ceremony is starting" and it would
 * reach only the couple's own dashboard. This file pins the four properties
 * that make the receiver correct, all of which are easy to undo by accident.
 *
 * ── THE RULE CHANGED ON 2026-09-28, AND THIS FILE CHANGED WITH IT ───────────
 * Until then the second test here pinned "live window only": the loader took
 * `isLive` and returned null outside the day. The owner ruled (DECISION_LOG
 * "OWNER ANSWERS — ANNOUNCEMENTS, PRINT COLUMNS…", item 1): *"an announcement
 * shows to guests as soon as it is sent"* — before the day at the top of their
 * Invitation/Event Hub, on the day at the top as before. The Schedule's
 * Announce (PR #6061) could already be sent a week early; until this change the
 * words were saved and shown to nobody until the day. What survives of the old
 * gate is its conservative half: once the event is OVER the announcement comes
 * down, so the last "dinner is moving up 15 minutes" cannot haunt the Post
 * Event page. `announcementStage` in lib/coordinator-broadcasts.ts is the one
 * place that decides, and it is tested here BEHAVIOURALLY, not by source scan.
 *
 * Source scans for the rest: there is no DOM under `tsx --test`, and the render
 * path needs a live event and a guest session. What regresses here is the
 * WIRING — someone widens the audience, re-adds a day-of-only gate, drops the
 * ended gate, or makes an announcement dismissible.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { announcementStage } from '@/lib/coordinator-broadcasts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARD = readFileSync(join(HERE, 'day-of-announcement.tsx'), 'utf8');
const SITE = readFileSync(join(HERE, 'site-body.tsx'), 'utf8');
/** The announcement moved to the layout on 2026-09-22 — it is the only node
 *  that wraps all twelve guest pages. See the layout's own docblock. */
const LAYOUT = readFileSync(join(HERE, '..', 'layout.tsx'), 'utf8');
/** 🗄 EV1 (2026-10-28): the guests-only gate and the read moved to the route the card asks — the layout reads no
 *  viewer any more, so the Event Hub under it can be served from the cache. */
const ROUTE = readFileSync(join(HERE, '..', 'announcement', 'route.ts'), 'utf8');
const READ = readFileSync(join(HERE, '..', '_lib', 'latest-announcement.server.ts'), 'utf8');
const STAGE = readFileSync(join(HERE, '..', '_lib', 'announcement-stage.ts'), 'utf8');

test('announcement · GUESTS only — a stranger with the link never sees it', () => {
  /*
    THE RULING IS UNCHANGED; ONLY THE MECHANISM MOVED. An announcement is for
    the people in the room — "the ceremony is running late" is not for whoever
    was forwarded the URL.

    Until 2026-09-22 this was enforced STRUCTURALLY: the mount sat inside
    `site-body.tsx`'s guest tree, which an anonymous visitor never reaches. That
    also meant it reached ONE of the twelve guest pages, so it moved to
    `[slug]/layout.tsx` — which wraps everyone, anonymous visitors included. A
    layout has no guest tree to hide inside, so the gate must now be ASKED FOR,
    and this test is what stops it being dropped.
  */
  /*
    🗄 AND MOVED AGAIN, 2026-10-28 (EV1): the layout asking it made EVERY guest page render per request — the Event
    Hub included, on the one day it must not fall over. The card now asks `GET /{slug}/announcement`, and THAT route
    holds the gate. Same ruling, asserted where it now lives.
  */
  assert.ok(LAYOUT.includes('<DayOfAnnouncement'), 'the announcement is not rendered at all');
  assert.doesNotMatch(LAYOUT, /readGuestSession\(|cookies\(\)/, 'the layout reads the viewer again — the hub cannot be cached');
  assert.match(CARD, /fetch\(`\/\$\{encodeURIComponent\(slug\)\}\/announcement`\)/, 'the card must ask the gated route');
  // The gate: this event's pass (signature + its QR still current), or a signed-in viewer readGuestSession admits.
  assert.match(READ, /verified\.payload\.event_id !== eventId/, 'the pass must be for THIS event');
  assert.match(READ, /session\?\.event_id === eventId/, 'a signed-in viewer must hold THIS event’s pass too');
  assert.match(READ, /guestSessionTokenStillCurrent\(guest_id, qr_token\)/, 'a rotated QR must stop reading the words');
  // And the words are read only behind that verdict — a non-guest gets NO words, not hidden ones.
  const gateAt = ROUTE.indexOf('holdsThisEventsCurrentPass(event.event_id)');
  const readAt = ROUTE.indexOf('latestAnnouncementFor(event.event_id)');
  assert.ok(gateAt > 0 && gateAt < readAt, 'the guest gate must precede the read');
  assert.match(ROUTE, /return NextResponse\.json\(\{ body: null \}, \{ headers: NOT_HELD \}\);\n\s*const latest/, 'a non-guest must get null, never the words');

  // ⛔ AND IT MUST NOT HAVE BEEN LEFT BEHIND IN site-body TOO. Two mounts would
  // double it on the landing page, and the second copy would not carry the gate.
  assert.ok(
    !SITE.includes('<DayOfAnnouncement'),
    'the announcement still renders in site-body — it now mounts once, in the layout',
  );
});

test('announcement · before the day, a sent announcement SHOWS (owner 2026-09-28)', () => {
  // The decision, behaviourally. 'pre' is the last three days; 'inactive' is
  // any earlier day — both are "before", and both render.
  assert.equal(announcementStage('pre', false), 'before', 'three days out: shown');
  assert.equal(announcementStage('inactive', false), 'before', 'a month out: shown');
  // On the day the live look holds — including through the night after, when
  // the calendar already says "yesterday" but the day-of window is still open.
  assert.equal(announcementStage('live', false), 'live');
  assert.equal(announcementStage('live', true), 'live', 'the live window outranks the calendar');

  // And the wiring carries it: one rule decides the stage (`announcementStageOf`) for the layout that mounts the card
  // and the route that answers it; the only stage refused is 'after'. A re-added `if (!isLive)` is exactly the
  // regression this test exists to catch.
  assert.match(STAGE, /return announcementStage\(phase, ended\);/, 'the stage rule must resolve the stage');
  assert.match(LAYOUT, /stage = announcementStageOf\(event\);/, 'the layout must resolve the stage');
  assert.match(LAYOUT, /\{eventId && stage !== 'after' \? \(/, 'the card mounts until the event is over');
  assert.match(ROUTE, /if \(stage === 'after'\) return NextResponse\.json\(\{ body: null \}/, 'the route must refuse only after');
  assert.doesNotMatch(STAGE + ROUTE, /if \(!isLive\)/, 'the day-of-only gate is back');
  // The calm variant is asked for before the day; the day-of look on the day.
  assert.match(LAYOUT, /stage=\{stage === 'live' \? 'live' : 'before'\}/);
  assert.match(CARD, /stage\?: 'before' \| 'live';/, 'the card must accept the stage');
});

test('announcement · once the event is over it comes down — nothing stale survives', () => {
  // The conservative half of the old rule, kept on purpose: the Post Event page
  // keeps its own words. "Over" is `isFinishedEvent`'s verdict (the last day has
  // passed in the venue's calendar), never a second definition.
  assert.equal(announcementStage('post', true), 'after');
  assert.equal(announcementStage('inactive', true), 'after', 'a month after: hidden');
  assert.match(STAGE, /isFinishedEvent\(/, 'the stage rule must ask the board\u2019s own "is it over"');
  assert.match(STAGE, /calendarDayInZone\(venueTz\)/, 'and ask it in the VENUE\u2019s calendar, not the server\u2019s');
});

test('announcement · one message, never a feed', () => {
  // A guest gets the latest only. A scrollback of operational chatter is the
  // coordinator's business and would compete with the couple's own words.
  assert.match(READ, /fetchLatestBroadcasts\(createAdminClient\(\), eventId, 1\)/, 'one message, the latest');
  assert.match(READ, /const latest = items\[0\];/);
});

test('announcement · not dismissible, and announced politely', () => {
  // "Phones down" that a guest can swipe away is worse than none — the
  // coordinator has no way to know it was dismissed.
  // Scan the CODE, not the prose — the file's own docblock explains why it is
  // not dismissible, and matching that word would fail on the explanation.
  const code = CARD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Do NOT add bare words like "hidden" here: `aria-hidden` on the decorative
  // icon is correct, and a blunt word-list flags it. (Caught three times in one
  // day — a smell test that fires on correct code teaches people to delete the
  // test.)
  for (const smell of ['onClick', 'dismiss(', 'Dismiss(', 'onDismiss', 'setDismissed']) {
    assert.ok(
      !code.includes(smell),
      `the announcement card's CODE contains "${smell}" — it must not be dismissible`,
    );
  }

  // ⚠ THIS TEST USED TO ASSERT `useState` AND `'use client'` WERE ABSENT, and
  // it went red on 2026-08-05 when the card began subscribing to realtime. It
  // was right to fire: those were its proof. But they were a PROXY — "it cannot
  // be dismissed because it cannot hold state" — and the card now must hold
  // state, because the announcement used to reach only guests who happened to
  // reload, which on the one day this exists for is no delivery at all.
  //
  // The property is unchanged and is what is asserted now: there is no control
  // that hides it, and nothing renders it conditionally on having been seen.
  // Loosening the proxy without pinning the property is how a guard quietly
  // becomes decoration, so the state it IS allowed to hold is named exactly.
  const stateHooks = code.match(/useState[<(]/g) ?? [];
  assert.equal(
    stateHooks.length,
    1,
    'The card holds more state than the one piece it is allowed (the current ' +
      'announcement text, replaced live). A second useState is where a ' +
      '"dismissed" flag would live — say why it is here, or do not add it.',
  );
  assert.match(
    code,
    /const \[text, setText\] = useState<string \| null>\(body\)/,
    'The one permitted state is the announcement text itself, as the route ' +
      'last answered it (EV1: no longer server-rendered — the layout reads no viewer).',
  );
  // role=status + polite: announced without seizing focus. `alert` would
  // interrupt whatever the guest is reading, and this is not an error.
  assert.match(CARD, /role="status"/);
  assert.match(CARD, /aria-live="polite"/);
  assert.ok(!CARD.includes('role="alert"'), 'an announcement must not be an alert');
});

test('announcement · the coordinator’s words render as TEXT, never as markup', () => {
  // Typed by a person on a phone under pressure, shown to every guest at the
  // wedding. Nothing here may interpret it.
  assert.ok(
    !CARD.includes('dangerouslySetInnerHTML'),
    'the announcement body is rendered as HTML — it is untrusted human input',
  );
  assert.match(CARD, /\{body\}/);
});
