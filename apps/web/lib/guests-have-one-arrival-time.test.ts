/**
 * ⏰ GUESTS HAVE ONE ARRIVAL TIME — the dress code's Guests CALL TIME, the invitation's "Guests arrive" and Event Details'
 * "Guests arrive" row are ONE stored value (owner 2026-10-19, DECISION_LOG "GUESTS GET A CALL TIME IN THE DRESS CODE — THE
 * SAME FIELD AS 'GUESTS ARRIVE'": *"guest call time"* … "saved once, shown everywhere; never a second guest time").
 *
 * The value is the Schedule's arrival moment (`lib/guests-arrive.ts`). The property, for one fixture:
 *
 *   1 · Studio's Guests call time === the invitation card's "Guests arrive" time === Event Details' "Guests arrive" row
 *       === a plain guest's Me › Arrive by — and a role's own call time still wins for its holder;
 *   2 · editing it from the Studio moves the other three; editing the moment as the Schedule does (Event Details' tool)
 *       moves the Studio's value — because the Studio writes THROUGH the Schedule's own writers, with fields those
 *       writers read, and never into the dress code;
 *   3 · no arrival moment yet (the programme opens on the Ceremony) → the row says "Set when guests arrive"; the
 *       invitation still reads the Ceremony, unchanged; setting it adds a public "Guests arrive" moment before the
 *       Ceremony, and then all four read it;
 *   4 · a time at or after the next moment is refused in plain words (it would stop being the first moment);
 *   5 · a moment guests cannot see (hidden, "Only for · Entourage", a coordinator's prep) is never the guests' time;
 *   6 · the pages read it from the one resolver — source anchors on Event Details, the guest page and the Studio.
 *
 * SABOTAGE (each seen RED, then restored — PR body): Event Details back on its own `.find(...)` rule · the Studio's
 * Guests row saving into the dress code (`saveDress`) · `guestMeFacts` dropping `guestsArriveBy` · the resolver
 * forgetting the audience fence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  afterGuestsArriveWrite,
  guestsArriveHhmm,
  guestsArriveMoment,
  guestsArriveTime,
  guestsArriveWrite,
  GUESTS_ARRIVE_UNSET,
  type ArriveBlock,
} from './guests-arrive';
import { rowGuestsMaySee, sortScheduleBlocks } from './schedule';
import { blockTime } from './print-pieces';
import { guestMeFacts } from './guest-me-parts';
import { invitationCard } from '../app/[slug]/_lib/invitation-card';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (/(?:^|\/)(?:actions|wizard-actions|hub-draft-actions|colour-access-actions)$/.test(request)) {
      return new Proxy({}, { get: () => async () => ({}) });
    }
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

type Row = ArriveBlock & { visibility: string | null };
const at = (hhmm: string) => `2026-12-12T${hhmm}:00.000Z`;
const row = (id: string, label: string, type: string, start: string, end: string | null, extra: Partial<Row> = {}): Row => ({
  block_id: id,
  label,
  block_type: type,
  start_at: at(start),
  end_at: end ? at(end) : null,
  is_public: true,
  sort_order: 0,
  parent_block_id: null,
  audience: null,
  visibility: 'couple_visible',
  ...extra,
});

/** The run of show: a private prep, an entourage-only call, THE arrival, the ceremony, the reception. */
const FIXTURE: Row[] = [
  row('prep', 'Hair & make-up', 'custom', '08:00', '11:00', { is_public: false }),
  row('call', 'Entourage call', 'custom', '13:00', '13:30', { audience: 'entourage' }),
  row('staged', 'Coordinator walk-through', 'custom', '13:15', null, { visibility: 'coordinator_only' }),
  row('arrive', 'Guests arrive', 'pre_ceremony', '14:30', '15:00'),
  row('ceremony', 'Ceremony', 'ceremony', '15:00', '16:00'),
  row('reception', 'Reception', 'reception', '18:00', null),
];

/* ── the four readers, each as its page reads ─────────────────────────────── */

