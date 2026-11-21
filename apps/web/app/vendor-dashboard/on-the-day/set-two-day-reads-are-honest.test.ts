/**
 * set-two-day-reads-are-honest.test.ts — WHEN A READ FAILS, THE PAGE STAYS, AND SAYS SO, on page 8 of "supplier pages,
 * set two" (owner-approved 21 Nov 2026; drawing `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html`
 * `#p8`, its two frames marked "Honest state · new", and the shared `#fail` rule). The same disease
 * `../set-two-reads-are-honest.test.ts` and `../reads-are-honest.test.ts` pin elsewhere:
 *
 *   1. THE COUPLE'S PROGRAM. `fetchRunOfShowBlocks` answers `null` for a refused read and `[]` for an empty program,
 *      and the event day folded both into `[]` — the now/next tiles read "—" and the floor clock read as if nothing was
 *      on, the same as a couple who wrote no program. Now the page carries the measured flag (`programUnread`) and the
 *      body decides it BEFORE anything that would draw an empty program: one warn note with Try again inside it, in
 *      place of the now/next tiles, the clock line and the Now / Up next card; the "coming" tile (its own read) stays.
 *   2. THE PAPIC DESK. A failed read sent the supplier back to the floor with no word (a redirect). Now a read that
 *      could not answer — the profile read threw, or the bookings read could not reach its end and this event is not
 *      among what it did read — renders the page shell, the title, "We couldn’t load this event’s Papic right now." and
 *      Try again as the one main button. The FAILED answer is decided before the REFUSED one.
 *   3. A GATE THAT REFUSES STILL REFUSES. The counsel switch off, no shop of your own, not booked on this event → the
 *      same `redirect(back)` as before; the fee unpaid → the shared locked-by-fee page. Unchanged.
 *   4. The bookings read says when its FIRST arm (the schedule pool) could not finish — until now a refused pool read
 *      was logged and read as "not booked", which is exactly the redirect rule 2 retires.
 *
 * Held as properties of each file's source — which read is measured, and that the failed branch is decided BEFORE the
 * absent one (an order a count over a file cannot see).
 *
 * 🛡 Mutation-checked (2026-11-21), each broken on purpose and seen RED, then restored:
 *   · page: `const programUnread = blocksRaw === null;` → `= false;` (rule 1);
 *   · body: `{programUnread ? null : (` around `<FloorClock` removed — the clock drawn over an unread program (rule 1);
 *   · body: the counts filter `programUnread ? counts.filter(…)` → `counts` — the "—" tiles back (rule 1);
 *   · papic page: the `!room.complete` line moved below `if (!booking) redirect(back);` (rule 2, order);
 *   · papic page: the profile `catch` → `catch { redirect(back); }` (rule 2);
 *   · papic page: `if (!booking) redirect(back);` deleted — a not-booked shop shown the desk (rule 3);
 *   · lib: `let complete = poolComplete && candidateRead.complete;` → `= candidateRead.complete;` (rule 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const readWeb = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const LIVE = 'live/[eventId]';
const COULDNT = /We couldn(?:&rsquo;|’|')t load/;

test('rule 1 · the couple’s program read carries a measured flag — failed is never drawn as empty', () => {
  const lib = readWeb('app/_actions/run-of-show.ts');
  const fn = lib.slice(lib.indexOf('export async function fetchRunOfShowBlocks'));
  assert.ok(fn.indexOf('if (error) return null;') > -1, 'the program read no longer answers null for a refused read');
  assert.ok(fn.indexOf('if (error) return null;') < fn.indexOf('.map((b) =>'), 'the refused read must be answered before the rows are mapped');

  const page = read(`${LIVE}/page.tsx`);
  const flagAt = page.indexOf('const programUnread = blocksRaw === null;');
  const foldAt = page.indexOf('const blocks = blocksRaw ?? [];');
  assert.ok(flagAt > -1, 'the page no longer measures whether the program was read');
  assert.ok(foldAt > flagAt, 'the flag must be measured BEFORE the read is folded into []');
  assert.match(page, /programUnread=\{programUnread\}/, 'the measured flag does not reach the body');

  const body = read(`${LIVE}/_components/event-day-body.tsx`);
  assert.match(body, /const shownCounts = programUnread \? counts\.filter\(\(t\) => t\.key === 'coming'\) : counts;/, 'an unread program still draws its "—" tiles');
  assert.match(body, /<EventHubCounts tiles=\{shownCounts\} \/>/);
  const note = body.indexOf('<ReadFailedNote mark="program">');
  assert.ok(note > -1, 'the unread program has no note of its own');
  assert.match(body.slice(note, note + 160), COULDNT);
  assert.match(body.slice(note, note + 160), /the couple&rsquo;s program right now\./);
  const clockGuard = body.indexOf('{programUnread ? null : (');
  assert.ok(clockGuard > -1 && clockGuard < body.indexOf('<FloorClock blocks={blocks} />'), 'the floor clock is drawn over an unread program');
  assert.match(body, /\{showRunOfShow && !programUnread \? \(\s*<DayRunOfShow eventId=\{eventId\} blocks=\{blocks\} \/>/, 'the Now / Up next card is drawn over an unread program');
  assert.match(readWeb('app/vendor-dashboard/_components/set-two/read-failed.tsx'), /end=\{<TryAgain \/>\}/, 'the note lost its Try again');
});

test('rule 1 · the "coming" tile keeps its own honest words', () => {
  const page = read(`${LIVE}/page.tsx`);
  assert.match(page, /key: 'coming', value: brief \? [^,]+, word: brief \? 'coming \(RSVP\)' : 'couldn’t load'/);
});

test('rule 2 · a Papic read that could not answer renders the honest page — never a redirect', () => {
  const page = read(`${LIVE}/papic/page.tsx`);
  assert.doesNotMatch(page, /fetchVendorRoomEvents\(/, 'the plain bookings read cannot say it did not finish');
  assert.match(page, /await fetchVendorRoomEventsDetailed\(supabase, profile\.vendor_profile_id\)\.catch\(\(\) => null\)/);
  assert.match(
    page,
    /try \{\s*profile = await fetchOwnVendorProfile\(supabase, user\.id\);\s*\} catch \{\s*return <PapicReadFailed eventId=\{eventId\} \/>;\s*\}/,
    'a profile read that threw must render the honest page',
  );
  const failedAt = page.indexOf('if (!booking && (room === null || !room.complete)) return <PapicReadFailed eventId={eventId} />;');
  const refusedAt = page.indexOf('if (!booking) redirect(back);');
  assert.ok(failedAt > -1, 'an unfinished bookings read no longer renders the honest page');
  assert.ok(refusedAt > failedAt, 'the FAILED branch must be decided BEFORE the not-booked redirect');

  const body = read(`${LIVE}/_components/papic-desk-body.tsx`);
  const fn = body.slice(body.indexOf('export function PapicReadFailed'));
  assert.match(fn, /<PartPage column="mx-auto w-full tab:max-w-3xl" mark="papic">/, 'the failed page lost its shell');
  assert.match(fn, /<PapicPin title="Papic capture"/, 'the failed page lost its title');
  assert.match(fn, /<ReadFailedBody mark="papic">We couldn&rsquo;t load this event&rsquo;s Papic right now\.<\/ReadFailedBody>/);
  assert.doesNotMatch(fn.slice(0, fn.indexOf('export type PapicCapture')), /redirect\(|notFound\(/);
});

test('rule 3 · a gate that refuses still refuses — redirect or the fee lock, as before', () => {
  const page = read(`${LIVE}/papic/page.tsx`);
  const counsel = page.indexOf('if (!(await isVendorPapicCaptureEnabled())) redirect(back);');
  const noShop = page.indexOf('if (!profile) redirect(back);');
  const notBooked = page.indexOf('if (!booking) redirect(back);');
  const fee = page.indexOf("if (feeGate.stage !== 'unlocked') {");
  assert.ok(counsel > -1, 'the counsel switch no longer fails closed');
  assert.ok(noShop > counsel, 'no shop of your own no longer sends you back');
  assert.ok(notBooked > noShop, 'a shop not booked here is no longer sent back');
  assert.ok(fee > notBooked, 'the fee lock is no longer asked after the booking');
  assert.match(page.slice(fee, fee + 200), /return \(\s*<EventLockedPage/, 'the unpaid fee no longer shows the shared locked page');
});

test('rule 4 · the bookings read says when the schedule pool could not finish', () => {
  const sched = readWeb('lib/vendor-schedule.ts');
  const fn = sched.slice(sched.indexOf('export async function fetchVendorPoolBookingsDetailed'), sched.indexOf('export async function fetchVendorBlocks('));
  assert.match(fn, /return \{ bookings: \[\], complete: read\.complete \};/);
  assert.match(fn, /return \{ bookings: entries, complete: read\.complete \};/);
  const room = readWeb('lib/vendor-room-access.ts');
  assert.match(room, /const \{ bookings: pool, complete: poolComplete \} = await fetchVendorPoolBookingsDetailed\(client, vendorProfileId\);/);
  assert.match(room, /let complete = poolComplete && candidateRead\.complete;/, 'a refused pool read reads as "not booked" again');
});
