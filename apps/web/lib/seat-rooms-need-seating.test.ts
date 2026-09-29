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
 * 🪤 THE SEAT PLAN'S CLAIM IS GATED BY `seatingEnabled`, NOT `hideKeys`. Until 2026-09-24
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

/* 🔄 2026-09-24 (event menu by moment) → train n (2026-09-29): the Seat plan
   was ONE row of the one tree; its Details home (Details › Your event › Seat
   plan) is on main now, so the row is gone on every surface and its page is
   CLAIMED instead — by the Event Hub Maker, or by Our Services where there is
   no Maker. The gate moved with it: a kind that seats nobody has no row that
   claims /seating (its /seating redirects home), pinned by its effect. */
test('the Seat plan page is claimed only where the kind seats people, on every surface and phase', () => {
  const src = code('lib/customer-menu.ts');
  assert.equal(
    times(src, 'ctx.seatingEnabled !== false'),
    1,
    'The /seating claim lost its seatingEnabled gate — a row now lights for a ' +
      'room that redirects. (Exactly one: a second copy is a second answer.)',
  );
  const claims = (rows: { href: string; matchPrefix?: string; alsoMatch?: string[] }[]) =>
    rows.flatMap((r) => [r.href, r.matchPrefix ?? '', ...(r.alsoMatch ?? [])]);
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    for (const websiteEnabled of [true, false]) {
      const off = buildEventMenuSections('E', { phase, seatingEnabled: false, websiteEnabled }).flatMap((x) => x.rows);
      assert.ok(!off.some((r) => r.key === 'seat'), `${phase}: a Seat plan row came back`);
      assert.ok(
        !claims(off).includes('/dashboard/E/seating'),
        `${phase}: a row claims /seating for a kind with no seating`,
      );
      const rail = buildCustomerNavGroups('E', { phase, seatingEnabled: false, websiteEnabled }).flatMap((g) => g.items);
      assert.ok(!rail.some((i) => i.key === 'seat'), `${phase}: the RAIL shows Seat plan`);
      // ⚠ UNDEFINED MEANS SEATING — a caller not taught the field keeps the claim,
      // on the Maker where there is one, else on Our Services.
      const untaught = buildEventMenuSections('E', { phase, websiteEnabled }).flatMap((x) => x.rows);
      const holder = untaught.find((r) => (r.alsoMatch ?? []).includes('/dashboard/E/seating'));
      assert.equal(
        holder?.key,
        websiteEnabled ? 'launch' : 'studio',
        `${phase}/${websiteEnabled ? 'maker' : 'no maker'}: /seating is not held by the right row`,
      );
    }
  }
});

test('layout resolves seatingEnabled and hands it to the bar and the rail', () => {
  const src = code('app/dashboard/[eventId]/layout.tsx');
  assert.ok(
    times(src, "surfaceEnabled(profile, 'seating')") === 1,
    'layout.tsx no longer resolves seatingEnabled.',
  );
  // 🔄 Stage D (2026-09-29): the section sub-nav is retired — the phone has
  // ONE bar, whose Maker (or Services) tab lights the Seat plan's page (train
  // n). Exactly one phone mount must be told the gate.
  assert.ok(
    times(src, 'seatingEnabled={seatingEnabled}') === 1,
    'seatingEnabled must reach the bottom bar — it decides whether /seating lights a tab.',
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
