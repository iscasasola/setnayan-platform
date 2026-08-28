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
  splitFinishedByStory,
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

/**
 * The body of a `<section id="NAME">` … `</section>` block, by brace-free
 * scanning from the opening tag to the matching closing tag at the same depth.
 */
function sectionBody(src: string, id: string): string {
  const open = src.indexOf(`id="${id}"`);
  assert.notEqual(open, -1, `<section id="${id}"> is gone from the launcher.`);
  const from = src.lastIndexOf('<section', open);
  let depth = 0;
  let i = from;
  while (i < src.length) {
    if (src.startsWith('<section', i)) depth++;
    else if (src.startsWith('</section>', i)) {
      depth--;
      if (depth === 0) return src.slice(from, i + 10);
    }
    i++;
  }
  assert.fail(`<section id="${id}"> is never closed.`);
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

test('the launcher renders EVERY shelf, always', () => {
  const src = launcher();
  // FIVE SHELVES SINCE 2026-08-21 (owner). The two this test was written for
  // are still here under the names he chose: "Coming up" → "Planning", and the
  // finished pair → "Untold"/"Told". Renaming a shelf is a copy decision; a
  // shelf DISAPPEARING is the regression, and that is what these still catch.
  assert.match(
    src,
    /<SectionLabel[\s\S]{0,400}?>\s*Planning\s*<\/SectionLabel>/,
    'The "Planning" shelf heading is gone.',
  );
  assert.match(
    src,
    /<SectionLabel[\s\S]{0,400}?>\s*Worth planning\s*<\/SectionLabel>/,
    'The "Worth planning" shelf is gone — the days that come around for this ' +
      'person have no other home now that the Your Year menu is retired.',
  );
  assert.match(
    src,
    /<SectionLabel[\s\S]{0,500}?>\s*Now happening\s*<\/SectionLabel>/,
    'The "Now happening" row is gone.',
  );
  // The finished shelf is a NAMED place. Its name depends on whether this
  // account's stories could be read: "Untold" when they were (owner
  // 2026-08-21), "Ended" when they were not. Either way it is named, and either
  // way every finished celebration is on it.
  assert.match(
    src,
    /storiesMeasured\s*\n?\s*\? 'The day has passed/,
    'The Untold shelf lost the sentence its (i) reveals.',
  );
  assert.match(
    src,
    /\{storiesMeasured \? 'Untold' : 'Ended'\}/,
    'The finished shelf heading is gone — the second shelf must be a NAMED ' +
      'place, not an unlabelled tail of the first.',
  );
  assert.match(
    src,
    /id="finished"/,
    'The Finished section lost its own anchor, so nothing can link to it.',
  );
  assert.match(
    src,
    /id="published"/,
    'The Published shelf lost its own anchor.',
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
  /*
    ⚠ ONE COMPOSITION SINCE 2026-08-23 (owner ruling — `DECISION_LOG.md`). The
    board used to render every shelf twice, phone and desktop, so these counts
    read `>= 2`. They are EXACT now rather than relaxed: a second mapping means
    a second card composition came back, which is the thing the ruling removed.
  */
  assert.equal(
    count(src, /unwritten\.map\(/),
    1,
    'The finished shelf either renders no cards, or renders a second ' +
      'composition of them. One card, every width.',
  );
});

test('the finished cards are gated by NOTHING except emptiness', () => {
  // 🚨 THE THIRD HOLE, and it is this file's claim #1 — somebody's memories must
  // not sit behind a switch. It was enforced by counting three IDENTIFIERS
  // (`showAll`, `show=all`, `sp.show`) to zero, so any other name for the same
  // gate passed; and the `finished.map(` count was satisfied inside an arbitrary
  // condition. **A guard can match a string instead of the act.**
  //
  // This asserts the ACT: inside the shelf, the ONLY conditions are whether
  // there are any cards, and — since the 2026-08-20 split — whether the stories
  // could be read at all. The second one is allowed ONLY in front of the
  // write-the-story chips, never in front of a card, which the position checks
  // below prove rather than trust.
  const section = sectionBody(launcher(), 'finished');
  const conditions = [...section.matchAll(/\{([^{}]+?)\s*\?\s*\(/g)].map((m) =>
    m[1]!.trim(),
  );
  // ⚠ TIGHTENED 2026-08-22. This used to allow a second condition,
  // `storiesMeasured`, because a stand-alone "Write the story of X" chip was
  // rendered behind it below the cards. The owner retired that chip — the CARD
  // now carries the story destination itself — so the branch is gone and the
  // only condition left in this shelf is whether it is empty. Accepting the old
  // pair would let the gate creep back in front of a card.
  assert.deepEqual(
    conditions,
    ['unwritten.length === 0'],
    'The finished shelf has a condition other than "is it empty" standing in ' +
      `front of it: ${JSON.stringify(conditions)}. Whatever it is named, that ` +
      'is a switch in front of somebody\'s memories.',
  );
  assert.equal(
    count(section, /unwritten\.map\(/),
    1,
    'The finished section either renders no cards, or renders a second ' +
      'composition of them.',
  );
  // AND NO CARD MAY BE PUT BEHIND THE MEASURED GATE. `storiesMeasured` still
  // decides the shelf's NAME and the story override's destination, but it must
  // never wrap a card again: a refused read would empty somebody's memories.
  assert.doesNotMatch(
    section,
    /storiesMeasured \?\s*\(/,
    'A `storiesMeasured ? (…)` branch is back inside the finished shelf. Whatever ' +
      'it wraps, a failed read of the stories would make it vanish.',
  );
  assert.ok(
    section.indexOf('GlassEventCard') > 0,
    'The finished shelf no longer renders the event card.',
  );
});

test('every finished celebration is on exactly one shelf', () => {
  // The split is only safe because it is EXHAUSTIVE: unmeasured puts everything
  // on the first shelf, measured puts each event on exactly one of the two.
  // Proven on the function, not on the markup.
  const finished = [
    { event_id: 'a', member_type: 'couple' },
    { event_id: 'b', member_type: 'couple' },
  ] as never as Parameters<typeof splitFinishedByStory>[0];
  for (const ids of [null, new Set<string>(), new Set(['a']), new Set(['a', 'b'])]) {
    const { unpublished, published } = splitFinishedByStory(finished, ids);
    assert.deepEqual(
      [...unpublished, ...published].map((e) => e.event_id).sort(),
      ['a', 'b'],
      'A finished celebration fell off the board entirely.',
    );
  }
});

test('the Untold card itself opens THAT EVENT\'S OWN story page — no separate chip', () => {
  // ⚠ THE MECHANISM CHANGED AGAIN ON 2026-08-22, SAME DAY. The previous
  // version of this test pinned a stand-alone "Write the story of X" chip
  // rendered BELOW the card grid. The owner then asked for the chip gone
  // entirely and the CARD itself to jump straight to the story page — two
  // controls for one celebration collapsed into the one a person actually
  // presses. A `<Link>` still does the navigating and still writes nothing;
  // what moved is which element carries the href.
  const src = launcher();
  assert.doesNotMatch(
    src,
    /Write the story of/,
    'The stand-alone chip is back. The card itself is meant to be the control now.',
  );
  assert.match(
    src,
    /storyHref=\{\s*storiesMeasured && canWriteStoryFor\(event\)\s*\?\s*`\/dashboard\/\$\{event\.event_id\}\/website\/editorial`\s*:\s*undefined\s*\}/,
    "The Untold shelf's cards no longer override their href to that event's own story page.",
  );
  /*
    ⚠ THERE USED TO BE TWO CARD GRIDS ON THIS SHELF — a phone chip grid and a
    desktop card grid — and this counted the override to 2 because wiring it
    into only one opened correctly on a laptop and wrongly on the phone that
    showed it to the owner. Since 2026-08-23 one card renders at every width
    (owner ruling — `DECISION_LOG.md`), so the correct count is 1.

    🔑 THE PROPERTY IS UNCHANGED AND THE CHECK IS NOT WEAKER: it is still EXACT,
    so a second grid appearing without the override — the original defect — still
    fails here, and so does the override going missing altogether.
  */
  const overrideCount = (
    src.match(
      /storyHref=\{\s*storiesMeasured && canWriteStoryFor\(event\)\s*\?\s*`\/dashboard\/\$\{event\.event_id\}\/website\/editorial`\s*:\s*undefined\s*\}/g,
    ) ?? []
  ).length;
  assert.equal(
    overrideCount,
    1,
    'The story-page override is wired into a number of Untold card ' +
      'renderings (mobile chips vs. the desktop grid) — the other still opens ' +
      "the ordinary event dashboard.",
  );
  assert.doesNotMatch(
    src,
    /href=\{`\/dashboard\/creator\?event=/,
    'A card points at the Storyteller composer again. That is a different ' +
      'kind of writing — a blank page, one day can have several, a supplier can ' +
      'write one too.',
  );
});

test('the story-page override never reaches a guest or an unmeasured board', () => {
  // The override is gated on the SAME two conditions the retired chip used:
  // `storiesMeasured` (a refused read must not be treated as "nothing written")
  // and `canWriteStoryFor` (only the organiser may open that editor). Losing
  // either guard sends a guest, or a board whose read failed, straight into a
  // celebration's private story editor.
  const src = launcher();
  assert.match(
    src,
    /storyHref=\{\s*storiesMeasured && canWriteStoryFor\(event\)/,
    'The story-page override no longer checks storiesMeasured && canWriteStoryFor together.',
  );
});

test('the empty Finished shelf explains the shelf and claims no zero', () => {
  const src = launcher();
  assert.match(
    src,
    /unwritten\.length === 0/,
    'The empty state for the finished shelf is gone.',
  );
  assert.match(
    src,
    /Celebrations move here on their own/,
    'The empty finished shelf lost the line that says what it is FOR.',
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
  // ⚠ 2026-08-22: two of these now render `href={resolvedHref}`, where
  // `resolvedHref = storyHref ?? href` — the Untold shelf sends its cards to the
  // celebration's own story page. The derivation is UNCHANGED and is still the
  // fallback, which the second assertion below pins: an override that stopped
  // falling back to `href` would strand an invited guest on a 404 again, which
  // is the exact bug this whole test exists for.
  for (const component of ['GlassEventCard']) {
    const body = fnBody(src, component);
    if (/const resolvedHref =/.test(body)) {
      assert.match(
        body,
        /const resolvedHref = storyHref \?\? href;/,
        `${component}'s href override no longer falls back to the shared ` +
          'derivation — an invited guest with no public page gets a dead link.',
      );
      assert.match(
        body,
        /href=\{resolvedHref\}/,
        `${component} computes resolvedHref and then does not use it.`,
      );
      continue;
    }
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
  assert.equal(
    count(src, /\{closedReason\}/),
    1,
    'The card stopped rendering the reason — a dead card that explains nothing ' +
      'reads as the app being broken, or as the couple pulling their page. More ' +
      'than one means a second composition returned.',
  );
  assert.match(
    fnBody(src, 'GlassEventCard'),
    /\{closedReason\}/,
    'The reason must be rendered by the card itself, not by a wrapper that ' +
      'some shelf might forget.',
  );
});

test('CardShell actually renders a LINK when there is a destination', () => {
  // 🚨 A HOLE IN MY OWN GUARD, found by an adversarial audit of this very file.
  // This PR moved "turn an href into a link" out of the three card components and
  // into CardShell — but the per-component assertions only prove the href is
  // HANDED to CardShell. Nothing proved CardShell renders a <Link> at all, so it
  // could have returned a <div> in every case and **every card on the board would
  // have stopped being clickable with all tests green.**
  const body = fnBody(launcher(), 'CardShell');
  assert.match(
    body,
    /<Link href=\{href\} className=\{className\} style=\{style\}>/,
    'CardShell stopped rendering a <Link>. Every card on the board is then dead, ' +
      'and nothing else in this file would notice.',
  );
  assert.match(
    body,
    /if \(!href\) \{/,
    'CardShell no longer distinguishes "has a destination" from "does not".',
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
  // Anchored to the ACT (the named list is consulted by the strip), not to the
  // exact formatting of the expression — a prettier run must not break CI.
  assert.match(
    body,
    /\.filter\([\s\S]{0,200}?PRESSABLE_CLASSES as readonly string\[\]\)\.includes\(c\)/,
    'The affordance strip is gone or no longer consults PRESSABLE_CLASSES.',
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
  /*
    The two phone-only compositions that used to print `stanceLabel(stance)`
    directly are gone; the one card wears the badge, asserted above. The
    per-component slicing is KEPT rather than collapsed to a file-level match —
    `StanceChip`'s own body uses the helper, so a file-level count is satisfied
    by the helper defining itself and cannot see a card going quiet.
  */
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

test('the invited memberships are actually PUT ON the board', () => {
  // 🚨 THE SECOND HOLE. The headline feature is "invited events reach the board",
  // and the only caller-side proof was that the launcher CALLS fetchUserEvents
  // with 'guest'. Nothing asserted the RESULT was used — so dropping it on the
  // floor one word later passed. A call is not a consequence.
  const src = launcher();
  assert.match(
    src,
    /const boardEvents = mergeBoardMemberships\(events, invitedEvents\);/,
    'The invited rows are read and then discarded — the board is organiser-only ' +
      'again, which is exactly how it shipped before this change.',
  );
  assert.match(
    src,
    /splitEventBoard\(\s*boardEvents,\s*todayISO,\s*\)/,
    'The shelves are split from something other than the merged set.',
  );
});

test('the ⌘K index cannot offer a dead jump', () => {
  /*
    🪤 THIS GUARD READ THE WRONG FILE FOR ONE COMMIT, AND THAT IS THE LESSON.
    The index it protects moved on 2026-08-14 — out of `(launcher)/page.tsx`
    and into `_components/frontdoor/command-data.ts`, because the shared top
    bar renders the palette on all five signed-in trees and two builders would
    have listed different things on /dashboard than inside a wedding. Left
    pointed here the guard would have gone green over a file that no longer
    contains an index at all: a guard reading a file that cannot contain the
    defect is decoration.

    🔑 WHAT IT PROTECTS IS UNCHANGED AND IS NOT NEGOTIABLE. The couple
    dashboard admits ORGANISERS ONLY, so an index that derives
    `/dashboard/${event_id}` puts a 404 behind a search result offered to the
    very person who was just told they belong. `lib/event-board.ts` is the only
    authority on where a membership may go — see
    [[project_setnayan_guest_doors_are_not_dashboards]], where this rule has
    now been broken NINE times across four PRs.
  */
  const src = readFileSync(
    resolve(HERE, '..', '..', '_components', 'frontdoor', 'command-data.ts'),
    'utf8',
  );
  assert.ok(
    src.length > 500,
    'command-data.ts is missing or a stub — every assertion below would pass ' +
      'vacuously. The index has moved again; follow it, do not delete this.',
  );
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
  // …and the launcher must NOT have grown a second index back.
  assert.doesNotMatch(
    launcher(),
    /const commandItems: HomeCommandItem\[\]/,
    'The launcher is building its own palette index again, beside the shared ' +
      'one. Two builders is two answers to one question.',
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
  /*
    🚨 PERSONALIZATION AND HOSTS WERE ADDED 2026-08-18 BECAUSE THEY HAD NO DOOR.
    Both are real, live routes, and the only component linking to either
    (`_components/profile-menu.tsx`) is imported by NOTHING — superseded by the
    account switcher, which carries neither row. The only way in was typing the
    address. The owner found it in four minutes by looking for the put-away
    button and not finding it.

    🔑 A LINK IN A COMPONENT NOBODY MOUNTS IS NOT A LINK. Every check we have
    asks whether the route renders, and it does — which is why this survived.

    They belong in the EVENT's own list, not the account menu: that menu is
    about you, and "put this celebration away" is about the event.
  */
  assert.deepEqual(
    keysByGroup.also,
    ['personalization', 'hosts', 'refer', 'schedule', 'seat', 'budget'],
    'The "Also in this event" group changed.',
  );
  // Both must actually point somewhere inside this event.
  const also = groups.find((g) => g.key === 'also')!.items;
  assert.equal(
    also.find((i) => i.key === 'personalization')?.href,
    '/dashboard/EVT123/details',
  );
  assert.equal(also.find((i) => i.key === 'hosts')?.href, '/dashboard/EVT123/hosts');
  /*
    ⏳ REFER WAS NEVER CLICKABLE FOR A SINGLE DAY. The account switcher replaced
    the old profile menu on 2026-06-17; this link was added to that already-dead
    menu on 2026-07-10, three weeks later. The morning's fix restored two of the
    dead menu's rows and missed this third one — which is why the coverage check
    is now DERIVED from that component rather than hand-listed.

    🔒 It keeps the key 'refer' so the event layout's existing `navHideKeys` gate
    hides it while the referral programme is off. That gate had been filtering on
    a key no item carried, so it hid nothing while still costing a query on every
    event page render.
  */
  assert.equal(also.find((i) => i.key === 'refer')?.href, '/dashboard/EVT123/refer');
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

// ── 7 · THE HOME HEADER IS ONE LINE ─────────────────────────────────────────

test('home has no greeting eyebrow and no tail hanging off the title', () => {
  // Owner 2026-08-18, on a screenshot of this exact header: "we do not need
  // these. it just eats up space and we want it to be simpler to understand on
  // each page without too much side comments" — and on the target, "look at how
  // apple makes everything simple." The rest of the app's page headers became
  // one row in PR #4557; this one is built differently and was missed by that
  // sweep's lint, whose scope is an `.sn-eye` inside a `<header>`.
  //
  // Both regressions are silent: a greeting line and a grey tail render
  // perfectly, they just put two more things above the thing you came for.
  const src = stripComments(read(LAUNCHER));
  assert.doesNotMatch(
    src,
    /Kumusta,\s*\{greeting\}/,
    'The greeting eyebrow is back above the title. It is the shape the owner ' +
      'pointed at on 2026-08-18 (and the composer that once repeated the name ' +
      'below it is itself retired, 2026-08-20).',
  );
  assert.doesNotMatch(
    src,
    /Pick up where you left off/,
    'The returning-user tail is back. It is decoration hanging off the title — ' +
      'the state the owner actually screenshotted.',
  );
  // NOT a "no <span> in the h1" rule: the point is ONE line, not a ban on markup.
  // ⚠ UPDATED 2026-08-19. This pinned the per-state title
  // `{noEvents ? '…first event.' : 'Where to?'}`. The page is now ONLY events,
  // and the zero-state had to go with the rest: `fetchUserEvents` degrades to
  // `[]` on any error, so "Let's set up your first event." was a claim the page
  // could not stand behind — and on an events-only page it would be the whole
  // screen shown to somebody with six weddings whose read just failed.
  // ⚠ UPDATED 2026-08-20 — the title is UNPAINTED, not deleted (owner:
  // "Remove Your Events on My Events. we don't need that text."). The top bar
  // already names this place, so the visible h1 was the same word twice.
  //
  // The rule this now holds is the one that survived: the page still HAS a
  // name — stripping the h1 outright would leave the document with no heading
  // at all and start the outline at "Coming up" with no parent — and that name
  // still claims nothing about how many events you have, so it stays true when
  // the read fails.
  assert.match(
    src,
    /<h1 className="sr-only">\s*Your events\s*<\/h1>/,
    'The home title must still exist for a screen reader and must still claim ' +
      'nothing about how many events you have.',
  );
  assert.doesNotMatch(
    src,
    /<h1 className="text-\[1\.375rem\]/,
    'The visible page title is back. The owner removed it on 2026-08-20 as a ' +
      'duplicate of the Events nav entry directly above it.',
  );
});
