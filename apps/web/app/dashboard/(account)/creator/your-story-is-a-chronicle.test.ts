/**
 * Your Story is a CHRONICLE — the shape the owner asked for on 2026-08-20.
 *
 *   1. the celebration picker offers days that are OVER;
 *   2. the "accept vendor offers" toggle is gone and stays gone;
 *   3. the chapter number is DERIVED — no screen lets anybody type one;
 *   4. a `?event=` handed in by the browser is only honoured when it is really
 *      one of this account's offered celebrations.
 *
 * Source-level, like the other guards on this surface: these are claims about
 * what the page DOES, and each one below was mutation-checked by occurrence
 * count (before → after) rather than by eye.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(process.cwd(), 'app', 'dashboard', '(account)', 'creator');
const page = () => readFileSync(join(HERE, 'page.tsx'), 'utf8');
const offerActions = () => readFileSync(join(HERE, 'offer-actions.ts'), 'utf8');
const participation = () =>
  readFileSync(join(process.cwd(), 'lib', 'chapter-event-participation.ts'), 'utf8');

/** Occurrences of a global regex — the number a mutation has to move. */
function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

/** Source with block + line comments stripped: a guard must not read a note
 *  ABOUT the removed thing as the thing itself. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the ACCEPT VENDOR OFFERS toggle is gone — owner: it is forever on', () => {
  const body = code(page());
  assert.equal(
    count(body, /setCreatorAcceptsOffers/g),
    0,
    'The vendor-offers toggle is back on Your Story. The owner ruled it is ' +
      'always on (2026-08-20) — every account can be a storyteller.',
  );
  assert.equal(
    count(body, /Accept vendor offers/g),
    0,
    'The vendor-offers toggle tile is back.',
  );
  assert.equal(
    count(code(offerActions()), /export async function setCreatorAcceptsOffers/g),
    0,
    'The writer is back. With no screen behind it that is an action nobody can ' +
      'reach — and the column it wrote is what keeps offers flowing.',
  );
});

test('the column survives the toggle — the opt-out mechanism is not destroyed', () => {
  // 🔑 Removing a switch is safe here ONLY because the column defaults TRUE.
  // The note that says so must stay with the code, because the day somebody
  // wants the opt-out back, the column is what makes it a one-screen job.
  assert.match(
    offerActions(),
    /creator_accepts_offers/,
    'The note explaining that the column is kept (and still read) is gone.',
  );
});

test('the picker offers CONCLUDED celebrations only', () => {
  const lib = code(participation());
  assert.match(
    lib,
    /isFinishedEvent\(/,
    'The concluded test is gone — the picker is offering days that have not ' +
      'happened, and a chapter is the story of a day that has.',
  );
  assert.match(
    lib,
    /keep\.has\(e\.event_id\) \|\| hasConcluded\(e, todayISO\)/,
    'The offer filter changed shape. It must offer concluded celebrations PLUS ' +
      'the ones a chapter is already attached to.',
  );
});

test('AN ALREADY-ATTACHED CELEBRATION IS NEVER FILTERED AWAY', () => {
  // 🪤 The save path re-proves the tie through this same list. Without the
  // keep-set, a host who moved their date forward would silently detach their
  // own written chapter — and the database drops the host's inclusion decision
  // on any event change, so it would not come back by re-attaching.
  const lib = code(participation());
  assert.match(
    lib,
    /loadLinkableEvents\(userId, \{ keepEventIds: \[eventId\] \}\)/,
    'resolveEventTie stopped keeping the submitted celebration in the list, so ' +
      'saving a chapter can now detach it from its day.',
  );
  assert.match(
    code(page()),
    /keepEventIds: chapters\.map\(\(c\) => c\.event_id\)/,
    'The composer no longer keeps the days its own chapters are attached to.',
  );
});

test('the chapter number is DERIVED, never typed', () => {
  const body = code(page());
  assert.match(
    body,
    /groupChronicleByYear\(chapters/,
    'The chronicle grouping is gone — chapters are back to an undated list.',
  );
  assert.equal(
    count(body, /name="(chapter_)?number"|name="volume"/g),
    0,
    'A field asking somebody which chapter they are on has appeared. The owner ' +
      'ruled the number is automated: "They do not decide what chapter they are on."',
  );
  assert.match(
    body,
    /Chapter \$\{number\}/,
    'The card stopped printing its derived number.',
  );
});

test('the year is a HEADING, not a Volume', () => {
  // "Vol. I · No. 7" already means SETNAYAN's publication cycle on the couple's
  // editorial masthead and every Real Stories card. One masthead word cannot
  // mean two scopes on two pages a couple reads minutes apart.
  const body = code(page());
  assert.equal(
    count(body, /\bVol\.\s|\bVolume\b/g),
    0,
    'Your Story is printing "Volume". That word is taken — it is Setnayan’s ' +
      'own edition cycle on the editorial masthead.',
  );
  assert.match(
    body,
    /block\.year \?\? 'Not placed yet'/,
    'The year heading is gone.',
  );
});

test('a ?event= from the browser only preselects a celebration really on offer', () => {
  const body = code(page());
  assert.match(
    body,
    /myEvents\.some\(\(e\) => e\.event_id === prefillEventId\)/,
    'The prefill is no longer checked against the offered list — anybody could ' +
      'preselect a celebration this account cannot attach.',
  );
});

/* ── the season shape (owner 2026-08-20, second ruling) ─────────────────── */

