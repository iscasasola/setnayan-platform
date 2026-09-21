/**
 * the-event-is-over-and-somebody-says-so.test.ts — CTRL-B2 build 1.
 *
 * ── THE DEFECT, measured 2026-09-22 against prod ────────────────────────────
 * `coupleConfirmReceived` requires `service_marked_complete_at`. Production:
 * **51 bookings, that column set on 0 of them, `vendor_reviews` empty.** No
 * couple has ever been able to confirm delivery, so the review door has never
 * opened, so no shop has a track record, so nothing feeds the next booking.
 * **The retention loop has never closed once** — and the reason was that the
 * chain had no starter motor: there was no `mark_complete` kind on the desk,
 * and no writer for the column anywhere in the application.
 *
 * Most of this file EXECUTES `needsCompletionMark`; only the mounts are
 * source-read, and each is counted.
 *
 * 🛡 Mutation-checked — sabotages listed per test, all confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { needsCompletionMark, COMPLETION_ASK_AFTER_DAYS } from '@/lib/answers-desk';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

const BOOKED = { status: 'contracted', eventDate: '2026-06-01', serviceMarkedCompleteAt: null };
/** Comfortably after the event, in any timezone. */
const LATER = new Date('2026-06-10T00:00:00+08:00');

// SABOTAGE: include 'considering' in BOOKED_FOR_COMPLETION → RED.
test('only a really-booked shop is asked whether they delivered', () => {
  for (const status of ['contracted', 'deposit_paid', 'delivered', 'complete']) {
    assert.equal(needsCompletionMark({ ...BOOKED, status }, LATER), true, `${status} must be asked`);
  }
  for (const status of ['considering', 'shortlisted', null, '', 'unknown_future_state']) {
    assert.equal(
      needsCompletionMark({ ...BOOKED, status }, LATER),
      false,
      `${JSON.stringify(status)} must NOT be asked — a shop that was only ever considered did not work the day, and the mark unlocks a review`,
    );
  }
});

// SABOTAGE: drop the `serviceMarkedCompleteAt` early return → RED.
test('a booking already marked is never asked again', () => {
  assert.equal(
    needsCompletionMark({ ...BOOKED, serviceMarkedCompleteAt: '2026-06-02T00:00:00Z' }, LATER),
    false,
    'the timestamp starts the couple\'s 7-day auto-confirm clock — asking twice would restart it and push their confirmation further away on every press',
  );
});

// SABOTAGE: compare with `new Date(eventDate)` (UTC midnight) → RED on the
// PH-morning case, which is the whole reason the parse is pinned to +08:00.
test('nobody is asked during their own celebration', () => {
  const eventDate = '2026-06-01';
  const c = { ...BOOKED, eventDate };
  // 8am in Manila on the day itself — exactly what UTC midnight renders as.
  assert.equal(
    needsCompletionMark(c, new Date('2026-06-01T08:00:00+08:00')),
    false,
    'asked eight hours into their own event day — a desk that does not know what day it is stops being read',
  );
  assert.equal(
    needsCompletionMark(c, new Date('2026-06-01T23:59:00+08:00')),
    false,
    'a wedding runs past midnight; the day itself is never the day to ask',
  );
  assert.equal(
    needsCompletionMark(c, new Date('2026-06-02T00:00:00+08:00')),
    true,
    'the day after, in Manila, is when the ask opens',
  );
  assert.equal(COMPLETION_ASK_AFTER_DAYS, 1, 'the delay is one day — change it deliberately, not by accident');
});

// SABOTAGE: `if (!c.eventDate) return true` → RED.
test('an unreadable date asks NOTHING — this rule fails closed', () => {
  for (const eventDate of [null, '', 'not-a-date', '2026-13-45']) {
    assert.equal(
      needsCompletionMark({ ...BOOKED, eventDate }, LATER),
      false,
      `${JSON.stringify(eventDate)} must not produce a card — an over-eager row asks a supplier to assert something that is not yet true, and that assertion unlocks a review and a confirmation`,
    );
  }
});

// ── THE MOUNTS — counted, so a deletion cannot pass as an absence ───────────

