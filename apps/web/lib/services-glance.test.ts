/**
 * GUARD — every paid service at a glance says what is TRUE, in every state the
 * approved prototype draws (owner "approve all", 2026-10-14 —
 * `prototypes/services_home_rows_and_bands_2026-10-14_fable.html`, `glance(k)`):
 * not added (slim, price under the name, Add) · waiting for payment · owned, and
 * each service's own moments — and a read that did not happen is "—", never 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_TOOLS_NEVER_ROWS,
  SERVICE_ROW_ORDER,
  WAITING_WORDS,
  boothGlance,
  doorBuys,
  hubProGlance,
  liveGlance,
  musicGlance,
  plannerGlance,
  serviceDayOf,
  serviceRowDoubled,
  type ServiceRowGlance,
} from './services-glance';

const lineText = (g: ServiceRowGlance) => `${g.line.lead ?? ''}${g.line.strong ?? ''}${g.line.tail ?? ''}`;
const slimText = (g: ServiceRowGlance) => (g.slim ? `${g.slim.lead ?? ''}${g.slim.price ?? ''}${g.slim.tail}` : null);

test('the six rows, in the one order — and no free tool among them (owner 2026-10-14 🧾)', () => {
  assert.deepEqual([...SERVICE_ROW_ORDER], ['papic', 'ai', 'live', 'music', 'booth', 'hub']);
  for (const tool of FREE_TOOLS_NEVER_ROWS) {
    assert.ok(!(SERVICE_ROW_ORDER as readonly string[]).includes(tool), `${tool} is a free tool, never a row`);
  }
  assert.equal(serviceDayOf('plan'), 'before');
  assert.equal(serviceDayOf('dayof'), 'day');
  assert.equal(serviceDayOf('after'), 'after');
});

/* ─── Planner ───────────────────────────────────────────────────────────── */

test('Planner · not added: slim "₱2,499 · one-time" + Add; band shows the price, "Add for ₱2,499"', () => {
  const g = plannerGlance({ ownership: 'none', price: 2499, day: 'before', suppliers: 7 });
  assert.equal(slimText(g), '₱2,499 · one-time');
  assert.deepEqual(g.doors, [{ kind: 'add', label: 'Add' }]);
  assert.equal(g.band.big, '₱2,499');
  assert.equal(g.band.word, 'one-time · never expires');
  assert.equal(g.band.line, 'Not added · ranks suppliers, watches payments and deadlines');
  assert.deepEqual(g.band.main, { kind: 'add', label: 'Add for ₱2,499' });
  assert.equal(g.hidden, false);
  assert.equal(plannerGlance({ ownership: 'none', price: null, day: 'before', suppliers: null }).hidden, true, 'not on sale for this event — nothing to show');
});

test('Planner · waiting: the services menu\'s words, no second Add', () => {
  const g = plannerGlance({ ownership: 'waiting', price: 2499, day: 'before', suppliers: 0 });
  assert.equal(slimText(g), WAITING_WORDS);
  assert.deepEqual(g.doors, []);
  assert.equal(g.band.main, null, 'a pending order is never offered a second time');
  assert.equal(g.mood, 'wait');
});

test('Planner · on: "Planner on · N suppliers watched", never "days left" (it never expires)', () => {
  const g = plannerGlance({ ownership: 'on', price: 2499, day: 'before', suppliers: 7, paymentsDue30d: 2 });
  assert.equal(lineText(g), 'Planner on · 7 suppliers watched');
  assert.equal(g.line.strong, '7 suppliers watched');
  assert.deepEqual(g.doors, [{ kind: 'shortlist', label: 'Open your shortlist' }]);
  assert.equal(g.band.big, '7');
  assert.equal(g.band.word, 'suppliers watched');
  assert.equal(g.band.of, 'never expires · watching this event');
  assert.equal(g.band.line, 'Planner on · 2 payments due in 30 days');
  assert.doesNotMatch(JSON.stringify(g), /days? left/i);
  const one = plannerGlance({ ownership: 'on', price: null, day: 'before', suppliers: 1 });
  assert.equal(lineText(one), 'Planner on · 1 supplier watched');
});

