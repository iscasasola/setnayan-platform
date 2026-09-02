/**
 * event-hub-control.test.ts — the controller renders in all three phases, and
 * it never states a fact it did not measure.
 *
 * ── THE DEFECT THIS PINS ────────────────────────────────────────────────────
 * `app/dashboard/[eventId]/launch/page.tsx` gathers the couple's whole public
 * address — the four stages of their one link and the three day-of services —
 * and it was written for the wedding day. Its copy branches on
 * `eventHasHappened` alone, so the months BEFORE the day (when the
 * save-the-date and the invitation are the entire product) and the months
 * after (when the story is) got the day-of page with one word changed.
 *
 * ── AND THE TRAP UNDER IT ───────────────────────────────────────────────────
 * Two lifecycle resolvers live one import apart and mean different things.
 * `getLifecyclePhase` says which of the four PUBLIC pages the link is showing;
 * `getMenuLifecyclePhase` says whether the celebration has happened. Their
 * disagreement is not exotic — it is every couple, every day, for months:
 *
 *     107 days out ....... stage = save_the_date   phase = plan
 *      31 days out ....... stage = rsvp            phase = plan
 *
 * Same phase, different page. `the two resolvers are NOT interchangeable` below
 * is the mutation-facing assertion: swap the resolvers in `resolveHubStage` and
 * both couples resolve to 'plan', which is not a LifecyclePhase at all, so no
 * channel is marked "Active now" and the couple 31 days out is told their
 * save-the-date is live while their guests are already on the RSVP.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. The honest-read half is tested the same
 * way `guests-read-is-honest.test.ts` tests it: not that the error is logged,
 * but that the two cases are DISTINGUISHABLE at the value the render consumes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHubStage,
  resolveHubPhase,
  resolveHubStanding,
  resolveHubFacts,
  resolveHubNextStep,
  hubOffersAllowed,
  type HubEventRead,
  type HubGuestRead,
} from '@/lib/event-hub-control';

const MNL = 'Asia/Manila';
const at = (iso: string) => new Date(iso).getTime();

/** "Now" for every observation below: 2 September 2026, mid-morning in Manila. */
const NOW = at('2026-09-02T10:00:00+08:00');

const event = (over: Partial<HubEventRead> = {}): HubEventRead => ({
  measured: true,
  eventDate: '2026-12-18',
  eventEndDate: null,
  clearedAt: null,
  timezone: MNL,
  slug: 'maria-and-jomar',
  ...over,
});

const guests = (over: Partial<HubGuestRead> = {}): HubGuestRead => ({
  measured: true,
  invited: 90,
  replied: 61,
  ...over,
});

/* ══════════════════════════════════════════════════════════════════════════
   THE THREE OBSERVATIONS — one page, three phases, correct in each
   ══════════════════════════════════════════════════════════════════════════ */

test('⭐ 107 DAYS OUT — the save-the-date is the live page, and the page is planning', () => {
  const read = event({ eventDate: '2026-12-18' }); // 2026-09-02 → 2026-12-18 is 107 days
  const standing = resolveHubStanding(read, NOW);
  assert.equal(standing.stage, 'save_the_date', 'the guests are looking at the save-the-date');
  assert.equal(standing.phase, 'plan', 'and the couple is still planning');

  const [stage, replies, quiet, day] = resolveHubFacts(read, guests(), NOW);
  assert.equal(stage.value, 'Save-the-Date live');
  assert.equal(replies.value, '61 of 90 in');
  assert.equal(quiet.value, '29 have not replied');
  assert.equal(day.value, 'In 107 days', 'the fourth fact is the countdown, in the venue clock');

  const next = resolveHubNextStep(standing, read, guests());
  assert.equal(next.key, 'replies');
  assert.match(next.headline, /29 guests have not replied yet/);

  assert.equal(hubOffersAllowed(standing.phase), true, 'months out, an offer is welcome');
});

