/**
 * The couple's private note and the guest's own message are DIFFERENT COLUMNS.
 *
 * 🔴 Until 2026-08-06 they were one — `guests.notes` — with two labels:
 *      couple's screen: "Notes (private)"
 *      guest's screen:  "A note to the couple"
 * Both pre-filled from it, both wrote back to it. So the couple's note about a
 * guest ("seat away from Tita") appeared pre-typed in that guest's own reply
 * box, and submitting the RSVP erased it. Spreadsheet-imported guests saw
 * "Household: <name>" there for the same reason.
 *
 * These are source-level guards on purpose. The defect was never a logic bug —
 * every function did exactly what it said. It was two surfaces pointed at one
 * column, which only a cross-file check can catch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('the guest-facing RSVP form binds to guest_note, never to notes', () => {
  const src = read('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(src, /name="guest_note"/, 'the guest field must be guest_note');
  assert.match(src, /defaultValue=\{guest\.guest_note \?\? ''\}/);
  assert.doesNotMatch(src, /name="notes"/, 'a guest-facing field must never be named notes');
  assert.doesNotMatch(
    src,
    /defaultValue=\{guest\.notes/,
    "the couple's private note must never pre-fill a guest's box",
  );
});

test('the guest RSVP action writes guest_note and never touches notes', () => {
  const src = read('app/[slug]/actions.ts');
  assert.match(src, /formData\.get\('guest_note'\)/);
  assert.match(src, /guest_note: guestNote/);
  assert.doesNotMatch(
    src,
    /formData\.get\('notes'\)/,
    'the guest action must not read a notes field',
  );
  assert.doesNotMatch(
    src,
    /^\s+notes,$/m,
    'the guest action must not write the notes column',
  );
});

test("the couple's private note is not even SELECTED onto the guest surface", () => {
  const src = read('app/[slug]/_lib/loaders.ts');
  const selectLine = src
    .split('\n')
    .find((l) => l.includes('dietary_restrictions') && l.includes('qr_token'));
  assert.ok(selectLine, 'guest select list not found');
  assert.match(selectLine!, /guest_note/, 'the guest surface needs guest_note');
  assert.doesNotMatch(
    selectLine!,
    /(^|,)\s*notes\s*(,|')/,
    "the couple's notes column must not travel to the guest page at all",
  );
});

test('the guest-facing type carries guest_note and not notes', () => {
  const src = read('app/[slug]/_lib/types.ts');
  assert.match(src, /guest_note: string \| null;/);
});

test('the couple still receives BOTH — their own note and the guest\'s message', () => {
  const lib = read('lib/guests.ts');
  assert.match(lib, /,rsvp_status,notes,guest_note,qr_token,/, 'couple select needs both');
  assert.match(lib, /guest_note: string \| null;/);
  const page = read('app/dashboard/[eventId]/guests/[guestId]/page.tsx');
  assert.match(page, /guest\.guest_note/, "the couple must be shown the guest's message");
  assert.match(page, /never sees it/, 'the private note must say plainly that it is private');
});
