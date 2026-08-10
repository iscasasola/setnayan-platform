/**
 * preserve-picks.test.ts — WHICH captures keep their full resolution.
 *
 * 🔒 OWNER-LOCKED 2026-08-10, REVERSED THE SAME DAY. The first ruling was *"if
 * nothing is picked, pick all"*, and this file was built on it: the column
 * recorded the DECLINE, so absent meant preserved and the default needed no
 * backfill.
 *
 * ⛔ THAT PREMISE IS GONE. Owner, later the same day: *"then start with nothing.
 * they will pick which they want to preserve."* It followed from pricing
 * preservation at ₱500/year per 5,000 credits — **you do not auto-enrol somebody
 * into a bill**, and keep-everything-by-default did exactly that.
 *
 * So the column now records the **PICK**: `preserved_at IS NULL` means NOT
 * preserved, which is the default. Migration `20271127689103` replaces the
 * column rather than reinterpreting it — a name that says "declined" while
 * meaning "picked" would make every query result and audit line read backwards.
 *
 * ⚠ THE ASSERTIONS BELOW WERE RE-POINTED, NOT DELETED. Each one still guards the
 * same property; only the direction changed. The ban on the opposite column
 * remains — it now bans the OPT-OUT one, for the same reason it once banned the
 * opt-in one: two columns encoding the same decision is how the two come to
 * disagree.
 *
 * ## What changed in shipped behaviour, and why it was safe today
 *
 * Until this change a paid event skipped **every** capture — all-or-nothing per
 * event. It is now per capture. That is safe only because the `HIGH_RES_ARCHIVE`
 * row is inactive and nobody has ever bought it; the same change after the first
 * sale would silently start compressing originals somebody had paid to keep.
 *
 * ⚠ THIS IS NOT A DELETE FLAG. Declining lets the normal sweep replace one
 * ORIGINAL with its compressed copy. The photo is never deleted, and the
 * compressed copy is kept five years for everyone, paid or not. The owner has
 * corrected that vocabulary twice — say "compressed", never "deleted".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..', '..');

/** Executed code only — comments explain the trap and must not satisfy a check. */
const code = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const SWEEP = code(join(WEB, 'lib/papic-fullres-drop.ts'));

/**
 * The migration that CURRENTLY defines the preservation column.
 *
 * ⚠ FOUND, NOT NAMED. This test used to read `20271125158531_preserve_picks.sql`
 * by filename — and when the owner reversed the default the same day, that file
 * became a superseded body describing a rule the database no longer runs, while
 * the test went on asserting it, green. A name-pinned guard outlives the thing
 * it guards. Migrations apply in filename order, so the LAST one to define the
 * column is the one in force.
 */
function currentPreservationMigration(): string {
  const dir = join(REPO, 'supabase/migrations');
  const hit = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .find((f) => /preserved_at\s+timestamptz/.test(readFileSync(join(dir, f), 'utf8')));
  assert.ok(hit, 'no migration defines preserved_at — has the column been renamed again?');
  return readFileSync(join(dir, hit), 'utf8');
}

test('the migration records the PICK, so absent means NOT preserved', () => {
  const sql = currentPreservationMigration();
  for (const table of ['public.papic_photos', 'public.papic_guest_captures']) {
    assert.ok(
      new RegExp(`ALTER TABLE ${table.replace('.', '\\.')}[\\s\\S]{0,120}preserved_at`).test(sql),
      `${table} did not get preserved_at`,
    );
  }
  assert.ok(
    !/preserve_declined_at\s+timestamptz/.test(sql),
    'the opt-OUT `preserve_declined_at` column is back. Preservation is opt-in ' +
      '(owner 2026-08-10) and two columns encoding one decision is how they ' +
      'come to disagree. The reason this once read the other way round is in ' +
      'capture — which is the reason the decline is stored instead.',
  );
});

