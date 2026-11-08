/**
 * 👁 A PICKED SUPPLIER'S SCHEDULE OPENS ON THAT SUPPLIER'S PART (owner 9 Nov 2026, "Yes, theirs first").
 *
 * The shipped day's "View as" (the one PickMenu, `data-schedule-lens`) already has the `vendor:<vendor_id>` lens. It now
 * takes an OPENING lens: 'all' (Master) everywhere unless a caller names one, and a picked supplier / picked client
 * Schedule tab names `{ kind: 'vendor', id }`. Pinned here, by RENDERING the day:
 *
 *   1 · no `initialLens` → Master, exactly as shipped (no "view" line, no empty line);
 *   2 · `initialLens` vendor → that supplier's view is on ("Lumière's view · back to Master"), and the menu still offers
 *       Master · everything and Guests;
 *   4 · the event Schedule page reads `?lens=vendor:<id>` (and only a well-formed one) and hands it to the day;
 *   3 · a supplier with NO tagged moment (or before the responsible-party columns are live) still gets its lens, with
 *       the honest "No moments for Lumière yet" — never a silent fall back to Master.
 *
 * Sabotage (9 Nov 2026): `useState<Lens>({ kind: 'all' })` again → 2 + 3 RED; the opening vendor dropped from the
 * options when untagged → 3 RED; the empty line removed → 3 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScheduleDay, noMomentsForLine } from './_components/day-rail';
import { scheduleLensFromParam, type DayActions, type DayMoment } from './_components/day-types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

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
const m = (id: string, label: string, start: string, vendors: string[]): DayMoment => ({
  block_id: id,
  label,
  block_type: 'custom',
  start_at: start,
  end_at: null,
  location: null,
  notes: null,
  is_public: true,
  parent_block_id: null,
  run_state: 'upcoming',
  staged: false,
  responsible_party: null,
  responsible_vendor_ids: vendors,
});
const DAY = [m('a', 'Ceremony', '2026-12-18T06:00:00.000Z', ['v-lum']), m('b', 'Reception', '2026-12-18T10:00:00.000Z', [])];

function day(extra: Record<string, unknown>, opts: { tagged?: boolean; ros?: boolean } = {}) {
  const tagged = opts.tagged ?? true;
  return renderToStaticMarkup(
    React.createElement(ScheduleDay, {
      actions: ACTIONS,
      eventId: 'ev-1',
      eventType: 'wedding',
      eventDateKey: '2026-12-18',
      moments: tagged ? DAY : DAY.map((x) => ({ ...x, responsible_vendor_ids: [] })),
      requests: [],
      suppliers: [{ vendor_id: 'v-lum', vendor_name: 'Lumière' }],
      role: 'host',
      canStage: false,
      rosEnabled: opts.ros ?? true,
      templates: [],
      isEventDay: false,
      emcee: null,
      hostPanel: null,
      ...extra,
    }),
  );
}

test('1 · no opening lens → Master, as shipped', () => {
  const html = day({});
  assert.doesNotMatch(html, /back to Master/, 'the day no longer opens on Master');
  assert.doesNotMatch(html, /data-schedule-lens-empty/);
});

test('2 · a picked supplier opens on its own part; Master and Guests are still one pick away', () => {
  const html = day({ initialLens: { kind: 'vendor', id: 'v-lum' } });
  assert.match(html, /Lumière&#x27;s view/, 'the day did not open on the supplier\'s part');
  assert.match(html, /back to Master/);
  assert.doesNotMatch(html, /data-schedule-lens-empty/, 'a supplier with a tagged moment reads as empty');
  assert.match(html, /data-schedule-lens/, 'the View as menu is gone');
});

test('3 · no tagged moment → the lens stays, with the honest empty line — never a silent Master', () => {
  for (const opts of [{ tagged: false }, { tagged: false, ros: false }]) {
    const html = day({ initialLens: { kind: 'vendor', id: 'v-lum' }, initialLensName: 'Lumière' }, opts);
    assert.match(html, /Lumière&#x27;s view/, `${JSON.stringify(opts)}: fell back to Master`);
    assert.match(html, /data-schedule-lens-empty=""/, `${JSON.stringify(opts)}: no honest empty line`);
    assert.ok(html.includes(noMomentsForLine('Lumière')), 'the empty line lost its words');
  }
  assert.equal(noMomentsForLine('Lumière'), 'No moments for Lumière yet');
  // Before the responsible-party columns are live the lens still opens (and is not called empty when it is not).
  const off = day({ initialLens: { kind: 'vendor', id: 'v-lum' } }, { ros: false });
  assert.match(off, /Lumière&#x27;s view/, 'rosEnabled off fell back to Master');
  assert.doesNotMatch(off, /data-schedule-lens-empty/);
  // An unknown supplier (not on the event's list) is named by the caller, not "Supplier".
  const unknown = day({ initialLens: { kind: 'vendor', id: 'v-new' }, initialLensName: 'Casa Catering' });
  assert.match(unknown, /No moments for Casa Catering yet/);
});

test('4 · the event Schedule reads ?lens=vendor:<id> and opens the day on it; anything else is Master', () => {
  const id = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  assert.deepEqual(scheduleLensFromParam(`vendor:${id}`), { kind: 'vendor', id });
  for (const bad of [undefined, null, '', 'all', 'guest', 'vendor:', 'vendor:not-a-uuid', `vendors:${id}`]) {
    assert.equal(scheduleLensFromParam(bad), undefined, `${String(bad)} opened a supplier lens`);
  }
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  assert.match(page, /const initialLens = scheduleLensFromParam\(lensParam\);/, 'the page does not read ?lens=');
  assert.match(page, /<ScheduleDay\b[\s\S]*?\{\.\.\.\(initialLens \? \{ initialLens \} : \{\}\)\}/, 'the day is not handed the lens');
});
