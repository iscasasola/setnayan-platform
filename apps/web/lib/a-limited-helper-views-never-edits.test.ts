/**
 * a-limited-helper-views-never-edits.test.ts — A LIMITED HELPER NEVER PASSES AN
 * EDIT GATE.
 *
 * Owner 2026-09-28: "Limited Helper can keep. may view but may not edit. can see
 * progress but not edit/customize the event" → "yes they cannot edit".
 *
 * 🔑 TWO LOCKS, BECAUSE ONE OF THEM IS BLIND TO THE OTHER'S DOOR.
 *   · The DATABASE refuses a limited helper's writes (RESTRICTIVE policies,
 *     migration 20271251336140; tests/db/cohosts-come-from-the-guest-list).
 *   · But most server actions check "is this an accepted seat?" and then write
 *     with the ADMIN client, which bypasses every policy. A limited helper IS an
 *     accepted seat, so every such gate must also say "…and not a limited
 *     helper" — `.neq('role_subtype', 'viewer')`.
 * This test is the second lock's memory: any server-action file (or shared
 * gate) that admits an accepted seat must exclude the limited helper, so a new
 * action cannot quietly let one through.
 *
 * View-only pages (layout, "Who is here", the schedule page…) are exempt on
 * purpose — a limited helper is meant to SEE the event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** Shared gates that server actions call — not 'use server' themselves. */
const SHARED_EDIT_GATES = [
  'lib/host-gate.ts',
  'lib/run-of-show-advance.ts',
  'lib/panood-control-room-access.ts',
  'lib/coordinator-broadcasts-server.ts',
  'lib/vendor-couple-invite.ts',
  'app/dashboard/[eventId]/story/_lib/host-authority.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ACCEPTED_SEAT = /\.not\('accepted_at',\s*'is',\s*null\)/g;
const EXCLUDES_HELPER = /^\s*\.neq\('role_subtype',\s*'viewer'\)/;

function gatesIn(file: string): { total: number; missing: number } {
  const src = stripComments(readFileSync(file, 'utf8'));
  let total = 0;
  let missing = 0;
  for (const m of src.matchAll(ACCEPTED_SEAT)) {
    // Only chains on event_moderators: look back to the nearest .from(.
    const before = src.slice(Math.max(0, (m.index ?? 0) - 600), m.index);
    const lastFrom = before.lastIndexOf(".from('");
    if (lastFrom === -1 || !before.slice(lastFrom).startsWith(".from('event_moderators')")) continue;
    total += 1;
    const after = src.slice((m.index ?? 0) + m[0].length);
    if (!EXCLUDES_HELPER.test(after)) missing += 1;
  }
  return { total, missing };
}

test('every edit gate that admits an accepted seat excludes the limited helper', () => {
  const serverActions = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))].filter((f) =>
    /^\s*['"]use server['"]/.test(readFileSync(f, 'utf8')),
  );
  const files = [...new Set([...serverActions, ...SHARED_EDIT_GATES.map((f) => join(WEB, f))])];

  let gates = 0;
  const offenders: string[] = [];
  for (const f of files) {
    const { total, missing } = gatesIn(f);
    gates += total;
    if (missing > 0) offenders.push(`${relative(WEB, f)} (${missing} of ${total})`);
  }
  // Floor: an empty scan would report a perfectly clean sweep.
  assert.ok(gates >= 15, `scan floor: found only ${gates} accepted-seat gates — did the pattern drift?`);
  assert.deepEqual(
    offenders,
    [],
    'these edit gates admit an accepted seat without `.neq(\'role_subtype\', \'viewer\')` — a limited helper would pass and write through the admin client',
  );
});
