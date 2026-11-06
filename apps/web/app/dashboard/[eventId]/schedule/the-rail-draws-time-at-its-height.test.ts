/**
 * 📏 THE RAIL DRAWS TIME AT ITS HEIGHT — a thing on the rail is as tall as its minutes, never as tall as a button
 * (walk of the dev labs, 2026-11-01, schedule-lab at 390: the dashed "Lumière Photo proposes · Post-ceremony photos"
 * strip, 3:30–4:00, ran over the top of Cocktails at 4:00).
 *
 * 🔑 ROOT CAUSE: `globals.css` gives every `<button>` and `[role=button]` `min-height: 44px` (the touch floor). The
 * moments already opt out (`min-h-0`) — their height IS their time. A supplier's request strip did not, so a
 * 30-minute request (64 px an hour on a phone → 29 px) drew 44 px tall and covered the next moment's start.
 *
 * Held here, by RENDERING the real rail (a host, with a 30-minute request): every pressable thing on the rail that is
 * sized by its time (an inline `height`) carries `min-h-0`, so the floor cannot stretch it past its slot.
 *
 * SABOTAGE, seen red: drop `min-h-0` from the request strip → "a time-sized press on the rail keeps the 44-px floor".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScheduleDay } from './_components/day-rail';
import type { DayActions, DayMoment, DayRequest } from './_components/day-types';

(globalThis as unknown as { React: unknown }).React = React;

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
  moment({ block_id: 'cer', label: 'Ceremony', block_type: 'ceremony', start_at: '2026-12-18T14:00:00.000Z', end_at: '2026-12-18T15:30:00.000Z' }),
  moment({ block_id: 'cock', label: 'Cocktails', start_at: '2026-12-18T16:00:00.000Z', end_at: '2026-12-18T17:00:00.000Z' }),
];

const REQUEST: DayRequest = {
  suggestion_id: 'sug-lum',
  block_id: null,
  kind: 'new',
  by: 'Lumière Photo',
  proposed_label: 'Post-ceremony photos',
  proposed_start_at: '2026-12-18T15:30:00.000Z',
  proposed_end_at: '2026-12-18T16:00:00.000Z',
  proposed_location: null,
  note: 'Ten minutes on the church steps.',
};

const noop = async () => undefined;
const ACTIONS: DayActions = {
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

test('a time-sized press on the rail drops the 44-px button floor', () => {
  const html = renderToStaticMarkup(
    React.createElement(ScheduleDay, {
      actions: ACTIONS,
      eventId: 'ev-1',
      eventType: 'wedding',
      eventDateKey: '2026-12-18',
      moments: DAY,
      requests: [REQUEST],
      suppliers: [],
      role: 'host',
      canStage: false,
      rosEnabled: false,
      templates: [],
      isEventDay: false,
      emcee: null,
      hostPanel: null,
    }),
  );
  assert.match(html, /Lumière Photo proposes/, 'the request strip is not on the rail — this guard has nothing to hold');
  let sized = 0;
  for (const m of html.matchAll(/<(button|div)\b[^>]*>/g)) {
    const tag = m[0];
    const pressable = m[1] === 'button' || /\brole="button"/.test(tag);
    const style = /\bstyle="([^"]*)"/.exec(tag)?.[1] ?? '';
    if (!pressable || !/(^|;)height:/.test(style)) continue;
    sized += 1;
    const cls = /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '';
    assert.ok(/(^|\s)min-h-0(\s|$)/.test(cls), `a time-sized press on the rail keeps the 44-px floor:\n${tag.slice(0, 260)}`);
  }
  console.log(`time-sized presses on the rail: ${sized}`);
  assert.ok(sized >= 3, `only ${sized} time-sized presses rendered (2 moments + 1 request expected)`);
});
