/**
 * adding-a-team-member-takes-two-admins.test.ts — § 9.1's first row, for the
 * admin role nobody called an admin role.
 *
 * ── The finding (2026-11-05) ────────────────────────────────────────────────
 * `users.is_team_member = TRUE` makes an account an admin everywhere —
 * `isAdminProfile` (lib/admin/admin-predicate.ts) and every copy of
 * `is_internal || is_team_member || account_type === 'admin'` under app/admin.
 * Vendor Agreement § 9.1: "Promote a user to any admin role" takes two admins.
 *
 * Two doors set the flag. `grant_team_pool` (two admins) and "Add to team" on
 * the Users list (`toggleTeamMember`, ONE admin). On 2026-11-05 the owner
 * retired the team pool, and `grant_team_pool` with it — which left the
 * one-admin button as the only way to make someone an admin by this flag.
 *
 * ── What this holds ─────────────────────────────────────────────────────────
 *   · exactly ONE place in app/ + lib/ writes anything but `false` to the
 *     flag: the `grant_team_member` arm of the approvals dispatcher, which runs
 *     only after a different admin confirms;
 *   · `toggleTeamMember` routes ON to the approval and still writes OFF itself
 *     — removing access must never wait on a quorum;
 *   · the action type is in the vocabulary and in the CHECK.
 *
 * 🔒 The writer list is exact. A new writer fails here, which is the point:
 * the obvious action is never the only writer (see
 * a-price-change-takes-two-admins.test.ts for the same lesson, three times).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';
import { APPROVAL_ACTIONS, isApprovalActionType } from './admin-approvals';
import { TWO_ADMIN_PROMISES } from './two-admin-promise';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '..', '..');
const DISPATCHER = 'app/admin/approvals/actions.ts';
const TOGGLE = 'app/admin/users/actions.ts';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The object literal starting at `open` (a `{`), up to its matching `}`. */
function objectAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

/** Every `.update({…})` / `.insert({…})` / `.upsert({…})` payload in a file. */
function writePayloads(src: string): string[] {
  const out: string[] = [];
  const re = /\.(update|insert|upsert)\(\s*(\[\s*)?\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(objectAt(src, m.index + m[0].length - 1));
  return out;
}

/**
 * The values a payload gives the `is_team_member` KEY — shorthand counts as a
 * value. A READ of the column inside a payload (`before: prior?.is_team_member`
 * in an audit row) is not a key: it follows a `.`, so it is skipped.
 */
function teamMemberValues(payload: string): string[] {
  const values: string[] = [];
  for (const m of payload.matchAll(/(?<![.\w])is_team_member\s*(?::\s*([^,}\n]+)|(?=[,}]))/g)) {
    values.push(m[1] !== undefined ? m[1].trim() : '<shorthand>');
  }
  return values;
}

test('exactly one place can turn is_team_member ON — the two-admin dispatcher', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const writers = new Set<string>();
  let scanned = 0;

  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (SKIP.has(e)) continue;
      const abs = join(dir, e);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      if (!/\.(ts|tsx)$/.test(abs) || abs.includes('.test.')) continue;
      scanned += 1;
      const raw = readFileSync(abs, 'utf8');
      if (!raw.includes('is_team_member')) continue;
      for (const payload of writePayloads(stripComments(raw))) {
        if (teamMemberValues(payload).some((v) => v !== 'false')) {
          writers.add(abs.slice(WEB.length + 1));
        }
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));

  console.log(`[team-member-gate] scanned ${scanned} files · ${writers.size} can set the flag to a non-false value`);
  assert.ok(scanned > 500, `only ${scanned} files scanned — the walk is not reaching the tree`);
  assert.deepEqual(
    [...writers].sort(),
    [DISPATCHER],
    'Something other than the approvals dispatcher can set users.is_team_member to a value that is ' +
      'not `false`. is_team_member IS an admin role (lib/admin/admin-predicate.ts), and Vendor ' +
      'Agreement § 9.1 says making someone an admin takes two admins. Open a `grant_team_member` ' +
      'approval instead of writing the flag.',
  );
});

test('the dispatcher sets the flag only in the grant_team_member arm', () => {
  const src = read(DISPATCHER);
  const at = src.indexOf("row.action_type === 'grant_team_member'");
  assert.ok(at > 0, 'the approvals dispatcher has no grant_team_member arm — an approved request would throw');
  const arm = src.slice(at, src.indexOf('} else', at));
  assert.match(arm, /is_team_member:\s*true/, 'the grant_team_member arm does not set the flag');

  // …and nowhere else in the file writes `true`.
  const outside = src.slice(0, at) + src.slice(at + arm.length);
  const elsewhere = writePayloads(outside).flatMap(teamMemberValues).filter((v) => v !== 'false');
  assert.deepEqual(elsewhere, [], 'the dispatcher sets is_team_member outside the grant_team_member arm');
});

test('Add to team opens the approval; Remove from team writes false on one admin', () => {
  const src = read(TOGGLE);
  const at = src.indexOf('export async function toggleTeamMember');
  assert.ok(at >= 0, 'toggleTeamMember has moved or been renamed');
  const body = src.slice(at, src.indexOf('\nexport ', at + 1));

  assert.match(
    body,
    /desiredRaw === 'true'[\s\S]{0,120}requestTeamMemberGrant\(/,
    'turning the flag ON must open the two-admin request, not write the flag',
  );
  assert.match(
    body,
    /\.update\(\{\s*is_team_member:\s*false\b/,
    'Remove from team must stay a direct one-admin write — removing access must never wait on a quorum',
  );

  const fnAt = src.indexOf('async function requestTeamMemberGrant');
  assert.ok(fnAt >= 0, 'requestTeamMemberGrant is gone');
  const fn = src.slice(fnAt, src.indexOf('\n}\n', fnAt));
  assert.match(fn, /action_type:\s*'grant_team_member'/, 'the request does not open a grant_team_member approval');
  assert.match(fn, /eq\('status', 'pending'\)/, 'a second press must find the open request, not open another');
});

test('grant_team_member is in the vocabulary, the CHECK and the § 9.1 record', () => {
  assert.ok(isApprovalActionType('grant_team_member'), 'grant_team_member is not a known approval type');
  assert.ok(APPROVAL_ACTIONS.some((a) => a.type === 'grant_team_member'));

  // The LAST migration that rebuilds the CHECK is the live list.
  const dir = join(REPO, 'supabase', 'migrations');
  const rebuilds = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => {
      const sql = readFileSync(join(dir, f), 'utf8');
      return /ADD CONSTRAINT admin_approval_requests_action_type_check/i.test(sql);
    });
  const last = rebuilds.at(-1);
  assert.ok(last, 'no migration defines admin_approval_requests_action_type_check');
  assert.match(
    readFileSync(join(dir, last), 'utf8'),
    /'grant_team_member'/,
    `the latest CHECK (${last}) does not allow grant_team_member — every request would be refused at INSERT`,
  );

  const promote = TWO_ADMIN_PROMISES.find((p) => p.key === 'promote-to-admin');
  assert.ok(promote, 'the promote-to-admin promise row is gone');
  assert.match(promote.note, /grant_team_member/, 'the § 9.1 record does not say the team-member flag is gated');
});
