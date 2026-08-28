/**
 * THE SEAT ROOMS BELONG TO THE KINDS THAT SEAT PEOPLE — and the writers close
 * with the readers.
 *
 * Owner 2026-08-28, verbatim: "only its own rooms". The approved grid
 * (EVENT_HUB_UNIVERSAL_DESIGN_2026-08-17.md § A) gives the four seat-shaped
 * rooms a "—" for travel, date and hangout.
 *
 * 🔴 THE RULE THIS FILE EXISTS TO HOLD IS NOT "the guest routes check seating".
 * It is that the READERS and the WRITERS move together. Narrowing the four
 * guest rooms alone re-creates, exactly, the defect `app/[slug]/seat/page.tsx`
 * records having already been repaired once: a host builds a seat plan, buys the
 * ₱1,499 branded per-guest QR pass, and their guests land on "this page does not
 * exist". So this guard bills SEVEN sites — four readers, three writers — and a
 * deletion at any one of them is red.
 *
 * 🪤 THE DAY-OF TAB CANNOT BE GATED WITH `hideKeys`, AND A FUTURE SESSION WILL
 * TRY. `hideKeys` filters `planningMenus` at the very bottom of
 * `buildCustomerMenuTree`; the day-of branch returns before it. A 'seats' entry
 * in hideKeys compiles, reads as correct, and hides nothing. The last two
 * assertions pin the real mechanism so that mistake fails instead of shipping.
 *
 * 🪤 Source assertions strip comments first — every site below carries a note
 * explaining the gate, and a raw-source grep would match the prose and pass
 * forever on its own justification.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WEDDING_PROFILE, surfaceEnabled } from './event-type-profile';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Occurrence count, so a mutation is measured rather than assumed. */
const times = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/* ───────────── the four READERS: a seat room refuses without 'seating' ─────── */

const READERS: ReadonlyArray<[string, string]> = [
  ['the seat pass', 'app/[slug]/seat/page.tsx'],
  ['find-my-seat', 'app/[slug]/find-seat/page.tsx'],
  ['the table map', 'app/[slug]/find-my-table/page.tsx'],
  ['the 3D venue walk', 'app/[slug]/venue/page.tsx'],
];

for (const [room, rel] of READERS) {
  test(`${room} refuses a kind with no seating surface`, () => {
    const src = code(rel);
    const n = times(src, "'seating'");
    assert.ok(
      n >= 1,
      `${rel}: no 'seating' check in code (comments stripped). This room is ` +
        `offered to a trip, a dinner date and a hangout, which have no ` +
        `banquet floor — it can only ever show its "not posted yet" plate.`,
    );
    // ABSENT, NEVER GREYED (approved grid § D rule 2): the refusal is a 404,
    // not an empty state. An empty state promises a plan that is coming.
    assert.ok(
      /notFound\(\)/.test(src),
      `${rel}: the seating refusal must be notFound(), not an empty plate.`,
    );
  });
}

/* ───────────── the three WRITERS: nothing can be built or bought ──────────── */

test('the seating room itself refuses a kind with no seating surface', () => {
  const src = code('app/dashboard/[eventId]/seating/page.tsx');
  assert.ok(
    times(src, "surfaceEnabled(seatingProfile, 'seating')") >= 1,
    'The seating room has no gate. A host of a kind whose guest seat rooms ' +
      '404 could still build a plan nobody can open.',
  );
  assert.ok(/redirect\(/.test(src), 'the seating room must redirect, not render.');
});

test('the paid per-guest QR add-on is not offered where there is no seating', () => {
  const src = code('lib/add-ons-catalog.ts');
  const entry = src.slice(src.indexOf("key: 'custom-qr-guest'"));
  assert.ok(entry.length > 100, "custom-qr-guest entry not found — renamed?");
  const nextKey = entry.indexOf("key: '", 10);
  const scoped = nextKey > 0 ? entry.slice(0, nextKey) : entry;
  assert.ok(
    times(scoped, "surface: 'seating'") === 1,
    "CUSTOM_QR_GUEST prints a branded QR that opens a guest's SEAT PASS. " +
      "Without surface: 'seating' the ₱1,499 card is offered on kinds whose " +
      'seat pass 404s — selling something the buyer’s guests cannot open.',
  );
});

test('the day-of Seats tab is gated on seatingEnabled, NOT on hideKeys', () => {
  const src = code('lib/customer-menu.ts');
  assert.ok(
    times(src, 'ctx.seatingEnabled !== false') === 1,
    'The day-of Seats tab lost its seatingEnabled gate — it now links to a ' +
      'room that redirects.',
  );
  // The trap, pinned: hideKeys is applied to `planningMenus` only, and the
  // day-of branch returns before it. If someone "simplifies" this onto
  // hideKeys, the tab silently stops being hidden.
  const dayOf = src.slice(src.indexOf("ctx.phase === 'dayof'"));
  const dayOfBranch = dayOf.slice(0, dayOf.indexOf("ctx.phase === 'after'"));
  assert.ok(dayOfBranch.length > 100, 'day-of branch not found — restructured?');
  assert.ok(
    !dayOfBranch.includes('hideKeys'),
    'The day-of branch returns BEFORE the hideKeys filter runs, so gating the ' +
      'Seats tab through hideKeys would hide nothing. Use seatingEnabled.',
  );
});

test('layout resolves seatingEnabled and hands it to both navs', () => {
  const src = code('app/dashboard/[eventId]/layout.tsx');
  assert.ok(
    times(src, "surfaceEnabled(profile, 'seating')") === 1,
    'layout.tsx no longer resolves seatingEnabled.',
  );
  assert.ok(
    times(src, 'seatingEnabled={seatingEnabled}') === 2,
    'seatingEnabled must reach BOTH the bottom nav and the section sub-nav — ' +
      'the day-of Seats tab renders in both.',
  );
});

/* ───────────── the direction of failure ──────────────────────────────────── */

test('a wedding keeps every seat room — the gate only ever subtracts', () => {
  assert.equal(surfaceEnabled(WEDDING_PROFILE, 'seating'), true);
});

test('an unreadable profile is NOT treated as "no seating"', () => {
  // resolveProfile degrades to GENERIC_PROFILE, which enables seating. A read
  // error must never silently delete a paid, published seat plan; only the
  // withdrawn kinds lose the rooms, and they lose them by their own stored row.
  const src = code('lib/event-type-profile.ts');
  assert.ok(
    times(src, 'fallbackFor(eventType)') >= 2,
    'resolveProfile lost its degrade-to-a-real-profile fallback; a DB hiccup ' +
      'would start 404-ing real seat passes.',
  );
});
