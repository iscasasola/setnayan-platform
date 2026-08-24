/**
 * A guest can say who they are bringing — and cannot invent a seat.
 *
 * 🚨 THE PROMISE AND THE GAP. The host's own help text promises the +1's name
 * arrives, and the couple's guest list shows a "+ TBA" chip waiting for it.
 * Nothing on the guest side could send it. No name ⇒ no row ⇒ no QR ⇒ no camera
 * for that person.
 *
 * 🔑 THE REGISTER'S CAUSAL CHAIN WAS FALSE, and Rule 0 caught it. Two shipped
 * mechanisms already mint a real row with its own QR: the host's "add a guest"
 * form, and `/welcome`, where the +1 names THEMSELVES on first opening their
 * invitation. What was missing was the PRIMARY guest's side of it. So this is an
 * append to the shipped reply card, not a new screen, and `/welcome` is
 * deliberately untouched — it remains the +1's own door.
 *
 * 🔑 AND THE CARD WAS NOT MISSING A BOX — IT WAS MISSING A FACT.
 * `plus_one_allowed` was never selected by the guest-side loader and had no slot
 * on `GuestRow`, so the widget could not know the guest was entitled to bring
 * anyone. Threading that column is the actual fix; the box is the easy half.
 *
 * ── 🔒 THE SECURITY PROPERTY THIS FILE EXISTS FOR ───────────────────────────
 * The block only RENDERS when the host allowed a +1. **A rendered gate is not a
 * gate.** Both fields can be posted by anyone holding the URL, so the write
 * re-reads `plus_one_allowed` FROM THE DATABASE. Without that read, any guest
 * could mint themselves a second seat — with its own QR and its own camera — at
 * an event whose host allowed them none.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(WEB, p), 'utf8');
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const ACTIONS = strip(read('app/[slug]/actions.ts'));
const WIDGET = strip(read('app/[slug]/_components/rsvp-widget.tsx'));
const LOADERS = strip(read('app/[slug]/_lib/loaders.ts'));
const TYPES = strip(read('app/[slug]/_lib/types.ts'));

/** The write block, isolated so assertions cannot match unrelated code. */
const WRITE = (() => {
  const at = ACTIONS.indexOf("plus_one_of_guest_id', guestId");
  assert.ok(at > -1, 'the plus-one write is gone');
  return ACTIONS.slice(Math.max(0, at - 1800), at + 2600);
})();

// ── The fact the card was missing ───────────────────────────────────────────

test('the guest-side loader selects the entitlement', () => {
  assert.match(LOADERS, /plus_one_allowed/, 'loaders.ts does not select plus_one_allowed');
});

test('GuestRow carries it, so the widget can see it', () => {
  assert.match(TYPES, /plus_one_allowed: boolean;/, 'GuestRow has no slot for the entitlement');
});

// ── 🔒 The authorization property ───────────────────────────────────────────

test('🔒 the entitlement is re-read from the DATABASE, not taken from the form', () => {
  // The one that matters. A rendered gate is not a gate.
  assert.match(
    WRITE,
    /\.select\('plus_one_allowed[^']*'\)/,
    'the write never re-reads plus_one_allowed — a guest could mint themselves a seat',
  );
  assert.match(
    WRITE,
    /primary\?\.plus_one_allowed/,
    'the write does not branch on the database value',
  );
});

test('🔒 the row is created ONLY inside that check', () => {
  const gate = WRITE.indexOf('primary?.plus_one_allowed');
  const insert = WRITE.indexOf(".insert({");
  assert.ok(gate > -1 && insert > gate, 'the insert is not inside the entitlement check');
});

test('the new row is scoped to this event and this primary', () => {
  assert.match(WRITE, /plus_one_of_guest_id: guestId/, 'the +1 is not linked to the guest');
  assert.match(WRITE, /event_id: eventId/, 'the +1 is not scoped to the event');
});

// ── The rules it shares with the rest of the card ───────────────────────────

test('a blank box is not a removal', () => {
  // Same rule as the contact boxes: blank means "not decided", never "delete".
  // Removing a +1 destroys a real guest row with its own QR — a host action.
  assert.match(
    WRITE,
    /if \(plusOneFirst \|\| plusOneLast\)/,
    'the write runs on an empty submit — a blank box must change nothing',
  );
  assert.ok(!/\.delete\(\)/.test(WRITE), 'the guest-side write can delete a guest row');
});

test('naming the +1 clears the "+ TBA" placeholder', () => {
  // guestDisplayName PREFERS display_name, so leaving it keeps the placeholder
  // on the seating chart and in the emcee script — the half-fix /welcome shipped.
  assert.match(WRITE, /display_name: null/, 'the placeholder survives being named');
});

test('the host list stops reading "+ TBA" too', () => {
  assert.match(WRITE, /plus_one_name: named \|\| null/, 'the primary is not updated');
});

// ── The box itself ─────────────────────────────────────────────────────────

test('the box appears only when the host allowed one, and only to someone coming', () => {
  assert.match(WIDGET, /guest\.plus_one_allowed && !replyLocked/, 'the block is not gated');
  assert.match(WIDGET, /attending-reveal/, 'the block is not tied to the attending reveal');
  // The reveal is CSS-only — the same rule the selfie block already uses, so
  // this adds no client JS and no new state.
  assert.match(
    WIDGET,
    /\.rsvp-form:has\(input\[name="rsvp_status"\]\[value="attending"\]:checked\) \.attending-reveal/,
    'the CSS reveal does not cover the new block',
  );
});

test('/welcome is untouched — it stays the +1s own door', () => {
  const welcome = strip(read('app/[slug]/welcome/actions.ts'));
  assert.match(welcome, /confirmPlusOneName/, 'the +1s own naming screen was disturbed');
});
