/**
 * THE MARCH WRITES NO GUEST ROW — the TypeScript half.
 *
 * ⚖ Owner 2026-10-01, DECISION_LOG "THE WEDDING MARCH IS ITS OWN ENTITY":
 * "guests' own data (+1, partner link, role, side) is untouched by any march
 * edit and vice versa". The SQL half — every march function writes
 * `march_walks` and nothing else — is `tests/db/march-is-its-own-table.db.test.ts`.
 * This holds the doors in front of it: the march's actions and their shared
 * write helper reach the database ONLY through the march's own functions, and
 * never `.update()` / `.insert()` / `.upsert()` / `.delete()` a guest.
 *
 * 🔑 Before 2026-10-01 a march edit DID write guests — `pair_with_guest_id`,
 * `entourage_order` and (the "They're a couple" tick) `couple_with_guest_id`.
 * Any of those coming back fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

/** Every file that writes the march. */
const WRITERS = [
  'app/dashboard/[eventId]/guests/march-actions.ts',
  'app/dashboard/[eventId]/guests/entourage-order-actions.ts',
  'app/dashboard/[eventId]/guests/pair-actions.ts',
  'lib/entourage-write.ts',
];

/** The march's own SQL functions — each writes `march_walks` only. */
// + the "Not walking" tray's one writer (2026-10-06) — `march_not_walking` / `march_walks` only, never a guest row.
const MARCH_RPCS = new Set(['join_entourage_line', 'swap_entourage_places', 'set_entourage_order', 'unpair_guest', 'set_march_walking']);

test('the march’s writers never write a guest row', () => {
  for (const file of WRITERS) {
    const code = read(file);
    // Any chain that starts at `.from('guests')` and reaches a write verb.
    const chains = code.match(/\.from\(\s*['"]guests['"]\s*\)[\s\S]*?;/g) ?? [];
    for (const chain of chains) {
      assert.doesNotMatch(chain, /\.(?:update|insert|upsert|delete)\(/, `${file} writes a guest row: ${chain.slice(0, 120)}`);
    }
    assert.doesNotMatch(
      code,
      /\b(?:pair_with_guest_id|entourage_order|couple_with_guest_id)\b/,
      `${file} names a retired guest column of the march`,
    );
  }
});

test('the march reaches the database only through its own functions', () => {
  let seen = 0;
  for (const file of WRITERS) {
    for (const [, fn] of read(file).matchAll(/\.rpc\(\s*['"]([a-z_]+)['"]/g)) {
      seen += 1;
      assert.ok(MARCH_RPCS.has(fn!), `${file} calls ${fn}, which is not one of the march's own functions`);
    }
  }
  // Anti-vacuity: join, swap, order and unpair are all still called.
  assert.ok(seen >= 4, `only ${seen} march calls found — the scan is reading the wrong files`);
});

test('the reader asks for the walk, not the retired guest columns', () => {
  const entourage = read('lib/entourage.ts');
  const columns = /export const ENTOURAGE_COLUMNS =\s*'([^']+)'/.exec(entourage)?.[1] ?? '';
  assert.match(columns, /march:march_walks\(walk_no, place_in_walk\)/, 'the entourage read no longer embeds the walk');
  assert.doesNotMatch(columns, /pair_with_guest_id|entourage_order/, 'the entourage read asks a retired guest column again');
});

test('⛔ the seater reads no walking pair — a walk is not a seat-together hint (owner 2026-10-01)', () => {
  /* Rules ▾ "Sit together" (`role_seating`, the default) seats the sponsors as
     one unit, and a spouse is a +1, which already rides with them. */
  for (const file of ['lib/seating.ts', 'lib/seating-reconcile.ts', 'app/dashboard/[eventId]/seating/actions.ts']) {
    assert.doesNotMatch(read(file), /\bpair_with_guest_id\b|\bmarch_walks\b/, `${file} seats people by who they walk with`);
  }
});

test('the Sponsors page calls a principal pair a WALK — full names, never a couple', () => {
  const page = read('app/dashboard/[eventId]/sponsors/page.tsx');
  const row = /function PrincipalPairRow\([\s\S]*?\n}\n/.exec(page)?.[0] ?? '';
  assert.ok(row, 'PrincipalPairRow is gone — this guard is reading nothing');
  assert.match(row, /\{groomSponsor\.full_name\} walks with \{brideSponsor\.full_name\}/, 'the pair no longer says who walks with whom, in full');
  assert.doesNotMatch(row, />\s*Pair \{pairIndex\}|\bcouples?\b/i, 'a principal pair reads as a couple again');
});