test('Planner · just added: 0 watched says how it starts', () => {
  const g = plannerGlance({ ownership: 'on', price: 2499, day: 'before', suppliers: 0 });
  assert.equal(lineText(g), 'Planner on · 0 suppliers watched');
  assert.equal(g.say, 'Add a supplier to your shortlist and the Planner starts watching it.');
  assert.equal(g.band.line, 'Planner on · nothing to watch yet');
});

test('Planner · an unread count is "—", never 0', () => {
  const g = plannerGlance({ ownership: 'on', price: 2499, day: 'before', suppliers: null });
  assert.equal(lineText(g), 'Planner on · — suppliers watched');
  assert.equal(g.band.big, '—');
});

test('Planner · after the day: "N final bills to settle" (owner call 3)', () => {
  const g = plannerGlance({ ownership: 'on', price: 2499, day: 'after', suppliers: 7, finalBills: 3 });
  assert.equal(lineText(g), 'Planner on · 3 final bills to settle');
  assert.equal(g.band.line, 'Your day is done · 3 final bills to settle');
  assert.equal(lineText(plannerGlance({ ownership: 'on', price: 0, day: 'after', suppliers: 7, finalBills: 0 })), 'Planner on · every bill settled');
  assert.equal(lineText(plannerGlance({ ownership: 'on', price: 0, day: 'after', suppliers: 7, finalBills: null })), 'Planner on · your day is done', 'unread bills are not "0 to settle"');
});

test('Planner · Plan it myself on: the band says the Planner rests', () => {
  const g = plannerGlance({ ownership: 'on', price: 2499, day: 'before', suppliers: 7, manual: true });
  assert.equal(g.band.of, 'Plan it myself is on · the Planner rests');
});

/* ─── Live stream ───────────────────────────────────────────────────────── */

const LIVE = { price: 2500, screenPrice: 3000, dayWords: 'Saturday, 19 December', cameras: 3, live: false, recorded: false } as const;

test('Live · not added: "1 camera free · ₱2,500 for more"; band keeps the free controller door', () => {
  const g = liveGlance({ ...LIVE, ownership: 'none', day: 'before' });
  assert.equal(slimText(g), '1 camera free · ₱2,500 for more');
  assert.deepEqual(g.band.main, { kind: 'add', label: 'Add for ₱2,500' });
  assert.deepEqual(g.band.second, { kind: 'controller', label: 'Open controller' });
  assert.equal(g.band.line, '1 camera is free — try it from the controller');
  assert.equal(liveGlance({ ...LIVE, ownership: 'none', day: 'after' }).hidden, true, 'the buy path closes after the day');
});

test('Live · bought, nothing set up: "No cameras set up yet · Goes live <date>"', () => {
  const g = liveGlance({ ...LIVE, ownership: 'on', day: 'before', cameras: 0 });
  assert.equal(lineText(g), 'No cameras set up yet · Goes live Saturday, 19 December');
  assert.equal(g.mood, 'wait');
  assert.equal(g.band.big, '0');
  assert.equal(g.band.line, 'Goes live Saturday, 19 December · you press Go live');
});

test('Live · ready: "3 cameras ready · Goes live <date>" + Add a venue screen + Open controller', () => {
  const g = liveGlance({ ...LIVE, ownership: 'on', day: 'before' });
  assert.equal(lineText(g), '3 cameras ready · Goes live Saturday, 19 December');
  assert.deepEqual(
    g.doors.map((d) => d.kind),
    ['more-screen', 'controller'],
  );
  assert.deepEqual(g.band.main, { kind: 'controller', label: 'Open controller' });
  assert.deepEqual(g.band.second, { kind: 'more-screen', label: 'Add a venue screen · ₱3,000 a day' });
  assert.equal(g.moment, null);
  const noScreen = liveGlance({ ...LIVE, ownership: 'on', day: 'before', screenPrice: null });
  assert.deepEqual(noScreen.doors.map((d) => d.kind), ['controller'], 'no venue screen on sale — no door to it');
  assert.equal(lineText(liveGlance({ ...LIVE, ownership: 'on', day: 'before', dayWords: null })), '3 cameras ready · Goes live on your day');
});

