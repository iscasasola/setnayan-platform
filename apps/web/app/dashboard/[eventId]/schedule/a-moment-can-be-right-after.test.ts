/**
 * ⏭ A MOMENT "RIGHT AFTER THE ONE ABOVE" (owner 2026-11-02, DECISION_LOG "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS
 * WRITTEN: 4 ADDITIONS" (1); migration 20271302727358, held in the database by
 * tests/db/a-moment-can-be-right-after.db.test.ts).
 *
 * The coordinator's timeline writes "Bouquet toss" with no clock, under "Cake cutting". Three readers draw it, in order,
 * as "Right after" — never its stored order key (the anchor's start), never a guessed midnight:
 *   · the host's run of show (a chapter's page, `chapters-host.tsx`);
 *   · the guest's "Your schedule" (`yourSchedule`);
 *   · the supplier's Schedule view (`buildSupplierDay`).
 * And the moment sheets offer it as ONE dropdown (When ▾: At a time · Right after the one above), never a pill row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RIGHT_AFTER, inRunOrder, momentAbove, momentClockWords } from '../../../../lib/moment-order';
import { clockWords, type Chapter, type TaskRow } from '../../../../lib/schedule-chapters';
import { yourSchedule, type YourMoment } from '../../../../lib/guest-your-schedule';
import { buildSupplierDay, type SupplierBlockRow } from '../../../../lib/supplier-schedule';

const DAY = '2099-12-18';
const at = (hhmm: string) => `${DAY}T${hhmm}:00.000Z`;
const CH = 'c0000000-0000-4000-8000-000000000001';

const chapter: Chapter = {
  block_id: CH,
  label: 'Reception',
  start_at: at('18:00'),
  end_at: at('23:00'),
  location: 'Seda',
  spot: null,
  notes: null,
  ingress_minutes_before: null,
  egress_minutes_after: null,
  call_lead_minutes: 60,
  on_invitation: true,
  photo_who: 'chapter',
  photo_when: 'right_away',
  is_public: true,
  moments: 4,
  time_tba: false,
};

/** Cake 8:15 · Toss (right after Cake, its key Cake's 8:15) · Speech 8:15 too (a timed moment at the same key) · Dance 9:00. */
const cake = { block_id: 'm-cake', parent_block_id: CH, label: 'Cake cutting', start_at: at('20:15'), end_at: at('20:30'), sort_order: 0, time_tba: false, follows_block_id: null };
const toss = { block_id: 'm-toss', parent_block_id: CH, label: 'Bouquet toss', start_at: at('20:15'), end_at: null, sort_order: 0, time_tba: true, follows_block_id: 'm-cake' };
const speech = { block_id: 'm-speech', parent_block_id: CH, label: 'Speech', start_at: at('20:15'), end_at: at('20:20'), sort_order: 1, time_tba: false, follows_block_id: null };
const dance = { block_id: 'm-dance', parent_block_id: CH, label: 'Last dance', start_at: at('21:00'), end_at: at('21:10'), sort_order: 0, time_tba: false, follows_block_id: null };

test('the order: a moment right after sits directly under the one it follows, even past a timed moment at the same key', () => {
  assert.deepEqual(inRunOrder([dance, speech, toss, cake]).map((m) => m.block_id), ['m-cake', 'm-toss', 'm-speech', 'm-dance']);
  // A chain stays together.
  const garter = { ...toss, block_id: 'm-garter', follows_block_id: 'm-toss' };
  assert.deepEqual(inRunOrder([garter, dance, toss, cake]).map((m) => m.block_id), ['m-cake', 'm-toss', 'm-garter', 'm-dance']);
  // An anchor not in the list: kept by its key, never dropped. A cycle: kept, never looped.
  assert.deepEqual(inRunOrder([toss, dance]).map((m) => m.block_id), ['m-toss', 'm-dance']);
  const a = { ...toss, block_id: 'a', follows_block_id: 'b' };
  const b = { ...toss, block_id: 'b', follows_block_id: 'a' };
  assert.equal(inRunOrder([a, b]).length, 2);
});

test('"the one above": for a new moment the chapter\'s last; for one in the list the moment directly above it', () => {
  assert.equal(momentAbove([cake, dance], null)?.block_id, 'm-dance');
  assert.equal(momentAbove([cake, toss, speech, dance], 'm-speech')?.block_id, 'm-toss');
  assert.equal(momentAbove([cake, dance], 'm-cake'), null);
});

