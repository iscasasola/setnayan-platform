/**
 * 📅 THE DATE EDIT WRITES WHAT IT SAYS (owner 2026-11-13, DECISION_LOG "DATE EDIT PROTOTYPE APPROVED"; prototype
 * `event_dates_edit_2026-11-13`). The writers need a database, so their claims are pinned in their SOURCE (comments
 * stripped — a docblock naming a column is not a write of it), and the calendar is pinned by RENDERING it:
 *
 *   · the stepper is drawn only when the type may run more than a day, and its + stops at max_days;
 *   · an N-day option is drawn as ONE joined bar (rstart · inrange · rend), the middle days FILLED (owner addition 3);
 *   · "A few dates" saves the START days + the day count and leaves the exact date EMPTY;
 *   · "Last day" is refused past the type's cap with `eventSpanRefusal`'s line, before any write;
 *   · a non-wedding's City or area writes `region` ONLY (based post — nothing else of Event settings), never
 *     `std_film_venue_city`;
 *   · the pill "A few dates" exists only while nobody is booked.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import (tsconfig `jsx: preserve`), and a stub for the `.css` import.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css')) return {};
    return load.call(this, request, ...rest);
  };
}

const APP = join(__dirname, '..', '..', '..', '..');
const src = (...p: string[]) => stripComments(readFileSync(join(APP, ...p), 'utf8'));

async function cal(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DateCalendar } = await import('@/app/onboarding/_shared/date-calendar');
  return renderToStaticMarkup(
    React.createElement(DateCalendar as never, {
      chrome: 'bare',
      mode: 'specific',
      candidates: [],
      windowStart: null,
      windowEnd: null,
      onChange: () => {},
      dateExempt: true,
      ...props,
    } as never),
  );
}

/** Two years out: inside the calendar's three, after any floor, and the month the view opens on. */
function futureSaturday(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('the stepper is drawn only for a type that may run more than a day, and its + stops at max_days', async () => {
  const oneDay = await cal({ maxDays: 1, days: 1 });
  assert.doesNotMatch(oneDay, /How many days is your event\?/, 'a 1-day type was asked how many days');
  const unasked = await cal({});
  assert.doesNotMatch(unasked, /How many days is your event\?/, 'a caller that does not ask now shows the step');

  const birthday = await cal({ maxDays: 7, days: 3 });
  assert.match(birthday, /How many days is your event\?/);
  assert.match(birthday, /data-datecal-days="3"/);
  const atCap = await cal({ maxDays: 7, days: 9 });
  assert.match(atCap, /data-datecal-days="7"/, 'a day count past the cap was drawn');
  assert.match(atCap, /Up to 7 days for this kind of event\./);
  const plus = atCap.match(/<button[^>]*aria-label="More days"[^>]*>/)?.[0] ?? '';
  assert.match(plus, /disabled/, 'More days is still pressable at the cap');
});

test('an N-day option is ONE joined bar — start, filled middle, end — and is a removable chip', async () => {
  const start = futureSaturday();
  const html = await cal({ maxDays: 7, days: 3, candidates: [start] });
  assert.equal((html.match(/calday[^"]*\brstart\b/g) ?? []).length, 1);
  assert.equal((html.match(/calday[^"]*\binrange\b/g) ?? []).length, 1);
  assert.equal((html.match(/calday[^"]*\brend\b/g) ?? []).length, 1);
  assert.match(html, new RegExp(`data-datecal-chip="${start}"`));
  assert.match(html, /aria-label="Remove [A-Z][a-z]{2} [A-Z][a-z]{2} \d+ – [A-Z][a-z]{2} [A-Z][a-z]{2} \d+"/);
});

test('owner addition 3 — an option’s middle days are FILLED dark, never the pale busy-day shade', () => {
  const css = readFileSync(join(APP, 'app', 'onboarding', '_shared', 'date-calendar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = css.match(/\.sn-datecal \.calday\.inrange\{[^}]*\}/g)?.pop() ?? '';
  assert.match(rule, /color-mix\(in srgb,var\(--cal-mulberry\) 72%,var\(--cal-surface\)\)/, 'the middle days are not ink ~72%');
  assert.match(rule, /color:var\(--cal-paper\)/);
  assert.match(rule, /font-weight:600/);
});

test('the hint tail is the one rule, and nothing set opens on the first bookable month', async () => {
  const html = await cal({});
  assert.match(html, /your venue’s booked day becomes your date/);
  assert.doesNotMatch(html, /we lock the one all your suppliers share/);
  const c = src('app', 'onboarding', '_shared', 'date-calendar.tsx');
  assert.match(c, /const seed = minD;/, 'nothing set no longer opens on the first bookable month');
});

test('the shared-day offer is wired: Make it a window · Keep my options', () => {
  const c = src('app', 'onboarding', '_shared', 'date-calendar.tsx');
  assert.match(c, /sharesDayOffer\(iso, hit, n, multi\.length\)/);
  assert.match(c, /label="Make it a window"/);
  assert.match(c, /label="Keep my options"/);
  // Make it a window: Flexible window, the options cleared.
  const take = c.slice(c.indexOf('const takeOffer'), c.indexOf('const dismissOffer'));
  assert.match(take, /setMulti\(\[\]\)/);
  assert.match(take, /dateMode: 'window'/);
});

test('A few dates saves the START days and the day count — and leaves the exact date EMPTY', () => {
  const a = src('app', 'dashboard', '[eventId]', 'actions.ts');
  const body = a.slice(a.indexOf('export async function updateEventDateOptions'), a.indexOf('export async function setPlanningMode'));
  assert.ok(body.length > 200, 'updateEventDateOptions is gone');
  assert.match(body, /dateOptionsRefusal\(/, 'the options are not checked by the calendar’s own rules');
  assert.match(body, /date_candidates: mode === 'specific' \? sorted : null/);
  assert.match(body, /event_days: Math\.floor\(days\)/);
  assert.match(body, /event_date: null/, 'options must leave the exact date empty');
  assert.match(body, /event_end_date: null/);
  assert.match(body, /CONFIRMED_VENDOR_STATUSES/, 'options are saved over a booking');
  assert.ok(body.indexOf('dateOptionsRefusal(') < body.indexOf(".from('events')\n    .update"), 'refused only after writing');
  // The sheet posts the start days, the day count and nothing that would set the date.
  const s = src('app', 'dashboard', '[eventId]', 'vendors', '_components', 'fact-sheets.tsx');
  const door = s.slice(s.indexOf('options: (o) =>'), s.indexOf('region: (next, was) =>'));
  assert.match(door, /fd\.append\('date_candidate', c\)/);
  assert.match(door, /fd\.set\('event_days', String\(o\.days\)\)/);
  assert.doesNotMatch(door, /event_date'/);
});

test('Last day is refused past the type’s cap with eventSpanRefusal, BEFORE the write', () => {
  const a = src('app', 'dashboard', '[eventId]', 'actions.ts');
  const body = a.slice(a.indexOf('export async function updateEventDate('), a.indexOf('export async function updateEventDateOptions'));
  const refuse = body.indexOf('eventSpanRefusal(');
  const write = body.indexOf('.update({');
  assert.ok(refuse > 0, 'updateEventDate never calls eventSpanRefusal');
  assert.ok(refuse < write, 'the span is checked after the write');
  assert.match(body, /maxDays: \(await resolveProfileByEvent\(eventId\)\)\.maxDays/, 'the cap is not the type’s own');
  assert.match(body, /event_days: eventDate && eventEndDate \? eventSpanDays\(eventDate, eventEndDate\) : 1/, 'the day count drifts from the span');
  // Absent ⇒ untouched: only a form that posts the last day writes it.
  assert.match(body, /\.\.\.\(endPosted\s*\?/);
});

test('A few dates is a pill only while nobody is booked; Last day only where the type may run longer', () => {
  const s = src('app', 'dashboard', '[eventId]', 'vendors', '_components', 'fact-sheets.tsx');
  assert.match(s, /const fewOffered = booked === 0;/);
  assert.match(s, /\.\.\.\(fewOffered \? \[\{ key: 'few' as const, label: 'A few dates' \}\] : \[\]\)/);
  assert.match(s, /const lastDayShown = asksHowManyDays\(maxDays\);/);
  assert.match(s, /empty="Same day"/);
  assert.match(s, /<DateCalendar\b/, 'A few dates is not the shared calendar');
});

test('City or area on a non-wedding writes events.region ONLY — never std_film_venue_city', () => {
  const s = src('app', 'dashboard', '[eventId]', 'vendors', '_components', 'fact-sheets.tsx');
  const door = s.slice(s.indexOf('region: (next, was) =>'), s.indexOf('draft: (patch) =>'));
  assert.match(door, /updateEventMatchCriteria\(fd\)/, 'not the Region’s own writer');
  assert.match(door, /fd\.set\('region', next\)/);
  assert.match(door, /MERGE_BASE_FIELD/, 'an unbased post would also write the feel and the names');
  const sets = [...door.matchAll(/fd\.(?:set|append)\('([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(sets.filter((k) => k !== 'event_id'), ['region'], `the region door posts more than the region: ${sets.join(', ')}`);
  const branch = s.slice(s.indexOf('data-place-region=""'), s.indexOf('data-place-region-note'));
  assert.ok(branch.length > 50, 'the region branch is gone');
  assert.doesNotMatch(branch, /std_film_venue_city/);
  assert.match(branch, /doors\.region\(place\.rk/, 'the picked place’s region is not what is written');
  assert.match(s, /This is your <span className="font-semibold text-ink">Region<\/span> in ⚙ Event settings — one value, shown in both places\./);
});

test('the onboarding insert writes the day count, clamped to the type’s cap', async () => {
  const { buildGenericEventInsert } = await import('@/lib/onboarding/event-insert');
  const payload = {
    eventType: 'birthday',
    displayName: 'Maria & Jose',
    recurs: false,
    region: null,
    venueLatitude: null,
    venueLongitude: null,
    pax: null,
    budgetBand: null,
    budgetAmountCentavos: null,
    dateMode: 'specific' as const,
    dateCandidates: ['2027-01-09', '2027-01-16'],
    windowStart: null,
    windowEnd: null,
    eventDays: 9,
    moodFeelKey: null,
    experiencePersona: null,
    experienceForWhom: null,
    experienceAxes: {},
    picks: [],
    interestedServices: [],
    refinements: {},
    basicMoodboard: null,
    places: [],
    guidanceOptIn: true,
    sendTopInquiries: false,
    inquiriesPerCategory: 3,
    role: null,
  };
  const opts = { slug: 'maria-jose', now: '2026-11-13T00:00:00Z', userId: 'u', isAnonymous: false, experienceEnabled: false, homeSignalsEnabled: false };
  const row = buildGenericEventInsert(payload as never, { ...opts, maxDays: 7 } as never);
  assert.equal(row.event_days, 7, 'a day count past the type’s cap reached the row');
  assert.deepEqual(row.date_candidates, ['2027-01-09', '2027-01-16'], 'the options are the START days');
  assert.equal(row.event_date ?? null, null, 'options set an exact date');
  const oneDayType = buildGenericEventInsert(payload as never, opts as never);
  assert.equal(oneDayType.event_days, 1, 'without a cap the event is one day');
});
