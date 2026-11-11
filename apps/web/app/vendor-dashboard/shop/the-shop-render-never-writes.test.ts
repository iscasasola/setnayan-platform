/**
 * 🔒 THE SHOP RENDER NEVER WRITES (8 Nov release gate, blocker A).
 *
 * What it caught: opening /vendor-dashboard/shop ran `readBadgeRewardTracker`, which ran `grantOwedBadgeRewards` — a
 * SERVICE-ROLE write (`shop_badge_reward_grant`, `shop_badge_upgrade_grant`) that hands a shop real Event Plus / Papic
 * stock — inside the page render, a GET. It was also a waterfall: facts → grant → three reads → upgrades, five round
 * trips in a row before the page could draw.
 *
 * What is held (each part was broken on purpose and went red, then restored):
 *   1 · `readBadgeRewardTracker` and EVERY reader it reaches (walked by name across the files that define them) call no
 *       write — no `.rpc(` / `.insert(` / `.update(` / `.upsert(` / `.delete(` — and never `grantOwed…`. The walk must
 *       reach the five readers it is known to call, so it can never pass by walking nothing.
 *   2 · The Shop page itself calls no write, and its one service-role client goes only into that read-only tracker.
 *   3 · The money still moves at the same visit: Shop and Performance mount `<BadgeRewardSweep />`, which asks the ONE
 *       paying door `GET /api/vendor/badges?view=facts` after the page draws — and that door still pays
 *       (`grantOwedBadgeRewards`), the same door Today uses (owner 2026-11-05). A guard that only removed the write
 *       would silently stop paying suppliers; this one pins both halves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The files whose functions the tracker reaches (its own readers, the upgrades, and the three helpers they call). */
const READER_FILES = [
  'lib/badge-rewards.server.ts',
  'lib/badge-upgrades.server.ts',
  'lib/shop-booked-loops.server.ts',
  'lib/shop-gifts.server.ts',
  'lib/vendor-branches.ts',
];

/** Every top-level/exported function in a file → its body (brace-matched; string- and comment-free source). */
function functionBodies(code: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of code.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g)) {
    const name = m[1]!;
    // Skip the parameter list (it may hold `{ … }` types), then take the body's braces.
    let i = m.index! + m[0].length;
    let paren = 1;
    while (i < code.length && paren > 0) {
      if (code[i] === '(') paren += 1;
      else if (code[i] === ')') paren -= 1;
      i += 1;
    }
    // The body opens at the first `{` that ends its line (a return type's `{ … }` never does, in formatted code).
    const open = code.indexOf('{\n', i);
    if (open < 0) continue;
    let depth = 0;
    let j = open;
    for (; j < code.length; j++) {
      if (code[j] === '{') depth += 1;
      else if (code[j] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.set(name, code.slice(open, j + 1));
  }
  return out;
}

/**
 * A write: a table write, `grantOwed…`, or ANY rpc except the read-only ones named here. `shop_booked_loop_count` is
 * declared STABLE (migration 20271327129110) — a counter, it writes nothing. A new rpc on this path must be added here
 * on purpose, with its volatility checked, or the guard goes red.
 */
const READ_ONLY_RPCS = ['shop_booked_loop_count'];
const WRITE = new RegExp(String.raw`\.(insert|update|upsert|delete)\s*\(|\bgrantOwed\w*\s*\(|\.rpc\(\s*(?!'(?:${READ_ONLY_RPCS.join('|')})')`);

test('1 · the badge tracker, and every reader it reaches, never writes', () => {
  const bodies = new Map<string, string>();
  for (const f of READER_FILES) for (const [k, v] of functionBodies(src(f))) if (!bodies.has(k)) bodies.set(k, v);
  assert.ok(bodies.has('readBadgeRewardTracker'), 'readBadgeRewardTracker is gone from lib/badge-rewards.server.ts');

  const seen = new Set<string>();
  const queue = ['readBadgeRewardTracker'];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const m of bodies.get(name)!.matchAll(/\b(\w+)\s*\(/g)) if (bodies.has(m[1]!) && !seen.has(m[1]!)) queue.push(m[1]!);
  }
  for (const known of ['readBadgeRewardFacts', 'readGrantedRewards', 'readRewardNames', 'readTier', 'readBadgeUpgrades']) {
    assert.ok(seen.has(known), `the walk no longer reaches ${known} — the guard would be checking nothing`);
  }
  const writers = [...seen].filter((n) => WRITE.test(bodies.get(n)!));
  assert.deepEqual(writers, [], `a page render pays or writes again, through: ${writers.join(', ')}`);
});

test('2 · the Shop page calls no write; its service-role client feeds only the read-only tracker', () => {
  const page = src('app/vendor-dashboard/shop/page.tsx');
  assert.doesNotMatch(page, WRITE, 'the Shop render writes');
  const admins = [...page.matchAll(/createAdminClient\(\)/g)].length;
  const intoTracker = [...page.matchAll(/readBadgeRewardTracker\(\s*createAdminClient\(\)/g)].length;
  assert.ok(admins >= 1, 'the tracker no longer reads (the badge rows lost their rewards)');
  assert.equal(admins, intoTracker, 'the Shop render hands its service-role client to something other than the read-only tracker');
  // The Analytics carousel streams inside this same render (owner 11 Nov 2026) — it must not pay either.
  assert.doesNotMatch(src('app/vendor-dashboard/performance/_components/one-analytics-section.tsx'), WRITE, 'the Analytics render writes');
});

test('3 · the reward is still paid at the same visit — after the draw, through the one door', () => {
  const sweep = src('app/vendor-dashboard/_components/badge-reward-sweep.tsx');
  assert.match(sweep, /url = '\/api\/vendor\/badges\?view=facts'/, 'the sweep no longer asks the paying door');
  assert.match(sweep, /useEffect\(/, 'the sweep no longer runs after the page draws');
  // The Shop tab (which now carries the Analytics carousel too) pays once; the carousel never mounts a second sweep.
  assert.equal([...src('app/vendor-dashboard/shop/page.tsx').matchAll(/<BadgeRewardSweep \/>/g)].length, 1, 'the Shop tab no longer pays a newly earned reward at all');
  assert.doesNotMatch(src('app/vendor-dashboard/performance/_components/one-analytics-section.tsx'), /<BadgeRewardSweep\b/, 'a second sweep on one page');
  const door = src('app/api/vendor/badges/route.ts');
  assert.match(
    door,
    /if \(sp\.get\('view'\) === 'facts'\) \{[\s\S]*?grantOwedBadgeRewards\(admin, profile\.vendor_profile_id, rewardFacts\)[\s\S]*?NextResponse\.json\(\{ vendorId: profile\.vendor_profile_id, facts, granted \}/,
    'the badge-facts door no longer pays (or no longer says what it paid)',
  );
});
