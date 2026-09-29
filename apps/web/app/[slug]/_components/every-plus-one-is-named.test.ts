/**
 * EVERY PLUS-ONE IS NAMED — one short set per seat, one switcher, one row each.
 *
 * Owner, verbatim, 2026-09-29: *"plus guests are only minimum questions. they
 * don't need to recommend songs and notes to the couple. They also get their
 * own QR Code. they can also link it to their account. Second, they can have
 * 1-4 pluses. so there needs to be a way to write their names in a simpler way.
 * like a toggle on which guest they are editing."*
 *
 * What this file holds (rsvp-plus-ones.tsx · lib/extra-seats.ts · submitRsvp):
 *   1. the reply draws exactly one set of boxes per seat the couple gave, 1–4;
 *   2. switching seats never unmounts one — every seat's boxes are in the form
 *      at every active seat, so nothing typed is lost and every seat POSTs;
 *   3. a plus-one is asked first name, last name, meal, dietary — never a song,
 *      a note to the couple or a selfie;
 *   4. Send is idempotent: a re-send names the SAME rows, a rename updates the
 *      row it names, a cleared name keeps the row, and only a NEW name makes a
 *      row (its own `qr_token` is the column's default) — never more than given;
 *   5. a blank name is "+N TBA", allowed, and changes no name.
 *
 * 🪤 Harness as `ask-your-guests.test.ts`: `globalThis.React` before the dynamic
 * import (`"jsx": "preserve"`), `server-only`/`client-only` stubbed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { planSeatNames, readSeatNames, type ExtraSeatRow } from '@/lib/extra-seats';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

async function renderWidget(count: number, seats?: unknown[], ask: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('./rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: {
        guest_id: 'g-1',
        first_name: 'Ana',
        last_name: 'Cruz',
        display_name: 'Ana Cruz',
        rsvp_status: 'attending',
        meal_preference: 'chicken',
        dietary_restrictions: null,
        guest_note: null,
        email: null,
        mobile: null,
        plus_one_allowed: true,
        plus_one_count: count,
        plus_one_name: null,
        plus_one_seats: seats ?? [],
        qr_token: 't',
        photo_source: null,
        photo_url: null,
      },
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      replyLocked: false,
      ask,
    } as never),
  );
}

/** Only the plus-one block of a rendered card. */
function plusOneBlock(html: string): string {
  const at = html.indexOf('data-rsvp-plus-ones');
  assert.ok(at > -1, 'the plus-one block did not render');
  const end = html.indexOf('name="meal_preference"', at);
  return html.slice(at, end > -1 ? end : undefined);
}

// ── 1 · one set per seat, 1–4 ───────────────────────────────────────────────

test('the reply draws exactly one set of boxes per seat the couple gave (1–4)', async () => {
  for (const n of [1, 2, 3, 4]) {
    const block = plusOneBlock(await renderWidget(n));
    for (let i = 1; i <= 4; i++) {
      const has = block.includes(`name="plus_one_first_name_${i}"`);
      assert.equal(has, i <= n, `+${n}: seat ${i} ${has ? 'drawn' : 'missing'}`);
      assert.equal(block.includes(`name="plus_one_last_name_${i}"`), i <= n);
      assert.equal(block.includes(`name="plus_one_meal_${i}"`), i <= n);
      assert.equal(block.includes(`name="plus_one_dietary_${i}"`), i <= n);
    }
  }
});

test('each seat opens on what it already holds — name, meal, dietary', async () => {
  const block = plusOneBlock(
    await renderWidget(2, [
      { guest_id: 's1', name: 'Maria Santos', first: 'Maria', last: 'Santos', meal: 'fish', dietary: 'halal' },
      { guest_id: 's2', name: null, first: null, last: null, meal: null, dietary: null },
    ]),
  );
  assert.match(block, /name="plus_one_seat_id_1" value="s1"/);
  assert.match(block, /name="plus_one_seat_id_2" value="s2"/);
  assert.match(block, /name="plus_one_first_name_1"[^>]*value="Maria"/);
  assert.match(block, /name="plus_one_last_name_1"[^>]*value="Santos"/);
  assert.match(block, /name="plus_one_dietary_1"[^>]*value="halal"/);
  assert.match(block, /<option value="fish" selected="">/, 'the stored meal is not the one shown — a Send would overwrite it');
});

