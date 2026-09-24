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
 * 🪤 SEAT PLAN IS GATED BY `seatingEnabled`, NOT `hideKeys`. Until 2026-09-24
 * that was forced (hideKeys never reached the day-of roster); the one tree now
 * applies hideKeys everywhere, but seating is a SURFACE, not a menu key, and
 * the layout resolves it once. The nav assertions pin the real mechanism.
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
import { buildEventMenuSections } from './customer-menu';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';

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

/* 🔄 2026-09-24 (event menu by moment). The day-of "Seats" TAB is gone —
   Papic took its slot — and "Seat plan" is now ONE row of the one tree, in
   The day, drawn by the rail, the ☰ drawer and the phone's moment strip in
   every phase. The rail used to ignore this gate entirely; now all three read
   the same row, so the gate is pinned by its effect on every surface. */
test('the Seat plan row is gated on seatingEnabled, on every surface and phase', () => {
  const src = code('lib/customer-menu.ts');
  assert.equal(
    times(src, 'ctx.seatingEnabled !== false'),
    1,
    'The Seat plan row lost its seatingEnabled gate — it now links to a room ' +
      'that redirects. (Exactly one: a second copy is a second answer.)',
  );
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const off = buildEventMenuSections('E', { phase, seatingEnabled: false }).flatMap((x) => x.rows);
    assert.ok(!off.some((r) => r.key === 'seat'), `${phase}: Seat plan shows for a kind with no seating`);
    const rail = buildCustomerNavGroups('E', { phase, seatingEnabled: false }).flatMap((g) => g.items);
    assert.ok(!rail.some((i) => i.key === 'seat'), `${phase}: the RAIL shows Seat plan for a kind with no seating`);
    // ⚠ UNDEFINED MEANS SHOW — a caller not taught the field keeps the row.
    const untaught = buildEventMenuSections('E', { phase }).flatMap((x) => x.rows);
    assert.ok(untaught.some((r) => r.key === 'seat'), `${phase}: an untaught caller lost Seat plan`);
  }
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
      'the moment strip draws Seat plan on the phone.',
  );
  const inputs = src.slice(src.indexOf('const eventRailInputs'));
  assert.ok(
    /seatingEnabled,/.test(inputs.slice(0, inputs.indexOf('};'))),
    'seatingEnabled must reach the RAIL too (eventRailInputs) — it drew Seat ' +
      'plan for every kind until 2026-09-24.',
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
