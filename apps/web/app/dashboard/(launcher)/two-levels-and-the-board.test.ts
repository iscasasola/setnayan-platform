/**
 * two-levels-and-the-board.test.ts — the menu says which level you are on, and
 * finished events have their own place.
 *
 * ─── THE THREE THINGS THIS HOLDS ────────────────────────────────────────────
 *
 * 1 · BOTH SHELVES ALWAYS EXIST. A finished event used to hide behind a
 *     `?show=all` query param, and prod held exactly one: a wedding whose day
 *     had passed. **A thing you have to switch on reads as a thing that might
 *     not be there** — and what was behind it is somebody's memories. Owner
 *     2026-08-13: Coming up and Finished, two always-present sections.
 *
 * 2 · A CARD SAYS WHICH SIDE OF THE EVENT YOU ARE ON, AND GOES SOMEWHERE THAT
 *     ADMITS YOU. `/dashboard/[eventId]` admits `member_type = 'couple'` ONLY
 *     (app/dashboard/[eventId]/layout.tsx). Now that invited events reach the
 *     board, a hardcoded `/dashboard/${event_id}` on any card is a 404 shown to
 *     somebody who was told they belong — the exact harm Session 8 found on an
 *     Alaala card on 2026-08-12 and deliberately did not propagate.
 *
 * 3 · A TAB PRESS NEVER DROPS WHICH EVENT YOU ARE IN, and creating a trip is
 *     never refused. Both were already true; nothing guarded either.
 *
 * ─── WHY BOTH A BEHAVIOUR HALF AND A SOURCE HALF ────────────────────────────
 * 🔑 TESTING THE PRIMITIVE IS NOT TESTING THE CALLER. `lib/event-board.ts` is
 * pure and exercised for real below — but a page that stops CALLING it fails
 * nothing, and that is precisely how a control disappears. So every pure
 * assertion has a source-anchored twin proving the launcher still renders it.
 *
 * Every source assertion runs over `stripComments` output and is anchored to the
 * ACT (a rendered element, a called helper) rather than to a bare identifier —
 * a mention in a comment or an unused import must never satisfy it. Each one was
 * mutation-checked with its occurrence count printed before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import type { EventWithRole } from '@/lib/events';
import {
  eventBoardHref,
  eventStance,
  isFinishedEvent,
  mergeBoardMemberships,
  splitEventBoard,
  stanceLabel,
} from '@/lib/event-board';
import { buildCustomerNavGroups } from '../[eventId]/_components/customer-nav-config';
import {
  findBlockingLifeEvent,
  isGatedLifeType,
  type LifeEventRow,
} from '@/lib/life-event-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = resolve(HERE, 'page.tsx');
const AUTOSURFACED = resolve(
  HERE,
  '..',
  '(account)',
  '_components',
  'autosurfaced-events.tsx',
);
const PICKER = resolve(
  HERE,
  '..',
  '(account)',
  'create-event',
  '_components',
  'event-type-picker.tsx',
);

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const launcher = () => read(LAUNCHER);

/** Count non-overlapping matches — the number a mutation run has to move. */
function count(src: string, re: RegExp): number {
  return (src.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) ?? [])
    .length;
}

/**
 * The body of one top-level `function NAME(...)` declaration.
 *
 * 🔑 WHY THIS EXISTS, MEASURED. The first cut of this file asserted
 * `count(stanceLabel(stance)) >= 2` across the WHOLE launcher — and there are
 * THREE call sites, because `StanceChip` uses the helper too. Deleting the stance
 * line out of the phone chip left two, and the guard stayed GREEN. A file-level
 * count cannot tell you WHICH component still renders a thing; slicing to the
 * component can. (Same family as the guard that matched a file-level substring
 * so an import exempted the file.)
 */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(
    start,
    -1,
    `Component ${name} is gone from the launcher — re-read this test before ` +
      'regenerating anything.',
  );
  const rest = src.slice(start + 1);
  const next = rest.search(/\nfunction \w/);
  return next === -1 ? rest : rest.slice(0, next);
}

