/**
 * WHO ELSE WANTS THIS DATE — counts, never names, and never on the couple's
 * side of the conversation.
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────
 * Owner: *"Target date for vendors will show who are also inquiring for that
 * day so they do not need to browse their calendar?"* So the supplier's
 * conversation page says, beside the couple's target date, how many OTHER
 * couples are asking this same shop about that day and how many bookings the
 * shop already holds that week.
 *
 * ── 🔒 THE THREE BOUNDARIES, EACH WITH A TEST ───────────────────────────────
 *  1. COUNTS, NEVER NAMES. The reader asks for counts only; nothing it selects
 *     could carry another couple's identity, and no formatter takes a name.
 *  2. SUPPLIER SIDE ONLY. Nothing under `app/dashboard/` — the couple's tree —
 *     may reach this module. A couple told "two rivals are also chasing this
 *     caterer" has been handed a pressure tactic nobody ruled on.
 *  3. ⚠ THE COUPLE-FACING VERSION THAT ALREADY SHIPS IS NOT PRECEDENT. The
 *     marketplace bench shows a couple "N couples inquired for your date",
 *     floored at 3, running the OPPOSITE direction. It was never ruled on, it
 *     is untouched, and its shape is not permission for anything here.
 *
 * ⚠ IT SCANS THE STRIPPED SOURCE — this file names the forbidden things.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  demandDayLabel,
  vendorDateDemandLine,
  vendorDateDemandNote,
  weekBounds,
} from '@/lib/vendor-date-demand';

const WEB = join(import.meta.dirname, '..');
const MODULE = 'lib/vendor-date-demand.ts';
const moduleSrc = stripComments(readFileSync(join(WEB, MODULE), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE COPY — counts, plural-correct, and silent when there is nothing
// ───────────────────────────────────────────────────────────────────────────

test('the accept-card line reads as the design writes it', () => {
  assert.equal(
    vendorDateDemandLine({ otherInquiries: 2, bookingsThatWeek: 1, dateIso: '2026-12-18' }),
    '18 Dec — 2 other couples are asking you about this date · you hold 1 booking that week.',
  );
});

test('one of a thing is never "1 couples"', () => {
  assert.equal(
    vendorDateDemandLine({ otherInquiries: 1, bookingsThatWeek: 2, dateIso: '2026-12-18' }),
    '18 Dec — 1 other couple is asking you about this date · you hold 2 bookings that week.',
  );
});

test('a clause with nothing in it is dropped, not printed as a zero', () => {
  assert.equal(
    vendorDateDemandLine({ otherInquiries: 3, bookingsThatWeek: 0, dateIso: '2026-12-18' }),
    '18 Dec — 3 other couples are asking you about this date.',
  );
  assert.equal(
    vendorDateDemandLine({ otherInquiries: 0, bookingsThatWeek: 0, dateIso: '2026-12-18' }),
    null,
    'an empty diary says nothing rather than saying "0"',
  );
  assert.equal(vendorDateDemandLine(null), null, 'and a failed read renders nothing at all');
});

test('the rail note is the same facts, shorter', () => {
  assert.equal(
    vendorDateDemandNote({ otherInquiries: 2, bookingsThatWeek: 1, dateIso: '2026-12-18' }),
    '2 other couples asking about 18 Dec · 1 booking held that week',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE WEEK — Monday to Sunday, and no timezone drift
// ───────────────────────────────────────────────────────────────────────────

test('the week runs Monday to Sunday and contains the day itself', () => {
  // 2026-12-18 is a Friday.
  assert.deepEqual(weekBounds('2026-12-18'), { from: '2026-12-14', to: '2026-12-20' });
  // A Monday is the first day of its own week, not the last of the previous.
  assert.deepEqual(weekBounds('2026-12-14'), { from: '2026-12-14', to: '2026-12-20' });
  // A Sunday belongs to the week whose Monday preceded it.
  assert.deepEqual(weekBounds('2026-12-20'), { from: '2026-12-14', to: '2026-12-20' });
});

test('the day is parsed from the string, so it never slips a day westward', () => {
  // ⚠ `new Date('2026-12-18')` is midnight UTC; local getters then report the
  // 17th for every reader west of Greenwich — the bug that printed the wrong
  // day on 41 screens (2026-08-04).
  assert.equal(demandDayLabel('2026-12-18'), '18 Dec');
  assert.equal(demandDayLabel('2027-01-01'), '1 Jan');
  assert.equal(demandDayLabel('not-a-date'), null);
  assert.equal(demandDayLabel(null), null);
  assert.equal(weekBounds(null), null);
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · 🔒 COUNTS, NEVER NAMES
// ───────────────────────────────────────────────────────────────────────────

test('nothing this module reads could carry another couple’s identity', () => {
  for (const forbidden of ['display_name', 'slug', 'public_id', 'host_name']) {
    assert.equal(
      moduleSrc.includes(forbidden),
      false,
      `the reader must never select ${forbidden} — the counts are the supplier's, the names are not`,
    );
  }
  // Both reads are head-only counts, so no row content crosses the wire at all.
  assert.equal(
    (moduleSrc.match(/count: 'exact',\s*\n?\s*head: true/g) ?? []).length,
    2,
    'both reads are counts; a row-returning select is a spill waiting for a render',
  );
});

test('both embeds name their foreign key, or the line silently never appears', () => {
  // 🚨 `events!inner` is REFUSED by PostgREST with PGRST201: one direct foreign
  // key reaches `events` from here, and nineteen junction tables also join the
  // two, so it finds many routes and refuses rather than guessing. This repo
  // has already lost three features to it silently — including *"another couple
  // is holding this supplier on your date"*, a caution never once shown.
  //
  // ⚠ ASKING PRODUCTION FOR THE FOREIGN KEYS DOES NOT PREDICT THIS. That query
  // returns exactly one FK per table, which reads as "unambiguous" and is the
  // wrong question. This assertion tests the CLAIM — that the junction is named
  // — rather than the proxy that made it look safe.
  //
  // `the-cure-was-already-written-down.test.ts` scans the whole tree for the
  // `event_vendors` half. This one also pins the `chat_threads` half, which no
  // guard covers, and which fails in exactly the same silent way.
  assert.equal(
    (moduleSrc.match(/events!inner/g) ?? []).length,
    0,
    'a bare events!inner is a query that returns nothing and says nothing',
  );
  assert.match(moduleSrc, /events!chat_threads_event_id_fkey!inner\(event_date\)/);
  assert.match(moduleSrc, /events!event_vendors_event_id_fkey!inner\(event_date\)/);
});

test('the shipped same-day RPC is left exactly where it was', () => {
  // 🔑 RULE 0. `get_vendor_same_day_bookings` answers an adjacent question and
  // was read before this was built. It could not serve: its body REQUIRES the
  // caller to be BOOKED on the event on screen, and the surface this line is
  // for is the accept card of a PENDING inquiry. It is therefore not called
  // here — and not modified either, since its booked-gate and its missing
  // `vendor_team_members` union are both load-bearing.
  assert.equal(moduleSrc.includes('get_vendor_same_day_bookings'), false);
  const desk = readFileSync(join(WEB, 'app/[slug]/_lib/supplier-desk.server.ts'), 'utf8');
  assert.match(desk, /get_vendor_same_day_bookings/, 'its one call site is untouched');
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · 🔒 SUPPLIER SIDE ONLY
// ───────────────────────────────────────────────────────────────────────────

test('the couple’s tree cannot reach this line', () => {
  const readers = walk(join(WEB, 'app'))
    .filter((f) => !/\.test\.tsx?$/.test(f))
    .filter((f) => stripComments(readFileSync(f, 'utf8')).includes('vendor-date-demand'))
    .map((f) => relative(WEB, f));

  assert.ok(readers.length > 0, 'the line must be rendered SOMEWHERE, or this guard proves nothing');

  const wrongSide = readers.filter((f) => !f.startsWith('app/vendor-dashboard/'));
  assert.deepEqual(
    wrongSide,
    [],
    'this is the supplier’s own commercial position; the couple must never see it',
  );
});

test('the couple’s own thread page says nothing about who else wants the date', () => {
  const couple = stripComments(
    readFileSync(join(WEB, 'app/dashboard/[eventId]/messages/[threadId]/page.tsx'), 'utf8'),
  );
  for (const phrase of ['other couples', 'other couple is asking', 'booking that week']) {
    assert.equal(couple.includes(phrase), false, `the couple must never read "${phrase}"`);
  }
});
