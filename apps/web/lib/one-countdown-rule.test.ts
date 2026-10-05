/**
 * ONE COUNTDOWN RULE — the guest countdown's Days and Home's "days to go" agree.
 *
 * Found live by the controller, 2026-10-05, on maria-and-jose (2026-12-12,
 * Asia/Manila): the Details countdown read **67** days while Home read **"68
 * days to go"**. Both were in Manila; they rounded differently — Home counts
 * calendar days (today counts), the countdown floored the time left.
 *
 * Holds, for every half hour of three Manila days and the eve: the countdown's
 * Days (`countdownReading`, what `countdown.tsx` draws) === Home's `daysUntil`
 * (lib/home-facts.ts, via `homeFacts`) === the hub's scene-template count
 * (`sceneFactsFor`). And that the countdown component reads the shared rule —
 * not a private copy of the arithmetic.
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

const homeDays = (now: Date, timezone: string | null = MJ.timezone) =>
  homeFacts({
    eventDate: MJ.event_date,
    precision: MJ.event_date_precision,
    timezone,
    guests: { stats: EMPTY_STATS, measured: false },
    money: null,
    now,
  }).daysOut;

const countdownDays = (now: Date) => {
  const target = countdownTargetMs(MJ.event_date, MJ.timezone);
  assert.ok(target !== null);
  return countdownReading(target, now.getTime()).days;
};

/** Every half hour from Manila midnight of `day` for 24 h. */
function halfHours(day: string): Date[] {
  const start = Date.parse(`${day}T00:00:00+08:00`);
  return Array.from({ length: 48 }, (_, i) => new Date(start + i * 30 * 60_000 + 17_000));
}

test('1 · on 5 Oct the countdown and Home both say 68 — at every half hour of the Manila day', () => {
  for (const now of halfHours('2026-10-05')) {
    assert.equal(homeDays(now), 68, now.toISOString());
    assert.equal(countdownDays(now), 68, `countdown at ${now.toISOString()}`);
  }
});

test('2 · they agree every half hour across three days and the eve (the tick-over is the same Manila midnight)', () => {
  for (const day of ['2026-10-04', '2026-10-06', '2026-12-10', '2026-12-11']) {
    for (const now of halfHours(day)) {
      assert.equal(countdownDays(now), homeDays(now), `disagree at ${now.toISOString()}`);
    }
  }
  // The eve: one day to go, never zero (zero is "Today is the day").
  assert.equal(countdownDays(new Date('2026-12-11T20:00:00+08:00')), 1);
  // The day itself: the countdown retires; Home says 0.
  const onTheDay = new Date('2026-12-12T09:00:00+08:00');
  assert.equal(countdownReading(countdownTargetMs(MJ.event_date, MJ.timezone)!, onTheDay.getTime()).isPast, true);
  assert.equal(homeDays(onTheDay), 0);
});

test('3 · the hours beside the days are what is left of today, so the four tiles tick together', () => {
  const r = countdownReading(countdownTargetMs(MJ.event_date, MJ.timezone)!, Date.parse('2026-10-05T11:18:00+08:00'));
  assert.deepEqual({ days: r.days, hours: r.hours, minutes: r.minutes }, { days: 68, hours: 12, minutes: 42 });
});

test('4 · same zone: an event with no zone stored counts in Manila, never the server’s clock', () => {
  // 02:00 Manila on 5 Oct is still 4 Oct in UTC — a UTC count would say 69.
  assert.equal(homeDays(new Date('2026-10-05T02:00:00+08:00'), null), 68);
});

test('5 · the guest page reads the shared rule — countdown.tsx and the scene template', async () => {
  const widget = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/_components/countdown.tsx'), 'utf8'));
  assert.match(widget, /countdownReading\(target, Date\.now\(\)\)/);
  assert.doesNotMatch(widget, /Math\.floor\(ms \/ 86_400_000\)/, 'a private floor of the days is back');
  const { sceneFactsFor } = await import('@/app/[slug]/_lib/scene-facts');
  for (const now of halfHours('2026-10-05')) {
    const facts = sceneFactsFor(MJ as never, { solemn: false, now: now.getTime() });
    assert.equal(facts.daysToGo, countdownDays(now), `scene template disagrees at ${now.toISOString()}`);
  }
});