const TODAY = '2026-08-13';

function ev(over: Partial<EventWithRole> & { event_id: string }): EventWithRole {
  return {
    public_id: `S89E-${over.event_id}`,
    event_type: 'wedding',
    display_name: over.event_id,
    event_date: null,
    is_primary: false,
    archived: false,
    venue_name: null,
    venue_address: null,
    monogram_text: null,
    monogram_color: null,
    concierge_status: null,
    member_type: 'couple',
    ...over,
  } as EventWithRole;
}

// ── 1 · THE TWO SHELVES ─────────────────────────────────────────────────────

test('a past event goes to Finished, an upcoming one to Coming up', () => {
  const { comingUp, finished } = splitEventBoard(
    [
      ev({ event_id: 'past', event_date: '2026-08-01' }),
      ev({ event_id: 'soon', event_date: '2026-12-18' }),
    ],
    TODAY,
  );
  assert.deepEqual(comingUp.map((e) => e.event_id), ['soon']);
  assert.deepEqual(finished.map((e) => e.event_id), ['past']);
});

test('an event happening TODAY in Manila is not finished yet', () => {
  // 🔑 The boundary is a PH CALENDAR DAY, never an instant. A wedding is not
  // "celebrated" at 8am on its own morning because UTC still says yesterday.
  assert.equal(isFinishedEvent({ event_date: TODAY, archived: false }, TODAY), false);
  assert.equal(
    isFinishedEvent({ event_date: '2026-08-12', archived: false }, TODAY),
    true,
  );
});

test('an archived event is Finished whatever its date says', () => {
  const { comingUp, finished } = splitEventBoard(
    [ev({ event_id: 'shelved', event_date: '2027-01-01', archived: true })],
    TODAY,
  );
  assert.deepEqual(comingUp, []);
  assert.deepEqual(finished.map((e) => e.event_id), ['shelved']);
});

test('an UNDATED event sits at the TAIL of Coming up — never on Finished', () => {
  // "Date to be set" is a real state, not a missing value. An event with no
  // locked date has certainly not happened, so it cannot be a memory.
  const { comingUp, finished } = splitEventBoard(
    [
      ev({ event_id: 'undated', event_date: null }),
      ev({ event_id: 'far', event_date: '2027-06-01' }),
      ev({ event_id: 'near', event_date: '2026-09-19' }),
    ],
    TODAY,
  );
  assert.deepEqual(
    comingUp.map((e) => e.event_id),
    ['far', 'near', 'undated'],
    'Coming up must run date DESCENDING with the undated event LAST.',
  );
  assert.deepEqual(finished, []);
});

test('Finished runs most-recent-past first', () => {
  const { finished } = splitEventBoard(
    [
      ev({ event_id: 'older', event_date: '2024-02-02' }),
      ev({ event_id: 'recent', event_date: '2026-08-01' }),
    ],
    TODAY,
  );
  assert.deepEqual(finished.map((e) => e.event_id), ['recent', 'older']);
});

test('the board carries organiser + invited rows and nothing else', () => {
  const { comingUp } = splitEventBoard(
    [
      ev({ event_id: 'mine', member_type: 'couple', event_date: '2026-12-18' }),
      ev({ event_id: 'theirs', member_type: 'guest', event_date: '2026-12-12' }),
      ev({ event_id: 'shop', member_type: 'vendor', event_date: '2026-11-11' }),
      ev({ event_id: 'coord', member_type: 'coordinator', event_date: '2026-10-10' }),
    ],
    TODAY,
  );
  assert.deepEqual(
    comingUp.map((e) => e.event_id).sort(),
    ['mine', 'theirs'],
    'A vendor booking and a coordinator assignment are not this board — both have ' +
      'their own doorways, and a coordinator reaches the event shell through an ' +
      'accepted moderator row, not through member_type.',
  );
});

// ── 2 · STANCE, AND THE DOOR IT DECIDES ─────────────────────────────────────