// SABOTAGE: remove the `mark_complete` branch from the card switch → RED.
test('the desk can DRAW the row and TAKE the answer on it', () => {
  const sections = read('app/vendor-dashboard/_components/overview-sections.tsx');
  assert.equal(
    count(sections, /card\.kind === 'mark_complete'/),
    1,
    'a desk that assembles a card it cannot draw renders nothing — exactly the silence this build removes',
  );
  assert.equal(
    count(sections, /<form action=\{markServiceComplete\}>/),
    1,
    'the answer must be given ON the row — a card that names the job and cannot accept it is a second dead end',
  );
});

// SABOTAGE: delete the readBookingsAwaitingCompletion call → RED.
// SABOTAGE: drop completionAwaiting from the eventIds spread → RED.
test('the overview reads the bookings AND their dates', () => {
  const overview = read('lib/vendor-overview.ts');
  assert.equal(
    count(overview, /readBookingsAwaitingCompletion\(admin, vendorProfileId\)/),
    1,
    'no read, no card',
  );
  assert.equal(
    count(overview, /completionAwaiting\.rows\.map\(\(b\) => b\.event_id\)/),
    1,
    'without the event ids in the meta lookup every row reads eventDate: null, needsCompletionMark refuses ALL of them, and the card silently never appears',
  );
  assert.match(
    overview,
    /kind: 'mark_complete'/,
    'the card must actually be pushed onto the feed',
  );
});

// 🪤 RULE 0 CAUGHT THIS BUILD MID-FLIGHT. The first version of this file
// asserted a NEW `vendorMarkServiceComplete` written for the desk. It already
// existed, in the same file, and was better — it also sets
// `completion_status: 'vendor_marked'`, which the new one missed.
//
// 🔑 THE MEASUREMENT THAT MISSED IT WAS A `grep … | head`. The writer was real
// and was simply BELOW THE CUT, so a truncated non-zero result read as a
// complete one. The desk kind genuinely was absent; the writer never was.
//
// So this test now asserts there is exactly ONE writer, and that the desk uses
// it — the duplicate is the thing to guard against, not the absence.
// SABOTAGE: paste a second vendorMarkServiceComplete into the file → RED.
test('there is exactly ONE completion writer, and it was already shipped', () => {
  const actions = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.equal(
    count(actions, /export async function vendorMarkServiceComplete/),
    1,
    'a second writer would set service_marked_complete_at without completion_status, leaving the couple confirmable but the handshake mid-state',
  );
  const fn = /export async function vendorMarkServiceComplete[\s\S]*?\n}/.exec(actions)?.[0] ?? '';
  assert.match(
    fn,
    /completion_status: 'vendor_marked'/,
    'the mark and the handshake status move together — that is what the shipped writer does and why it was not replaced',
  );
  assert.match(
    fn,
    /\.is\('service_marked_complete_at', null\)/,
    'a second press must be a no-op — the timestamp starts the couple\'s 7-day auto-confirm clock',
  );
});

// SABOTAGE: pass a vendor_id into the form → RED.
test('the desk posts what the shipped action actually reads', () => {
  const sections = read('app/vendor-dashboard/_components/overview-sections.tsx');
  // 🪤 `/function MarkCompleteBody\([\s\S]*?\n}/` STOPS AT THE DESTRUCTURING'S
  // OWN CLOSING BRACE — a 60-character window containing only the parameter
  // list, in which `name="vendor_id"` can never appear, so the assertion below
  // would have passed no matter what the component posted. Slice to the NEXT
  // top-level function instead, and FLOOR the length so a window that collapses
  // again fails loudly rather than passing vacuously.
  const start = sections.indexOf('function MarkCompleteBody(');
  assert.ok(start > 0, 'MarkCompleteBody not found — this guard is pointed at nothing');
  const next = sections.indexOf('\nfunction ', start + 1);
  const body = sections.slice(start, next > 0 ? next : undefined);
  assert.ok(
    body.length > 400,
    `MarkCompleteBody window collapsed to ${body.length} chars — a guard that cannot see the form cannot fail`,
  );
  assert.equal(
    count(body, /name="event_id"/),
    1,
    'the action resolves the booking from (event, this shop) and reads event_id only',
  );
  assert.equal(
    count(body, /name="vendor_id"/),
    0,
    'passing a vendor id would LOOK like it scoped the write when the action ignores it entirely',
  );
});
