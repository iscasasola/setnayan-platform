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

import { loadSources, gateWritersOf } from './gate-writers';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..'); // apps/web
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

/**
 * Columns whose whole purpose is to be TURNED ON by somebody. Each needs a
 * writer — a server action, a script, an admin path — that sets it.
 *
 * Add a column here when its false value silently disables a feature rather
 * than erroring. Do NOT add columns that are stamped as a side effect (a
 * timestamp, a counter); those have writers by construction.
 */
const SWITCHES: {
  column: string;
  /** The table it lives on — needed to pair a table-write with a field-name. */
  table: string;
  whoFlips: string;
  whatBreaksWhenStuck: string;
  /** Set when the ONLY writer is an RPC parameter — see rpcWritersOf. */
  writtenViaRpcParam?: string;
  /**
   * The table the column lives on. Defaults to `events`.
   *
   * 🚨 ADDED 2026-08-16 BECAUSE THE DETECTOR WAS TABLE-BLIND, and that made it
   * blind to the very instance it was next asked to hold. `archived` is a
   * column on BOTH `events` and `communities`, and `samahan/actions.ts` writes
   * `communities.archived` — so this register reported "events.archived has a
   * writer" while `events.archived` had none, for two years. Measured, not
   * inferred: with both new writer files deleted, the suite still passed 9/9.
   */
  table?: string;
}[] = [
  {
    column: 'live_media_public',
    table: 'events',
    whoFlips: 'the couple, on the website privacy page',
    whatBreaksWhenStuck:
      'a visitor with no invitation never sees the livestream or the live photo ' +
      'wall — on the day, while the broadcast is running',
  },
  {
    column: 'papic_face_mode',
    table: 'events',
    whoFlips: 'an admin / the DPO, per event',
    whatBreaksWhenStuck: 'face auto-tagging stores nothing, on a feature that was paid for',
  },
  {
    // 🚨 REGISTERED AFTER SHIPPING IT BROKEN, 2026-08-06. The column was added
    // with six readers and NO writer, in the same day three other instances of
    // this shape were being fixed. The guard existed and never looked, because
    // nobody registered the switch with it.
    column: 'author_named_publicly',
    table: 'guest_columns',
    whoFlips: 'the guest, on the message form on the event page',
    whatBreaksWhenStuck:
      'a guest can never choose to be named beside their own published words — ' +
      'the safe half of the ruling works and the half that gives them a say does not',
    writtenViaRpcParam: 'p_name_me',
  },
  {
    // 🚨 FOURTH INSTANCE, registered 2026-08-09 — and the longest-running one.
    // `vendor_profiles.is_founder` shipped 2026-06-09 with a migration, a
    // column comment and two live readers, and no code anywhere ever wrote it.
    // The single row that carried it was set by a HARDCODED UUID inside the
    // migration itself, so the perk was real, working, tested — and
    // unreachable by any second business, forever. Note what a mere-mention
    // check would have concluded: the column name appears in an admin export
    // list, an anon-column-scope migration and a db test, so it looks
    // thoroughly wired from every angle except the one that matters.
    // Lives on `vendor_profiles`, not `events` — declared explicitly now that
    // the detector is table-scoped. Before 2026-08-16 the check was table-blind,
    // so this passed by accident rather than by aim.
    table: 'vendor_profiles',
    column: 'is_founder',
    table: 'vendor_profiles',
    whoFlips: 'an admin, on the vendor plan page (/admin/vendors/[id]/plan)',
    whatBreaksWhenStuck:
      'no business can ever be made a founding supplier — the unlimited-category ' +
      'and unlimited-services-per-category override works and nobody can receive it',
  },
  {
    // 🚨 FIFTH INSTANCE, registered 2026-08-12 — and the first where the column
    // had neither a writer NOR a reader. `events.live_photo_wall_visibility`
    // shipped 2026-11-04 with a CHECK constraint, a column comment naming the
    // exact surface it governs, and nothing at either end for nine months.
    //
    // What that cost: the SKU is titled "Live VENUE Photo Wall", and it
    // also mirrored the wall onto every invited guest's phone for the whole
    // celebration. The couple's only "off" was revoking the venue screen codes,
    // which did nothing to the phones. So a couple who deliberately shut the
    // wall down still had their wedding playing in a hundred hands.
    //
    // ⚠ AN APPLIED MIGRATION MISDESCRIBED IT as "(venue wall)" — the misreading
    // that let it live. This guard does not read comments, which is the point.
    column: 'live_photo_wall_visibility',
    table: 'events',
    whoFlips: 'the couple, on the Live Photo Wall card (Papic page / day-of console)',
    whatBreaksWhenStuck:
      'the photo wall plays on every invited guest’s phone for the whole ' +
      'celebration and the couple cannot stop it — revoking every venue screen ' +
      'code, the only “off” the product offers them, leaves it running',
  },
  {
    // 🚨 SIXTH INSTANCE, registered 2026-08-16 — and the longest-lived. Unlike
    // the five above, `events.archived` was never obscure: it shipped with the
    // FIRST migration, a dozen screens read it, eleven database objects
    // reference it, and the RLS policy plus the column grant have always let an
    // organiser set it. Everything was in place except a way to press it.
    //
    // 🔑 THE TELL WAS NOT SILENCE — IT WAS FIVE SCREENS TELLING PEOPLE TO USE
    // IT. "Finish or archive it first" is what a couple was told when they
    // tried to plan a second wedding; the admin console's delete warning
    // recommended "archiving instead if you might restore later". Every one of
    // those sentences named a control that did not exist, for two years.
    //
    // The owner was personally behind that instruction: holding two upcoming
    // weddings, a third was refused with nothing to press.
    //
    // ⚠ AND IT LOOKED HALF-BUILT, WHICH IS WORSE THAN LOOKING ABSENT. A reader
    // checking "does archive exist?" finds a column, readers, a filter in the
    // admin console and an `?archived=1` query param, and concludes yes.
    column: 'archived',
    // ⚠ REQUIRED, AND ITS ABSENCE WAS A MERGE DEFECT NEITHER SIDE HAD ALONE.
    // This entry was written against the older resolver, which ended
    // `?? 'events'` — so omitting the table silently defaulted. The resolver was
    // then refactored on main to `sw ? [sw.table] : [fallbacks]`, which drops that
    // default for a REGISTERED switch, so `sw.table` arrived undefined and the
    // detector searched a table called nothing. It reported "archived has no
    // writer" while a correct writer sat in `archive-actions.ts`.
    // 🔑 A DEFAULT REMOVED BY A REFACTOR IS INVISIBLE TO WHOEVER RELIED ON IT.
    // Naming it explicitly is right anyway: this file's own header records that
    // `archived` exists on BOTH `events` and `communities`, and that a write to
    // the wrong one satisfied this register for two years.
    table: 'events',
    whoFlips: 'a host, on the event’s Personalization page (“Put this away”)',
    whatBreaksWhenStuck:
      'no celebration can ever be put away, so a couple who has finished one ' +
      'wedding can never start another — the refusal tells them to archive it ' +
      'and there is nothing anywhere to press',
  },
];

