/**
 * A YEAR ADDS UP ITS BUDGETS — AND NOTHING ELSE.
 *
 * Three things about a cluster's budget rollup fail silently, so all three are
 * pinned here rather than described in a comment:
 *
 * 1. THE TOTAL IS DERIVED. Nothing stores it (7a forbids a value-bearing
 *    column on either cluster table, and its guard's pattern already names
 *    `budget`). A wrong total does not throw and does not look broken — it just
 *    states, in pesos, a plan the couple does not have.
 *
 * 2. 🛑 AN UNREADABLE BUDGET MUST NEVER BECOME ₱0. This is the disease this
 *    repo has shipped and re-fixed seven times: a refused read rendering
 *    byte-identically to a genuine zero. Σ of no rows is 0 in arithmetic and a
 *    LIE on a screen, so `totalPhp` is null whenever nothing contributed, and
 *    every absence gets words instead of a number.
 *
 * 3. ⛔ THE POT IS NOT BUDGET MONEY AND MAY NOT BE SUMMED. Owner ruling
 *    2026-09-02: budget pesos roll up across a cluster, Papic capture credits
 *    never do. The last test is a source scan, because "the year has 30,000
 *    shots" reads beautifully and nothing about it looks wrong on screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import {
  budgetStateNote,
  fetchClusterBudgets,
  rollUpClusterBudgets,
  type BudgetReadState,
  type CelebrationBudget,
} from './cluster-budgets';

function row(event_id: string, state: BudgetReadState, targetPhp: number | null = null): CelebrationBudget {
  return { event_id, state, targetPhp };
}

const ALL_STATES: BudgetReadState[] = ['set', 'none', 'withheld', 'unknown'];

/* ── 1 · the total is the sum of its celebrations ────────────────────────── */

test('a cluster total equals the sum of its celebrations', () => {
  const roll = rollUpClusterBudgets([
    row('wedding', 'set', 800_000),
    row('shower', 'set', 45_000),
    row('party', 'set', 120_000),
  ]);
  assert.equal(roll.totalPhp, 965_000);
  assert.equal(roll.countedIn, 3);
  assert.equal(roll.notCounted, 0);
  assert.equal(roll.noTarget, 0);
});

test('the total changes when a member is ADDED', () => {
  const before = rollUpClusterBudgets([row('wedding', 'set', 800_000)]);
  const after = rollUpClusterBudgets([
    row('wedding', 'set', 800_000),
    row('shower', 'set', 45_000),
  ]);
  assert.equal(before.totalPhp, 800_000);
  assert.equal(after.totalPhp, 845_000, 'linking a celebration did not move the year total');
  assert.equal(after.countedIn, 2);
});

test('the total changes when a member is REMOVED', () => {
  const before = rollUpClusterBudgets([
    row('wedding', 'set', 800_000),
    row('shower', 'set', 45_000),
  ]);
  const after = rollUpClusterBudgets([row('wedding', 'set', 800_000)]);
  assert.equal(before.totalPhp, 845_000);
  assert.equal(after.totalPhp, 800_000, 'unlinking a celebration left its money in the year');
  assert.equal(after.countedIn, 1);
});

/* ── 2 · unknown is unknown, never zero ──────────────────────────────────── */

test('a group with NOTHING readable has no total — not a total of zero', () => {
  const roll = rollUpClusterBudgets([row('a', 'unknown'), row('b', 'unknown')]);
  assert.equal(
    roll.totalPhp,
    null,
    'two refused reads produced a peso figure. ₱0 against a real plan is ' +
      'byte-identical to a couple who has budgeted nothing — the exact defect ' +
      'the guest list and the supplier ledger each shipped once.',
  );
  assert.equal(roll.notCounted, 2);
  assert.equal(roll.countedIn, 0);
});

test('a group where nobody has set a budget has no total either', () => {
  const roll = rollUpClusterBudgets([row('a', 'none'), row('b', 'none')]);
  assert.equal(roll.totalPhp, null, 'an unset plan was reported as a plan of ₱0');
  assert.equal(roll.noTarget, 2);
});

test('an empty group has no total', () => {
  const roll = rollUpClusterBudgets([]);
  assert.equal(roll.totalPhp, null);
  assert.equal(roll.countedIn, 0);
});

