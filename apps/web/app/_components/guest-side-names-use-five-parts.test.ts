/**
 * EVERY NAME A GUEST TYPES IS THE FIVE PARTS.
 *
 * Owner, verbatim, 2026-09-30: *"The name will be same: Prefix · First · Middle
 * · Last · Suffix, to stay consistent"* — the same five the profile and the
 * Guest list store (`FORMAL_NAME_FIELDS`). On the guest side that is:
 *
 *   · the RSVP's plus-one seats (`PlusOneSeatPanels`) — and Me's "Add name" in
 *     place, which draws those same panels;
 *   · the plus-one's own door (`PlusOneDoor`);
 *   · the ask-to-join request (`RequestForm`).
 *
 * Held three ways, because each one alone can be walked past:
 *   1 · a SWEEP of every guest-side file (`app/[slug]/**`, `app/join/**`) for a
 *       raw `<input>` / `<select>` whose name is a name box — a new surface
 *       that hand-rolls a first/last pair fails here, wherever it lives;
 *   2 · each known surface RENDERS all five, with Prefix as ONE dropdown;
 *   3 · the readers keep what the boxes post (the seat rule, the request).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { FORMAL_NAME_FIELDS, NAME_PREFIX_CHOICES, prefixChoicesFor } from '@/lib/formal-name';
import { parsePersonName } from '@/lib/person-name-parse';
import { planSeatNames, readSeatNames, seatNamePartColumns } from '@/lib/extra-seats';
import { readRequestAnswers } from '@/lib/guest-requests';

(globalThis as unknown as { React: unknown }).React = React;

const APP = join(__dirname, '..');
const GUEST_SIDE = [join(APP, '[slug]'), join(APP, 'join')];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

/** A name box's field name — a person's name or one of its parts, bare or per seat. */
const NAME_FIELD =
  /^(?:plus_one_)?(?:name|full_name|your_name|guest_name|first_name|last_name|middle_name|name_prefix|name_suffix)(?:_\$\{[^}]+\}|_[1-4])?$/;

// ── 1 · the sweep ──────────────────────────────────────────────────────────

test('no guest-side file hand-rolls a name box — every one is the shared five', () => {
  const offenders: string[] = [];
  let scanned = 0;
  for (const root of GUEST_SIDE) {
    for (const file of walk(root)) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/<(input|select|textarea)\b[\s\S]*?\/?>/g)) {
        const tag = m[0];
        const name = tag.match(/\bname=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/);
        if (!name) continue;
        scanned += 1;
        const value = name[1] ?? name[2] ?? name[3] ?? '';
        // A hidden field is carried, not typed (the signed-in "Open my invitation").
        if (/type="hidden"/.test(tag)) continue;
        if (NAME_FIELD.test(value)) offenders.push(`${relative(APP, file)} · name="${value}"`);
      }
    }
  }
  assert.ok(scanned > 20, `the sweep read only ${scanned} named fields — it is not looking`);
  assert.deepEqual(offenders, [], 'a guest types a name into boxes that are not the five parts');
});

test('each guest-side name surface draws the shared FormalNameInputs', () => {
  for (const rel of [
    ['[slug]', '_components', 'rsvp-plus-ones.tsx'],
    ['[slug]', 'welcome', '_components', 'plus-one-door.tsx'],
    ['join', '[eventId]', '_components', 'request-form.tsx'],
  ]) {
    const src = stripComments(readFileSync(join(APP, ...rel), 'utf8'));
    assert.match(src, /<FormalNameInputs\b/, `${rel.join('/')} no longer draws the five name parts`);
  }
  // Me's "Add name" in place is the same panels, not boxes of its own.
  const inPlace = stripComments(readFileSync(join(APP, '[slug]', '_components', 'add-name-in-place.tsx'), 'utf8'));
  assert.match(inPlace, /<PlusOneSeatPanels\b/);
});

// ── 2 · what renders ───────────────────────────────────────────────────────

/** The one tag carrying `name="…"`, whatever order React wrote its attributes in. */
const tagOf = (html: string, name: string) => html.match(new RegExp(`<[a-z]+[^>]*name="${name}"[^>]*>`))?.[0] ?? '';

function assertFive(html: string, nameOf: (f: string) => string, required: boolean) {
  for (const f of FORMAL_NAME_FIELDS) {
    const tag = tagOf(html, nameOf(f));
    assert.ok(tag, `no "${nameOf(f)}" box`);
    if (f === 'name_prefix') assert.match(tag, /^<select\b/, 'Prefix is not a dropdown');
    else assert.match(tag, /^<input\b/);
    const must = required && (f === 'first_name' || f === 'last_name');
    assert.equal(/required=""/.test(tag), must, `${nameOf(f)}: required should be ${must}`);
  }
}

