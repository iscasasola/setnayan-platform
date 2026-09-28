/**
 * the-day-is-a-rail.test.ts — the Schedule rebuild, slice 1 (2026-09-27).
 *
 * Owner-approved build spec: `prototypes/schedule_redesign_2026-09-25.html`
 * (DECISION_LOG "SCHEDULE REDESIGN PROTOTYPE APPROVED") and "WHERE
 * ANNOUNCEMENTS ARE TYPED — TODAY ONLY ON THE DAY; THE SCHEDULE REBUILD FIXES
 * IT". This RENDERS the rail rather than reading its source, and pins the
 * things a couple would notice first if they broke:
 *
 *   1 · a moment sits WHERE its time is — top from its start, height from its
 *       length — on the venue's wall clock, not the reader's;
 *   2 · the eye is on every moment and says which way it points;
 *   3 · the people who may change the schedule get the controls, and a
 *       view-only reader gets NONE of them (no Add, no Shift, no gaps to tap);
 *   4 · a supplier's request is drawn as a ghost where they asked;
 *   5 · Announce is mounted on the page for exactly the people the
 *       announcement INSERT policy admits, writes through the ONE existing
 *       channel, and tells the couple honestly when guests will see it;
 *   6 · the page has its first-visit tour;
 *
 * and, finishing the rebuild (2026-09-28, owner rules of 2026-09-27):
 *
 *   7 · every set of choices is ONE dropdown — the shared PickMenu the Maker
 *       uses — never a pill row or a native select; a quantity is a −/+ stepper;
 *   8 · Announce works BEFORE the day: hosts always, a coordinator only with
 *       schedule 'edit', suppliers never — the resolver and the action agree;
 *   9 · the guest-facing schedule scene on the Event Hub reads the SAME rows
 *       the rail writes (`event_schedule_blocks`, `is_public`), so the eye on
 *       the rail is the eye the guests see;
 *  10 · the dev lab that lets a phone drive the real rail is dev-only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { TOURS } from '@/lib/tours';
import { ScheduleDay } from './_components/day-rail';
import { lengthOptions, startOptions } from './_components/day-sheets';
import type { DayActions, DayMoment, DayRequest, DayRole } from './_components/day-types';

(globalThis as unknown as { React: unknown }).React = React;

const read = (rel: string) => stripComments(readFileSync(join(import.meta.dirname, rel), 'utf8'));
const WEB = join(import.meta.dirname, '..', '..', '..', '..');
const readWeb = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

function moment(over: Partial<DayMoment> & Pick<DayMoment, 'block_id' | 'label' | 'start_at'>): DayMoment {
  return {
    block_type: 'custom',
    end_at: null,
    location: null,
    notes: null,
    is_public: true,
    parent_block_id: null,
    run_state: 'upcoming',
    staged: false,
    responsible_party: null,
    responsible_vendor_ids: [],
    ...over,
  };
}

const DAY: DayMoment[] = [
  moment({
    block_id: 'hmua',
    label: 'Hair & makeup',
    block_type: 'pre_ceremony',
    start_at: '2026-12-18T08:00:00.000Z',
    end_at: '2026-12-18T12:00:00.000Z',
    is_public: false,
  }),
  moment({
    block_id: 'cer',
    label: 'Ceremony',
    block_type: 'ceremony',
    start_at: '2026-12-18T14:00:00.000Z',
    end_at: '2026-12-18T15:30:00.000Z',
  }),
];

const REQUEST: DayRequest = {
  suggestion_id: 'sug-1',
  block_id: null,
  kind: 'new',
  by: 'Casa Catering',
  proposed_label: 'Cake cutting',
  proposed_start_at: '2026-12-18T21:20:00.000Z',
  proposed_end_at: '2026-12-18T21:40:00.000Z',
  proposed_location: null,
  note: 'The cake needs twenty minutes.',
};

const noop = async () => undefined;
const STUB_ACTIONS: DayActions = {
  updateScheduleBlock: noop,
  bulkRetimeScheduleBlocks: noop,
  createScheduleBlock: noop,
  deleteScheduleBlock: noop,
  toggleBlockVisibility: noop,
  setBlockResponsibleParty: noop,
  setBlockPrepVisibility: noop,
  loadScheduleTemplate: noop,
  resolveScheduleSuggestion: noop,
};

function render(role: DayRole, requests: DayRequest[] = []) {
  return renderToStaticMarkup(
    React.createElement(ScheduleDay, {
      actions: STUB_ACTIONS,
      eventId: 'ev-1',
      eventType: 'wedding',
      eventDateKey: '2026-12-18',
      moments: DAY,
      requests,
      suppliers: [],
      role,
      canStage: false,
      rosEnabled: false,
      templates: [],
      isEventDay: false,
      emcee: null,
      hostPanel: null,
    }),
  );
}

/** The inline style of the moment whose aria-label starts with `label`. */
function styleOf(html: string, label: string): string {
  const re = new RegExp(`aria-label="${label}[^"]*"[^>]*style="([^"]*)"`);
  const m = re.exec(html);
  assert.ok(m, `no moment labelled ${label}`);
  return m![1]!;
}

