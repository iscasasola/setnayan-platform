/**
 * 🚶 ROUND 9 — W1's first check of the never-fixed supplier findings, live c0c8ff4 (14 Nov 2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { launchOfferFeesLine, type LaunchOfferSettings } from './launch-offer';
import { clientFilingDate, onlyCandidateDay } from './vendor-customer-pipeline';

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const offer = (o: Partial<LaunchOfferSettings>): LaunchOfferSettings => ({
  enabled: true,
  cap: 2000,
  papicCredits: 50,
  cycleDays: 28,
  startedAt: '2026-10-08T00:00:00.000Z',
  closedAt: null,
  proEndsAt: null,
  used: 3,
  ...o,
});

test('F-W1-30 · the Booking fees page names the launch offer while it runs — from the live settings, never typed', () => {
  const now = Date.parse('2026-11-14T00:00:00.000Z');
  const line = launchOfferFeesLine(offer({}), now);
  assert.match(line ?? '', /^Launch offer · Setnayan's first 2,000 bookings are free — 1,997 still open\./);
  // Closed, switched off, unset or unreadable: nothing about it (never a guess about money).
  assert.equal(launchOfferFeesLine(offer({ enabled: false }), now), null);
  assert.equal(launchOfferFeesLine(offer({ cap: null }), now), null);
  assert.equal(launchOfferFeesLine(offer({ used: 2000 }), now), null);
  assert.equal(launchOfferFeesLine(null, now), null);
  const page = code('app/vendor-dashboard/booking-fees/page.tsx');
  assert.match(page, /launchOfferFeesLine\(await readLaunchOffer\(createAdminClient\(\)\)/);
  assert.match(page, /data-fees-launch-offer=""/);
  assert.doesNotMatch(page, /first 2,?000 bookings/, 'the cap is never typed into the page');
});

test('F-W1-47 · a client with ONE candidate day files under that day, not under "No date yet"', () => {
  assert.equal(onlyCandidateDay(['2027-06-19']), '2027-06-19');
  assert.equal(onlyCandidateDay(['2027-06-19', '2027-06-26']), null, 'several candidates: no single day');
  assert.equal(onlyCandidateDay([]), null);
  assert.equal(onlyCandidateDay(null), null);
  assert.equal(clientFilingDate({ eventDate: null, onlyCandidateDate: '2027-06-19' }), '2027-06-19');
  assert.equal(clientFilingDate({ eventDate: '2027-01-02', onlyCandidateDate: '2027-06-19' }), '2027-01-02', 'a fixed day wins');
  const sort = code('app/vendor-dashboard/customers/clients-show-sort.ts');
  assert.match(sort, /if \(group === 'day'\) return \(r\) => clientFilingDate\(r\) \?\? 'No date yet';/);
  assert.match(sort, /c\.sort === 'date'\) return \(clientFilingDate\(a\)/);
  const page = code('app/vendor-dashboard/customers/page.tsx');
  assert.match(page, /onlyCandidateByEvent\.set\(e\.event_id, onlyCandidateDay\(e\.date_candidates\)\)/);
  assert.match(page, /onlyCandidateDate: onlyCandidateByEvent\.get\(eventId\) \?\? null,/);
});

test('RW-59 · an event dated only by its one picked day: the Hub and the reply page read ONE reply window', async () => {
  const { replyWindow, REPLY_WINDOW_EVENT_COLUMNS } = await import('./reply-window');
  // /w3-barkada-hangout as measured in prod (14 Nov 2026): a get-together, no event_date, one candidate, default ask.
  const raw = {
    event_type: 'simple_event',
    event_date: null,
    event_end_date: null,
    launch_mode: 'auto',
    manual_phase: null,
    std_invitation_launch_date: null,
    guest_list_edit_deadline: null,
    rsvp_ask_config: null,
    date_candidates: ['2026-12-20'],
  };
  const face = { phasesEnabled: true, solemn: false };
  const now = Date.parse('2026-11-14T03:00:00.000Z');
  const { withPickedDate } = await import('./event-anchor');
  // The Hub's loader dates the row (withPickedDate) before asking; the reply page passes the raw row. Same answer.
  const hub = replyWindow(withPickedDate(raw), now, 'Asia/Manila', face);
  const replyPage = replyWindow(raw, now, 'Asia/Manila', face);
  assert.deepEqual(replyPage, hub, 'the reply page and the Hub disagree about the window');
  // Every reader that selects the window's own columns now carries the picked day.
  assert.match(REPLY_WINDOW_EVENT_COLUMNS, /\bdate_candidates\b/);
  for (const f of ['app/[slug]/invite/reply/page.tsx', 'app/[slug]/invite/enter/page.tsx']) {
    assert.match(code(f), /std_invitation_launch_date[^`]*date_candidates`/, f);
  }
});