test('an unreadable member does not drag the total — it is counted as NOT counted', () => {
  const roll = rollUpClusterBudgets([
    row('wedding', 'set', 800_000),
    row('shower', 'unknown'),
    row('party', 'withheld'),
    row('lunch', 'none'),
  ]);
  assert.equal(roll.totalPhp, 800_000, 'an unreadable member contributed money it never reported');
  assert.equal(roll.countedIn, 1);
  assert.equal(roll.noTarget, 1);
  assert.equal(
    roll.notCounted,
    2,
    'the caller was not told the total is partial, so it will draw a sum of ' +
      'one celebration as if it were the whole year',
  );
});

test("a celebration you do not host contributes NOTHING, even carrying a figure", () => {
  /*
   * 🔒 Defence in depth. `fetchClusterBudgets` never populates targetPhp on a
   * withheld row — but if it ever did, the arithmetic must still refuse it,
   * because the rollup is what turns a leaked figure into a printed one.
   */
  const roll = rollUpClusterBudgets([row('theirs', 'withheld', 930_000)]);
  assert.equal(roll.totalPhp, null, "somebody else's budget entered the year total");
  assert.equal(roll.notCounted, 1);
});

test('a `set` row with no figure cannot enter the total', () => {
  const roll = rollUpClusterBudgets([row('broken', 'set', null)]);
  assert.equal(roll.totalPhp, null);
  assert.equal(roll.countedIn, 0, 'a row claiming `set` with no number was counted as measured');
});

test('"could not read it" and "not yours to see" are counted apart', () => {
  /*
   * 🔑 They are a FAILURE and a RULE WORKING CORRECTLY. Collapsed into one
   * "not counted", the summary line reads as a glitch over a deliberate
   * refusal — and as a refusal over a glitch the couple could fix by
   * refreshing. The tile's copy is built from these two, so they must not be
   * one number.
   */
  const roll = rollUpClusterBudgets([
    row('a', 'set', 100),
    row('b', 'unknown'),
    row('c', 'withheld'),
    row('d', 'withheld'),
  ]);
  assert.equal(roll.unknownCount, 1);
  assert.equal(roll.withheldCount, 2);
  assert.equal(roll.notCounted, 3, 'notCounted must stay the sum of its two halves');
  assert.equal(roll.notCounted, roll.unknownCount + roll.withheldCount);
});

test('a `set` row with no figure falls toward UNKNOWN, never toward zero', () => {
  const roll = rollUpClusterBudgets([row('broken', 'set', null)]);
  assert.equal(roll.unknownCount, 1, 'a figureless row was silently discarded instead of reported');
  assert.equal(roll.countedIn, 0);
  assert.equal(roll.totalPhp, null);
});

/* ── the words for an absence are words, never money ─────────────────────── */

test('every absence is given words, and none of them is a figure', () => {
  assert.equal(budgetStateNote('set'), null, 'a real budget must print its own number');
  for (const state of ALL_STATES) {
    if (state === 'set') continue;
    const note = budgetStateNote(state);
    assert.ok(note && note.length > 0, `state ${state} has no copy, so a surface will invent some`);
    assert.doesNotMatch(
      note,
      /₱|\bPHP\b|\b0\b/,
      `the copy for "${state}" reads as an amount ("${note}") — an absence must ` +
        'not wear the face of a figure',
    );
  }
});

test('the four states stay four — a new one cannot be added without copy', () => {
  // A silent fifth state would fall through `budgetStateNote`'s switch and
  // return undefined, which renders as nothing at all: an empty cell where a
  // budget should be, indistinguishable from a page that simply did not load.
  for (const state of ALL_STATES) {
    const note = budgetStateNote(state);
    assert.ok(note === null || typeof note === 'string', `state ${state} produced ${note}`);
  }
});

/* ── the READ, and the belt the database alone will not apply ────────────── */

type TableReply = { data: unknown[] | null; error: { message: string } | null };

