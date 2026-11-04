/**
 * day-check.test.ts — THE DAY, BEFORE YOU ACCEPT (owner 2026-11-04): the words, the failed read, and the one rule.
 *
 *   1. A FAILED READ NEVER SAYS "0 BOOKED". A refused `vendor_day_check` (RLS, a missing grant, an unapplied
 *      migration, an unknown verdict) is `failed`, drawn as "Couldn't check this day" — never a checked day with
 *      zero bookings, never an open day (reads-are-honest, apps/web/app/vendor-dashboard/reads-are-honest.test.ts).
 *      Behaviour against a stubbed client, not only the source.
 *   2. FULL IS THE SERVER'S, NOT A RECOUNT. `full` is the RPC's `slot_full || daily_full`; a card whose own numbers
 *      look full is not allowed to flip the ask to "Waiting list" on its own. The verdict names are exactly the
 *      statuses `vendor_agree_to_lock` answers with — each has a sentence in lib/lock-answer-notice.ts.
 *      (The DB half — the verdict equals the yes for the same row — is
 *      tests/db/the-day-check-agrees-with-the-yes.db.test.ts.)
 *   3. The panel swaps Agree for "Waiting list" ONLY on `dayFull`, and keeps Agree when the read failed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DAY_CHECK_FAILED,
  DAY_CHECK_VERDICTS,
  WAITLIST_ANSWER_STATUSES,
  cardDayWords,
  dayCheckLine,
  parseDayCheck,
  shortDayWords,
  waitlistAnswerNotice,
} from './day-check';
import { LOCK_AGREE_STATUSES } from './lock-answer-notice';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

const OPEN = {
  status: 'ok',
  date: '2026-12-19',
  verdict: 'open',
  slot_full: false,
  daily_full: false,
  competing: 0,
  services: [{ service_id: 's1', name: 'photo_booth', mode: 'day', daily_limit: 4, slots: 0, per_slot: null, slot_limit: 0, booked: 0, is_this_ask: true }],
  booked: [],
  asking: [],
  shortlisted: [{ event_id: 'e9', name: 'Santos & Lim', event_type: 'Wedding' }],
};
const FULL = {
  ...OPEN,
  date: '2027-02-14',
  verdict: 'daily_limit_reached',
  daily_full: true,
  services: [{ ...OPEN.services[0], daily_limit: 1, booked: 1 }],
  booked: [
    { name: 'Lopez & Pineda', event_type: 'Wedding', service: 'photo_booth', service_id: 's1', source: 'setnayan' },
    { name: 'Garcia debut', source: 'outside' },
  ],
  shortlisted: [],
};

test('the line, as the prototype words it — open day and full day', () => {
  const open = parseDayCheck(OPEN)!;
  assert.deepEqual(dayCheckLine(open, shortDayWords(open.date)), { tone: 'ok', text: 'Dec 19 · 0 of 4 booked · 1 shortlisted', full: false });
  const full = parseDayCheck(FULL)!;
  assert.deepEqual(dayCheckLine(full, shortDayWords(full.date)), {
    tone: 'bad',
    text: 'Full on Feb 14 · Lopez & Pineda booked · you take 1 a day',
    full: true,
  });
  assert.equal(cardDayWords(full.services[0]!), 'Full');
  assert.equal(full.services[0]!.name, 'Photo booth');
});

test('FULL IS THE SERVER’S: numbers that look full do not flip the ask without the RPC’s flag', () => {
  const looksFull = parseDayCheck({ ...OPEN, services: [{ ...OPEN.services[0], daily_limit: 1, booked: 1 }] })!;
  assert.equal(looksFull.full, false, 'the panel would offer "Waiting list" where the yes would go through');
  assert.equal(dayCheckLine(looksFull, 'Dec 19').full, false);
});

test('every verdict but "open" is a status the yes answers with, and has its sentence', () => {
  for (const v of DAY_CHECK_VERDICTS.filter((x) => x !== 'open')) {
    assert.ok(LOCK_AGREE_STATUSES.includes(v), `${v} is not a vendor_agree_to_lock status`);
  }
  // …and an unknown verdict is unreadable, never "open".
  assert.equal(parseDayCheck({ ...OPEN, verdict: 'fully_booked' }), null);
  assert.equal(parseDayCheck({ status: 'not_your_booking' }), null);
  assert.equal(parseDayCheck(null), null);
});

test('every waiting-list answer the RPC and the action can give has a sentence', () => {
  const sql = readFileSync(join(HERE, '..', '..', '..', 'supabase', 'migrations', '20271306441834_the_day_check_before_the_yes.sql'), 'utf8');
  const body = sql.slice(sql.indexOf('FUNCTION public.vendor_waitlist_the_ask'));
  const statuses = [...body.matchAll(/'status', '([a-z_]+)'/g)].map((m) => m[1]!);
  assert.ok(statuses.length >= 5, `read ${statuses.length} statuses — the extractor went blind`);
  for (const s of [...new Set(statuses), 'ok_unsent', 'error']) {
    assert.ok(WAITLIST_ANSWER_STATUSES.includes(s), `waiting-list status ${s} has no sentence`);
  }
  assert.equal(waitlistAnswerNotice('something_new')?.tone, 'refused', 'an unknown answer must still be said');
});

/* ── 1 · A FAILED READ IS SAID — behaviour, against a stubbed client ─────────────────────────────────────────── */

