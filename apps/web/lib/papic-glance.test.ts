/**
 * GUARD — Papic at a glance says what is TRUE (owner 2026-10-13, DECISION_LOG
 * 📸 / 📍): credits left · Buy more · See N photos; "On from [date]" before the
 * window; "Running low" under 10%; "Stopped" at zero; the Next card at its two
 * moments (cameras ready before the first photo · cameras stopped) — and a read
 * that did not happen is "—", never 0.
 *
 * The window is the app's own default (`resolveStoredWindow`, 6 months before)
 * and "low" is `POOL_METER_LOW_PCT` — this asserts against them, not copies.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { creditsWord, glanceTileFromStandings, papicGlance, seePhotosWord, type PapicGlanceInput } from './papic-glance';
import { formatPapicDayInWords, resolveStoredWindow } from './papic-window';
import { POOL_METER_LOW_PCT, poolLevel } from './papic-pool-meter';
import { pickHomeNext, homeServices, type HomeNextInput } from './home-first-screen';

const DAY = 86_400_000;
/** Noon Manila on 2026-10-14 — a fixed "now". */
const NOW = Date.parse('2026-10-14T12:00:00+08:00');
const iso = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);

function windowFor(eventDate: string) {
  const w = resolveStoredWindow({ windowStart: null, windowEnd: null, eventDate });
  return { startDate: w.startDate, endIso: w.endIso };
}
function glance(tile: PapicGlanceInput['tile'], eventDate = iso(NOW + 40 * DAY), over: Partial<PapicGlanceInput> = {}) {
  return papicGlance({ permitted: true, tile, window: windowFor(eventDate), papicOn: true, nowMs: NOW, ...over });
}

test('in the window: "N credits left", Buy more, and the photo count for See N photos', () => {
  const g = glance({ shotsLeft: 1240, shotsTotal: 1500, photosGathered: 260 });
  assert.equal(g.phase, 'open');
  assert.equal(g.status, '1,240 credits left');
  assert.equal(g.tone, 'ok');
  assert.equal(g.buy, true);
  assert.equal(g.photos, 260);
  assert.equal(g.moment, null, 'photos exist — no "ready" card');
  assert.equal(seePhotosWord(260), 'See 260 photos');
  assert.equal(seePhotosWord(1), 'See 1 photo');
  assert.equal(creditsWord(1), '1 credit');
});

test('under 10% is "Running low" — the meter\'s own rule, from raw ratios', () => {
  assert.equal(POOL_METER_LOW_PCT, 10);
  const g = glance({ shotsLeft: 37, shotsTotal: 550, photosGathered: 513 });
  assert.equal(g.tone, 'low');
  assert.equal(g.status, 'Running low · 37 credits left');
  // 9.6% left still reads low (rounding would have said 10%).
  assert.equal(poolLevel(96, 1000), 'low');
  assert.equal(poolLevel(100, 1000), 'ok', 'exactly 10% is not under 10%');
});

test('at zero: "Stopped", Buy more, and the Next card\'s "stopped" moment', () => {
  const g = glance({ shotsLeft: 0, shotsTotal: 550, photosGathered: 550 });
  assert.equal(g.tone, 'stopped');
  assert.equal(g.status, 'Stopped · 0 credits left');
  assert.equal(g.buy, true);
  assert.equal(g.moment, 'stopped');
  const next = pickHomeNext({ ...NOTHING, papicStopped: true });
  assert.equal(next.kind, 'papic');
  assert.equal(next.title, 'Your cameras have stopped');
  assert.equal(next.action, 'Add credits');
});

test('ready before the first photo — the Next card\'s other moment (never the retired free camera)', () => {
  const g = glance({ shotsLeft: 50, shotsTotal: 50, photosGathered: 0 });
  assert.equal(g.moment, 'ready');
  const next = pickHomeNext({ ...NOTHING, papicReady: true });
  assert.equal(next.title, 'Your cameras are ready');
  assert.ok(!/free camera/i.test(`${next.title} ${next.body}`), 'the retired free "One" camera is promised again');
});

test('more than 6 months away: cameras WAIT, "On from [date]", credits still buyable, no Next moment', () => {
  const eventDate = iso(NOW + 260 * DAY);
  const g = glance({ shotsLeft: 50, shotsTotal: 50, photosGathered: 0 }, eventDate);
  assert.equal(g.phase, 'waits');
  assert.equal(g.buy, true, 'credits can be bought early');
  assert.equal(g.moment, null, 'a camera that cannot shoot yet is not "ready"');
  const on = formatPapicDayInWords(windowFor(eventDate).startDate, NOW);
  assert.ok(on && g.status.startsWith(`On from ${on}`), g.status);
  assert.match(g.status, /· 50 credits$/);
});

test('after the window: nothing to buy, no moment', () => {
  const g = glance({ shotsLeft: 10, shotsTotal: 50, photosGathered: 40 }, iso(NOW - 3 * DAY));
  assert.equal(g.phase, 'closed');
  assert.equal(g.buy, false);
  assert.equal(g.moment, null);
});

test('🔴 a read that did not happen is "—", never 0 — and never a moment', () => {
  assert.equal(glance('failed').status, '—');
  assert.equal(glance('failed').moment, null);
  const refused = glance({ shotsLeft: 50, shotsTotal: 50, photosGathered: null });
  assert.equal(refused.photos, null, 'a refused photo count is not "no photos"');
  assert.equal(refused.moment, null, 'a refused count must not conjure "ready"');
  assert.equal(glanceTileFromStandings({ credits: null, creditsTotal: null, poolRead: false, inLibrary: 3 }), 'failed');
  assert.equal(papicGlance({ permitted: false, tile: null, window: windowFor(iso(NOW)), papicOn: true }).status, 'Open');
  assert.equal(glance(null).status, 'Not added');
});

test('an unread or "No" switch conjures no Next moment', () => {
  assert.equal(glance({ shotsLeft: 0, shotsTotal: 50, photosGathered: 5 }, undefined, { papicOn: null }).moment, null);
  assert.equal(glance({ shotsLeft: 50, shotsTotal: 50, photosGathered: 0 }, undefined, { papicOn: false }).moment, null);
});

test('dates in words — "Saturday, 12 December" (Manila), the year only when it is not this year', () => {
  assert.equal(formatPapicDayInWords('2026-12-12', NOW), 'Saturday, 12 December');
  assert.equal(formatPapicDayInWords('2027-06-12', NOW), 'Saturday, 12 June 2027');
  assert.equal(formatPapicDayInWords('2026-12-12T23:30:00+08:00', NOW), 'Saturday, 12 December', 'Manila day');
  assert.equal(formatPapicDayInWords(null, NOW), null);
});

test('NEVER TWICE: when Papic is the Next card its row leaves "Your services"', () => {
  const keys = homeServices({ next: 'papic', storeShell: false, papic: 'x', ai: 'y', papicDoors: { tone: 'stopped', buy: true, photos: 3 } }).map((s) => s.key);
  assert.deepEqual(keys, ['ai']);
  const row = homeServices({ next: 'plan', storeShell: false, papic: '12 credits left', ai: 'y', papicDoors: { tone: 'ok', buy: true, photos: 3 } })[0]!;
  assert.deepEqual(row.papic, { tone: 'ok', buy: true, photos: 3 }, 'the row carries its two doors');
});

const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };
