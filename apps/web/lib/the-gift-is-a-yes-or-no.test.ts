/**
 * the-gift-is-a-yes-or-no.test.ts — the Setnayan Exclusive stopped being prose.
 *
 * Owner rulings, 2026-09-09, all four in one sitting:
 *   • "ok then only offer papic credits. so it is simple and useful"
 *   • "papic credits will be auto computed based on what they pay … (so it is
 *     either a yes or a no)."
 *   • "no. just max to 40%. nothing more."   ⇒ no amount control at all
 *   • "exclusive setnayan gift then should be optional."
 *
 * ⚖ WHAT THESE TESTS ARE FOR. Three of the four claims below are about things
 * that are INVISIBLE when they break:
 *   ① a number creeping onto the card — it would look like a better card, and
 *     it would be a promise we cannot keep, because the count comes from a
 *     booking fee that does not exist while the card is being advertised;
 *   ② the two live cards losing their old promise — a save would simply write
 *     NULL and nobody would be told;
 *   ③ the gift's badge being merged with the legacy one — which would bill two
 *     suppliers 40% of their fee for a gift they never chose.
 * None of the three fails a typecheck and none of them throws.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readSnapshot, snapshotFromService } from './service-card-snapshot';

const HERE = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

const FACE = 'app/vendor-dashboard/services/_components/service-card-face.tsx';
const ACTIONS = 'app/vendor-dashboard/services/actions.ts';
const MIGRATION =
  '../../supabase/migrations/20271216515644_the_gift_is_a_yes_or_no.sql';

// ── ① THE CONTROL IS A BOOLEAN, AND IT READS OFF A REAL FORM FIELD ─────────

test('the yes/no rides the form, and only the exact string "on" means yes', () => {
  const fd = new FormData();
  fd.set('includes_setnayan_gift', 'on');
  assert.equal(readSnapshot(fd).givesSetnayanGift, true);

  // Every other value is a NO. `'off'` is what the maker and the wizard send
  // when a supplier says no, and it must never read as a yes by truthiness.
  for (const value of ['off', 'true', 'yes', '1', 'ON', '']) {
    const other = new FormData();
    other.set('includes_setnayan_gift', value);
    assert.equal(
      readSnapshot(other).givesSetnayanGift,
      false,
      `"${value}" must not read as a yes`,
    );
  }

  // Absent is also a no AT THE SNAPSHOT — an untouched form shows no gift.
  assert.equal(readSnapshot(new FormData()).givesSetnayanGift, false);
});

test('a stored yes survives the round trip through snapshotFromService', () => {
  assert.equal(snapshotFromService({ includes_setnayan_gift: true }).givesSetnayanGift, true);
  assert.equal(snapshotFromService({ includes_setnayan_gift: false }).givesSetnayanGift, false);
  assert.equal(snapshotFromService({}).givesSetnayanGift, false);
});

// ── ② THE CARD PROMISES NO NUMBER ──────────────────────────────────────────

test('the gift line on the card states no quantity', () => {
  const face = read(FACE);
  const branch = face.slice(
    face.indexOf('{snap.givesSetnayanGift ?'),
    face.indexOf(') : snap.hasExclusive ?'),
  );
  assert.ok(branch.length > 0, 'the gift branch was not found on the card face');

  // Strip the JSX/style scaffolding, keep the words a couple reads.
  const copy = branch
    .replace(/className=(["'{])[^]*?\1/g, ' ')
    .replace(/style=\{\{[^]*?\}\}/g, ' ')
    .replace(/<[^>]*>/g, ' ');

  // A digit here is the failure: the photo count is 40% of a booking fee that
  // does not exist yet, so any figure printed on a card could be broken by a
  // lower quote — and honouring it would breach the 40% ceiling.
  assert.equal(
    /\d/.test(copy),
    false,
    `the card's gift line must promise no number, got: ${copy.trim()}`,
  );
  // And it must not imply one in words either.
  for (const word of ['credits', 'photos free', 'up to', '%']) {
    assert.equal(
      copy.toLowerCase().includes(word),
      false,
      `the card's gift line must not say "${word}"`,
    );
  }
  assert.match(copy, /Setnayan gift/);
});

test('the gift and the retired free text are two branches, gift first', () => {
  const face = read(FACE);
  const gift = face.indexOf('{snap.givesSetnayanGift ?');
  const legacy = face.indexOf('snap.hasExclusive ?');
  assert.ok(gift > -1 && legacy > gift, 'the gift branch must be tested first');

  // Merging them is the money bug: `hasExclusive` is true for both live cards,
  // neither of which offers Papic credits.
  assert.equal(
    /givesSetnayanGift\s*\|\|\s*(snap\.)?hasExclusive/.test(face),
    false,
    'the two promises must never be OR-ed into one line',
  );
});

test('a card carrying ONLY the retired free text still shows its old promise', () => {
  // This is the shape of both rows live in production on 2026-09-09.
  const snap = snapshotFromService({
    exclusive_perk_text: 'Free 1-hour extension for Setnayan couples',
  });
  assert.equal(snap.hasExclusive, true, 'the legacy promise must survive');
  assert.equal(snap.givesSetnayanGift, false, 'and must not become a costed gift');
});

// ── ③ THE SAVE PATH CANNOT ERASE WHAT IT NO LONGER EDITS ───────────────────

test('the wizard payload never sends exclusive_perk_text', () => {
  const actions = read(ACTIONS);
  // A present key means set-or-clear in the RPC, so sending it from a form that
  // no longer has the input would write NULL over a live promise.
  assert.equal(
    /^\s*exclusive_perk_text:/m.test(actions),
    false,
    'a write path is still sending exclusive_perk_text',
  );
  assert.equal(
    actions.includes('parseExclusivePerk'),
    false,
    'the retired free-text parser is still wired into a write path',
  );
});

test('the migration keeps an absent perk key meaning UNCHANGED', () => {
  const sql = read(MIGRATION);
  // The guard is on the SQL that does it, not on a comment about it.
  assert.match(
    sql,
    /exclusive_perk_text\s*=\s*CASE\s+WHEN\s+v_perk_given\s+THEN\s+v_perk\s+ELSE\s+exclusive_perk_text\s+END/,
    'the UPDATE must preserve the stored perk when the key is absent',
  );
  assert.match(sql, /v_perk_given\s*:=\s*p_fields\s*\?\s*'exclusive_perk_text'/);
});

test('the migration drops the RPC-side compulsory-gift refusal', () => {
  const sql = read(MIGRATION);
  const body = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.save_vendor_service'));
  // 20271215941485 moved the trigger and the TypeScript but left this RAISE
  // alive, so the ruling was unreachable through commitVendorService.
  assert.equal(
    /RAISE\s+EXCEPTION[^;]*Setnayan Exclusive perk is required/i.test(body),
    false,
    'the RPC still refuses to publish a card without a gift',
  );
});

test('the new column is created NOT NULL DEFAULT FALSE and is never backfilled', () => {
  const sql = read(MIGRATION);
  assert.match(
    sql,
    /ADD COLUMN IF NOT EXISTS includes_setnayan_gift BOOLEAN NOT NULL DEFAULT FALSE/,
  );
  // ⛔ A backfill from the free text would bill two suppliers 40% of their
  // booking fee for a gift neither of them offered.
  //
  // 🔑 THIS ASSERTS ON STATEMENTS, NOT ON PROSE — and it took two tries.
  // Searching the file for an UPDATE went red on correct code twice: first on
  // `save_vendor_service`, which UPDATEs the column on every save (the
  // feature), and then on this migration's own header, which uses the word
  // "UPDATE" to explain the preservation rule. Text-matching a SQL file is a
  // proxy; the claim is "the DDL region runs no statement other than the ADD
  // COLUMN and its comment", so that is what is checked.
  const ddl = sql.slice(0, sql.indexOf('CREATE OR REPLACE FUNCTION'));
  assert.ok(ddl.includes('ADD COLUMN'), 'the DDL region was not located');
  const statements = ddl
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean);
  assert.ok(statements.length > 0, 'no statements parsed out of the DDL region');
  for (const stmt of statements) {
    assert.match(
      stmt,
      /^(ALTER TABLE|COMMENT ON COLUMN)\b/,
      `the DDL region runs an unexpected statement — a backfill of the gift ` +
        `flag is a money event, not a tidy-up: ${stmt.slice(0, 80)}`,
    );
  }
});