test('1 · a moment sits where its wall-clock time is, and is as tall as it runs', () => {
  const html = render('host');
  // The ruler starts at the earliest hour (8 AM) at 64px an hour on a phone.
  // Ceremony: 2:00 PM → 6 hours down → 384px; 90 minutes → 96px, less the 3px gap.
  const cer = styleOf(html, 'Ceremony');
  console.log('ceremony style:', cer);
  assert.match(cer, /top:384px/);
  assert.match(cer, /height:93px/);
  const hmua = styleOf(html, 'Hair &amp; makeup');
  assert.match(hmua, /top:0(px)?;/, 'the first moment sits on the first hour line');
  assert.match(hmua, /height:253px/);
  assert.match(html, /2:00 – 3:30 PM/, 'the range reads on the moment, in the venue’s clock');
});

test('2 · the eye is on every moment and says which way it points', () => {
  const html = render('host');
  assert.equal((html.match(/Shown to guests — tap to hide/g) ?? []).length, 1);
  assert.equal((html.match(/Hidden from guests — tap to show/g) ?? []).length, 1);
});

test('3 · editors get the controls; a view-only reader gets none of them', () => {
  const edit = render('host');
  assert.match(edit, /aria-label="Add moment"/);
  assert.match(edit, /aria-label="Shift the day \(running late\)"/);
  assert.match(edit, /＋ <span class="font-mono">/, 'an empty stretch offers itself as a tap-to-add');

  const view = render('view');
  assert.doesNotMatch(view, /aria-label="Add moment"/);
  assert.doesNotMatch(view, /Shift the day/);
  assert.doesNotMatch(view, /＋ <span class="font-mono">/);
  // The eye still SAYS what guests see, but cannot be pressed.
  assert.match(view, /disabled=""[^>]*aria-label="Shown to guests|aria-label="Shown to guests[^>]*disabled=""/);
});

test('4 · a supplier request is drawn as a ghost where they asked', () => {
  const html = render('host', [REQUEST]);
  assert.match(html, /Casa Catering proposes · Cake cutting/);
  assert.match(html, /aria-label="Supplier requests \(1\)"/);
  // A view-only reader cannot approve, so is shown no inbox and no ghost.
  const view = render('view', [REQUEST]);
  assert.doesNotMatch(view, /Casa Catering proposes/);
});

