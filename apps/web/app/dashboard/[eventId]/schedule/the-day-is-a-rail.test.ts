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
 *   6 · the page has its first-visit tour.
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
import type { DayActions, DayMoment, DayRequest, DayRole } from './_components/day-types';

(globalThis as unknown as { React: unknown }).React = React;

const read = (rel: string) => stripComments(readFileSync(join(import.meta.dirname, rel), 'utf8'));

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
  // Before the day it must not claim guests already have it.
  assert.match(button, /at the top of their Event Hub on the day/);
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
