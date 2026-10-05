/**
 * ONE COUNTDOWN RULE, AND IT IS NEVER FALSE — the guest countdown's Days and
 * Home's "days to go" are the same number, and that number is never more than
 * the time actually left.
 *
 * Found live by the controller, 2026-10-05, on maria-and-jose (2026-12-12,
 * Asia/Manila): Details read 67 days while Home read "68 days to go". Ruling
 * (controller, same day): ONE rule — whole days of real time left to the start
 * of the day in the event's zone (Manila when it has none). The four tiles are
 * exact (67 d 12 h 42 m on 5 Oct at 11:18); Home says "67 days to go", then
 * "Tomorrow" and "Today" at the end.
 *
 * Holds, for every half hour of several Manila days: countdown Days ===
 * Home's printed number (`homeFacts().daysToGo`, its tile `days`) === the hub's
 * scene template (`sceneFactsFor`); the tiles add up to the real time left; the
 * eve says "Tomorrow" and the day "Today"; no zone means Manila, never the
 * server's UTC; and Home's dashboard prints the rule, not the calendar count.
 */
// Run as the server does (Vercel is UTC), whatever this machine's zone — so the
// "never the server's clock" case can fail here, not only in CI.
process.env.TZ = 'UTC';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { countdownReading, countdownTargetMs } from './countdown-target';
import { homeFacts } from './home-facts';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

/** maria-and-jose, as prod holds it (read 2026-10-05). */
const MJ = { event_date: '2026-12-12', timezone: 'Asia/Manila', venue_latitude: null, venue_longitude: null, event_date_precision: 'day' };
const EMPTY_STATS = { total: 0, attending: 0, declined: 0, pending: 0, maybe: 0 } as never;

const home = (now: Date, timezone: string | null = MJ.timezone) =>
  homeFacts({
    eventDate: MJ.event_date,
    precision: MJ.event_date_precision,
    timezone,
    guests: { stats: EMPTY_STATS, measured: false },
    money: null,
    now,
  });

const target = () => {
  const t = countdownTargetMs(MJ.event_date, MJ.timezone);
  assert.ok(t !== null);
  return t;
};
const countdownDays = (now: Date) => countdownReading(target(), now.getTime()).days;

/** Every half hour from Manila midnight of `day` for 24 h. */
function halfHours(day: string): Date[] {
  const start = Date.parse(`${day}T00:00:00+08:00`);
  return Array.from({ length: 48 }, (_, i) => new Date(start + i * 30 * 60_000 + 17_000));
}

test('1 · on 5 Oct the countdown and Home both say 67 — at every half hour of the Manila day', () => {
  for (const now of halfHours('2026-10-05')) {
    const h = home(now);
    assert.deepEqual(h.daysToGo, { kind: 'days', days: 67 }, now.toISOString());
    assert.deepEqual(h.days, { value: '67', label: 'days to go' }, now.toISOString());
    assert.equal(countdownDays(now), 67, `countdown at ${now.toISOString()}`);
  }
});

test('2 · never false: the four tiles are exactly the time left — 67 d 12 h 42 m at 11:18', () => {
  const now = Date.parse('2026-10-05T11:18:00+08:00');
  const r = countdownReading(target(), now);
  assert.deepEqual({ days: r.days, hours: r.hours, minutes: r.minutes, seconds: r.seconds }, { days: 67, hours: 12, minutes: 42, seconds: 0 });
  // The tiles add back up to the real remainder, at every half hour of three days.
  for (const day of ['2026-10-05', '2026-12-10', '2026-12-11']) {
    for (const at of halfHours(day)) {
      const x = countdownReading(target(), at.getTime());
      const told = ((x.days * 24 + x.hours) * 60 + x.minutes) * 60_000 + x.seconds * 1000;
      const left = target() - at.getTime();
      assert.ok(told <= left && left - told < 1000, `tiles say ${told} ms, ${left} ms left at ${at.toISOString()}`);
    }
  }
});

test('3 · they agree across days; the eve says "Tomorrow", the day "Today"', () => {
  for (const day of ['2026-10-04', '2026-10-06', '2026-12-10']) {
    for (const now of halfHours(day)) {
      const h = home(now).daysToGo;
      assert.equal(h?.kind, 'days', now.toISOString());
      assert.equal(h?.kind === 'days' ? h.days : -1, countdownDays(now), `disagree at ${now.toISOString()}`);
    }
  }
  // 10 Dec 20:00 → 1 d 4 h left: "1 day to go".
  assert.deepEqual(home(new Date('2026-12-10T20:00:00+08:00')).days, { value: '1', label: 'day to go' });
  for (const now of halfHours('2026-12-11')) {
    assert.deepEqual(home(now).daysToGo, { kind: 'tomorrow' }, now.toISOString());
    assert.equal(countdownDays(now), 0, 'the tiles: under a day left');
  }
  assert.deepEqual(home(new Date('2026-12-11T20:00:00+08:00')).days, { value: 'Tomorrow', label: 'is the day' });
  const onTheDay = new Date('2026-12-12T09:00:00+08:00');
  assert.deepEqual(home(onTheDay).daysToGo, { kind: 'today' });
  assert.deepEqual(home(onTheDay).days, { value: 'Today', label: 'is the day' });
  assert.equal(home(onTheDay).daysOut, 0, 'Home\'s sentences still branch on the calendar day');
  assert.equal(countdownReading(target(), onTheDay.getTime()).isPast, true, 'the countdown retires on the day');
});

test('4 · same zone: an event with no zone stored counts in Manila, never the server’s clock', () => {
  // 02:00 Manila on 5 Oct is still 4 Oct in UTC.
  const h = home(new Date('2026-10-05T02:00:00+08:00'), null);
  assert.deepEqual(h.daysToGo, { kind: 'days', days: 67 });
  assert.equal(h.daysOut, 68, 'the calendar count Home branches on, also in Manila');
  // The eve, in Manila, at 01:00 — UTC would still call it two days out.
  assert.deepEqual(home(new Date('2026-12-11T01:00:00+08:00'), null).daysToGo, { kind: 'tomorrow' });
});

test('5 · the guest page and Home print the shared rule — countdown, scene template, dashboard', async () => {
  const widget = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/_components/countdown.tsx'), 'utf8'));
  assert.match(widget, /countdownReading\(target, Date\.now\(\)\)/);
  const { sceneFactsFor } = await import('@/app/[slug]/_lib/scene-facts');
  for (const now of halfHours('2026-10-05')) {
    const facts = sceneFactsFor(MJ as never, { solemn: false, now: now.getTime() });
    assert.equal(facts.daysToGo, countdownDays(now), `scene template disagrees at ${now.toISOString()}`);
  }
  const eve = sceneFactsFor(MJ as never, { solemn: false, now: Date.parse('2026-12-11T20:00:00+08:00') });
  assert.equal(eve.dayWord, 'Tomorrow');
  const dash = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/_components/event-dashboard.tsx'), 'utf8'));
  assert.doesNotMatch(dash, /`\$\{daysOut\} days to go`/, 'the dashboard prints the calendar count as "days to go" again');
  assert.doesNotMatch(dash, /<CountUp value=\{daysOut\}/, 'the focal counts up to the calendar count again');
  assert.match(dash, /daysToGo\?\.kind === 'days' \? daysToGo\.days : daysOut/);
});
