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
import { papicRowWhileNext } from './papic-glance';

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
  assert.deepEqual(g.line, { strong: '1,240 credits left', tail: '' });
  assert.equal(g.mood, 'ok');
  assert.equal(g.pct, 83, 'the meter is what is left of what was bought');
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
  assert.equal(g.mood, 'low');
  assert.equal(g.status, 'Running low · 37 credits left');
  assert.equal(g.moment, null, 'low is a Next card only ON the day (owner call 1)');
  // 9.6% left still reads low (rounding would have said 10%).
  assert.equal(poolLevel(96, 1000), 'low');
  assert.equal(poolLevel(100, 1000), 'ok', 'exactly 10% is not under 10%');
});

test('at zero: "Stopped", Buy more, and the Next card\'s "stopped" moment', () => {
  const g = glance({ shotsLeft: 0, shotsTotal: 550, photosGathered: 550 });
  assert.equal(g.mood, 'gone');
  assert.equal(g.status, '0 credits left · Your cameras have stopped');
  assert.equal(g.buy, true);
  assert.equal(g.moment, 'stopped');
  const next = pickHomeNext({ ...NOTHING, guests: { total: 32, unsent: 12 }, papic: { moment: 'stopped', left: 0, total: 2000 } });
  assert.equal(next.kind, 'papic', 'the prototype ranks the stopped card above "Send 12 invitations"');
  assert.equal(next.title, 'Your cameras have stopped');
  assert.match(next.body, /^All 2,000 credits are used\./);
  assert.equal(next.action, 'Buy more');
  // Owner call 3: the row keeps the red meter only — no second "Stopped", no second Buy more.
  const row = papicRowWhileNext(g, 'stopped');
  assert.deepEqual(row, { line: { strong: '0 credits left' }, buy: false });
});

test('ready before the first photo — the Next card\'s other moment (never the retired free camera)', () => {
  const g = glance({ shotsLeft: 50, shotsTotal: 50, photosGathered: 0 });
  assert.equal(g.moment, 'ready');
  const next = pickHomeNext({ ...NOTHING, papic: { moment: 'ready', left: 50, total: 50 } });
  assert.equal(next.title, 'Your cameras are ready');
  assert.equal(next.action, 'Open Papic');
  assert.deepEqual(papicRowWhileNext(g, 'ready').buy, true, 'the ready card offers Open Papic, so the row keeps Buy more');
  assert.ok(!/free camera/i.test(`${next.title} ${next.body}`), 'the retired free "One" camera is promised again');
});

test('more than 6 months away: cameras WAIT, "On from [date]", credits still buyable, no Next moment', () => {
  const eventDate = iso(NOW + 260 * DAY);
  const g = glance({ shotsLeft: 50, shotsTotal: 50, photosGathered: 0 }, eventDate);
  assert.equal(g.phase, 'waits');
  assert.equal(g.buy, true, 'credits can be bought early');
  assert.equal(g.moment, null, 'a camera that cannot shoot yet is not "ready"');
  const on = formatPapicDayInWords(windowFor(eventDate).startDate, NOW);
  assert.ok(on, 'the window has a first day');
  assert.equal(g.status, `50 credits · On from ${on}`);
  assert.equal(g.mood, 'wait', 'gold — before the window');
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
  assert.equal(glance('failed').mood, 'plain', 'an unread pool draws no meter');
});

test('dates in words — "Saturday, 12 December" (Manila), the year only when it is not this year', () => {
  assert.equal(formatPapicDayInWords('2026-12-12', NOW), 'Saturday, 12 December');
  assert.equal(formatPapicDayInWords('2027-06-12', NOW), 'Saturday, 12 June 2027');
  assert.equal(formatPapicDayInWords('2026-12-12T23:30:00+08:00', NOW), 'Saturday, 12 December', 'Manila day');
  assert.equal(formatPapicDayInWords(null, NOW), null);
});

test('owner call 1: running low ON THE EVENT DAY takes the Next card, once', () => {
  const today = iso(NOW);
  const g = glance({ shotsLeft: 140, shotsTotal: 2000, photosGathered: 1860 }, today, { eventDate: today });
  assert.equal(g.moment, 'low-today');
  const next = pickHomeNext({ ...NOTHING, papic: { moment: 'low-today', left: 140, total: 2000 } });
  assert.equal(next.title, 'Your credits are running low');
  assert.equal(next.action, 'Buy more');
  assert.equal(papicRowWhileNext(g, 'low-today').buy, false, 'the card offers Buy more, so the row does not');
});

test('NEVER TWICE: while Papic holds the Next card the ROW STAYS (owner 2026-10-14) — only its doubled button goes', () => {
  const doors = { glance: { count: 0, total: 50, mood: 'gone' as const, pct: 0, result: 3 }, line: { strong: '0 credits left' }, buy: false };
  const keys = homeServices({ next: 'papic', storeShell: false, papic: 'x', ai: 'y', papicDoors: doors }).map((s) => s.key);
  assert.deepEqual(keys, ['papic', 'ai']);
  // A service with no doors (Setnayan AI) still leaves the row while it is Next.
  assert.deepEqual(homeServices({ next: 'ai', storeShell: false, papic: 'x', ai: 'y' }).map((s) => s.key), ['papic']);
});

const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };
