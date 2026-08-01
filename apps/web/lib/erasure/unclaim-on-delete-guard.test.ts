/**
 * THE DATABASE CAN UNCLAIM A SEAT WITHOUT ASKING ANY CODE.
 *
 * `paparazzi_seats.claimer_user_id` is
 *   `UUID REFERENCES auth.users(id) ON DELETE SET NULL`
 * and `claim_qr_token` is NOT in that clause. So deleting the auth row nulls the
 * claimer and leaves the printed QR intact — `seatClaimability()` flips from
 * 'taken' back to 'claimable' and `papic_claim_seat`'s `AND claimer_user_id IS
 * NULL` then passes. The QR someone walked in with becomes a working claim
 * credential for whoever is holding it.
 *
 * That is not hypothetical. `runAnonDraftSweep()` hard-deletes login-free
 * claimers 30 days after they claim, and its only guard looks for
 * `event_members` rows with member_type='couple' — a seat claimer is never one,
 * so the legal-hold block is skipped entirely and the delete proceeds. It fires
 * on every admin page render (`app/admin/layout.tsx`, via `after()`).
 *
 * The erasure path enforces "never separate the unclaim from the rotation"
 * because it performs the unclaim itself. This test exists because the FK
 * performs it too, from underneath — so the rule has to be checked against the
 * SCHEMA, not just against the erasure code.
 *
 * ── WHAT THIS CATCHES ──────────────────────────────────────────────────────
 * Any table that has BOTH
 *   (a) a column referencing `auth.users` with ON DELETE SET NULL, and
 *   (b) a column that looks like a bearer credential (`%token%`)
 * must be named in `CLAIM_TOKEN_ROTATIONS` or carry a written exclusion. A new
 * table of this shape reddens CI on the day it lands, instead of quietly
 * shipping a QR that re-arms itself when an account goes away.
 *
 * ── WHAT IT DOES NOT CATCH ─────────────────────────────────────────────────
 *  1. ON DELETE CASCADE rows (the row goes away, so there is no live token) and
 *     bare columns with NO FK — `panood_camera_operators.claimer_user_id` is
 *     loose-typed on purpose, so a deleted auth user leaves it pointing at
 *     nothing and the slot stays 'taken' forever. That is a stuck-seat bug, not
 *     a credential one, and erasure covers it.
 *  2. A credential column not named `%token%` (a `secret`, a `code`, a `pin`).
 *     The heuristic is the boundary; widen it rather than trust it.
 *  3. It proves the table is CLASSIFIED, never that the rotation is correct —
 *     that is `tests/db/erasure-completeness.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS_DIR } from '@/lib/security/migration-schema';
import { CLAIM_TOKEN_ROTATIONS } from './coverage';

/**
 * Tables of this shape that are deliberately NOT rotated, each with the reason.
 * An entry here is a claim someone has to defend in review — an empty string is
 * not allowed.
 */
const NOT_ROTATED: Record<string, string> = {
  vendor_invites:
    'A claimed invite token is NOT dead — resolveClaimContextForService() takes one as its intended input and returns the couple’s display name through the admin client. Left alone deliberately: rotating changes the guided first-service flow, which is a product decision. Tracked, not settled.',

  // ── The three below are FALSE POSITIVES of the heuristic, all the same shape:
  // the column that goes NULL is not the CLAIMER, so nulling it flips no
  // claimability gate. Kept as entries rather than narrowing the scan, because a
  // narrower regex would stop asking about tables that genuinely need an answer.
  guests:
    'The nulled column is photo_set_by_user_id — WHO SET THE GUEST’S PHOTO, not a claimer. qr_token identifies a guest so paparazzi can tag them; it is meant to keep working and is not a claim credential. Deleting the account of whoever set a photo must not invalidate that guest’s seat at the wedding.',
  community_invite_tokens:
    'The nulled column is created_by — the invite’s AUTHOR, not its claimer. An invite is exactly as valid after its author leaves as before; nothing about the token’s reach changes, so there is no unclaim to pair a rotation with.',
  vendor_creator_offers:
    'Matched on reach_token_ref, which the schema comment calls an "opaque handle for the reservation (audit / spec field)" — the vendor TOKEN CURRENCY, not a bearer QR. The nulled column is holder_user_id (who pays). No credential exists here to revoke.',
};

