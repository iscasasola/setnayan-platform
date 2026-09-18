/**
 * EVERY approval action_type THE CODE WRITES MUST BE ALLOWED BY THE CHECK.
 *
 * 🔴 LAU-20. `admin_approval_requests.action_type` is a TEXT column with a
 * `CHECK (action_type IN (...))`. Each feature that opts into the two-admin gate
 * rebuilds that CHECK with one more value — and the fraud migration
 * (20270518682623) rebuilt it from an OLDER list, dropping
 * 'approve_journal_spotlight'. From then on every sponsored journal spotlight
 * was refused at INSERT in production: `initiateSponsored()` bounced with
 * "Could not open approval", the spotlight could never reach a second admin, and
 * no test noticed, because nothing inserted that value against the real schema.
 *
 * `enum-literals-are-real.db.test.ts` covers Postgres ENUM columns; it cannot
 * see a CHECK on a text column. This test is that missing half, for this table.
 *
 * HOW THE LIST IS DERIVED — from the code, never typed here:
 *   1. every `.from('admin_approval_requests').insert({ ... })` in app/ + lib/
 *      is found, and its `action_type:` is read. A string literal is collected;
 *      the one non-literal writer (the manual picker in admin/approvals, which
 *      validates with isApprovalActionType) contributes APPROVAL_ACTIONS. Any
 *      OTHER shape fails the test, so a new writer cannot slip past unread.
 *   2. every member of the `ApprovalActionType` union is collected too, and
 *      every emitted literal must be a member (the TS type stays the vocabulary).
 * Then each value is INSERTED into the replayed schema. A refusal is the bug.
 *
 * ⚠ WHEN THIS FAILS, THE FIX IS A MIGRATION that rebuilds the CHECK from the
 * CURRENT vocabulary (`select pg_get_constraintdef(...)` in prod, or the LAST
 * migration that redefined it) plus the new value — never a list copied from
 * an older migration, which is exactly how this broke.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { APPROVAL_ACTIONS } from '../../lib/admin-approvals';
import { stripComments } from '../../lib/strip-comments';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

const WEB = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'tests') continue;
    const abs = join(dir, entry);
    const s = statSync(abs);
    if (s.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(abs);
  }
  return out;
}

/** Strip comments — a docblock naming a type is not a write of it. */
const code = stripComments;

/** The object literal starting at `open` (a `{`), up to its matching `}`. */
function objectAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced insert payload');
}

type Site = { file: string; value: string };

function emittedSites(): { sites: Site[]; unreadable: string[] } {
  const sites: Site[] = [];
  const unreadable: string[] = [];
  const INSERT = /\.from\(\s*['"]admin_approval_requests['"]\s*\)\s*\.insert\(\s*\{/g;
  for (const abs of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = code(readFileSync(abs, 'utf8'));
    const file = abs.slice(WEB.length + 1);
    for (const m of src.matchAll(INSERT)) {
      const payload = objectAt(src, m.index! + m[0].length - 1);
      const lit = payload.match(/action_type:\s*'([^']+)'/);
      if (lit) {
        sites.push({ file, value: lit[1]! });
        continue;
      }
      // The manual new-request picker: `action_type: actionType`, where
      // actionType has passed isApprovalActionType → one of APPROVAL_ACTIONS.
      if (/action_type:\s*actionType\b/.test(payload) && /isApprovalActionType\(actionType\)/.test(src)) {
        for (const a of APPROVAL_ACTIONS) sites.push({ file, value: a.type });
        continue;
      }
      unreadable.push(`${file}: ${payload.slice(0, 120).replace(/\s+/g, ' ')}`);
    }
  }
  return { sites, unreadable };
}

function unionMembers(): string[] {
  const src = code(readFileSync(join(WEB, 'lib', 'admin-approvals.ts'), 'utf8'));
  const decl = src.match(/export type ApprovalActionType\s*=([\s\S]*?);/);
  assert.ok(decl, 'ApprovalActionType union not found in lib/admin-approvals.ts — re-point this guard');
  return [...decl[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

test('the scan finds every writer, and reads each one', () => {
  const { sites, unreadable } = emittedSites();
  const files = new Set(sites.map((s) => s.file));
  console.log(`# approval writers: ${[...files].join(', ')}`);
  console.log(`# emitted action_types: ${[...new Set(sites.map((s) => s.value))].join(', ')}`);
  assert.deepEqual(
    unreadable,
    [],
    'an admin_approval_requests insert whose action_type this guard cannot read — teach the guard its shape, do not skip it',
  );
  // Floor: the three writers measured 2026-09-18 (approvals picker, fraud,
  // journal spotlights). Fewer means the pattern stopped matching.
  assert.ok(files.size >= 3, `only ${files.size} writer file(s) found — the scan is not reaching them`);
  assert.ok(
    sites.some((s) => s.value === 'approve_journal_spotlight'),
    'the journal-spotlight writer was not found — the scan cannot see the site LAU-20 broke',
  );
});

test('every emitted action_type is a member of ApprovalActionType', () => {
  const members = new Set(unionMembers());
  const outside = emittedSites().sites.filter((s) => !members.has(s.value));
  assert.deepEqual(
    outside.map((s) => `${s.file} writes '${s.value}'`),
    [],
    'add the value to ApprovalActionType in lib/admin-approvals.ts — the union is the vocabulary',
  );
});

test('🔴 the replayed schema ACCEPTS every action_type the code can write', async () => {
  const values = [...new Set([...emittedSites().sites.map((s) => s.value), ...unionMembers()])].sort();
  console.log(`# inserting ${values.length}: ${values.join(', ')}`);
  assert.ok(values.length >= 6, `only ${values.length} values to insert — the derivation collapsed`);

  const au = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('approval-vocab@t.invalid', jsonb_build_object('account_type','admin')) RETURNING id`,
  );
  const adminId = au.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    adminId,
    'approval-vocab@t.invalid',
  ]);

  // Each INSERT autocommits on its own, so one refusal cannot poison the next.
  const refused: string[] = [];
  for (const v of values) {
    try {
      await db.query(
        `INSERT INTO public.admin_approval_requests (action_type, target_id, rationale, initiated_by)
         VALUES ($1, 'S89X-VOCABTEST', 'vocabulary check', $2)`,
        [v, adminId],
      );
    } catch (e) {
      refused.push(`${v} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  assert.deepEqual(
    refused,
    [],
    'Postgres REFUSES these approval types, so the feature that writes them can never open its two-admin gate. ' +
      'Rebuild admin_approval_requests_action_type_check from the CURRENT vocabulary plus the missing value.',
  );
});