test('an INVITED card never points into the couple dashboard', () => {
  // THE 404 ASSERTION. /dashboard/[eventId] admits member_type='couple' only.
  const href = eventBoardHref({
    event_id: 'abc',
    slug: 'maria-and-jose',
    member_type: 'guest',
  });
  assert.equal(href, '/maria-and-jose');
  assert.ok(
    !href!.startsWith('/dashboard'),
    'An invited person was sent into the organiser dashboard, which 404s for them.',
  );
});

test('an invited card carries NO side effect — see the sibling guard', () => {
  // 🚨 A first cut pointed this at a `/{slug}/enter` GET handler that minted the
  // guest cookie, and a <Link> PREFETCHES: a card scrolling into view rewrote
  // which wedding the single-event cookie named. The rule — a card's destination
  // must be a page, never a route handler — is asserted in
  // app/[slug]/an-invited-person-is-recognised.test.ts, which resolves the href
  // to a file. Here we only pin the value.
  assert.equal(
    eventBoardHref({ event_id: 'abc', slug: 'cale-ice', member_type: 'guest' }),
    '/cale-ice',
  );
});

test('an organiser card opens the event dashboard', () => {
  assert.equal(
    eventBoardHref({ event_id: 'abc', slug: 'x', member_type: 'couple' }),
    '/dashboard/abc',
  );
});

test('an invited event with no public page yet gets NO link, not a broken one', () => {
  // 🪤 One prod event has a NULL slug today — and it is the finished one.
  for (const slug of [null, undefined, '   ']) {
    assert.equal(
      eventBoardHref({ event_id: 'abc', slug, member_type: 'guest' }),
      null,
      `slug ${JSON.stringify(slug)} must yield null, never "/null" or "/undefined".`,
    );
  }
});

test('the two stances read as two different sentences', () => {
  const organiser = stanceLabel('organiser');
  const invited = stanceLabel('invited');
  assert.ok(organiser.length > 0 && invited.length > 0);
  assert.notEqual(organiser, invited);
  assert.equal(eventStance('vendor'), null);
});

test('holding both memberships on one event resolves to the organiser', () => {
  const merged = mergeBoardMemberships(
    [ev({ event_id: 'e1', member_type: 'couple' })],
    [ev({ event_id: 'e1', member_type: 'guest' })],
  );
  assert.equal(merged.length, 1, 'The event was listed twice.');
  assert.equal(merged[0]!.member_type, 'couple');
});

// ── 3 · THE CALLER — the launcher actually renders all of it ────────────────

test('the launcher renders BOTH shelves, always', () => {
  const src = launcher();
  assert.match(
    src,
    /<SectionLabel[^>]*>\s*Coming up\s*<\/SectionLabel>/,
    'The "Coming up" shelf heading is gone.',
  );
  assert.match(
    src,
    /<SectionLabel[^>]*>\s*Finished\s*<\/SectionLabel>/,
    'The "Finished" shelf heading is gone — the second shelf must be a NAMED place, ' +
      'not an unlabelled tail of the first.',
  );
  assert.match(
    src,
    /id="finished"/,
    'The Finished section lost its own anchor, so nothing can link to it.',
  );
});

