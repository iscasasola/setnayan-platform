/**
 * gates-have-handles.test.ts — every switch the product depends on must have
 * something that can flip it.
 *
 * 🔴 THE PATTERN, TWICE NOW.
 *
 * `events.papic_face_mode` shipped, was paid for, was activated on 2026-06-19
 * with every flag green — and stored NOTHING for seven weeks, because the
 * column had ZERO WRITERS anywhere in the codebase. All five production events
 * sat in the mode that hard-nulls the face vector.
 *
 * `events.live_media_public` shipped on 2026-09-20 as "the couple's opt-in for
 * anonymous live media", `NOT NULL DEFAULT FALSE`, read on every render of the
 * guest site — and nothing ever wrote it either. The guest site computes
 * `liveMediaVisible = viewer is a guest OR live_media_public`, so a visitor
 * with no invitation never saw the livestream or the live photo wall on ANY
 * event. That visitor is the relative overseas who opened the link someone
 * forwarded on Messenger — precisely the person a wedding livestream is for.
 * All five production events were FALSE, and no couple could have changed it.
 *
 * WHY NEITHER WAS CAUGHT: a read-only column is INVISIBLE to every ordinary
 * check. It typechecks, it has RLS, it has a migration with a thoughtful
 * comment, its readers have tests, and the feature "works" — it just always
 * takes the false branch. Nothing errors. Nothing logs. Production looks calm.
 *
 * 🔑 TRACE TO THE WRITE, NOT THE FLAG. Grep the column name and ask whether
 * every single hit is a READ. That question is what this test asks, on a list
 * of the columns where the answer matters.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..'); // apps/web

/**
 * Columns whose whole purpose is to be TURNED ON by somebody. Each needs a
 * writer — a server action, a script, an admin path — that sets it.
 *
 * Add a column here when its false value silently disables a feature rather
 * than erroring. Do NOT add columns that are stamped as a side effect (a
 * timestamp, a counter); those have writers by construction.
 */
const SWITCHES: { column: string; whoFlips: string; whatBreaksWhenStuck: string }[] = [
  {
    column: 'live_media_public',
    whoFlips: 'the couple, on the website privacy page',
    whatBreaksWhenStuck:
      'a visitor with no invitation never sees the livestream or the live photo ' +
      'wall — on the day, while the broadcast is running',
  },
  {
    column: 'papic_face_mode',
    whoFlips: 'an admin / the DPO, per event',
    whatBreaksWhenStuck: 'face auto-tagging stores nothing, on a feature that was paid for',
  },
];

/** Every .ts/.tsx under apps/web that is not a test, a type file, or generated. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = sourceFiles(WEB);

/**
 * Does any file WRITE this column? A write is the column appearing as an object
 * key inside an `.update({...})` or `.insert({...})` — which is how every write
 * in this codebase is spelled, since all of them go through supabase-js.
 *
 * Deliberately NOT "the column name appears somewhere": that is exactly the
 * check that would have passed for seven weeks on a column with 40 readers and
 * no writer.
 */
function writersOf(column: string): string[] {
  const found: string[] = [];
  // `.update({ ... column: ... })` / `.insert({ ... column: ... })`, allowing
  // whitespace and other keys, non-greedy up to the closing brace.
  const pattern = new RegExp(`\\.(update|insert|upsert)\\(\\s*[\\[{][\\s\\S]{0,600}?\\b${column}\\b\\s*:`);
  for (const file of FILES) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes(column)) continue;
    if (pattern.test(src)) found.push(file.slice(WEB.length + 1));
  }
  return found;
}

for (const sw of SWITCHES) {
  test(`${sw.column} has something that can turn it on`, () => {
    const writers = writersOf(sw.column);
    assert.ok(
      writers.length > 0,
      `NOTHING WRITES \`${sw.column}\`.\n\n` +
        `It is meant to be flipped by ${sw.whoFlips}. While it is stuck at its ` +
        `default, ${sw.whatBreaksWhenStuck}.\n\n` +
        `This is not a hypothetical: this exact shape shipped twice — ` +
        `papic_face_mode stored nothing for seven weeks with every flag green, ` +
        `and live_media_public hid the broadcast from every visitor without an ` +
        `invitation on every event in production.\n\n` +
        `A read-only switch is invisible to every other check: it typechecks, it ` +
        `has RLS, its readers have tests, and the feature simply always takes the ` +
        `false branch. Nothing errors.\n\n` +
        `Fix: ship the control that flips it, in the same change as the column.`,
    );
  });
}