test('the words: "Right after" for an untimed moment, "Time TBA" in a TBA chapter, the clock otherwise — never the key', () => {
  assert.equal(momentClockWords(toss, chapter, clockWords), RIGHT_AFTER);
  assert.equal(momentClockWords(cake, chapter, clockWords), '8:15 PM');
  assert.equal(momentClockWords(toss, { time_tba: true }, clockWords), 'Time TBA');
  // A CHAPTER with time_tba is never "Right after".
  assert.notEqual(momentClockWords({ parent_block_id: null, time_tba: true, start_at: at('00:00') }, null, clockWords), RIGHT_AFTER);
});

test('the guest\'s "Your schedule": their right-after moment says "Right after", under the moment above', () => {
  const guestId = 'g-1';
  const moments: YourMoment[] = [cake, toss, dance].map((m) => ({
    ...m,
    location: null,
    is_public: m.block_id !== 'm-toss',
    audience: null,
    staged: false,
  }));
  const task = (id: string, block: string, what: string): TaskRow => ({
    task_id: id, block_id: block, vendor_id: null, crew: null, guest_id: guestId, group_id: null, role: null, who_label: null, what, call_at: null, place: null, sort_order: 0,
  });
  const out = yourSchedule({
    chapters: [chapter],
    moments,
    tasks: [task('t1', 'm-toss', 'Catch it')],
    viewer: { guestId, roles: [], groupIds: [] },
    released: true,
    pro: true,
    guestsArriveBy: null,
  });
  assert.equal(out.kind, 'ok');
  const lines = out.kind === 'ok' ? out.chapters[0]!.lines : [];
  assert.deepEqual(lines.map((l) => [l.title, l.time]), [
    ['Cake cutting', '8:15 PM'],
    ['Bouquet toss', RIGHT_AFTER],
    ['Last dance', '9:00 PM'],
  ]);
});

test('the supplier\'s Schedule view: "Right after", in order, and the edit form is never prefilled with the key', () => {
  const rows: SupplierBlockRow[] = [
    { block_id: CH, parent_block_id: null, label: 'Reception', start_at: chapter.start_at, end_at: chapter.end_at, location: 'Seda', spot: null, time_tba: false, is_optional: false, responsible_vendor_ids: ['v1'], created_at: null, updated_at: null },
    ...[dance, toss, cake].map((m) => ({ ...m, location: null, spot: null, is_optional: false, responsible_vendor_ids: ['v1'], created_at: null, updated_at: null })),
  ];
  const day = buildSupplierDay({ blocks: rows, myBookingIds: ['v1'], tasks: [], requests: [] });
  const ms = day.chapters[0]!.moments;
  assert.deepEqual(ms.map((m) => [m.label, m.clock, m.rightAfter]), [
    ['Cake cutting', '8:15 PM', false],
    ['Bouquet toss', RIGHT_AFTER, true],
    ['Last dance', '9:00 PM', false],
  ]);
  const form = readFileSync(join(__dirname, '../../../vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx'), 'utf8');
  assert.match(form, /moment\.rightAfter \? '' : wallTime\(moment\.start_at\)/, 'the supplier\'s form prefills the order key as a time');
});

test('the host\'s run of show (a chapter\'s page) orders by the run and says "Right after"', () => {
  const host = readFileSync(join(__dirname, '_components/chapters-host.tsx'), 'utf8');
  assert.match(host, /inRunOrder\(moments\.filter\(\(m\) => momentSection\(m\.start_at, c\) === k\)\)/, 'the chapter page sorts by time alone');
  assert.match(host, /momentClockWords\(m, c, clockWords\)/, 'the chapter page draws the order key as a clock');
  assert.doesNotMatch(host, /\{clockWords\(m\.start_at\)\}/, 'a raw clock of a moment is back on the chapter page');
});

test('the moment sheets: When ▾ is ONE dropdown (PickMenu via ChosenRow), and "At a time" saves nothing until a time is typed', () => {
  const sheets = readFileSync(join(__dirname, '_components/moment-sheets.tsx'), 'utf8');
  assert.match(sheets, /function WhenRow[\s\S]{0,400}<ChosenRow/, 'When is not a dropdown');
  assert.match(sheets, /RIGHT_AFTER_LONG/);
  // On a moment with no clock, the Time row starts EMPTY — its key is the anchor's time, never shown as its own.
  assert.match(sheets, /value=\{untimed \? '' : wallTime\(m\.start_at\)\}/);
  // A typed time ends "right after": time_tba '0' rides the same save.
  assert.match(sheets, /time_tba: '0'/);
});