test('NOTHING gates the finished shelf behind a query param', () => {
  // 🔑 THE REGRESSION THIS EXISTS FOR. The mutation that must fail here is
  // re-introducing the toggle — any read of a `show` param, or a `showAll`
  // condition wrapped around the finished cards.
  const src = launcher();
  assert.equal(
    count(src, /\bshowAll\b/),
    0,
    'A `showAll` gate is back on the launcher. The finished shelf must render ' +
      'whether or not anything switched it on — those are somebody\'s memories.',
  );
  assert.equal(
    count(src, /show=all/),
    0,
    'The `?show=all` destination is back.',
  );
  assert.equal(
    count(src, /\bsp\.show\b/),
    0,
    'The launcher reads a `show` search param again.',
  );
  // …and the finished cards must actually be rendered from the shelf.
  assert.ok(
    count(src, /finished\.map\(/) >= 2,
    'The finished shelf renders no cards on one of the two compositions (phone / ' +
      'desktop). Both must list them.',
  );
});

test('the empty Finished shelf explains the shelf and claims no zero', () => {
  const src = launcher();
  assert.match(
    src,
    /finished\.length === 0/,
    'The empty state for the Finished shelf is gone.',
  );
  assert.match(
    src,
    /Celebrations move here on their own/,
    'The empty Finished shelf lost the line that says what it is FOR.',
  );
  // 🔑 fetchUserEvents graceful-degrades to [] on EVERY error including an RLS
  // denial, so an empty shelf cannot be told apart from a refused read. The old
  // "N finished events hidden" line was a measured count; nothing may print one.
  assert.equal(
    count(src, /finished events? hidden/),
    0,
    'A measured count of finished events is being printed again.',
  );
});

test('no card on the board hardcodes the organiser dashboard path', () => {
  // The one mutation that reintroduces the 404: putting the literal back.
  const src = launcher();
  assert.equal(
    count(src, /href=\{`\/dashboard\/\$\{event\.event_id\}`\}/),
    0,
    'A card hardcodes `/dashboard/${event.event_id}` again. For an INVITED event ' +
      'that is a 404 shown to somebody who was told they belong — the destination ' +
      'must come from eventBoardHref().',
  );
  // ONE DERIVATION. `deriveEventView` computes the href, and each card passes it
  // through — so the destination, the status line and the reason-it-cannot-open
  // can never disagree. (They did: the status branch tested `finished` before
  // `invited`, which made the "nothing to open" sentence unreachable on the
  // Finished shelf while the card still rendered with no link.)
  assert.match(
    fnBody(src, 'deriveEventView'),
    /const href = eventBoardHref\(event\);/,
    'deriveEventView stopped deriving the destination, so the card and its ' +
      'status line can drift apart again.',
  );
  for (const component of [
    'GlassEventCard',
    'MobileEventHero',
    'MobileEventChip',
  ]) {
    const body = fnBody(src, component);
    assert.match(
      body,
      /href=\{href\}/,
      `${component} no longer takes its destination from the shared derivation.`,
    );
    assert.match(
      body,
      /\bhref\b[^\n]*\}\s*=\s*deriveEventView|href,\s*closedReason\s*\}/,
      `${component} does not read href out of deriveEventView.`,
    );
  }
});

test('a card with nowhere to go SAYS SO, on every shelf', () => {
  // 🚨 THE REGRESSION THIS REPLACES. The reason was a `status` branch, and the
  // branch order was the defect: `finished` was tested BEFORE `invited`, so an
  // invited event whose day had passed always read "Celebrated" and the sentence
  // explaining an unopenable card was UNREACHABLE on the Finished shelf. Prod's
  // one past event is also its one slug-less event and already carries a live
  // join token — one scan from a real person meeting a silent dead card.
  const src = launcher();
  assert.match(
    fnBody(src, 'deriveEventView'),
    /const closedReason =\s*href === null && invited/,
    'The reason a card cannot be opened is derived from something other than "it ' +
      'has no destination". Anything else can be true on one shelf and not another.',
  );
  assert.ok(
    count(src, /\{closedReason\}/) >= 2,
    'A card composition stopped rendering the reason. A dead card that explains ' +
      'nothing reads as the app being broken, or as the couple pulling their page.',
  );
  assert.match(
    fnBody(src, 'MobileEventHero'),
    /closedReason,/,
    'The phone hero dropped the reason from its facts line.',
  );
});

