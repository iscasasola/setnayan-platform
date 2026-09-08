/**
 * One wedding day, rendered one way.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * *"Date should be more specific with Name of date instead of 2026-12-18, it
 * should be December 18, 2026."*
 *
 * A single vendor screen showed the same day THREE ways at once: the raw ISO
 * key `2026-12-18` on the Accept/Decline chip, `18 Dec.` in the "you're chasing
 * N customers" line, and a third form in the header. A supplier deciding
 * whether they are free that day should not have to work out that all three
 * are one date.
 *
 * 🔑 THE FORMATTER ALREADY EXISTED and was in the wrong house. `formatLongDate`
 * lived in `lib/paperwork.ts`, so five other screens rolled their own
 * `toLocaleDateString(..., { month: 'long' })` rather than import "paperwork" to
 * print a date. A home decides whether something gets reused.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { formatLongDate } from '@/lib/format-date';

const HERE = dirname(fileURLToPath(import.meta.url));
const thread = stripComments(
  readFileSync(
    resolve(HERE, '../app/vendor-dashboard/messages/[threadId]/page.tsx'),
    'utf8',
  ),
);

test('it renders the month by name', () => {
  assert.equal(formatLongDate('2026-12-18'), 'December 18, 2026');
});

test('🔑 the day never shifts with the reader’s timezone', () => {
  // `new Date('2026-12-18')` is UTC midnight — still the 18th in Manila, but
  // the 17th west of Greenwich. A wedding day that moves depending on where the
  // reader sits is the kind of error nobody reports and everybody distrusts.
  const original = process.env.TZ;
  try {
    for (const tz of ['Pacific/Honolulu', 'America/New_York', 'Asia/Manila', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      assert.match(
        formatLongDate('2026-12-18'),
        /December 18, 2026/,
        `the date renders as a different day in ${tz}`,
      );
    }
  } finally {
    process.env.TZ = original;
  }
});

test('it degrades without ever printing "Invalid Date" at a supplier', () => {
  assert.equal(formatLongDate(null), '—');
  assert.equal(formatLongDate(undefined), '—');
  assert.equal(formatLongDate(''), '—');
  assert.equal(formatLongDate('not-a-date'), 'not-a-date');
});

test('the Accept/Decline chip does not show a raw database value', () => {
  // ⚠ RE-POINTED 2026-09-08. The anchor was `inquiryBasics.event_date`, the
  // field fed by the `get_pending_inquiry_basics` RPC. That RPC returned four
  // deliberately NON-IDENTIFYING fields for a MASKED lead; with the mask
  // retired the chips read the same admin-scoped `events` row as the header, so
  // the name above and the date here can no longer disagree. The chip itself
  // is unchanged — this guard watches a rename, which is exactly the rot it
  // warns about, so it names the field rather than a line number.
  const i = thread.indexOf('event.event_date ?');
  assert.ok(i > -1, 're-point this guard — the inquiry date chip moved');
  // 900, not 500: `stripComments` blanks a JSX comment to spaces rather than
  // deleting it, so the explanatory comment sitting between the anchor and the
  // call pads the gap by ~280 characters. A window sized against the source you
  // remember, rather than the source the guard actually reads, fails on correct
  // code — which is exactly what it did first.
  const chip = thread.slice(i, i + 900);
  assert.match(
    chip,
    /formatLongDate\(event\.event_date\)/,
    'the inquiry chip prints the raw ISO key again — the one field a supplier ' +
      'reads before accepting or declining',
  );
});

test('the thread header uses the same formatter', () => {
  assert.match(
    thread,
    /formatLongDate\(event\.event_date\)/,
    'the header date drifted back to its own rendering',
  );
});

test('🔑 NO site on this page renders the date raw — counted, not merely present', () => {
  // ⚠ THE TEST ABOVE CANNOT CATCH A SINGLE SITE REGRESSING. It matches the
  // whole file, and there are now THREE `formatLongDate(event.event_date)`
  // call sites (header · Accept/Decline chip · the customer rail's prop). Break
  // any one and the other two still satisfy it — measured 2026-09-08 by
  // reverting the header to `{event.event_date}` and watching this file stay
  // fully green. Presence is not coverage when the anchor repeats.
  //
  // So assert the ABSENCE of the raw rendering instead, which has no such
  // escape hatch: every site is covered by one check, and a fourth site added
  // later is covered the day it is written.
  const raw = [...thread.matchAll(/\{\s*event\??\.event_date\s*\}/g)];
  assert.equal(
    raw.length,
    0,
    `${raw.length} site(s) on the vendor thread page print the raw ISO date. ` +
      'The owner asked for "December 18, 2026", not "2026-12-18".',
  );

  // And the count itself, so that DELETING a date rather than formatting it
  // cannot read as a pass.
  const formatted = [...thread.matchAll(/formatLongDate\(event\.event_date\)/g)];
  assert.equal(
    formatted.length,
    3,
    `expected 3 formatted date renders (header · inquiry chip · rail prop), found ${formatted.length}`,
  );
});

test('the formatter has a neutral home, not a domain one', () => {
  // It moved out of `paperwork.ts` precisely so that printing a date does not
  // require importing a documents module. If it goes back, the five ad-hoc
  // copies come back with it.
  const paperwork = stripComments(readFileSync(resolve(HERE, '../lib/paperwork.ts'), 'utf8'));
  assert.match(
    paperwork,
    /export \{ formatLongDate \} from '@\/lib\/format-date'/,
    'formatLongDate is defined in paperwork.ts again',
  );
});
