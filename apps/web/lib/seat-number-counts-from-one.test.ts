/**
 * seat-number-counts-from-one.test.ts — a guest is never told "Seat 0".
 *
 * `event_seat_assignments.seat_number` counts from 0: the auto-draft's first
 * chair is 0 (`seatAt` in lib/seating.ts) and prod read `min(seat_number) = 0`
 * on 2026-11-22 (33 of 263 numbered seats were chair 0). Seats › List writes it
 * `Seat ${formatCount(seat + 1)}`. The ticket (lib/pass-card.server.ts), the
 * printed passes (lib/print-set.server.ts) and the guest's own seat pass
 * (app/[slug]/seat/page.tsx) printed the column raw — so the first chair read
 * "Seat 0" and every seat was one lower than the seat plan the couple made.
 *
 *   (1) the rule itself: chair 0 is "1".
 *   (2) the readers that print a seat number say it through `seatNumberWords`.
 *   (3) a whole-tree scan of app/ and lib/: nothing turns `seat_number` into
 *       text itself, and no "Seat {…}" / `Seat ${…}` prints a seat number that
 *       has not been counted from 1.
 *
 * (2)–(3) are comment-stripped source scans: the hazard is code that is
 * PRESENT, and comments (this one included) may quote the bad string.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { seatNumberWords } from '@/lib/table-words';

const WEB = process.cwd();

test('(1) chair 0 reads "1" — a seat number is counted from one, with the count\'s commas', () => {
  assert.equal(seatNumberWords(0), '1');
  assert.equal(seatNumberWords(5), '6');
  assert.equal(seatNumberWords(1099), '1,100');
});

/** The readers that print `seat_number` to a guest. A moved file must re-anchor this guard, never pass over nothing. */
const READERS = ['lib/pass-card.server.ts', 'lib/print-set.server.ts', 'app/[slug]/seat/page.tsx'];

test('(2) the ticket, the printed passes and the seat pass count the seat through seatNumberWords', () => {
  for (const rel of READERS) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.match(src, /\bseat_number\b/, `${rel} no longer reads seat_number — re-anchor this guard on whatever prints the seat now`);
    assert.match(src, /\bseatNumberWords\(/, `${rel} prints a seat number without seatNumberWords — chair 0 reads "Seat 0"`);
  }
});

/** Every non-test .ts/.tsx under a directory, recursively. */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** An expression that is already a seat counted from 1, or is the helper itself. */
const COUNTED = /\+\s*1\b|\bseatNumberWords\(/;
/** An expression that names a seat number (the column, or a variable carrying it). */
const NAMES_SEAT_NUMBER = /\bseat_?[Nn]umber\b/;

/**
 * Expressions that print a seat number which is ALREADY words — keyed on the
 * file and the exact expression, each with why. A stale entry fails (4).
 */
const ALREADY_WORDS: Record<string, { expr: string; why: string }> = {
  'lib/print-layout.ts': {
    expr: 'pass.seatNumber',
    why: 'PrintPass.seatNumber is the string lib/print-set.server.ts already wrote with seatNumberWords',
  },
  'app/sample/hub/[guestKey]/page.tsx': {
    expr: 'seat.seatNumber',
    why: 'the sample event is a fixture whose seats are written from 1 (lib/sample-event/snapshot.ts); it never reads the column',
  },
};

function offendersIn(rel: string, raw: string): string[] {
  const src = stripComments(raw);
  const out: string[] = [];
  // (a) the column turned into text by hand.
  for (const m of src.matchAll(/\bString\(\s*([^()]*\bseat_number\b[^()]*)\)|\bseat_number\s*\)?\s*\.toString\(/g)) {
    if (!COUNTED.test(m[0])) out.push(`${rel}: ${m[0]}`);
  }
  // (b) "Seat ${…}" in a template literal, or "Seat {…}" in JSX text, printing a seat number not counted from 1.
  for (const m of src.matchAll(/\b[Ss]eat\s*(?:#|[Nn]o\.?)?\s*\$?\{([^{}\n]*(?:\([^()\n]*\)[^{}\n]*)*)\}/g)) {
    const expr = m[1].trim();
    if (!NAMES_SEAT_NUMBER.test(expr) || COUNTED.test(expr)) continue;
    if (ALREADY_WORDS[rel]?.expr === expr) continue;
    out.push(`${rel}: ${m[0]}`);
  }
  return out;
}

test('(3) nowhere in app/ or lib/ prints seat_number as stored (from 0)', () => {
  const files = [...filesUnder(join(WEB, 'app')), ...filesUnder(join(WEB, 'lib'))];
  for (const rel of READERS) {
    assert.ok(files.some((f) => relative(WEB, f) === rel), `${rel} is not where this scan looks — re-anchor this guard`);
  }
  const offenders: string[] = [];
  for (const f of files) offenders.push(...offendersIn(relative(WEB, f), readFileSync(f, 'utf8')));
  assert.deepEqual(
    offenders,
    [],
    'A seat number is printed as stored. event_seat_assignments.seat_number counts from 0, so the first ' +
      'chair reads "Seat 0" and every seat is one lower than the seat plan. Write it with seatNumberWords() ' +
      'from lib/table-words.ts (or `+ 1`, as Seats › List does).',
  );
});

test('(3b) the scan catches the shapes it is for', () => {
  assert.equal(offendersIn('x.ts', 'seatNumber: s.seat_number != null ? String(s.seat_number) : null').length, 1);
  assert.equal(offendersIn('x.ts', 'm.set(id, s.seat_number.toString())').length, 1);
  assert.equal(offendersIn('x.tsx', '<span>· Seat {seatNumber}</span>').length, 1);
  assert.equal(offendersIn('x.ts', 'const t = `Table 4 · seat ${a.seat_number}`;').length, 1);
  // …and leaves the counted ones, and the ones that are not a seat number, alone.
  assert.equal(offendersIn('x.tsx', '<span>· Seat {seatNumberWords(seatNumber)}</span>').length, 0);
  assert.equal(offendersIn('x.ts', '` · seat ${formatCount(p.seatNumber + 1)}`').length, 0);
  assert.equal(offendersIn('x.ts', 'const k = `${r.table_id}#${r.seat_number}`;').length, 0);
  assert.equal(offendersIn('x.ts', "fd.set('seat_number', String(seatNumber));").length, 0);
});

test('(4) every ALREADY_WORDS entry still prints what it excuses', () => {
  for (const [rel, { expr }] of Object.entries(ALREADY_WORDS)) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.ok(src.includes(expr), `${rel} no longer prints ${expr} — drop its ALREADY_WORDS entry`);
  }
});