const SOURCES = loadSources(WEB);

/*
 * 🚨 THE SHARED DETECTOR IS TOO LOOSE FOR THIS SWITCH, MEASURED 2026-08-18.
 *
 * `gateWritersOf` asks two questions of a FILE — "does it write table X
 * anywhere?" and "does it name column Y as a field anywhere?" — and never
 * requires the two to be the SAME statement. For `events.archived` that admits
 * two files that do not write it at all:
 *
 *   lib/chat-actions.ts — writes `.from('events')` for something else, and has a
 *                         local variable literally named `archived` that sets
 *                         `archived_at` on a DIFFERENT table.
 *   lib/events.ts       — has `archived: boolean` as a TYPE field and `archived,`
 *                         in a SELECT list. Neither is a write.
 *
 * PROVED: deleting the real writer's `.update({ archived, … })` (occurrences
 * 1 → 0) leaves the shared check GREEN. A guard that survives the removal of the
 * thing it guards is decoration — the fifth instance recorded in this codebase.
 *
 * ⚠ THE OLDER INLINE VERSION WAS STRICTER HERE. It anchored the chain from
 * `.from(` through `.update(` within a bounded span, so it could not be fooled by
 * two unrelated statements. The refactor to a shared helper gained the
 * variable-table and helper-resolution cases and LOST the proximity requirement.
 * Widening the shared helper is a change to infrastructure every switch depends
 * on, so it is deliberately NOT done inside a pull request about putting an event
 * away. This assertion closes the hole for THIS switch, and names the debt.
 */
