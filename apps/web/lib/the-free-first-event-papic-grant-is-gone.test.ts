/**
 * GUARD — the free first-event Papic grant is gone, in deed and in word.
 *
 * Owner ruling 16 Nov 2026 (DECISION_LOG "Free 50 Papic credits REMOVED"): the
 * platform's free first-event Papic grant goes, because every booking carries a
 * Setnayan gift. On 28 Nov the owner set `papic_event_pool_config.free_grant_points`
 * to 0 on every row in prod. This file holds the code half:
 *
 *   1 · NO GRANT RUNS. Nothing in the app calls `papic_claim_free_pool`, and the
 *       old caller (`lib/papic-free-grant.ts`) does not come back. The SQL stays
 *       (erasure coverage reads `papic_free_grant_claims`); with the column at 0
 *       its only remaining caller, the `event_members` trigger, grants nothing.
 *   2 · NO COPY NAMES IT. No app or lib source (comments stripped) says "free
 *       credits", "credits come free" or ties credits to a first event.
 *   3 · NOTHING SHOWS A 0-CREDIT GRANT. The /papic dial has no ₱0 / 0-credit
 *       rung, and the onboarding pool promises 0 free points.
 *   4 · THE ONE LINE. Where a line is needed it is `PAPIC_BOOKING_GIFT_LINE`.
 *
 * Credits already granted stay: nothing here (or anywhere in this change)
 * writes to `papic_event_point_grants`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { PAPIC_BOOKING_GIFT_LINE } from './setnayan-gift';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '..', '..');

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.test-helper\.ts$/.test(name)) acc.push(full);
  }
  return acc;
}

const SHIPPED = ['app', 'lib', 'components'].flatMap((d) => sources(join(WEB, d)));
const code = (file: string) => stripComments(readFileSync(file, 'utf8'));
const rel = (file: string) => relative(WEB, file).split('\\').join('/');

/**
 * ⏳ HELD BY OTHER SESSIONS — the only files allowed to still name the old
 * condition, until their own PRs land. This list may only shrink.
 *   · `app/(shell)/pricing/page.tsx`, `app/(shell)/pricing/plan/_plan-steps.ts` — the L9 public-pages session.
 *   · `lib/llms-txt.ts` — PR #8423.
 *   · `lib/papic-free-credit-promise.ts` — the deprecated constant those two import.
 */
const HELD_ELSEWHERE = new Set([
  'app/(shell)/pricing/page.tsx',
  'app/(shell)/pricing/plan/_plan-steps.ts',
  'lib/llms-txt.ts',
  'lib/papic-free-credit-promise.ts',
]);

test('1 · no grant runs: nothing in the app calls papic_claim_free_pool, and its caller is gone', () => {
  assert.equal(existsSync(join(WEB, 'lib', 'papic-free-grant.ts')), false, 'lib/papic-free-grant.ts is back');
  const callers = SHIPPED.filter((f) => /papic_claim_free_pool|ensureFreePapicPoolGrantAdmin|papic-free-grant['"]/.test(code(f))).map(rel);
  assert.deepEqual(callers, [], `these arm the free first-event grant again:\n  ${callers.join('\n  ')}`);
});

test('1b · the SQL stays (no migration, no clawback): the RPC and the claim table are still defined and covered', () => {
  const migrations = readdirSync(join(REPO, 'supabase', 'migrations')).map((f) => readFileSync(join(REPO, 'supabase', 'migrations', f), 'utf8'));
  assert.ok(migrations.some((s) => /FUNCTION public\.papic_claim_free_pool/.test(s)), 'papic_claim_free_pool is no longer defined');
  assert.match(readFileSync(join(WEB, 'lib', 'erasure', 'coverage.ts'), 'utf8'), /table: 'papic_free_grant_claims'/, 'erasure coverage lost the claim table');
});

/** What naming the retired grant looks like in copy. "Free cameras" and "free Papic photos" (the gift) are not it. */
const NAMES_IT = [
  /\bfree credits?\b/i,
  /\bcredits? (?:come |are )?free\b/i,
  /first event[^.!?'"`]{0,60}\bcredits?\b/i,
  /\bcredits?\b[^.!?'"`]{0,60}first event/i,
  /\bfree (?:papic )?pool\b/i,
  /PAPIC_FREE_CREDIT_CONDITION/,
];

/**
 * Not copy: an admin-only description of the SQL that stays (the claim table), which erasure coverage must keep
 * explaining for as long as the table exists. No customer reads it.
 */
const DESCRIBES_THE_SQL = new Set(['lib/erasure/coverage.ts']);

test('2 · no app copy names free first-event credits', () => {
  const offenders: string[] = [];
  for (const f of SHIPPED) {
    if (HELD_ELSEWHERE.has(rel(f)) || DESCRIBES_THE_SQL.has(rel(f))) continue;
    const src = code(f);
    for (const re of NAMES_IT) {
      const m = re.exec(src);
      if (m) offenders.push(`${rel(f)} — "${m[0].slice(0, 80)}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `The free first-event grant is retired (owner 16 Nov 2026). Say "${PAPIC_BOOKING_GIFT_LINE}" where a line is needed:\n  ${offenders.join('\n  ')}`,
  );
});

test('2b · the pattern fires on the copy that shipped, and passes true lines', () => {
  const shipped = [
    '50 free credits on your first event',
    'Free credits come on your first event, so you can try it first.',
    'Your first event’s free credits are already on.',
    'and your first event starts with free credits',
    'Free credits on a first event',
  ];
  for (const s of shipped) assert.ok(NAMES_IT.some((re) => re.test(s)), `would have let this ship: "${s}"`);
  const innocent = [PAPIC_BOOKING_GIFT_LINE, 'Cameras are free and unlimited', 'Set up your account and your first event.', 'free Papic photos for your event'];
  for (const s of innocent) assert.ok(!NAMES_IT.some((re) => re.test(s)), `convicted a true line: "${s}"`);
});

test('2c · the deprecated condition is imported only by the two files held elsewhere', () => {
  const importers = SHIPPED.filter((f) => /from ['"][^'"]*papic-free-credit-promise['"]/.test(code(f))).map(rel).sort();
  for (const f of importers) assert.ok(HELD_ELSEWHERE.has(f), `${f} imports the retired free-credit wording`);
});

test('3 · nothing shows a 0-credit or ₱0 grant: no "buy nothing" rung on /papic', () => {
  const page = code(join(WEB, 'app', '(shell)', 'papic', 'page.tsx'));
  const dial = code(join(WEB, 'app', '(shell)', 'papic', '_papic-dial.tsx'));
  assert.doesNotMatch(page, /peso:\s*0\s*,\s*bought:\s*0/, '/papic puts a ₱0 / 0-credit rung back on the dial');
  assert.doesNotMatch(dial, /You pay[\s\S]{0,200}nothing/, 'the dial says "You pay nothing" again');
  assert.doesNotMatch(page + dial, /free_grant_points|freeCredits/, '/papic reads or passes the free grant again');
});

test('4 · the one line is the owner’s wording, and the screens that need a line say it', () => {
  assert.equal(PAPIC_BOOKING_GIFT_LINE, 'Many bookings come with free Papic photos as a Setnayan gift.');
  for (const f of ['app/(shell)/papic/page.tsx', 'lib/help/topics-existing.ts']) {
    assert.match(code(join(WEB, f)), /PAPIC_BOOKING_GIFT_LINE/, `${f} no longer says the gift line`);
  }
});
