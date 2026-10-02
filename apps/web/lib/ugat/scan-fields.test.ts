/**
 * scan-fields.test.ts — the FIELDS scanner, against a fixture tree.
 *
 * Asserted from both sides, like scan-screens.test.ts: a field that reaches a
 * write is SAVED and one that reaches nothing is DROPPED; a form input its
 * action never reads is NOT READ and one it reads is not; a keyed reader
 * (`str(fd, 'x')`) is a read, and a helper that merely receives a string
 * (`back(fd, 'bad_name')`) is not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { parseSelect, scanFields } from './scan-fields';
import { scanScreens } from './scan-screens';
import { factOf, serializeFieldsMap } from './fields';

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ugat-fields-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

const FILES: Record<string, string> = {
  'app/page.tsx': `export default function P() { return <a href="/guests/new">Add</a>; }\n`,
  'app/guests/new/page.tsx': `import { GuestForm } from './_components/guest-form';
import { daysUntil } from '@/lib/days';
export default async function P() {
  const { data } = await s.from('events').select('event_id, event_date, style_preferences').maybeSingle();
  const n = daysUntil(data.event_date);
  return <GuestForm />;
}
`,
  'lib/days.ts': `export function daysUntil(d: string) { return 1; }\n`,
  'app/guests/new/_components/guest-form.tsx': `'use client';
import { createGuest } from '../actions';
export function GuestForm() {
  return (
    <form action={createGuest}>
      <input name="first_name" />
      <input name="meal" />
      <input name="nickname" />
      <input name="seen_tour" />
    </form>
  );
}
`,
  'app/guests/new/actions.ts': `'use server';
function str(fd: FormData, key: string) { return String(fd.get(key) ?? '').trim(); }
function back(fd: FormData, code: string) { redirect('/guests/new?e=' + code); }
export async function createGuest(formData: FormData) {
  const first = str(formData, 'first_name');
  const meal = clean(formData.get('meal'));
  const seen = formData.get('seen_tour') === 'on';
  if (!first) back(formData, 'bad_name');
  if (seen) console.log('x');
  const { data: row } = await s.from('guests').insert({ first_name: first, meal_preference: meal }).select('guest_id').single();
  await s.from('events').update({ style_preferences: { setup: { guestWord: first } } }).eq('event_id', row.guest_id);
}
`,
};

function scan() {
  const root = fixture(FILES);
  const screens = scanScreens({ webRoot: root, builders: new Map(), tableNodes: new Map() });
  return scanFields({ webRoot: root, screens });
}

test('a field that reaches a write is saved there; one that reaches nothing is dropped', () => {
  const m = scan();
  const a = m.actions.find((x) => x.ref === 'app/guests/new/actions.ts#createGuest');
  assert.ok(a, 'the action is mapped');
  assert.deepEqual(a.saves.first_name?.includes('guests.first_name'), true);
  assert.deepEqual(a.saves.meal, ['guests.meal_preference']);
  assert.deepEqual(a.dropped, ['seen_tour'], 'only the field used in a condition alone is dropped');
  assert.ok(!a.fields.includes('bad_name'), 'a string handed to a non-reading helper is not a field');
  assert.ok(a.writes.includes('events.style_preferences.setup.guestWord'), 'a jsonb key is a home');
});

test('a form input the action never reads is "not read"; the ones it reads are not', () => {
  const m = scan();
  const f = m.forms.find((x) => x.from === 'app/guests/new/_components/guest-form.tsx');
  assert.ok(f);
  assert.deepEqual(f.actions, ['app/guests/new/actions.ts#createGuest']);
  assert.deepEqual(f.notRead, ['nickname']);
});

test('a screen carries its reads, its writes, its actions and its calculations', () => {
  const m = scan();
  const s = m.screens.find((x) => x.id === '/guests/new');
  assert.ok(s);
  assert.ok(s.reads.includes('events.event_date'));
  assert.ok(s.writes.includes('guests.first_name'));
  assert.deepEqual(s.actions, ['app/guests/new/actions.ts#createGuest']);
  assert.deepEqual(s.calcs, ['days-to-go']);
  const home = m.screens.find((x) => x.id === '/');
  assert.deepEqual(home?.writes, [], 'a screen that only links writes nothing');
});

test('the scan is deterministic', () => {
  assert.equal(serializeFieldsMap(scan()), serializeFieldsMap(scan()));
});

test('selects and fact names parse the way the code writes them', () => {
  assert.deepEqual(parseSelect('events', 'event_id, d:event_date, guests(first_name, rsvp_status), x::text'), [
    'events.event_id',
    'events.event_date',
    'guests.first_name',
    'guests.rsvp_status',
    'events.x',
  ]);
  assert.deepEqual(parseSelect('events', '*'), ['events.*']);
  assert.equal(factOf('events.style_preferences.setup.guestWord'), 'guest_word');
  assert.equal(factOf('rpc:save.p_event_date'), 'event_date');
});
