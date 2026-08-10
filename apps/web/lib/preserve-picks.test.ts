/**
 * preserve-picks.test.ts — WHICH captures keep their full resolution.
 *
 * 🔒 OWNER-LOCKED 2026-08-10: *"they can pick which one to preserve"* and
 * *"if nothing is picked, pick all."*
 *
 * So the stored column records the **decline**, not the pick. That inversion is
 * the whole design: `preserve_declined_at IS NULL` means preserved, so the
 * owner's default needs no backfill and is automatically right for captures that
 * do not exist yet. An opt-in `preserved_at` column could not express "pick all"
 * without a backfill that would have to re-run forever.
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
import { readFileSync } from 'node:fs';
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

test('the migration records the DECLINE, so absent means preserved', () => {
  const sql = readFileSync(
    join(REPO, 'supabase/migrations/20271125158531_preserve_picks.sql'),
    'utf8',
  );
  for (const table of ['public.papic_photos', 'public.papic_guest_captures']) {
    assert.ok(
      new RegExp(`ALTER TABLE ${table.replace('.', '\\.')}[\\s\\S]{0,120}preserve_declined_at`).test(sql),
      `${table} did not get preserve_declined_at`,
    );
  }
  assert.ok(
    !/preserved_at\s+timestamptz/.test(sql),
    'an opt-in `preserved_at` column is back. It cannot express "if nothing is ' +
      'picked, pick all" without a backfill that must re-run for every future ' +
      'capture — which is the reason the decline is stored instead.',
  );
});

test('THE SWEEP READS THE COLUMN — a pick nothing reads is not a pick', () => {
  // The house failure: a column with no reader, or a reader with no writer.
  for (const sel of [
    /\.select\('photo_id[^']*preserve_declined_at'\)/,
    /\.select\('capture_id[^']*preserve_declined_at'\)/,
  ]) {
    assert.match(
      SWEEP,
      sel,
      'the sweep stopped selecting preserve_declined_at, so every capture reads ' +
        'as preserved and nothing is ever compressed — or, worse, the column is ' +
        'undefined and the skip silently inverts',
    );
  }
});

test('the skip is PER CAPTURE, not all-or-nothing per event', () => {
  assert.match(
    SWEEP,
    /if\s*\(\s*keep\s*&&\s*!\s*it\.preserve_declined_at\s*\)/,
    'the paid-event skip is back to all-or-nothing. A couple who declined a ' +
      'capture would keep it at full resolution anyway, so the picker would do ' +
      'nothing at all — a control that changes no outcome.',
  );
});

test('a decline never reaches the delete path — only the compress path', () => {
  // preserve_declined_at must not appear anywhere near an actual object delete.
  // The sweep's whole promise is that it REPLACES an original with a copy that
  // already exists; a decline is permission to do that, never to remove a photo.
  const deleteIsh = /preserve_declined_at[\s\S]{0,200}?(DeleteObject|\.remove\(|\.delete\(\))/;
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