test('THE SWEEP READS THE COLUMN — a pick nothing reads is not a pick', () => {
  // The house failure: a column with no reader, or a reader with no writer.
  for (const sel of [
    /\.select\('photo_id[^']*preserved_at'\)/,
    /\.select\('capture_id[^']*preserved_at'\)/,
  ]) {
    assert.match(
      SWEEP,
      sel,
      'the sweep stopped selecting preserved_at, so every capture reads ' +
        'as preserved and nothing is ever compressed — or, worse, the column is ' +
        'undefined and the skip silently inverts',
    );
  }
});

test('the skip is PER CAPTURE, not all-or-nothing per event', () => {
  assert.match(
    SWEEP,
    /if\s*\(\s*keep\s*&&\s*it\.preserved_at\s*\)/,
    'the paid-event skip must be PAID **and** PICKED. Dropping `keep` lets a ' +
      'couple protect originals for free by ticking boxes — preservation is a ' +
      'paid option. Dropping `it.preserved_at` goes back to all-or-nothing, so ' +
      'the picker changes no outcome. Both halves, or the control is a lie.',
  );
});

test('a decline never reaches the delete path — only the compress path', () => {
  // preserved_at must not appear anywhere near an actual object delete.
  // The sweep's whole promise is that it REPLACES an original with a copy that
  // already exists; a decline is permission to do that, never to remove a photo.
  const deleteIsh = /preserved_at[\s\S]{0,200}?(DeleteObject|\.remove\(|\.delete\(\))/;
  assert.ok(
    !deleteIsh.test(SWEEP),
    'preserve_declined_at is being read next to a delete. Declining preservation ' +
      'means the original is replaced by its compressed copy — it never means a ' +
      'photo is removed. The owner corrected that vocabulary twice.',
  );
});

test('the column is documented as NOT a delete flag, where a reader will look', () => {
  const sql = readFileSync(
    join(REPO, 'supabase/migrations/20271125158531_preserve_picks.sql'),
    'utf8',
  );
  // The database comment is what shows up in a schema browser, which is where
  // someone reaches for the meaning of a column they did not add.
  const comments = sql.match(/COMMENT ON COLUMN[\s\S]*?;/g) ?? [];
  assert.equal(comments.length, 2, 'both columns need a COMMENT — one is not enough');
  for (const c of comments) {
    assert.match(c, /Never a delete flag/i, 'the column comment must say it is not a delete flag');
    assert.match(c, /NULL = preserved/i, 'the comment must state the default');
  }
});

/**
 * 🚨 THE WRITE MUST POINT THE SAME WAY AS THE READ.
 *
 * The sweep keeps a capture when `preserved_at` is SET. So the action behind the
 * couple's tap must SET it when they choose to keep, and CLEAR it when they
 * change their mind. Inverting that one ternary is invisible in review, breaks
 * no type, fails no other test — and means every photo a couple deliberately
 * chose to keep is the exact set that gets compressed, while the ones they
 * ignored survive. The most expensive possible off-by-one.
 *
 * It was found by mutation testing this file, not by reading the code.
 */
test('🚨 choosing to keep SETS the mark; changing your mind CLEARS it', () => {
  const src = readFileSync(
    join(REPO, 'apps/web/app/dashboard/[eventId]/studio/papic/actions.ts'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, ' ');

  const update = src.match(/\.update\(\{\s*preserved_at:[^}]*\}\)/);
  assert.ok(update, 'the preserve action must still write preserved_at');

  // `preserve` is the couple's intent: true = keep it. The timestamp goes on
  // that branch, and null on the other. Written as two assertions so the failure
  // message names WHICH way round it went.
  assert.match(
    update[0],
    /preserve\s*\?\s*new Date\(\)\.toISOString\(\)\s*:\s*null/,
    'the write is INVERTED — choosing to keep a photo is recording that it may be compressed',
  );
  assert.ok(
    !/preserve\s*\?\s*null/.test(update[0]),
    'choosing to keep must never clear the mark',
  );
});