test('⭐ TODAY — the day-of page is live, the copy is the day, and NOTHING is for sale', () => {
  const read = event({ eventDate: '2026-09-02' });
  const now = at('2026-09-02T15:00:00+08:00');
  const standing = resolveHubStanding(read, now);
  assert.equal(standing.stage, 'event', 'the guests are on the day-of surface');
  assert.equal(standing.phase, 'dayof');

  const [stage, , , day] = resolveHubFacts(read, guests(), now);
  assert.equal(stage.value, 'The day itself');
  assert.equal(day.value, 'Today');

  const next = resolveHubNextStep(standing, read, guests());
  assert.equal(next.key, 'day', 'the day names itself — it does not ask for a purchase');
  assert.doesNotMatch(next.blurb, /unlock|upgrade|₱/i);

  // ⛔ § 5.1 rule 3. An offer never outranks the day.
  assert.equal(hubOffersAllowed(standing.phase), false);
});

test('⭐ LAST MONTH — the story is the live page, and the offers have closed', () => {
  const read = event({ eventDate: '2026-08-02' });
  const standing = resolveHubStanding(read, NOW);
  assert.equal(standing.stage, 'editorial');
  assert.equal(standing.phase, 'after');

  const [stage, , , day] = resolveHubFacts(read, guests(), NOW);
  assert.equal(stage.value, 'The story');
  assert.equal(day.value, '31 days ago', 'never a bare negative number');

  const next = resolveHubNextStep(standing, read, guests());
  assert.equal(next.key, 'story');
  assert.equal(next.ctaPath, '/website/editorial', 'channel 4 opens the existing workroom');

  assert.equal(hubOffersAllowed(standing.phase), false, 'the day-of rows close rather than sell');
});

/* ══════════════════════════════════════════════════════════════════════════
   THE TRAP — the two resolvers are not interchangeable
   ══════════════════════════════════════════════════════════════════════════ */

test('🚨 the two resolvers are NOT interchangeable — same phase, different live page', () => {
  const faraway = event({ eventDate: '2026-12-18' }); // 107 days out
  const soon = event({ eventDate: '2026-10-03' }); //  31 days out

  // The menu resolver cannot tell these apart. That is not a bug in it — its
  // job is "has it happened", and neither has.
  assert.equal(resolveHubPhase(faraway, NOW), 'plan');
  assert.equal(resolveHubPhase(soon, NOW), 'plan');

  // The stage resolver MUST tell them apart, because their guests are looking
  // at two different pages.
  assert.equal(resolveHubStage(faraway, NOW), 'save_the_date');
  assert.equal(resolveHubStage(soon, NOW), 'rsvp');
  assert.notEqual(
    resolveHubStage(faraway, NOW),
    resolveHubStage(soon, NOW),
    'if these ever agree, the stage is being resolved from the menu phase',
  );

  // Non-vacuity: the stage value is never one of the menu phase's values, so a
  // swapped resolver cannot pass this file by coincidence.
  for (const read of [faraway, soon]) {
    const stage = resolveHubStage(read, NOW) as string;
    assert.ok(
      !['plan', 'dayof', 'after'].includes(stage),
      `the stage resolved to '${stage}', which is a MENU phase — the resolvers have been swapped`,
    );
  }
});

test('🚨 a host who closed out their day is "after" even with the date still ahead', () => {
  // `cleared_at` is read by the menu resolver and DELIBERATELY not by the
  // public one (closing out the day must not retire the guests' page mid
  // celebration). So this is the second place the two legitimately disagree.
  const clearedEarly = event({ eventDate: '2026-12-18', clearedAt: '2026-09-01T09:00:00+08:00' });
  assert.equal(resolveHubPhase(clearedEarly, NOW), 'after', 'the couple has closed it out');
  assert.equal(
    resolveHubStage(clearedEarly, NOW),
    'save_the_date',
    'and their guests still see the page the date says they should',
  );
  assert.equal(hubOffersAllowed(resolveHubPhase(clearedEarly, NOW)), false);
});

/* ══════════════════════════════════════════════════════════════════════════
   UNREAD IS NOT EMPTY — the measurement reaches the render
   ══════════════════════════════════════════════════════════════════════════ */