test('Live · live now: the live mood, and the Next card ON THE DAY only (owner call 1)', () => {
  const g = liveGlance({ ...LIVE, ownership: 'on', day: 'day', live: true, liveSince: '2026-12-19T07:02:00Z' });
  assert.equal(g.mood, 'live');
  assert.equal(lineText(g), 'Live now · 3 cameras');
  assert.equal(g.band.big, 'Live');
  assert.equal(g.band.of, '3 cameras · since 3:02 pm');
  assert.equal(g.moment, 'live-now');
  assert.equal(liveGlance({ ...LIVE, ownership: 'on', day: 'before', live: true }).moment, null, 'a rehearsal is not the day');
  assert.doesNotMatch(JSON.stringify(g), /watching\b(?! on)/, 'nothing measures viewers — no invented "N watching"');
});

test('Live · after the day: "Recorded · 2 hr 14 min" + "download a copy to keep it" (owner call 2)', () => {
  const g = liveGlance({ ...LIVE, ownership: 'on', day: 'after', recorded: true, recordedMinutes: 134 });
  assert.equal(lineText(g), 'Recorded · 2 hr 14 min');
  assert.equal(g.say, 'Unlisted on YouTube · download a copy to keep it');
  assert.deepEqual(g.band.main, { kind: 'recording', label: 'See the recording' });
  const noLength = liveGlance({ ...LIVE, ownership: 'on', day: 'after', recorded: true, recordedMinutes: null });
  assert.equal(lineText(noLength), 'Recorded');
  assert.equal(noLength.band.big, 'Recorded');
  const none = liveGlance({ ...LIVE, ownership: 'on', day: 'after', recorded: false });
  assert.equal(lineText(none), 'Your day is done · no recording');
});

test('Live · an unread camera count is "—"', () => {
  const g = liveGlance({ ...LIVE, ownership: 'on', day: 'before', cameras: null });
  assert.equal(lineText(g), '— cameras · Goes live Saturday, 19 December');
  assert.equal(g.band.big, '—');
});

/* ─── Music ─────────────────────────────────────────────────────────────── */

test('Music · not added: "₱2,500 · one song"; hidden where the type has no Music Maker', () => {
  const g = musicGlance({ ownership: 'none', price: 2500, day: 'before', offered: true, song: null, playing: false });
  assert.equal(slimText(g), '₱2,500 · one song');
  assert.equal(g.band.line, 'Not added · tell us your story, we write and produce it');
  assert.equal(musicGlance({ ownership: 'none', price: 2500, day: 'before', offered: false, song: null, playing: false }).hidden, true);
  assert.equal(slimText(musicGlance({ ownership: 'waiting', price: 2500, day: 'before', offered: true, song: null, playing: false })), 'Waiting for payment · we start once approved');
});

test('Music · in production: a word, never a clock or a promise (owner 🧩 4)', () => {
  const g = musicGlance({ ownership: 'on', price: 2500, day: 'before', offered: true, song: 'in_production', playing: false });
  assert.equal(lineText(g), 'Song in production');
  assert.equal(g.band.big, 'In production');
  assert.equal(g.band.bigWord, true);
  assert.equal(g.band.main, null);
  assert.deepEqual(g.band.second, { kind: 'brief', label: 'See your brief' });
  assert.equal(g.moment, null);
  assert.doesNotMatch(JSON.stringify(g), /\b\d+\s*(days?|hours?|weeks?)\b/i, 'no turnaround is promised');
});

test('Music · ready: "Ready · 1 song", Hear your song, Another song = buy more, and the Next card until heard', () => {
  const g = musicGlance({ ownership: 'on', price: 2500, day: 'before', offered: true, song: 'ready', playing: true });
  assert.equal(lineText(g), 'Ready · 1 song');
  assert.equal(g.say, 'Playing on your Event Hub.');
  assert.deepEqual(g.doors.map((d) => d.kind), ['more-song', 'hear']);
  assert.deepEqual(g.band.main, { kind: 'hear', label: 'Hear your song' });
  assert.deepEqual(g.band.second, { kind: 'more-song', label: 'Another song · ₱2,500' });
  assert.equal(g.moment, 'song-ready');
  assert.equal(serviceRowDoubled(g, 'song-ready'), true, 'the row stands its doors down while the card offers them');
  assert.equal(serviceRowDoubled(g, null), false);
  const quiet = musicGlance({ ownership: 'on', price: 2500, day: 'before', offered: true, song: 'ready', playing: false });
  assert.equal(quiet.band.line, 'Ready · not playing on your Event Hub');
});

