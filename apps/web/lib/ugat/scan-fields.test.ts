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

/* ── wave 1 (2026-10-02): three ways a SAVED field read as "thrown away" ── */
const WAVE1: Record<string, string> = {
  'app/a/page.tsx': `import { Parts, Other } from './_c/parts';
import { save, remove, merge } from './actions';
export default function P() {
  return (
    <>
      <form action={save}><input name="link_url" /><input name="go" /><input name="quiet" /><input name="lonely" /></form>
      <form action={remove}><input name="id" /><Parts /></form>
      <form action={merge}><Other /></form>
    </>
  );
}
`,
  'app/a/_c/parts.tsx': `export function Parts() { return <span />; }
export function Other() { return <><input name="dup_id" /><input name="keep_id" /></>; }
`,
  'app/a/actions.ts': `'use server';
function readStr(fd: FormData, key: string) { return String(fd.get(key) ?? '').trim(); }
function readUrl(fd: FormData, key: string) { const raw = readStr(fd, key); return /^https?:/.test(raw) ? raw : null; }
function backTo(fd: FormData, msg: string): never { throw new Error(msg); }
export async function save(formData: FormData) {
  if (formData.get('go') !== 'on') backTo(formData, 'tick it');
  const lonely = formData.get('lonely') === '1';
  if (lonely) console.log('x');
  await s.from('t').insert({ link_url: readUrl(formData, 'link_url') });
  if (formData.get('quiet') !== '1') revalidatePath('/a');
}
export async function remove(formData: FormData) { await s.from('t').delete().eq('id', formData.get('id')); }
export async function merge(formData: FormData) { await s.rpc('merge', { a: formData.get('dup_id'), b: formData.get('keep_id') }); }
`,
};

test('wave 1: a key handed on through two keyed readers is a read; a gate that calls something decided it; a pure log did not', () => {
  const root = fixture(WAVE1);
  const m = scanFields({ webRoot: root, screens: scanScreens({ webRoot: root, builders: new Map(), tableNodes: new Map() }) });
  const a = m.actions.find((x) => x.ref === 'app/a/actions.ts#save')!;
  assert.deepEqual(a.saves.link_url, ['t.link_url'], 'readUrl(fd, k) → readStr(fd, k) → fd.get(k) reads link_url');
  assert.deepEqual(a.dropped, ['lonely'], 'go (turns the request away) and quiet (gates a revalidate) are used; a console.log decides nothing');
  const f = m.forms.find((x) => x.from === 'app/a/page.tsx' && x.actions.includes('app/a/actions.ts#save'))!;
  assert.deepEqual(f.notRead, []);
});

test('wave 1: a child component posts ITS OWN inputs, not its file-mates\'', () => {
  const root = fixture(WAVE1);
  const m = scanFields({ webRoot: root, screens: scanScreens({ webRoot: root, builders: new Map(), tableNodes: new Map() }) });
  const rm = m.forms.find((x) => x.actions.includes('app/a/actions.ts#remove'))!;
  assert.deepEqual(rm.inputs, ['id'], '<Parts /> renders no input — Other\'s dup_id/keep_id are not this form\'s');
  const mg = m.forms.find((x) => x.actions.includes('app/a/actions.ts#merge'))!;
  assert.deepEqual(mg.inputs, ['dup_id', 'keep_id']);
  assert.deepEqual(mg.notRead, []);
});