test('a card with no destination is inert to look at, not just to press', () => {
  // 🚨 The first cut passed the caller's className straight to the <div>, and it
  // carries `sn-press` (:active scale 0.97) and `sn-lift-4` (:hover translateY).
  // Both are plain class selectors in globals.css, so they fire on a div exactly
  // as on a link: the card lifted under the pointer and squashed under the
  // finger, then did nothing. A control that animates has promised something.
  const body = fnBody(launcher(), 'CardShell');
  assert.match(
    body,
    /PRESSABLE_CLASSES/,
    'CardShell stopped stripping the press/hover affordances from a linkless card.',
  );
  assert.match(
    body,
    /\.filter\(\(c\) => !\(PRESSABLE_CLASSES as readonly string\[\]\)\.includes\(c\)\)/,
    'The affordance strip is gone or no longer removes those classes.',
  );
  assert.match(
    launcher(),
    /const PRESSABLE_CLASSES = \['sn-press', 'sn-lift-4'\] as const;/,
    'The affordance list changed. Every class that makes a card LOOK pressable ' +
      'must be in it, or a dead card animates again.',
  );
});

test('every card names the stance — checked per component, not per file', () => {
  const src = launcher();
  // Sliced to each card component: a file-level count of the helper is satisfied
  // by StanceChip's own use of it, so it cannot see one card going quiet.
  assert.match(
    fnBody(src, 'GlassEventCard'),
    /<StanceChip stance=\{stance\}/,
    'The desktop card stopped rendering the stance badge.',
  );
  for (const component of ['MobileEventHero', 'MobileEventChip']) {
    assert.match(
      fnBody(src, component),
      /\{stanceLabel\(stance\)\}/,
      `${component} stopped printing the stance. A difference between two cards ` +
        'that is never named is worse than a label on both.',
    );
  }
});

test('the launcher asks for the invited memberships at all', () => {
  // Without this read the board is organiser-only and an event somebody joined
  // by scanning an invitation QR is INVISIBLE to them — which is how it shipped.
  assert.match(
    launcher(),
    /fetchUserEvents\(supabase, user\.id, 'guest'\)/,
    'The launcher no longer reads guest memberships, so an invited event can never ' +
      'appear on the board.',
  );
});