test('the plus-one seat panels draw all five, per seat; a blank seat stays allowed (TBA)', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PlusOneSeatPanels } = await import('../[slug]/_components/rsvp-plus-ones');
  const html = renderToStaticMarkup(
    React.createElement(PlusOneSeatPanels, {
      slots: [
        { seatId: 's1', first: 'Ben', last: 'Reyes', prefix: 'Atty.', middle: 'Cruz', suffix: 'Jr.', meal: 'fish', dietary: '' },
        { seatId: null, first: '', last: '', meal: 'no_preference', dietary: '' },
      ],
      active: 0,
      arranged: false,
      askMeal: false,
      askDietary: false,
    }),
  );
  assertFive(html, (f) => `plus_one_${f}_1`, false);
  assertFive(html, (f) => `plus_one_${f}_2`, false);
  assert.match(tagOf(html, 'plus_one_middle_name_1'), /value="Cruz"/, 'the stored middle name is not shown');
  assert.match(html, /<option value="Atty\." selected="">/, 'the stored prefix is not selected');
});

test('the ask-to-join request draws all five — First and Last required', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RequestForm } = await import('../join/[eventId]/_components/request-form');
  const html = renderToStaticMarkup(
    React.createElement(RequestForm, {
      action: async () => {},
      ask: {} as never,
      organizer: 'the couple',
      defaultParts: { first_name: 'Carla', last_name: 'Dizon' },
    }),
  );
  assertFive(html, (f) => f, true);
  assert.match(tagOf(html, 'first_name'), /value="Carla"/, 'a signed-in asker retypes their name');
  assert.doesNotMatch(html, /name="name"/, 'the old one-line box is still drawn');
});

// ── 3 · the readers keep what the boxes post ───────────────────────────────

const form = (pairs: Record<string, string>) => ({ get: (k: string) => (k in pairs ? pairs[k]! : null) });

test('the seat rule carries prefix / middle / suffix onto the seat row — and only when posted', () => {
  const read = readSeatNames(
    form({
      plus_one_name_prefix_1: 'Dr.',
      plus_one_first_name_1: 'Ben',
      plus_one_middle_name_1: '  Santos ',
      plus_one_last_name_1: 'Reyes',
      plus_one_name_suffix_1: '',
      plus_one_seat_id_1: 's1',
    }),
  );
  assert.deepEqual(read, [{ seatId: 's1', first: 'Ben', last: 'Reyes', prefix: 'Dr.', middle: 'Santos', suffix: null }]);
  const [op] = planSeatNames(read, [{ guest_id: 's1', first_name: 'TBA', confirmed_at: null, created_at: '1' }], 1);
  assert.equal(op?.kind, 'name');
  assert.deepEqual(seatNamePartColumns(op as never), { name_prefix: 'Dr.', middle_name: 'Santos', name_suffix: null });
  // An older reply (no part boxes) leaves the stored parts alone.
  const old = readSeatNames(form({ plus_one_first_name_1: 'Ben', plus_one_last_name_1: 'Reyes' }));
  assert.deepEqual(seatNamePartColumns(old[0] as never), {});
});

test('the request keeps the five as typed, and refuses a missing First or Last', () => {
  const base = { rsvp_status: 'attending', terms: 'on' };
  const ok = readRequestAnswers(
    form({ ...base, name_prefix: 'Atty.', first_name: 'Carla', middle_name: '', last_name: 'Dizon', name_suffix: 'III' }),
    {} as never,
  );
  assert.ok(ok.ok);
  assert.equal(ok.value.name, 'Carla Dizon');
  assert.deepEqual(ok.value.parts, {
    name_prefix: 'Atty.',
    first_name: 'Carla',
    middle_name: null,
    last_name: 'Dizon',
    name_suffix: 'III',
  });
  const noLast = readRequestAnswers(form({ ...base, first_name: 'Carla', last_name: ' ' }), {} as never);
  assert.deepEqual(noLast, { ok: false, error: 'missing_name' });
  // The one-line `name` (the signed-in hidden field) still reads, split later.
  const line = readRequestAnswers(form({ ...base, name: 'Carla Dizon' }), {} as never);
  assert.ok(line.ok && line.value.parts === null && line.value.name === 'Carla Dizon');
});

test('every prefix the dropdown offers is one the Guest list splitter reads as a prefix', () => {
  for (const p of NAME_PREFIX_CHOICES) {
    assert.equal(parsePersonName(`${p} Juan Cruz`).prefix, p, `"${p}" is not a prefix to the Guest list`);
  }
  // A stored prefix off the list is kept, never dropped.
  assert.equal(prefixChoicesFor('Justice')[0], 'Justice');
  assert.equal(prefixChoicesFor('Atty.').filter((p) => p === 'Atty.').length, 1);
});