test('5 · Announce is mounted for the announcement policy’s people, through the one channel', () => {
  const page = read('page.tsx');
  assert.match(
    page,
    /const canAnnounce = authority\.canSend && announceEnabled;/,
    'gated on the SAME resolver the coordinator_broadcasts INSERT policy mirrors',
  );
  assert.match(page, /resolveBroadcastAuthority\(supabase, eventId, user\.id\)/);
  assert.match(page, /\{canAnnounce \? \(\s*<AnnounceButton/);

  const button = read('_components/announce-button.tsx');
  assert.match(button, /from '\.\.\/\.\.\/_actions\/day-of-broadcast'/, 'no second announcement channel');
  assert.match(button, /sendCoordinatorBroadcast\(/);
  assert.doesNotMatch(button, /\.from\('coordinator_broadcasts'\)/, 'never writes the table itself');
  // Owner 2026-09-28: guests see it AS SOON AS IT IS SENT. Before the day the
  // sheet must say so — and must no longer say "on the day", which was the old
  // rule and would now under-promise a delivery that is actually made.
  assert.match(button, /at the top of their Event Hub right away/);
  assert.doesNotMatch(button, /Event Hub on the day/);
});

test('5b · the rail writes only through the existing actions the page hands it', () => {
  for (const f of [
    '_components/day-rail.tsx',
    '_components/moment-inspector.tsx',
    '_components/day-sheets.tsx',
  ]) {
    const src = read(f);
    assert.doesNotMatch(src, /createClient|@\/lib\/supabase/, `${f} must not open a database client`);
    assert.doesNotMatch(src, /['"]use server['"]/, `${f} must not declare a server action`);
  }
  // …and what the page hands it is the shipped action module, nothing new.
  const page = read('page.tsx');
  const mount = /<ScheduleDay\s+actions=\{\{([\s\S]*?)\}\}/.exec(page);
  assert.ok(mount, 'the page hands the rail its actions');
  const names = mount![1]!.split(',').map((x) => x.trim()).filter(Boolean);
  console.log('actions handed to the rail:', names.join(' · '));
  assert.equal(names.length, 9);
  for (const n of names) {
    assert.match(page, new RegExp(`import \\{[^}]*\\b${n}\\b[^}]*\\} from '\\./actions'`), `${n} comes from ./actions`);
  }
});

test('6 · the page has its first-visit tour, and the tour exists', () => {
  assert.match(read('page.tsx'), /<MiniTour tourKey="customer_schedule_v1" \/>/);
  assert.ok(TOURS.customer_schedule_v1.slides.length >= 3);
});

// ── Finishing the rebuild ───────────────────────────────────────────────────

const CHOICE_FILES = ['_components/day-rail.tsx', '_components/moment-inspector.tsx', '_components/day-sheets.tsx'];

test('7 · every set of choices is ONE PickMenu — the Maker’s — never a select or a pill row', () => {
  // One dropdown component in the whole app: the rail takes the Maker's.
  assert.match(
    read('_components/day-ui.tsx'),
    /export \{ PickMenu \} from '\.\.\/\.\.\/website\/editor\/_components\/pick-menu'/,
  );
  const pickMenus: Record<string, number> = {};
  for (const f of CHOICE_FILES) {
    const src = read(f);
    assert.equal(count(src, /<select\b/g), 0, `${f} still has a native <select>`);
    assert.equal(count(src, /aria-pressed=\{(?!isSel)/g), 0, `${f} still has a row of toggle chips`);
    pickMenus[f] = count(src, /<PickMenu\b/g);
    assert.ok(pickMenus[f]! >= 1, `${f} mounts no PickMenu`);
  }
  console.log('PickMenu mounts:', JSON.stringify(pickMenus));
  // phase · tag a supplier (inspector) · phase · starts · runs for · from · through · by (sheets) · view as (rail)
  assert.equal(pickMenus['_components/moment-inspector.tsx'], 2);
  assert.equal(pickMenus['_components/day-sheets.tsx'], 6);
  assert.equal(pickMenus['_components/day-rail.tsx'], 1);
  // A quantity is a −/+ stepper: starts and ends (inspector); starts, runs for, by (sheets).
  assert.equal(count(read('_components/moment-inspector.tsx'), /<Stepper\b/g), 2);
  assert.equal(count(read('_components/day-sheets.tsx'), /<Stepper\b/g), 3);

  // Rendered: the View-as dropdown is the PickMenu button, named for a reader.
  const html = render('host');
  assert.match(html, /aria-label="View as: Master · everything"[^>]*aria-haspopup="listbox"/);
  assert.match(html, /data-schedule-lens=""/);

  // The dropdowns never read blank after a −/+ press moves the value off their grid.
  const starts = startOptions(14 * 60 + 5);
  assert.ok(starts.some((o) => o.key === '845' && o.label === '2:05 PM'), 'an off-grid start is listed');
  assert.deepEqual(
    starts.map((o) => Number(o.key)),
    [...starts.map((o) => Number(o.key))].sort((a, b) => a - b),
    'starts stay in clock order',
  );
  assert.equal(startOptions(14 * 60).length + 1, starts.length, 'on-grid adds nothing');
  assert.ok(lengthOptions(80).some((o) => o.key === '80' && o.label === '1 h 20 min'));
  assert.equal(lengthOptions(60).length, 6);
});

test('8 · Announce before the day: hosts always · coordinator only with schedule edit · suppliers never', () => {
  const page = read('page.tsx');
  // Mounted from the authority alone — `isEventDay` is a PROP that changes the
  // wording, never a gate on the button, so the composer exists before the day.
  assert.match(page, /<AnnounceButton\s+eventId=\{eventId\}\s+isEventDay=\{isEventDay\}/);
  assert.doesNotMatch(page, /isEventDay\s*&&\s*canAnnounce|canAnnounce\s*&&\s*isEventDay/);

  const resolver = readWeb('lib/coordinator-broadcasts-server.ts');
  const fn = resolver.slice(resolver.indexOf('export async function resolveBroadcastAuthority'));
  assert.match(fn, /\.from\('event_members'\)[\s\S]*?\.eq\('member_type', 'couple'\)/, 'a host is a couple member');
  assert.match(fn, /return \{ canSend: true, role: 'couple' \}/);
  assert.match(fn, /resolveAreaLevel\(perms, 'schedule'\) === 'edit'/, 'a coordinator needs schedule edit');
  assert.match(fn, /return \{ canSend: true, role: 'coordinator' \}/);
  // No third door: nothing a supplier holds (a seat, a booking, a shop) is read.
  assert.doesNotMatch(fn, /vendor|supplier|booking/i, 'the resolver must know nothing about suppliers');
  assert.match(fn, /return \{ canSend: false, role: null \}/);

  // …and the ONE channel refuses on the same answer, before any write.
  const action = readWeb('app/dashboard/[eventId]/_actions/day-of-broadcast.ts');
  assert.match(action, /const authority = await resolveBroadcastAuthority\(supabase, eventId, user\.id\);\s*if \(!authority\.canSend\)/);
  assert.ok(
    action.indexOf('if (!authority.canSend)') < action.indexOf(".from('coordinator_broadcasts').insert("),
    'the refusal comes before the insert',
  );
});

test('9 · the guest-facing schedule scene reads the rows the rail writes', () => {
  const lib = readWeb('lib/schedule.ts');
  const pub = lib.slice(lib.indexOf('export async function fetchPublicScheduleBlocks'));
  assert.match(pub, /\.from\('event_schedule_blocks'\)[\s\S]*?\.eq\('is_public', true\)/);
  // The Event Hub scene mounts on that read…
  const hub = readWeb('app/[slug]/hub/page.tsx');
  assert.match(hub, /const scheduleBlocks = await fetchPublicScheduleBlocks\(/);
  assert.match(hub, /<ScheduleWidget[\s\S]*?blocks=\{scheduleBlocks\}/);
  // …and the rail's eye is the write that flips exactly that column.
  const actions = readWeb('app/dashboard/[eventId]/schedule/actions.ts');
  const toggle = actions.slice(actions.indexOf('export async function toggleBlockVisibility'));
  assert.match(toggle.slice(0, toggle.indexOf('\nexport ')), /is_public/);
  assert.match(read('_components/day-rail.tsx'), /toggleBlockVisibility\(\s*toFormData\(\{ event_id: eventId, block_id: m\.block_id, desired:/);
});

test('10 · the schedule lab drives the real rail and is dev-only', () => {
  const lab = readWeb('app/dev/schedule-lab/page.tsx');
  assert.match(lab, /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
  const client = readWeb('app/dev/schedule-lab/schedule-lab-client.tsx');
  assert.match(client, /from '@\/app\/dashboard\/\[eventId\]\/schedule\/_components\/day-rail'/);
  assert.doesNotMatch(client, /@\/lib\/supabase|createClient/, 'the lab opens no database');
});