/** The invitation card: `fetchPublicScheduleBlocks` (the fence, then start_at · sort_order) → `scheduleBlocks[0]`. */
function invitationLine(blocks: readonly Row[]): string | null {
  const shown = sortScheduleBlocks(blocks.filter((b) => rowGuestsMaySee(b as unknown as Record<string, unknown>) === 'yes') as Array<Row & { start_at: string }>);
  const card = invitationCard({ words: { solemn: false, twoPeople: true, eventWord: 'wedding' }, firstStartAt: shown[0]?.start_at ?? null, firstLabel: shown[0]?.label ?? null });
  return card?.timeLabel ?? null;
}
/** Event Details' "Guests arrive" row (`details/page.tsx`: `guestsArriveMoment(blocks)` → `blockTime`). */
const detailsRow = (blocks: readonly Row[]) => blockTime((guestsArriveMoment(blocks) as never) ?? null);
/** A plain guest's Me › Arrive by (`site-body.tsx` → `guestMeFacts({ guestsArriveBy })`). */
const meArriveBy = (blocks: readonly Row[], role: string = 'guest', dressCodeConfig: unknown = {}) =>
  guestMeFacts({ role: role as never, dressCodeConfig, rolePalette: {}, guestsArriveBy: guestsArriveTime(blocks) }).arriveBy;
/** Studio's Guests call time, as its time field holds it and as its header says it. */
const studioValue = (blocks: readonly Row[]) => ({ field: guestsArriveHhmm(blocks), says: guestsArriveTime(blocks) });

/** What `updateScheduleBlock` does to a row (start_at / end_at as datetime-local, stored verbatim). */
function scheduleRetime(blocks: readonly Row[], id: string, startLocal: string): Row[] {
  return blocks.map((b) => (b.block_id === id ? { ...b, start_at: `${startLocal}:00.000Z` } : b));
}

test('1 · one fixture: Studio’s Guests call time = invitation “Guests arrive” = Event Details row = a guest’s Arrive by', () => {
  assert.deepEqual(studioValue(FIXTURE), { field: '14:30', says: '2:30 PM' });
  assert.equal(invitationLine(FIXTURE), 'Guests arrive 2:30 PM');
  assert.equal(detailsRow(FIXTURE), '2:30 PM');
  assert.equal(meArriveBy(FIXTURE), '2:30 PM', 'a plain guest is told when guests arrive');
  /* A role's own call time still wins for its holder; a role with none arrives with the guests. */
  const config = { groups: { bridesmaids: { style: 'long_gown', callTime: '12:30' } } };
  assert.equal(meArriveBy(FIXTURE, 'bridesmaid', config), '12:30 PM', 'the bridesmaid keeps her own call time');
  assert.equal(meArriveBy(FIXTURE, 'principal_sponsor_ninang', config), '2:30 PM');
});

test('2 · editing it from the Studio moves the other three — through the Schedule’s writer, not the dress code', () => {
  const w = guestsArriveWrite({ blocks: FIXTURE, hhmm: '14:00', eventDate: '2026-12-12' });
  assert.equal(w.kind, 'update');
  if (w.kind !== 'update') return;
  assert.equal(w.fields.block_id, 'arrive', 'the arrival moment itself is retimed');
  assert.equal(w.fields.start_at, '2026-12-12T14:00', 'its own day, the new time');
  assert.equal(w.fields.end_at, undefined, 'its end (3:00 PM) is still after the start — kept');
  const after = afterGuestsArriveWrite(FIXTURE, w, '') as Row[];
  assert.deepEqual(studioValue(after), { field: '14:00', says: '2:00 PM' });
  assert.equal(invitationLine(after), 'Guests arrive 2:00 PM');
  assert.equal(detailsRow(after), '2:00 PM');
  assert.equal(meArriveBy(after), '2:00 PM');

  /* …and the other way: the moment retimed as the Schedule does it (Event Details' "Guests arrive" opens the Schedule). */
  const fromSchedule = scheduleRetime(FIXTURE, 'arrive', '2026-12-12T13:45');
  assert.deepEqual(studioValue(fromSchedule), { field: '13:45', says: '1:45 PM' }, 'the Studio reads the Schedule’s change');
  assert.equal(invitationLine(fromSchedule), 'Guests arrive 1:45 PM');
  assert.equal(detailsRow(fromSchedule), '1:45 PM');

  /* Later than its own end: the end is carried by the moment's length, so the row stays valid (end > start). */
  const late = guestsArriveWrite({ blocks: scheduleRetime(FIXTURE, 'arrive', '2026-12-12T13:00').map((b) => (b.block_id === 'arrive' ? { ...b, end_at: at('13:30') } : b)), hhmm: '14:15', eventDate: null });
  assert.ok(late.kind === 'update' && late.fields.end_at === '2026-12-12T14:45', 'the end follows the start');
});

