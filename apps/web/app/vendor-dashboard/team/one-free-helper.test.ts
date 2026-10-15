/**
 * ONE FREE HELPER — every place that counts a team's seats asks the ONE rule (owner 2026-10-14, DECISION_LOG 🧑‍🤝‍🧑).
 *
 * The rule itself is unit-tested in `lib/vendor-free-helper.test.ts`. This holds the WIRING: a reader that kept its
 * own "members beyond the founder" count would quietly disagree with the invite — the screen saying a Helper is free
 * while the action refuses one, or the other way round (a free paid seat). So:
 *   · the invite asks `canSeat` (kind 'invite'), and no longer counts heads itself;
 *   · the role change asks `canSeat` (kind 'role') when a Helper moves to a role that counts;
 *   · the Helpers screen and the Shop tile count through `teamSeats`;
 *   · nobody types the free number — they import `FREE_HELPER_SEATS` / `FREE_HELPER_ROLE`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/vendor-dashboard/team
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const ACTIONS = read('actions.ts');
const PAGE = read('page.tsx');
const SHOP = read('../shop/page.tsx');

function body(src: string, fn: string): string {
  const at = src.indexOf(`export async function ${fn}(`);
  assert.ok(at >= 0, `${fn} not found`);
  const next = src.indexOf('\nexport async function ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}

test('the invite asks the one rule, as an invite, and counts no heads of its own', () => {
  const invite = body(ACTIONS, 'inviteVendorTeamMember');
  assert.match(invite, /canSeat\(\{[\s\S]*?change:\s*\{\s*kind:\s*'invite',\s*role\s*\}/);
  assert.doesNotMatch(invite, /count:\s*'exact',\s*head:\s*true/, 'a head-count of members is back — it cannot see the free Helper');
});

test('a Helper moving to a role that counts asks the rule; nothing else pays the reads', () => {
  const update = body(ACTIONS, 'updateVendorTeamMember');
  assert.match(update, /target\.role === FREE_HELPER_ROLE && role !== FREE_HELPER_ROLE/);
  assert.match(update, /canSeat\(\{[\s\S]*?kind:\s*'role'/);
});

// Supplier batch (2026-10-15): step 5 retired the Shop's team tile and its team read — the Shop's Helpers row is a
// plain door to /vendor-dashboard/team. So the Helpers screen is the ONE place that counts seats; the Shop must not
// grow a second count back.
test('the Helpers screen counts through teamSeats; the Shop keeps no second count', () => {
  assert.match(PAGE, /teamSeats\(enriched, ctx\.founderUserId\)/);
  assert.doesNotMatch(PAGE, /\.filter\(\(m\) => m\.user_id !== ctx\.founderUserId\)\.length/, 'a second copy of the seat count');
  assert.doesNotMatch(SHOP, /team\.filter\(\(m\) => m\.user_id !== profile\.user_id\)\.length/, 'a second copy of the seat count');
  assert.ok(!/fetchVendorTeam\(/.test(SHOP) || /teamSeats\(team, profile\.user_id\)/.test(SHOP), 'the Shop reads the team again but does not count through teamSeats');
});

test('the free number and role are imported, never typed', () => {
  for (const [name, src] of [['actions.ts', ACTIONS], ['page.tsx', PAGE]] as const) {
    assert.match(src, /from '@\/lib\/vendor-free-helper'/, `${name} does not import the rule`);
  }
  assert.doesNotMatch(ACTIONS, /role\s*===\s*'viewer'\s*&&/, 'the free role is typed in the action');
});