test('the couple’s meal / dietary switches reach the plus-ones too', async () => {
  const block = plusOneBlock(await renderWidget(2, [], { meal: false, dietary: false }));
  assert.doesNotMatch(block, /plus_one_meal_/);
  assert.doesNotMatch(block, /plus_one_dietary_/);
  assert.match(block, /plus_one_first_name_2/);
});

// ── 2 · the switcher never loses what was typed ────────────────────────────

test('every seat’s boxes are in the form at EVERY active seat — only the active one shows', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PlusOneSeatPanels, plusOneSlots } = await import('./rsvp-plus-ones');
  const slots = plusOneSlots(
    4,
    [
      { guest_id: 'a', name: 'Maria Santos', first: 'Maria', last: 'Santos', meal: 'beef', dietary: null },
      { guest_id: 'b', name: null },
    ],
    null,
  );
  for (let active = 0; active < 4; active++) {
    const html = renderToStaticMarkup(
      React.createElement(PlusOneSeatPanels, { slots, active, arranged: true, askMeal: true, askDietary: true }),
    );
    for (let n = 1; n <= 4; n++) {
      assert.match(html, new RegExp(`name="plus_one_first_name_${n}"`), `switching to ${active + 1} unmounted seat ${n}`);
      assert.match(html, new RegExp(`name="plus_one_meal_${n}"`));
    }
    assert.match(html, /name="plus_one_first_name_1"[^>]*value="Maria"/, 'a switch reset a typed name');
    const shown = [...html.matchAll(/data-plus-one-seat="(\d)" class="([^"]*)"/g)]
      .filter(([, , cls]) => !/\bhidden\b/.test(cls))
      .map(([, n]) => Number(n));
    assert.deepEqual(shown, [active + 1], `active ${active + 1}: shown ${shown.join(',')}`);
  }
});

test('the switcher is the shared PickMenu — one dropdown, ✓ on a named seat, "Guest N" on an unnamed one', async () => {
  const { seatOptions } = await import('./rsvp-plus-ones');
  assert.deepEqual(seatOptions(['Maria Santos', '', ' Ben ', '']), [
    { key: '0', label: 'Maria Santos ✓' },
    { key: '1', label: 'Guest 2' },
    { key: '2', label: 'Ben ✓' },
    { key: '3', label: 'Guest 4' },
  ]);
  const src = stripComments(readFileSync(join(__dirname, 'rsvp-plus-ones.tsx'), 'utf8'));
  assert.match(src, /<PickMenu\b/, 'the switcher is not the shared PickMenu');
  assert.match(src, /Filling in for:/);
  assert.doesNotMatch(src, /role="tablist"|role="tab"/, 'a pill/tab row came back');
});

// ── 3 · minimum questions ──────────────────────────────────────────────────

test('a plus-one is asked ONLY first name, last name, meal and dietary', async () => {
  const block = plusOneBlock(await renderWidget(4));
  const names = [...block.matchAll(/name="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(names.length > 0);
  for (const n of names) {
    assert.match(n, /^plus_one_(first_name|last_name|meal|dietary|seat_id)_[1-4]$/, `a plus-one is asked "${n}"`);
  }
  assert.doesNotMatch(block, /song|guest_note|selfie|note to/i);
});

// ── 4 · Send is idempotent; one row per named seat ─────────────────────────

const tba = (id: string, at: string): ExtraSeatRow => ({ guest_id: id, first_name: 'TBA', confirmed_at: null, created_at: at });
const named = (id: string, at: string): ExtraSeatRow => ({ guest_id: id, first_name: 'X', confirmed_at: at, created_at: at });
const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k]! : null) });