test('the host really has a control that puts an event away — chain-anchored, not file-wide', () => {
  const writer = SOURCES.find((s) => s.path.endsWith('archive-actions.ts'));
  assert.ok(writer, 'the put-away action file is gone entirely');
  assert.match(
    writer!.code,
    // ⚠ `[^}]` NOT `[\s\S]` — MY FIRST CUT OF THIS ASSERTION HAD THE SAME DISEASE
    // IT WAS WRITTEN TO CURE. `[\s\S]{0,200}` reads straight past the update
    // object's closing brace and into `.select('event_id, archived')` on the very
    // next line, so deleting the write still matched. Confining the span to
    // characters that are not `}` keeps the match inside the object being written.
    // Proved: with the write removed this now fails; restored, it passes.
    /\.from\(\s*['"`]events['"`]\s*\)[\s\S]{0,300}?\.update\(\s*\{[^}]{0,200}?\barchived\b/,
    'nothing writes events.archived in one chain any more — the host has no way to ' +
      'put a celebration away, and the shared detector cannot see this because it ' +
      'accepts a table write and a column mention from unrelated statements.',
  );
});
const FILES = SOURCES.map((s) => join(WEB, s.path));

/**
 * Does anything WRITE this column?
 *
 * ⚠ THE DETECTOR MOVED to `lib/gate-writers.ts` on 2026-08-17, and the pattern
 * that used to live here was measurably too narrow. Against the real schema it
 * missed FOUR spellings this codebase actually uses — ES6 shorthand
 * (`{ faceblock_enabled }`, no colon), a write funnelled through a helper, an
 * update object longer than its 600-character window, and a payload assembled
 * into a variable first — and so called 16 working controls missing. A guard
 * that cries wolf teaches you to skim past the one time it is right.
 *
 * The shared module is now used by BOTH this file and the schema-enumerating
 * `tests/db/gates-have-handles.db.test.ts`, so the two cannot drift apart.
 */
function writersOf(column: string): string[] {
  const sw = SWITCHES.find((s) => s.column === column);
  // Columns named by the meta-tests below are not registered switches; fall back
  // to scanning every table so those assertions still mean what they say.
  const tables = sw ? [sw.table] : ['events', 'guests', 'users', 'vendor_profiles'];
  for (const table of tables) {
    const hits = gateWritersOf(SOURCES, table, column);
    if (hits.length > 0) return hits;
  }
  return rpcWritersOf(column);
}

/**
 * A write spelled as an RPC PARAMETER, which the pattern above cannot see.
 *
 * ⚠ THIS WAS A REAL BLIND SPOT, found 2026-08-06. A GUEST has no `auth.uid()`,
 * so a guest can never write a row directly — EVERY guest-side write in this
 * codebase goes through a `SECURITY DEFINER` RPC and arrives as a named
 * parameter, never as an `.insert({...})` key. The detector was therefore blind
 * to an entire class of writers, and would have reported "nothing writes this"
 * about a column with a perfectly good control on it.
 *
 * The mapping cannot be derived from TypeScript — the parameter is named in the
 * app (`p_name_me`) and the column in SQL (`author_named_publicly`) — so a
 * switch written this way declares its own parameter, and we then require BOTH
 * that some caller passes it AND that a migration assigns it to the column.
 * Two halves: a caller alone proves nothing, and SQL alone is unreachable.
 */
function rpcWritersOf(column: string): string[] {
  const sw = SWITCHES.find((s) => s.column === column);
  const param = sw?.writtenViaRpcParam;
  if (!param) return [];

  const callers = FILES.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return new RegExp(`\\.rpc\\(\\s*['"\`][^'"\`]+['"\`][\\s\\S]{0,900}?\\b${param}\\b\\s*:`).test(src);
  }).map((f) => f.slice(WEB.length + 1));
  if (callers.length === 0) return [];

  // ⚠ COMMENTS STRIPPED. A `--` line has no statement terminator, so a pattern
  // spanning `[^;]` runs straight through one — and the first cut of this check
  // was satisfied by the migration's own PROSE about the column and the
  // parameter, passing while the SQL assigned neither. Fourth time in one day a
  // guard here matched a comment instead of code.
  const sql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  // Require a REAL assignment of the parameter into the column. The earlier
  // fallback ("both names appear somewhere, and some INSERT exists") is exactly
  // the mere-mention test this file was written to reject.
  const assigns = new RegExp(`\\b${column}\\b\\s*=\\s*[^,;]*\\b${param}\\b`).test(sql);
  return assigns ? callers : [];
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

/**
 * A writer nobody can reach is the same bug wearing a different hat.
 *
 * The tests above ask "does anything write this column?" — but a server action
 * that only the codebase knows about is exactly as useless to an admin as no
 * writer at all. `setVendorFoundingSupplier` therefore has to be wired to a
 * form that actually renders, not merely exported. Checked on the RENDERED
 * region: the JSX `action={...}` / `action={setVendorFoundingSupplier}` binding
 * in the plan page, so a stray import or a comment mentioning the name cannot
 * satisfy it.
 */
test('the founding-supplier writer is reachable from a rendered control', () => {
  const page = join(
    WEB,
    'app/admin/vendors/[vendorProfileId]/plan/page.tsx',
  );
  const src = readFileSync(page, 'utf8')
    // Strip line comments so the docblock explaining the control cannot BE the
    // control — the failure mode that has bitten guards in this repo four times.
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

  assert.match(
    src,
    /<form\s+action=\{setVendorFoundingSupplier\}/,
    'The plan page no longer renders a <form action={setVendorFoundingSupplier}>. ' +
      'The action can still be imported and still writes the column — and no admin ' +
      'can reach it, which is the state `is_founder` sat in from 2026-06-09: a real, ' +
      'working, tested perk that nobody could ever be given.',
  );
  assert.match(
    src,
    /name="is_founder"/,
    'The form no longer posts an `is_founder` value, so setVendorFoundingSupplier ' +
      'rejects every submission ("Invalid founding-supplier value") — a control that ' +
      'renders and can never succeed.',
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