/** `CREATE TABLE [IF NOT EXISTS] public.X (…)` bodies, plus trailing ALTERs. */
function readTables(): Map<string, string> {
  const bodies = new Map<string, string>();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');

    // CREATE TABLE bodies — balanced-paren scan, because column declarations
    // contain nested parens (numeric(10,2), CHECK (x IN (…))).
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z0-9_]+)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      let depth = 1;
      let i = re.lastIndex;
      for (; i < sql.length && depth > 0; i += 1) {
        if (sql[i] === '(') depth += 1;
        else if (sql[i] === ')') depth -= 1;
      }
      const body = sql.slice(re.lastIndex, i - 1);
      const table = m[1];
      if (table) bodies.set(table, (bodies.get(table) ?? '') + '\n' + body);
    }

    // ALTER TABLE … ADD COLUMN — a later-added FK or token column counts too.
    const alter = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z0-9_]+)([^;]*);/gi;
    while ((m = alter.exec(sql))) {
      const table = m[1];
      if (table) bodies.set(table, (bodies.get(table) ?? '') + '\n' + (m[2] ?? ''));
    }
  }
  return bodies;
}

/** A column declaration that nulls itself when an auth user is deleted. */
const AUTH_SET_NULL =
  /([a-z0-9_]+)\s+uuid[^,]*?REFERENCES\s+auth\.users\s*\([^)]*\)[^,]*?ON\s+DELETE\s+SET\s+NULL/gi;

/** A column whose name reads like a bearer credential. */
const TOKEN_COL = /^\s*([a-z0-9_]*token[a-z0-9_]*)\s+(?:text|uuid|varchar|citext)/gim;

test('META · the migration corpus is actually readable (an empty scan must not pass)', () => {
  const tables = readTables();
  assert.ok(tables.size > 200, `parsed only ${tables.size} tables — the scan is broken, not the schema`);
  assert.ok(tables.has('paparazzi_seats'), 'paparazzi_seats vanished from the scan');
});

test('every table the DB can silently unclaim is classified — rotated, or excluded with a reason', () => {
  const tables = readTables();
  const hazard: string[] = [];

  for (const [table, body] of tables) {
    AUTH_SET_NULL.lastIndex = 0;
    TOKEN_COL.lastIndex = 0;
    const setsNull = AUTH_SET_NULL.test(body);
    if (!setsNull) continue;
    TOKEN_COL.lastIndex = 0;
    if (!TOKEN_COL.test(body)) continue;
    hazard.push(table);
  }

  // The shape must actually be found, or a regex change would make this test
  // vacuous — the absence of hazards would look identical to a broken scan.
  assert.ok(
    hazard.includes('paparazzi_seats'),
    `the known instance was not detected (found: ${hazard.join(', ') || 'none'}) — the scan regressed, so a real one would slip too`,
  );

  const rotated = new Set(CLAIM_TOKEN_ROTATIONS.map((r) => r.table));
  const unclassified = hazard.filter((t) => !rotated.has(t) && !(t in NOT_ROTATED));

  assert.deepEqual(
    unclassified.sort(),
    [],
    `These tables carry a bearer token AND a column that goes NULL when an auth user is deleted.\n` +
      `Deleting that user silently unclaims the row and leaves the printed credential working.\n` +
      `Add each to CLAIM_TOKEN_ROTATIONS, or to NOT_ROTATED with a reason that survives review:\n  ` +
      unclassified.sort().join('\n  '),
  );
});

test('every NOT_ROTATED exclusion carries a real reason', () => {
  for (const [table, why] of Object.entries(NOT_ROTATED)) {
    assert.ok(
      why.trim().length > 40,
      `${table} is excluded with no defensible reason — write one or rotate it`,
    );
  }
});

test('the sweep that hard-deletes anon users rotates BEFORE it deletes', () => {
  // The ordering IS the fix: rotating after auth.admin.deleteUser() is too late,
  // because the FK has already unclaimed the seat by then.
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'anon-draft-sweep.ts'), 'utf8');
  const rotateAt = src.indexOf('CLAIM_TOKEN_ROTATIONS');
  const deleteAt = src.indexOf('auth.admin.deleteUser');
  assert.ok(rotateAt !== -1, 'anon-draft-sweep no longer rotates claim tokens — a swept claimer’s QR re-arms itself');
  assert.ok(deleteAt !== -1, 'anon-draft-sweep no longer deletes the auth user — this guard is now checking nothing, delete it');
  assert.ok(
    rotateAt < deleteAt,
    'the rotation moved AFTER the delete — by then the FK has already unclaimed the seat and the printed QR is live',
  );
});