test('the ⌘K index cannot offer a dead jump', () => {
  const src = launcher();
  assert.match(
    src,
    /\.map\(\(e\) => \(\{ e, href: eventBoardHref\(e\) \}\)\)/,
    'The search index went back to deriving its own href.',
  );
  assert.match(
    src,
    /\.filter\(\(x\): x is \{ e: EventWithRole; href: string \}/,
    'The search index stopped dropping events with nowhere to go, so it can list a ' +
      'result that opens onto nothing.',
  );
});

test('the auto-surfaced "you were added" row routes a GUEST correctly', () => {
  // Every row there is a member_type='guest' membership. It linked into the
  // couple dashboard — a 404 for every person it was ever shown to.
  const src = read(AUTOSURFACED);
  assert.equal(
    count(src, /href=\{`\/dashboard\/\$\{event\.event_id\}`\}/),
    0,
    'The auto-surfaced row hardcodes the organiser dashboard again — a guaranteed ' +
      '404 for the guest it is shown to.',
  );
  assert.match(
    src,
    /eventBoardHref\(event\)/,
    'The auto-surfaced row no longer resolves its destination through eventBoardHref.',
  );
});

// ── 4 · OPENING AN EVENT NEVER DROPS WHICH EVENT YOU ARE IN ─────────────────

test('every rail destination stays inside the event you opened', () => {
  const groups = buildCustomerNavGroups('EVT123', { websiteEnabled: true });
  const items = groups.flatMap((g) => g.items);
  assert.ok(items.length >= 5, 'The event rail lost destinations.');
  for (const item of items) {
    assert.ok(
      item.href.startsWith('/dashboard/EVT123'),
      `Rail item "${item.key}" points at ${item.href} — outside the event, so a tab ` +
        'press would drop which event you are in.',
    );
    if (item.matchPrefix && item.matchPrefix !== '__home__') {
      assert.ok(
        item.matchPrefix.startsWith('/dashboard/EVT123'),
        `Rail item "${item.key}" highlights on ${item.matchPrefix}, outside the event.`,
      );
    }
  }
});

test('the event rail is the five destinations plus "Also in this event"', () => {
  const groups = buildCustomerNavGroups('EVT123', { websiteEnabled: true });
  const keysByGroup = Object.fromEntries(
    groups.map((g) => [g.key, g.items.map((i) => i.key)]),
  );
  assert.deepEqual(
    keysByGroup.plan,
    ['home', 'guests', 'explore', 'studio'],
    'The PLAN section changed. Overview · Guests · Marketplace · Studio is the ' +
      'shipped set; Marketplace keeps the key "explore" so no link breaks.',
  );
  assert.deepEqual(keysByGroup.golive, ['launch']);
  assert.deepEqual(
    keysByGroup.also,
    ['schedule', 'seat', 'budget'],
    'The "Also in this event" group changed.',
  );
  // 🔒 BUDGET HAS NO TOP-LEVEL ROW ON PURPOSE (owner 2026-07-10) — it lives
  // inside Marketplace beside Build and Compare, and is surfaced here only as a
  // quiet flat link. Promoting it is a product reversal, not a tidy-up.
  assert.ok(
    !keysByGroup.plan!.includes('budget'),
    'Budget was promoted into the PLAN section. The owner removed that row on ' +
      '2026-07-10; it belongs inside Marketplace.',
  );
});

test('the Marketplace row is the one the mobile tabs also carry', () => {
  const groups = buildCustomerNavGroups('EVT123');
  const market = groups
    .flatMap((g) => g.items)
    .find((i) => i.key === 'explore');
  assert.equal(market?.href, '/dashboard/EVT123/vendors');
  assert.equal(market?.label, 'Marketplace');
});

// ── 5 · CREATING A TRIP IS NEVER REFUSED ────────────────────────────────────

test('ten trips yes — travel is not a gated life type', () => {
  assert.equal(isGatedLifeType('travel'), false);
  const existingTrip: LifeEventRow = {
    event_id: 'trip-1',
    event_type: 'travel',
    display_name: 'Palawan',
    event_date: '2026-12-01',
    archived: false,
    honoree_label: null,
    honoree_dependent_id: null,
    created_at: '2026-08-01T00:00:00Z',
  };
  assert.equal(
    findBlockingLifeEvent([existingTrip], { eventType: 'travel' }, TODAY),
    null,
    'An in-planning trip blocked a second trip. Lifestyle types are UNLIMITED — ' +
      'this is the exact mistake a first draft of the 2026-08-12 drawing made.',
  );
  // …and an admin-created type nobody has taught the gate about fails OPEN.
  assert.equal(isGatedLifeType('brand_new_admin_type'), false);
});

test('two of the same life event still block — the gate is not gutted', () => {
  // The counterpart. Without this, deleting the whole gate passes the test above.
  const existingDebut: LifeEventRow = {
    event_id: 'debut-1',
    event_type: 'debut',
    display_name: 'Ana at 18',
    event_date: '2026-12-01',
    archived: false,
    honoree_label: 'Ana',
    honoree_dependent_id: null,
    created_at: '2026-08-01T00:00:00Z',
  };
  assert.equal(isGatedLifeType('debut'), true);
  assert.ok(
    findBlockingLifeEvent(
      [existingDebut],
      { eventType: 'debut', honoreeLabel: 'ana' },
      TODAY,
    ) !== null,
    'A second in-planning debut for the same honoree is no longer refused.',
  );
});

// ── 6 · THE CREATE GRID HIDES, AND NEVER LOCKS ──────────────────────────────

test('a folded event type is always one tap from being shown', () => {
  // Already shipped — guarded here because "hidden, NEVER locked" is the whole
  // owner ruling (2026-07-17) and a tidy-up that dropped the expander would turn
  // a default into a wall for the debutante planning her own party.
  const src = read(PICKER);
  assert.match(
    src,
    /show all event types/,
    'The "show all event types" doorway is gone from the create grid. Hiding debut ' +
      'and christening then becomes a WALL — and a self-planning debutante or an ' +
      'aunt planning her niece\'s day has no record for us to match.',
  );
  assert.match(
    src,
    /showAllTypes \|\| hidden\.length === 0/,
    'The create grid no longer un-folds when "show all" is pressed.',
  );
});