test('the reply reads each seat’s meal and dietary with its name', () => {
  assert.deepEqual(
    readSeatNames(form({ plus_one_first_name_1: 'Maria', plus_one_last_name_1: 'Santos', plus_one_meal_1: 'fish', plus_one_dietary_1: 'halal' })),
    [{ seatId: null, first: 'Maria', last: 'Santos', meal: 'fish', dietary: 'halal' }],
  );
});

test('first Send: one NEW row per named seat, up to what the couple gave; a blank seat stays TBA', () => {
  const ops = planSeatNames(
    readSeatNames(
      form({
        plus_one_first_name_1: 'Maria', plus_one_meal_1: 'fish',
        plus_one_first_name_2: '', plus_one_meal_2: 'no_preference',
        plus_one_first_name_3: 'Ben', plus_one_meal_3: 'beef',
      }),
    ),
    [],
    3,
  );
  assert.deepEqual(ops, [
    { kind: 'create', first: 'Maria', last: '', meal: 'fish' },
    { kind: 'create', first: 'Ben', last: '', meal: 'beef' },
  ]);
});

test('re-sending the same names names the SAME rows — nothing is minted twice', () => {
  const seats = [named('a', '1'), named('b', '2')];
  const again = readSeatNames(
    form({
      plus_one_seat_id_1: 'a', plus_one_first_name_1: 'Maria', plus_one_last_name_1: 'Santos',
      plus_one_seat_id_2: 'b', plus_one_first_name_2: 'Ben',
    }),
  );
  const ops = planSeatNames(again, seats, 2);
  assert.equal(ops.filter((o) => o.kind === 'create').length, 0);
  assert.deepEqual(ops.map((o) => (o.kind === 'create' ? null : o.seatId)), ['a', 'b']);
});

test('a rename updates the row it names; a cleared name keeps the row and its name', () => {
  const seats = [named('a', '1'), named('b', '2')];
  const ops = planSeatNames(
    readSeatNames(
      form({
        plus_one_seat_id_1: 'a', plus_one_first_name_1: 'Mariana', plus_one_meal_1: 'fish',
        plus_one_seat_id_2: 'b', plus_one_first_name_2: '', plus_one_meal_2: 'vegan',
      }),
    ),
    seats,
    2,
  );
  assert.deepEqual(ops, [
    { kind: 'name', seatId: 'a', first: 'Mariana', last: '', meal: 'fish' },
    { kind: 'details', seatId: 'b', meal: 'vegan' },
  ]);
});

test('a blank name with no seat of its own makes nothing — TBA is allowed, never minted', () => {
  assert.deepEqual(
    planSeatNames(readSeatNames(form({ plus_one_first_name_1: '', plus_one_meal_1: 'fish' })), [], 2),
    [],
  );
  // …and a forged seat id from someone else's list is not a door to their row.
  assert.deepEqual(
    planSeatNames([{ seatId: 'NOT-MINE', first: '', last: '', meal: 'fish' }], [tba('a', '1')], 1),
    [],
  );
});

// ── The write ───────────────────────────────────────────────────────────────

test('submitRsvp: a details-only seat never touches the name; meal is checked and switch-gated', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'actions.ts'), 'utf8'));
  const at = src.indexOf("op.kind === 'details'");
  assert.ok(at > -1, 'the details-only branch is gone');
  const branch = src.slice(at, src.indexOf('continue;', at));
  assert.doesNotMatch(branch, /first_name|last_name|plus_one_name_confirmed_at|\.delete\(/, 'a blank name renamed or removed a seat');
  assert.match(src, /ask\.meal && op\.meal !== undefined && MEAL_VALUES\.includes\(op\.meal/);
  assert.match(src, /ask\.dietary && op\.dietary !== undefined/);
  // The new row carries the seat's answers, beside the fields that make it a seat.
  assert.match(src, /\.insert\(\{\s*\.\.\.seatAnswers,\s*event_id: eventId/);
  // The host-list mirror takes the first NAMED seat, never a details-only one.
  assert.match(src, /ops\.find\(\(o\) => o\.kind !== 'details'\)/);
});