test('⭐ a REFUSED event read states no stage, no phase and no countdown', () => {
  // The refusal shape: `data` is null, so eventDate is null. Both resolvers
  // answer that honestly — 'save_the_date' and 'plan' — and BOTH answers are
  // about a null date, not about this event. Rendering them is the defect.
  const refused = event({ measured: false, eventDate: null, slug: null });
  const standing = resolveHubStanding(refused, NOW);
  assert.equal(standing.stage, null, 'unknown, not the first stage');
  assert.equal(standing.phase, null, 'unknown, not "plan"');

  const facts = resolveHubFacts(refused, guests(), NOW);
  assert.equal(facts[0].known, false);
  assert.equal(facts[0].value, null);
  assert.equal(facts[3].known, false, 'and no countdown to a date we did not read');
  assert.equal(facts[3].value, null);

  const next = resolveHubNextStep(standing, refused, guests());
  assert.equal(next.key, 'unreadable', 'no instruction is issued from a read that never came back');
});

test('⭐ a REFUSED guest read blanks the reply facts — it does not print "0 of 0"', () => {
  const read = event();
  const refused = guests({ measured: false, invited: 0, replied: 0 });
  const [, replies, quiet] = resolveHubFacts(read, refused, NOW);
  assert.equal(replies.known, false);
  assert.equal(replies.value, null, '"0 of 0 in" to a couple with 180 names is the whole defect');
  assert.equal(quiet.known, false);
  assert.equal(quiet.value, null);

  // …and the next step must not read the silence as "you have nobody".
  const next = resolveHubNextStep(resolveHubStanding(read, NOW), read, refused);
  assert.equal(next.key, 'unreadable');
  assert.notEqual(next.key, 'guests', '"Add the people you are inviting" is the same lie with a verb');
});

test('⭐ the refused and the genuinely-empty cases are DISTINGUISHABLE', () => {
  const read = event();
  const refused = resolveHubFacts(read, guests({ measured: false, invited: 0, replied: 0 }), NOW);
  const genuine = resolveHubFacts(read, guests({ measured: true, invited: 0, replied: 0 }), NOW);

  assert.equal(genuine[1].value, '0 of 0 in', 'a real empty list is a fact, and may be stated');
  assert.equal(refused[1].value, null, '…and an unread one may not');
  assert.notEqual(refused[1].known, genuine[1].known, 'the flag is the only thing that separates them');

  const standing = resolveHubStanding(read, NOW);
  assert.equal(
    resolveHubNextStep(standing, read, guests({ measured: true, invited: 0, replied: 0 })).key,
    'guests',
    'a genuinely empty list SHOULD be asked to fill itself',
  );
});

test('an event with no date set says so, rather than counting down to nothing', () => {
  const undated = event({ eventDate: null });
  const [stage, , , day] = resolveHubFacts(undated, guests(), NOW);
  assert.equal(day.value, 'Not set yet');
  assert.equal(day.known, true, 'a measured absence is a fact, unlike an unread one');
  assert.equal(stage.value, 'Save-the-Date live', 'and no date is the very start of the life');
});

test('the countdown is read in the VENUE clock, not the server clock', () => {
  // 2026-09-03 in Manila is still 2026-09-02 in UTC. A server-clock countdown
  // says "In 1 day" to a couple whose wedding is today.
  const read = event({ eventDate: '2026-09-03', timezone: MNL });
  const justAfterMidnightMNL = at('2026-09-03T00:30:00+08:00'); // = 2026-09-02T16:30Z
  const [, , , day] = resolveHubFacts(read, guests(), justAfterMidnightMNL);
  assert.equal(day.value, 'Today');
});

test('the link comes before the guest list — you cannot invite people to nowhere', () => {
  const noSlug = event({ slug: null });
  const standing = resolveHubStanding(noSlug, NOW);
  const next = resolveHubNextStep(standing, noSlug, guests({ invited: 0, replied: 0 }));
  assert.equal(next.key, 'link');
  assert.equal(next.ctaPath, '/website/editor');
});

test('every reply in is its own state, not a silent zero', () => {
  const read = event();
  const [, replies, quiet] = resolveHubFacts(read, guests({ invited: 90, replied: 90 }), NOW);
  assert.equal(replies.value, '90 of 90 in');
  assert.equal(quiet.value, 'Everyone replied');
  assert.equal(
    resolveHubNextStep(resolveHubStanding(read, NOW), read, guests({ invited: 90, replied: 90 })).key,
    'ready',
  );
});
