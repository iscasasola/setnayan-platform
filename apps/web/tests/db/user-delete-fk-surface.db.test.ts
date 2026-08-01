/**
 * Deleting a user must not be refused by a foreign key nobody decided on.
 *
 * ── THE MISTAKE THIS GUARD EXISTS TO PREVENT ───────────────────────────────
 * On 2026-08-01 a single FK was fixed — `vendor_ig_oauth_state.initiated_by`,
 * which had no ON DELETE clause and therefore defaulted to NO ACTION (refuse),
 * with three abandoned Instagram handshakes blocking the owner's own account.
 *
 * That fix treated an instance as an instance. The class query took ten seconds
 * and returned TWENTY-ONE. Four were actively blocking: oauth_state (30 rows),
 * event_moderators (2), slug_change_log (1), event_manual_vendors (1).
 *
 * Fixing one member of a pattern and moving on is the same error as trusting a
 * name grep: it checks the thing in front of you instead of the shape.
 *
 * ── WHAT THIS ASSERTS ──────────────────────────────────────────────────────
 * Every single-column FK onto `auth.users` either has a delete behaviour
 * (SET NULL / CASCADE), or is named in the baseline with a written reason.
 * Refusing IS a legitimate choice — a financial record that must survive its
 * author is a real thing. What is not legitimate is refusing BY DEFAULT,
 * because nobody wrote an ON DELETE clause.
 *
 * ⚠ NOTE THE DIRECTION. This does not demand CASCADE everywhere. Cascading an
 * authorship stamp would delete an event's moderator list because the person
 * who sent the invitations left. The event record belongs to the event.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const BASELINE = path.join(__dirname, 'user-delete-refusing-fks.baseline.txt');

function readBaseline(): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(BASELINE)) return out;
  for (const raw of fs.readFileSync(BASELINE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [k, ...rest] = line.split('|');
    out.set((k ?? '').trim(), rest.join('|').trim());
  }
  return out;
}

/** Single-column FKs onto auth.users whose delete action is NO ACTION ('a') or RESTRICT ('r'). */
async function refusingFks(): Promise<string[]> {
  const { rows } = await db.query<{ k: string }>(`
    SELECT con.conrelid::regclass::text || '.' || a.attname AS k
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid = 'auth.users'::regclass
       AND con.confdeltype IN ('a', 'r')
       AND array_length(con.conkey, 1) = 1
     ORDER BY 1
  `);
  return rows.map((r) => r.k);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

test('META · auth.users exists in the replay and has inbound FKs', async () => {
  // Anti-vacuity: if auth.users were missing, refusingFks() would throw or
  // return empty and every assertion below would pass for the wrong reason.
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_constraint
      WHERE contype='f' AND confrelid='auth.users'::regclass`,
  );
  assert.ok((rows[0]?.n ?? 0) > 20, 'suspiciously few FKs onto auth.users — the replay looks wrong');
});

test('the 17 fixed on 2026-08-01 no longer refuse a user delete', async () => {
  // Named individually rather than left to the baseline: each was a real
  // blocker, and a regression here is "this specific one reopened".
  const fixed = [
    'bespoke_monogram_generations.created_by',
    'budget_allocation_decisions.recorded_by',
    'budget_builds.created_by',
    'event_build_picks.picked_by',
    'event_category_build_state.set_by',
    'event_egift_methods.created_by_user_id',
    'event_manual_vendors.created_by_user_id',
    'event_moderators.invited_by_user_id',
    'event_sponsors.created_by_user_id',
    'guest_columns.reviewed_by_user_id',
    'guest_message_blocks.blocked_by',
    'photo_messages.reviewed_by_user_id',
    'scan_events.scanner_user_id',
    'slug_change_log.changed_by',
    'oauth_state.initiated_by',
    'live_studio_channel_oauth_state.initiated_by',
    'patiktok_oauth_state.initiated_by',
  ];
  const stillRefusing = new Set(await refusingFks());
  const regressed = fixed.filter((k) => stillRefusing.has(k));
  assert.deepEqual(
    regressed,
    [],
    `these were given a delete behaviour on 2026-08-01 and refuse again: ${regressed.join(', ')}. A later ADD CONSTRAINT without an ON DELETE clause silently restores NO ACTION.`,
  );
});

test('no FK refuses a user delete without a written reason', async () => {
  const refusing = await refusingFks();
  const baseline = readBaseline();
  const undeclared = refusing.filter((k) => !baseline.has(k));

  assert.deepEqual(
    undeclared,
    [],
    `${undeclared.length} foreign key(s) refuse to let a user be deleted and nobody said why:\n` +
      undeclared.map((k) => `  · ${k}`).join('\n') +
      `\n\nRefusing is a legitimate choice — a record that must outlive its author is a real thing.\n` +
      `Refusing BY DEFAULT, because no ON DELETE clause was written, is not. Either give it a\n` +
      `behaviour (SET NULL for an authorship stamp, CASCADE for state meaningless without the\n` +
      `user) or add a line to tests/db/user-delete-refusing-fks.baseline.txt saying what must\n` +
      `survive and why.`,
  );
});

test('every baseline line still names a refusing FK', async () => {
  const refusing = new Set(await refusingFks());
  const stale = [...readBaseline().keys()].filter((k) => !refusing.has(k));
  assert.deepEqual(stale, [], `baseline lines for FKs that no longer refuse: ${stale.join(', ')}. Delete them.`);
});