test('Music · after the day: "1 song · yours to keep"', () => {
  const g = musicGlance({ ownership: 'on', price: 2500, day: 'after', offered: true, song: 'ready', playing: true });
  assert.equal(lineText(g), '1 song · yours to keep');
  assert.equal(g.moment, null);
});

/* ─── Video booth ───────────────────────────────────────────────────────── */

test('Booth · not added: "Free to record · ₱1,500 to save & share" — per EVENT, never per day', () => {
  const g = boothGlance({ ownership: 'none', price: 1500, day: 'before', reels: null, dayWords: 'Saturday, 19 December' });
  assert.equal(slimText(g), 'Free to record · ₱1,500 to save & share');
  assert.equal(g.band.word, 'per event · save, download and share every reel');
  assert.deepEqual(g.band.second, { kind: 'booth', label: 'Open booth' });
  assert.doesNotMatch(JSON.stringify(g), /per day|\/ day|a day\b/i);
  assert.equal(boothGlance({ ownership: 'none', price: 1500, day: 'after', reels: null, dayWords: null }).hidden, true);
});

test('Booth · on before the day: "On · 0 reels yet" · "Guests record on your day · <date>"', () => {
  const g = boothGlance({ ownership: 'on', price: 1500, day: 'before', reels: 0, dayWords: 'Saturday, 19 December' });
  assert.equal(lineText(g), 'On · 0 reels yet');
  assert.equal(g.say, 'Guests record on your day · Saturday, 19 December');
  assert.deepEqual(g.band.main, { kind: 'booth', label: 'Open booth' });
});

test('Booth · on with reels: "On · 23 reels" + See your 23 reels; after: "23 reels · your day is done"', () => {
  const g = boothGlance({ ownership: 'on', price: 1500, day: 'day', reels: 23, dayWords: null });
  assert.equal(lineText(g), 'On · 23 reels');
  assert.deepEqual(g.band.second, { kind: 'reels', label: 'See your 23 reels' });
  const after = boothGlance({ ownership: 'on', price: 1500, day: 'after', reels: 23, dayWords: 'Saturday, 19 December' });
  assert.equal(lineText(after), '23 reels · your day is done');
  assert.deepEqual(after.band.main, { kind: 'reels', label: 'See your 23 reels' });
  assert.equal(lineText(boothGlance({ ownership: 'on', price: 1500, day: 'day', reels: 1, dayWords: null })), 'On · 1 reel');
  assert.equal(lineText(boothGlance({ ownership: 'on', price: 1500, day: 'day', reels: null, dayWords: null })), 'On · — reels');
});

/* ─── Event Hub Pro ─────────────────────────────────────────────────────── */

test('Hub Pro · not added: "₱5,000 · one-time"; the free Maker stays a door (◆ never blocks)', () => {
  const g = hubProGlance({ ownership: 'none', price: 5000, theme: null, background: null });
  assert.equal(slimText(g), '₱5,000 · one-time');
  assert.deepEqual(g.band.main, { kind: 'add', label: 'Add for ₱5,000' });
  assert.deepEqual(g.band.second, { kind: 'maker', label: 'Open the Maker' });
});

test('Hub Pro · on: "Pro on · <theme> theme · <background>" · Open the Maker', () => {
  const g = hubProGlance({ ownership: 'on', price: 5000, theme: 'Vintage', background: 'video background' });
  assert.equal(lineText(g), 'Pro on · Vintage theme · video background');
  assert.deepEqual(g.band.main, { kind: 'maker', label: 'Open the Maker' });
  assert.equal(g.band.word, 'Vintage theme · video background');
  assert.equal(lineText(hubProGlance({ ownership: 'on', price: 5000, theme: null, background: null })), 'Pro on', 'an unread look is left out, never guessed');
});

test('a buy door is told apart from a door that opens (the store shell draws none of the first kind)', () => {
  assert.equal(doorBuys({ kind: 'add', label: 'Add' }), true);
  assert.equal(doorBuys({ kind: 'more-song', label: 'Another song' }), true);
  assert.equal(doorBuys({ kind: 'more-screen', label: 'Add a venue screen' }), true);
  assert.equal(doorBuys({ kind: 'controller', label: 'Open controller' }), false);
});