/**
 * A supabase stub that records what was asked and replies per table.
 *
 * 🔑 WHY THIS EXISTS AND THE db-TEST DOES NOT COVER IT.
 * `tests/db/a-budget-rollup-reads-only-your-own-money.db.test.ts` proves the
 * POLICIES behave — but `events_host` deliberately ADMITS an accepted
 * moderator, so the database will happily hand over a budget the rollup must
 * not print. The couple-membership filter lives only in TypeScript, and
 * deleting it turns no policy test red. These tests are that filter's guard.
 */
function stubClient(replies: Record<string, TableReply>, seen: string[] = []) {
  const client = {
    from(table: string) {
      seen.push(table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        then: (
          resolve: (v: TableReply) => unknown,
          reject?: (e: unknown) => unknown,
        ) => Promise.resolve(replies[table] ?? { data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, seen };
}

test('the read asks who you are a COUPLE member of before printing anybody money', async () => {
  const { client, seen } = stubClient({
    event_members: { data: [{ event_id: 'mine' }], error: null },
    events_host: {
      // The database returned BOTH — exactly what events_host does for an
      // accepted delegate on somebody else's celebration.
      data: [
        { event_id: 'mine', estimated_budget_centavos: 8_000_000 },
        { event_id: 'delegated', estimated_budget_centavos: 93_000_000 },
      ],
      error: null,
    },
  });

  const roll = await fetchClusterBudgets(client, 'me', ['mine', 'delegated']);

  assert.ok(seen.includes('event_members'), 'the rollup never asked about membership at all');
  assert.deepEqual(
    roll.rows,
    [
      { event_id: 'mine', state: 'set', targetPhp: 80_000 },
      { event_id: 'delegated', state: 'withheld', targetPhp: null },
    ],
    'a celebration this person merely coordinates had its budget printed — ' +
      'events_host handed it over and nothing filtered it',
  );
  assert.equal(roll.totalPhp, 80_000, "somebody else's ₱930,000 entered the year total");
});

test('a REFUSED membership read is unknown — it does not silently withhold everything', async () => {
  const { client } = stubClient({
    event_members: { data: null, error: { message: 'permission denied' } },
    events_host: { data: [{ event_id: 'a', estimated_budget_centavos: 100 }], error: null },
  });
  const roll = await fetchClusterBudgets(client, 'me', ['a']);
  assert.deepEqual(roll.rows.map((r) => r.state), ['unknown']);
  assert.equal(roll.totalPhp, null, 'a refused read produced a figure');
});

test('a REFUSED budget read is unknown, and never ₱0', async () => {
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'a' }], error: null },
    events_host: { data: null, error: { message: 'permission denied' } },
  });
  const roll = await fetchClusterBudgets(client, 'me', ['a']);
  assert.deepEqual(roll.rows.map((r) => r.state), ['unknown']);
  assert.equal(
    roll.totalPhp,
    null,
    'the budget read was refused and the year still printed a total — this is ' +
      'the "₱0 committed against a real target" defect, one surface further on',
  );
});

test('a missing host row for a celebration you DO host is unknown, not "no budget"', async () => {
  /*
   * A couple member is inside `events_host`'s own WHERE, so a missing row is a
   * refusal or a drift. Calling it "No budget set yet" would state, in words,
   * the one fact we failed to read.
   */
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'a' }], error: null },
    events_host: { data: [], error: null },
  });
  const roll = await fetchClusterBudgets(client, 'me', ['a']);
  assert.deepEqual(roll.rows.map((r) => r.state), ['unknown']);
});

test('a host row with a NULL target is "none" — the one honest zero-ish state', async () => {
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'a' }], error: null },
    events_host: { data: [{ event_id: 'a', estimated_budget_centavos: null }], error: null },
  });
  const roll = await fetchClusterBudgets(client, 'me', ['a']);
  assert.deepEqual(roll.rows.map((r) => r.state), ['none']);
  assert.equal(roll.totalPhp, null);
  assert.equal(roll.noTarget, 1);
});

test('an UNPARSEABLE target is unknown — not "no budget set yet"', async () => {
  /*
   * The distinction the whole module exists for, in its least likely branch.
   * `estimated_budget_centavos` is BIGINT and PostgREST may return it as a
   * string; if that parse ever fails, saying "No budget set yet" would print a
   * confident sentence over a figure the host really typed.
   */
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'a' }], error: null },
    events_host: { data: [{ event_id: 'a', estimated_budget_centavos: 'not-a-number' }], error: null },
  });
  const roll = await fetchClusterBudgets(client, 'me', ['a']);
  assert.deepEqual(roll.rows.map((r) => r.state), ['unknown']);
  assert.equal(roll.noTarget, 0, 'an unreadable figure was reported as a host who set none');
  assert.equal(roll.unknownCount, 1);
});