test('2b · every field the Studio sends is one the Schedule’s own writer reads', () => {
  const actions = src('app/dashboard/[eventId]/schedule/actions.ts');
  const readsOf = (fn: string) => {
    const at = actions.indexOf(`export async function ${fn}(`);
    assert.ok(at >= 0, `${fn} is gone`);
    const body = actions.slice(at, actions.indexOf('\nexport async function', at + 10));
    return new Set([...body.matchAll(/formData\.get\('(\w+)'\)/g)].map((m) => m[1]));
  };
  const upd = guestsArriveWrite({ blocks: FIXTURE, hhmm: '14:00', eventDate: null });
  const crt = guestsArriveWrite({ blocks: FIXTURE.filter((b) => b.block_id !== 'arrive'), hhmm: '14:00', eventDate: null });
  assert.ok(upd.kind === 'update' && crt.kind === 'create');
  const u = readsOf('updateScheduleBlock');
  for (const k of ['event_id', ...Object.keys(upd.fields)]) assert.ok(u.has(k), `updateScheduleBlock does not read “${k}”`);
  const c = readsOf('createScheduleBlock');
  for (const k of ['event_id', 'block_id', ...Object.keys(crt.fields)]) assert.ok(c.has(k), `createScheduleBlock does not read “${k}”`);

  /* The Studio's Guests row: its writer is the Schedule's two, and it saves nothing into the dress code. */
  const studio = src('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx');
  const start = studio.indexOf('const setGuestsArrive = ');
  assert.ok(start >= 0, 'the Studio has no guests-arrival writer');
  const body = studio.slice(start, studio.indexOf('\n  };', start));
  assert.match(body, /guestsArriveWrite\(/);
  assert.match(body, /updateScheduleBlock\(fd\)/);
  assert.match(body, /createScheduleBlock\(fd\)/);
  assert.doesNotMatch(body, /saveDress|hubDraftAction|withCallTime/, 'the guests’ time is written into the dress code — a second home');
  const guestsRow = studio.slice(studio.indexOf('forGuests && props.arrival'), studio.indexOf(') : dress && !forGuests'));
  assert.match(guestsRow, /onSet=\{setGuestsArrive\}/, 'the Guests row’s call time does not save through the Schedule');
  assert.match(guestsRow, /guestsArriveHhmm\(/, 'the Guests row’s call time is not read from the arrival moment');
});

test('3 · no arrival yet → “Set when guests arrive”; the invitation still reads the Ceremony; setting it adds the moment', () => {
  const none = FIXTURE.filter((b) => b.block_id !== 'arrive');
  assert.deepEqual(studioValue(none), { field: null, says: null });
  assert.equal(detailsRow(none), null);
  assert.equal(meArriveBy(none), null, 'nothing said — never a guessed time');
  assert.equal(invitationLine(none), 'Ceremony 3:00 PM', 'the invitation is unchanged');
  assert.equal(GUESTS_ARRIVE_UNSET, 'Set when guests arrive');

  const w = guestsArriveWrite({ blocks: none, hhmm: '14:30', eventDate: '2026-12-12' });
  assert.equal(w.kind, 'create');
  if (w.kind !== 'create') return;
  assert.deepEqual(w.fields, { label: 'Guests arrive', block_type: 'pre_ceremony', start_at: '2026-12-12T14:30', end_at: '2026-12-12T15:00', is_public: 'on' });
  const after = afterGuestsArriveWrite(none, w, 'new-id') as Row[];
  assert.deepEqual(studioValue(after), { field: '14:30', says: '2:30 PM' });
  assert.equal(invitationLine(after), 'Guests arrive 2:30 PM');
  assert.equal(detailsRow(after), '2:30 PM');
  assert.equal(meArriveBy(after), '2:30 PM');

  /* An empty programme takes the event's date; no date at all is said, never guessed. */
  const empty = guestsArriveWrite({ blocks: [], hhmm: '09:00', eventDate: '2027-01-30' });
  assert.ok(empty.kind === 'create' && empty.fields.start_at === '2027-01-30T09:00');
  assert.deepEqual(guestsArriveWrite({ blocks: [], hhmm: '09:00', eventDate: null }), { kind: 'refuse', why: 'Set the date of your event first.' });
});

test('4 · a time at or after the next moment is refused in plain words', () => {
  assert.deepEqual(guestsArriveWrite({ blocks: FIXTURE, hhmm: '15:00', eventDate: null }), {
    kind: 'refuse',
    why: 'Guests arrive before Ceremony (3:00 PM) — pick an earlier time.',
  });
  const none = FIXTURE.filter((b) => b.block_id !== 'arrive');
  assert.equal(guestsArriveWrite({ blocks: none, hhmm: '16:00', eventDate: null }).kind, 'refuse');
  assert.equal(guestsArriveWrite({ blocks: FIXTURE, hhmm: '7', eventDate: null }).kind, 'refuse', 'a half-read time never saves');
});

test('5 · a moment guests cannot see is never the guests’ time', () => {
  /* The Entourage call (1:00 PM, "Only for · Entourage"), the hidden prep and the coordinator's staged walk-through are all
     earlier than the arrival — none of them is it. (Event Details used to take the first PUBLIC moment, audience unread.) */
  assert.equal(guestsArriveMoment(FIXTURE)?.block_id, 'arrive');
  const sabotage = FIXTURE.map((b) => (b.block_id === 'call' ? { ...b, audience: null } : b));
  assert.equal(guestsArriveMoment(sabotage)?.block_id, 'call', 'precondition: once it is for Everyone it IS the first moment');
  /* A child moment first, or the reception first: no arrival of its own. */
  assert.equal(guestsArriveMoment([row('r', 'Reception', 'reception', '18:00', null)]), null);
});

test('6 · the pages read the one resolver — Event Details, the guest page, the Studio', () => {
  const details = src('app/dashboard/[eventId]/details/page.tsx');
  assert.match(details, /const arrive = guestsArriveMoment\(blocks\);/, 'Event Details’ “Guests arrive” is not the one arrival moment');
  assert.match(details, /row="arrive"[^>]*value=\{arrive \? blockTime\(arrive\) : null\}/);
  assert.doesNotMatch(details, /firstPublic/, 'Event Details has a rule of its own for the arrival again');

  const site = src('app/[slug]/_components/site-body.tsx');
  assert.match(site, /const guestsArriveBy = guestsArriveTime\(scheduleBlocks\);/, 'the guest page does not read the one arrival');
  /** The object literal that opens at `anchor`'s last `{`, braces balanced — the call's own fields, nothing after it. */
  const objectAt = (anchor: string) => {
    const i = site.indexOf(anchor);
    assert.ok(i >= 0, `${anchor} is gone`);
    let depth = 0;
    for (let k = i + anchor.lastIndexOf('{'); k < site.length; k += 1) {
      if (site[k] === '{') depth += 1;
      else if (site[k] === '}' && --depth === 0) return site.slice(i, k + 1);
    }
    return '';
  };
  assert.match(objectAt('facts: guestMeFacts({'), /\bguestsArriveBy,/, 'Me’s parts are not told when guests arrive');
  assert.match(objectAt('const guestLook = {'), /\bguestsArriveBy,/, 'Me › Arrive by is not handed when guests arrive');
  assert.match(site, /firstStartAt: scheduleBlocks\[0\]\?\.start_at \?\? null,/, 'the invitation card is unchanged: the first moment');

  /* 🎟 The ticket, the checklist and the reminder email take their "doors" time (`guestArriveBy`'s `general`) from the
     same arrival — a role's own call time still wins inside `guestArriveBy` (me-reads-their-gender, 2026-10-19). */
  assert.match(site, /const firstScheduleTimeLabel = guestsArriveBy;/, 'the checklist reads a first-block time of its own');
  const pass = src('lib/pass-card.server.ts');
  const label = pass.slice(pass.indexOf('async function readArriveLabel('), pass.indexOf('\n}', pass.indexOf('async function readArriveLabel(')));
  assert.match(label, /return guestsArriveTime\(blocks\);/, 'the ticket’s ARRIVE is not the guests’ arrival');
  assert.doesNotMatch(label, /blocks\[0\]/, 'the ticket reads the first block again');
  const mail = src('lib/guest-reminder-emails.ts');
  assert.match(mail, /const arriveBy = guestsArriveTime\(blocks\);/, 'the reminder email reads a first-block time of its own');
  assert.doesNotMatch(mail, /blocks\[0\]/);
  const me = src('app/[slug]/_components/guest-me-parts.tsx');
  assert.match(me, /guestsArriveBy=\{p === 'arrive' \? \(look\.guestsArriveBy \?\? null\) : null\}/);
  const widget = src('app/[slug]/_components/dress-code-widget.tsx');
  assert.match(widget, /const arriveBy = mine\?\.callTime \?\? guestsArriveBy \?\? null;/, 'a role’s own time no longer wins, or guests are not told theirs');
});

test('6b · Studio › Attire draws the Guests call time from the Schedule — field, header, and the unset line', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const draw = (arrival: unknown) =>
    renderToStaticMarkup(
      React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
        eventId: 'e',
        palette: { reception: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'] },
        fallbackFive: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'],
        frozenDressing: [],
        changes: [],
        attire: [{ tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null }],
        /* A guests' time put in the dress code by hand is NOT what the row shows — the Schedule's is. */
        dressConfig: { roles: { guest: { style: 'cocktail', callTime: '09:00' } } },
        attireStyles: [],
        inspirations: [],
        autoThemes: [],
        regions: [],
        dosLists: null,
        startTab: 'attire',
        arrival,
      }),
    );
  const set = draw({ blocks: FIXTURE, eventDate: '2026-12-12' });
  assert.match(set, /data-mood-board-call-time="guest"/, 'the Guests row has no call time');
  assert.match(set, /type="time"[^>]*value="14:30"/, 'the field holds the Schedule’s arrival');
  assert.match(set, /Arrives 2:30 PM/, 'and the header says it');
  assert.doesNotMatch(set, /value="09:00"/, 'a dress-code time is shown for guests — a second home');
  assert.doesNotMatch(set, /Clear the call time for Guests/, 'the arrival moment is cleared from the dress code');

  const unset = draw({ blocks: FIXTURE.filter((b) => b.block_id !== 'arrive'), eventDate: '2026-12-12' });
  assert.match(unset, /type="time"[^>]*value=""/);
  assert.match(unset, /Set when guests arrive/);
  assert.doesNotMatch(unset, /Arrives /);

  const unread = draw(null);
  assert.match(unread, /data-mood-board-call-time="guest"/);
  assert.doesNotMatch(unread, /type="time"/, 'a refused read draws a field that would save onto nothing');
  assert.match(unread, /could not be read/);
});
