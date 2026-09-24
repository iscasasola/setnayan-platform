/**
 * the-add-flow-opens-the-real-picker.test.ts
 *
 * ⚖ Owner-approved 2026-09-24 (DECISION_LOG, "the template is good"): *"the
 * header (+), dashed tile and the empty state all open the REAL
 * `EventTypePicker` step (right panel on desktop, bottom sheet on phone)."*
 *
 * The mechanism is a Next.js intercepting route, so the claims are about
 * WIRING — which file renders what, and which door points where. Each one
 * below is a way this could quietly stop being the add flow the owner approved
 * while every page still renders:
 *
 *   • a FORKED picker (the panel copies EventTypePicker's props instead of
 *     rendering the page) — two create steps that will drift;
 *   • a door that stops pointing at `/dashboard/create-event`, so the
 *     interceptor never fires and that door leaves the board;
 *   • a layout that forgets to render the slot — every door then navigates
 *     away exactly as before and nothing is red;
 *   • a slot with no `default` — a hard load of `/dashboard` 404s the slot;
 *   • the phone losing its bottom sheet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const INTERCEPT = '@modal/(.)create-event/page.tsx';

test('the panel renders the REAL create-event page — imported whole, never re-built', () => {
  assert.ok(existsSync(join(HERE, INTERCEPT)), 'the interceptor is gone');
  const src = read(INTERCEPT);
  assert.match(
    src,
    /import CreateEventPage from '@\/app\/dashboard\/\(account\)\/create-event\/page';/,
    'the interceptor no longer imports the real create-event page',
  );
  assert.match(src, /<CreateEventPanel>\s*<CreateEventPage \{\.\.\.props\} \/>\s*<\/CreateEventPanel>/);
  assert.doesNotMatch(
    src,
    /EventTypePicker|getCreatableEventTypes|getBudgetBands/,
    'the interceptor assembles the picker itself — a forked create step',
  );
});

test('the slot is rendered by the launcher layout, and is empty by default', () => {
  const layout = read('layout.tsx');
  assert.match(layout, /modal: React\.ReactNode;/);
  assert.match(layout, /\{modal\}\s*<\/AppRailShell>/, 'the layout no longer renders the @modal slot');
  const def = read('@modal/default.tsx');
  assert.match(def, /export default function \w+\(\) \{\s*return null;\s*\}/);
});

test('the panel is a SidePanel that rises as a sheet on a phone and goes BACK on close', () => {
  const panel = read('_components/create-event-panel.tsx');
  assert.match(panel, /^'use client';/);
  assert.match(panel, /from '@\/app\/_components\/side-panel'/);
  assert.match(panel, /<SidePanel[^>]*phone="sheet"/, 'the phone lost its bottom sheet');
  assert.match(panel, /router\.back\(\)/, 'closing no longer returns to the board');
  // Server → client: only rendered children cross. No callable prop.
  assert.match(panel, /export function CreateEventPanel\(\{ children \}: \{ children: ReactNode \}\)/);
});

test('all three doors on Planning point at the intercepted address', () => {
  const page = read('page.tsx');
  const doors = page.match(/href="\/dashboard\/create-event"/g) ?? [];
  // NewEventCard's tile · NewEventButton's (+) · the empty state's button.
  assert.ok(doors.length >= 3, `expected the three add doors, saw ${doors.length}`);
  for (const fn of ['NewEventCard', 'NewEventButton']) {
    const body = page.match(new RegExp(`function ${fn}\\b[\\s\\S]*?\\n\\}`))?.[0] ?? '';
    assert.match(body, /href="\/dashboard\/create-event"/, `${fn} no longer opens the add flow`);
  }
  const empty = page.match(/<CollectionEmptyState[\s\S]{0,700}?\/>/)?.[0] ?? '';
  assert.match(empty, /href="\/dashboard\/create-event"/, 'the empty state no longer opens the add flow');
});