test('an empty group reads nothing at all', async () => {
  const { client, seen } = stubClient({});
  const roll = await fetchClusterBudgets(client, 'me', []);
  assert.deepEqual(seen, [], 'an empty group still went to the database');
  assert.equal(roll.totalPhp, null);
});

test('rows come back in the order the caller gave them', async () => {
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'b' }, { event_id: 'a' }], error: null },
    events_host: {
      data: [
        { event_id: 'b', estimated_budget_centavos: 200 },
        { event_id: 'a', estimated_budget_centavos: 100 },
      ],
      error: null,
    },
  });
  const roll = await fetchClusterBudgets(client, 'me', ['a', 'b']);
  assert.deepEqual(
    roll.rows.map((r) => r.event_id),
    ['a', 'b'],
    'the budgets no longer line up with the timeline rows they are drawn beside',
  );
});

/* ── 3 · NO PAPIC CREDIT IS AGGREGATED ANYWHERE ──────────────────────────── */

/**
 * 🔑 THIS SCANS FOR THE MECHANISM, NOT FOR THE WORD.
 *
 * The cluster surfaces SAY "Papic" out loud on purpose — the tile tells the
 * couple their shots are never pooled, which is the promise being kept. A
 * `/papic/i` sweep would fire on that sentence, and the honest way to silence
 * it would be to delete the reassurance. So the patterns below match only the
 * things that would actually MOVE a credit: importing a Papic module, reading a
 * Papic table or view, or calling a Papic function.
 *
 * (The repo's recorded guard failure is `one-top-bar.test.ts` — right about the
 * disease, wrong about the patient list. The list here is walked, not typed.)
 */
const POT_MECHANISMS: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /from\s+['"][^'"]*papic[^'"]*['"]/i, why: 'imports a Papic module' },
  { pattern: /\.from\(\s*['"]papic/i, why: 'reads a Papic table or view' },
  { pattern: /\.rpc\(\s*['"]papic/i, why: 'calls a Papic function' },
  { pattern: /\bpapic_event_pool|papic_event_point_grants|papic_reserve_event_points\b/i, why: 'names the pot ledger' },
];

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

test('no cluster surface reaches the Papic pot', () => {
  const files = [
    path.join(__dirname, 'cluster-budgets.ts'),
    path.join(__dirname, 'clusters.ts'),
    ...walkTsFiles(path.join(__dirname, '..', 'app', 'dashboard', '(account)', 'clusters')),
  ];
  // A sweep that finds nothing to check is a broken guard, not a pass.
  assert.ok(files.length >= 6, `the cluster sweep found only ${files.length} files`);

  const offenders: string[] = [];
  for (const file of files) {
    // The repo's ONE comment stripper — a hand-rolled two-replace regex blanks
    // everything between a `//` line containing `/*` and the next real `*/`,
    // and the guard then asserts against a blank and passes.
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const { pattern, why } of POT_MECHANISMS) {
      if (pattern.test(code)) {
        offenders.push(`${path.relative(process.cwd(), file)} — ${why}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'a cluster surface reached the Papic pot:\n  ' +
      offenders.join('\n  ') +
      '\nThe pot is bought per celebration. Summing it across a year silently ' +
      'reprices every celebration already sold (owner ruling 2026-09-02).',
  );
});

test('the budget rollup module holds no credit-shaped arithmetic', () => {
  const code = stripComments(readFileSync(path.join(__dirname, 'cluster-budgets.ts'), 'utf8'));
  for (const word of ['points', 'credits', 'shots', 'ceiling']) {
    assert.ok(
      !new RegExp(`\\b${word}\\b`).test(code),
      `cluster-budgets.ts names "${word}" in live code. This module adds up ` +
        'BUDGET PESOS. The moment it can also see credits, one of them ends up ' +
        'in the other total.',
    );
  }
});