test('the writer detector does not pass on a mere mention', () => {
  // The guard above is only worth having if it can tell a READ from a WRITE.
  // If this ever passes for a column that is only ever selected, both tests
  // above become decoration.
  const readOnly = writersOf('landing_page_hero_image_url__definitely_not_a_real_column');
  assert.equal(readOnly.length, 0, 'a column nothing mentions must have no writers');

  // And a column that IS written must be found — proving the pattern matches
  // the way this codebase actually spells an update.
  const known = writersOf('landing_page_visibility');
  assert.ok(
    known.length > 0,
    'landing_page_visibility is written by the privacy action; if the detector ' +
      'cannot see that write, it cannot see any write, and the assertions above ' +
      'are meaningless.',
  );
});

// ── The same disease one level up: a GATE FUNCTION nobody calls ─────────────
//
// 🔴 THIRD INSTANCE, found 2026-08-06. `lib/setnayan-ai-cockpit-flag.ts` exported
// `cockpitEnabled()` whose own docblock read: "The cockpit renders ONLY when this
// returns true. Default OFF, so prod today keeps the R3 status board
// byte-for-byte." Every word false — the function had ZERO IMPORTERS, so it
// neither held the surface back nor could take it down. The owner believed they
// held a lever that was connected at neither end.
//
// 🔑 A column with no writer and a gate function with no caller are the SAME
// BUG. The tests above trace the WRITE; this one traces the CALL. Both ask the
// question an ordinary test cannot: not "is the logic right?" but "does anything
// reach this at all?"
//
// ⚠ ALLOWLIST, NOT A BAN. Parking a flag ahead of its consumers is legitimate and
// this repo does it deliberately. What is NOT legitimate is a parked flag that
// CLAIMS to be gating something. Each entry below was read and is genuinely
// pre-wired, with an accurate docblock. A NEW inert flag fails until it is either
// wired or added here with a reason — which puts it in the diff, where a reviewer
// can disagree.
test('every feature-flag module has at least one non-test importer', () => {
  const PARKED_ON_PURPOSE = new Map([
    ['public-api-flag', 'V1 lock: "no public API endpoints" — 0033 plumbs the gateway only.'],
    ['slot-seat-reservations-flag', 'Owner-parked 2026-08-01; docblock states it is not yet wired.'],
    ['vendor-free-tier-booking-cap-flag', 'Built ahead of its consumer; docblock says so.'],
    ['vendor-launch-free-window-flag', 'Built ahead of its consumer; docblock says so.'],
  ]);

  const dir = join(WEB, 'lib');
  const flagFiles = readdirSync(dir).filter((f) => f.endsWith('-flag.ts'));
  assert.ok(
    flagFiles.length > 20,
    `only ${flagFiles.length} *-flag.ts modules found — the glob is wrong, and a ` +
      'guard that inspects nothing passes for the wrong reason.',
  );

  const inert: string[] = [];
  for (const file of flagFiles) {
    const base = file.replace(/\.ts$/, '');
    let importers = 0;
    const scan = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === 'node_modules' || n === '.next') continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) scan(p);
        else if (/\.tsx?$/.test(n) && !/\.test\./.test(n) && !p.endsWith(file)) {
          if (readFileSync(p, 'utf8').includes(`@/lib/${base}`)) importers++;
        }
      }
    };
    for (const root of ['app', 'lib', 'components']) {
      try {
        scan(join(WEB, root));
      } catch {
        /* dir may not exist */
      }
    }
    if (importers === 0 && !PARKED_ON_PURPOSE.has(base)) inert.push(base);
  }

  assert.deepEqual(
    inert,
    [],
    'These flag modules are imported by nothing, so they gate nothing — a switch ' +
      'connected at neither end:\n  ' +
      inert.join('\n  ') +
      '\n\nWire it, delete it, or add it to PARKED_ON_PURPOSE with a reason.',
  );
});