function stub(day: { data: unknown; error: unknown }, halls: { data: unknown; error: unknown } = { data: null, error: null }): SupabaseClient {
  return {
    rpc: (name: string) => Promise.resolve(name === 'vendor_day_check' ? day : halls),
  } as unknown as SupabaseClient;
}

test('a refused read is "failed" — never a checked day with zero bookings', async () => {
  // `server-only` throws outside a React Server build; the module's logic is what is under test (the house shim,
  // lib/a-background-pick-shows-at-once.test.ts).
  {
    const Mod = require('node:module');
    const load = Mod._load;
    Mod._load = function (request: string, ...rest: unknown[]) {
      if (request === 'server-only') return {};
      return load.call(this, request, ...rest);
    };
  }
  const { readDayCheck } = await import('./day-check.server');

  for (const res of [
    { data: null, error: { message: 'permission denied for function vendor_day_check', code: '42501' } },
    { data: null, error: null },
    { data: { status: 'ok', verdict: 'open' }, error: null }, // no date — unreadable
    { data: { ...OPEN, verdict: 'something_new' }, error: null },
  ]) {
    const r = await readDayCheck(stub(res), 'row');
    assert.equal(r.kind, 'failed', `${JSON.stringify(res)} was drawn as ${r.kind}`);
  }
  assert.equal((await readDayCheck(stub({ data: { status: 'no_date' }, error: null }), 'row')).kind, 'no_date');
  const ok = await readDayCheck(stub({ data: FULL, error: null }, { data: { status: 'hall_taken', taken: ['Hall A'], free: ['Hall B'] }, error: null }), 'row');
  assert.equal(ok.kind, 'ok');
  assert.deepEqual(ok.halls, { taken: ['Hall A'], free: ['Hall B'] });
  // A failed hall read only drops the hall warning; the day is still checked.
  const noHalls = await readDayCheck(stub({ data: OPEN, error: null }, { data: null, error: { message: 'x' } }), 'row');
  assert.deepEqual([noHalls.kind, noHalls.halls], ['ok', null]);
  assert.match(DAY_CHECK_FAILED, /Couldn’t check this day/);
  assert.doesNotMatch(DAY_CHECK_FAILED, /\b0\b/);
});

/* ── 3 · THE PANEL — Agree gives way only on the server's full ───────────────────────────────────────────────── */

test('the ask panel swaps Agree for "Waiting list" only on the RPC’s full, and both surfaces hand it the read', () => {
  const panel = stripComments(readFileSync(join(HERE, '..', 'app', 'vendor-dashboard', 'clients', '[eventId]', '_components', 'booking-ask-panel.tsx'), 'utf8'));
  const full = panel.match(/const dayFull = ([^;]+);/);
  assert.ok(full, 'booking-ask-panel.tsx lost `dayFull`');
  assert.equal(full[1]!.replace(/\s+/g, ' '), "dayCheck?.kind === 'ok' && dayCheck.check.full", 'dayFull must be the RPC’s flag, and false on a failed read');
  assert.equal((panel.match(/\{dayFull && waitlistAsk \? \(/g) ?? []).length, 1, 'the Agree/Waiting-list swap moved');
  assert.equal((panel.match(/<DayCheckLine read=\{dayCheck\} \/>/g) ?? []).length, 1, 'the day line is not drawn above Agree');
  for (const page of [
    ['clients', '[eventId]', 'page.tsx'],
    ['messages', '[threadId]', 'page.tsx'],
  ]) {
    const src = stripComments(readFileSync(join(HERE, '..', 'app', 'vendor-dashboard', ...page), 'utf8'));
    assert.equal((src.match(/dayCheck=\{dayCheck\}/g) ?? []).length, 1, `${page.join('/')} does not hand the panel its day`);
    assert.equal((src.match(/waitlistAsk=\{vendorWaitlistTheAsk\}/g) ?? []).length, 1, `${page.join('/')} has no Waiting list`);
    assert.ok(/readDayCheck\(supabase, /.test(src), `${page.join('/')} reads the day through another client than the supplier's session`);
  }
});