test('the composer asks WHEN it happened', () => {
  const body = code(page());
  assert.match(
    body,
    /name="happened_on"/,
    'The one question that puts a chapter in the right year is gone. Without it a ' +
      '2019 trip written up today files under 2026.',
  );
  assert.match(
    body,
    /max=\{manilaToday\(\)\}/,
    'The date ceiling is not Manila’s today. `new Date().toISOString()` is today ' +
      'in UTC — yesterday for eight hours of every Philippine evening — so ' +
      'somebody writing up tonight’s party would find their own day greyed out.',
  );
});

test('the chronicle reads the author’s own day FIRST', () => {
  assert.match(
    code(page()),
    /happenedOn: c\.happened_on/,
    'The composer stopped handing the author’s stated day to the chronicle, so ' +
      'their answer changes nothing.',
  );
});

test('the public timeline shows the YEAR, and never says "Your year"', () => {
  const profile = code(
    readFileSync(join(process.cwd(), 'app', 'u', '[userSlug]', 'page.tsx'), 'utf8'),
  );
  assert.match(
    profile,
    /groupChronicleByYear\(chapters/,
    'The public timeline is a flat list again — nobody reading a person’s story ' +
      'ever sees a year.',
  );
  // ⚠ The class was renamed when the timeline became three sizes
  // (uprof-tl-year → uprof-yr-*). The INVARIANT is unchanged: a reader must see
  // the year. Anchored to the rendered mark, not to the old spine's name.
  assert.match(profile, /uprof-yr-mark/, 'the year heading is gone');
  assert.match(profile, /uprof-yr-n/, 'the year itself no longer renders');
  assert.equal(
    count(profile, /Your year/g),
    0,
    '"Your year" is the name of a DIFFERENT page in the same menu — the one that ' +
      'looks forward at what is coming. Same words on two things is exactly the ' +
      'collision the Event Hub vocabulary lock exists to prevent.',
  );
  assert.match(
    profile,
    /happenedOn: c\.happened_on/,
    'The public timeline stopped reading the day the author gave it.',
  );
});

test('the number restarts inside each year', () => {
  const lib = code(
    readFileSync(join(process.cwd(), 'lib', 'creator-chronicle.ts'), 'utf8'),
  );
  assert.match(
    lib,
    /seenInYear/,
    'Numbering runs across a whole life again. Then a memory added years later ' +
      'shifts the number on every chapter after it — including ones already read.',
  );
});

/* ── who can read it (owner 2026-08-20, item 4) ─────────────────────────── */

test('the composer offers all three answers, and the middle one only with a celebration', () => {
  const body = code(page());
  assert.match(
    body,
    /CHAPTER_AUDIENCES\.map/,
    'The three-way choice is gone — "who can read this" is back to a Publish button.',
  );
  assert.match(
    body,
    /choice === 'event' && !canShareWithEvent\(c\.event_id\)/,
    'The middle answer is offered on a chapter about no celebration, where its ' +
      'only possible outcome is a refusal.',
  );
  assert.equal(
    count(body, /action=\{publishChapter\}|action=\{unpublishChapter\}/g),
    0,
    'The old two-door publish/unpublish pair is back beside the three-way choice.',
  );
});

test('ONLY the public answer touches the public page', () => {
  const actions = code(
    readFileSync(join(HERE, 'actions.ts'), 'utf8'),
  );
  assert.match(
    actions,
    /audience === 'published' && profile && profile\.public_profile_enabled !== true/,
    'Sharing a chapter with one celebration now flips the author’s whole profile ' +
      'public — the opposite of what they just asked for.',
  );
  assert.match(
    actions,
    /audience === 'published' && wasPrivate/,
    'Followers are notified for something that is not an announcement.',
  );
});

test('the event page never decides for itself who is one of the celebration’s people', () => {
  const slugPage = code(
    readFileSync(join(process.cwd(), 'app', '[slug]', 'page.tsx'), 'utf8'),
  );
  assert.match(
    slugPage,
    /ownerCapability \|\| vendorCapability \|\| viewerHoldsASeat \|\| session\?\.event_id === event\.event_id/,
    'The gate on the day’s stories changed shape. On a PUBLIC event page a ' +
      'passer-by must get an empty list — the four ways to belong are the host, ' +
      'a booked supplier, a signed-in seat-holder, and a guest carrying their pass.',
  );
  assert.match(
    slugPage,
    /findGuestSeatForUser\(event\.event_id, viewerAccount\.id\)/,
    'The signed-in guest with a seat and no current pass is unrecognised again — ' +
      'the most ordinary invited person there is, because the pass expires long ' +
      'before a wedding booked a year out.',
  );
});
