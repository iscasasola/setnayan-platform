/**
 * flag-chokepoint-scan.test.ts — a REPO SCAN that makes a kill-switch honest.
 *
 * THE GAP THIS CLOSES (`WHATS_NEXT_Explore_Marketplace_2026-07-29.md` §5.3):
 * *"Hardcoding `const replan = true` in `shortlist-categories.tsx` (bypassing
 * `isExploreReplanEnabled()`) breaks NO test — the full suite stays green. No CI
 * job has ever built with `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true`."*
 *
 * A flag-dark feature makes one promise: **flag OFF renders exactly what
 * production rendered before.** Nothing enforced that promise. The suite runs
 * with the flag unset, so a branch that stopped consulting the flag — a
 * hardcoded literal, a deleted import, an env read that drifted to a second
 * module with a different default — would test green in the one state where it
 * is wrong.
 *
 * Four properties per flag, each naming a real way the promise breaks:
 *
 *   1 · ONE READER. `process.env.<FLAG>` is read in exactly one module — its
 *       helper. A second reader is a second default, and the two disagree the
 *       day someone writes `=== 'true'` next to `!== 'false'`.
 *   2 · THE GATES STILL CALL IT. The load-bearing surfaces are named
 *       individually and must actually invoke the helper (comments stripped, so
 *       a docblock mentioning it doesn't count). Replacing a call with `true`
 *       and dropping the import turns the file's line red.
 *   3 · THE PURE CORES DON'T. `bench-sort` · `bench-card-actions` · `your-team`
 *       · `plans-panel` receive the flag as a parameter, and must keep doing so:
 *       a pure core that reads the env itself can no longer be exercised in both
 *       states in one test process. (Writing this check is what caught that four
 *       of them only MENTION the helper in a docblock — the injection is the
 *       design, not an omission.)
 *   4 · NO HARDCODED LOCAL. No consumer assigns the flag's conventional local
 *       name to a boolean literal — this is §5.3's exact scenario.
 *
 * Registry-driven on purpose: the next flag-dark feature adds one entry and
 * inherits all four checks. That is what §5.3 asks for — "it will matter for
 * the next flag-dark feature".
 *
 * NOT COVERED, deliberately: this cannot prove a flag-OFF *render* is identical
 * — that needs a build with the flag on, which is CI's job, not a unit test's.
 * It proves the flag is still the only thing being asked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

type FlagSpec = {
  /** The `NEXT_PUBLIC_*` env var. */
  env: string;
  /** The ONE module allowed to read it, relative to apps/web. */
  helper: string;
  /** The exported predicate every consumer must go through. */
  fn: string;
  /**
   * Surfaces whose flag branch is load-bearing — each must invoke `fn`. Named
   * one by one rather than counted, so the failure says WHICH gate went dark.
   */
  gates: string[];
  /**
   * Pure modules that receive the flag as an argument. They must NOT invoke
   * `fn` — reading the flag inside a pure core is what destroys a unit suite's
   * ability to exercise both states in one process.
   */
  pureCores: string[];
  /** Conventional local names for the resolved flag inside a consumer. */
  locals: string[];
};

const FLAGS: FlagSpec[] = [
  {
    env: 'NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED',
    helper: 'lib/explore-replan-flag.ts',
    fn: 'isExploreReplanEnabled',
    gates: [
      // The mobile dock removal (PR-3) — flag OFF must bring the dock back.
      'lib/customer-menu.ts',
      // Section labels: "Plans" / "Payments" vs today's strings.
      'lib/budget-build.ts',
      // The takeover's section headings + the one-scroll layout.
      'app/dashboard/[eventId]/vendors/_components/services-takeover.tsx',
      // §5.3's named example — the bench itself.
      'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
      // "Your team": the merge, the money tiles, the decision doorways.
      'app/dashboard/[eventId]/vendors/_components/build-locked.tsx',
      // "Your plans" — the reframed Compare panel.
      'app/dashboard/[eventId]/vendors/_components/build-compare.tsx',
    ],
    pureCores: [
      // These take the flag as a PARAMETER (`enabled`) and must never read it
      // themselves — that injection is what lets their unit suites drive both
      // states in one run. `bench-card-actions.ts` says so in its own docblock:
      // "FLAG: `enabled` is `isExploreReplanEnabled()`".
      'lib/bench-sort.ts',
      'lib/bench-card-actions.ts',
      'lib/your-team.ts',
      'lib/plans-panel.ts',
    ],
    locals: ['replan'],
  },
  {
    // BUD-2 · §18.6. The budget page's move onto the shared money resolver.
    // Registered on the day the first surface was wired, per this file's own
    // promise that "the next flag-dark feature adds one entry".
    env: 'NEXT_PUBLIC_BUDGET_TRUTH_ENABLED',
    helper: 'lib/budget-truth-flag.ts',
    fn: 'isBudgetTruthEnabled',
    gates: [
      // The strip's "Committed", the live card's "Total to pay", and which
      // vendors get a card — the three row sets R1 is about.
      'app/dashboard/[eventId]/budget/page.tsx',
      // BUD-3 — the empty-`covers_plan_groups` skip (R2, ₱810,000).
      'lib/checklist-budget.ts',
      // BUD-8 — the Merkado payments lens. The SECOND screen a couple calls
      // "our money": if this one stops asking the flag while `/budget` keeps
      // asking, the two print different totals for the same wedding on the day
      // the flag flips (measured: ₱80,000 apart on prod event `044f7e64…`).
      'app/dashboard/[eventId]/vendors/_components/merkado-budget-lens.tsx',
    ],
    pureCores: [
      // Take `enabled` as a parameter, so their suites drive BOTH states in one
      // process — including the assertions that flag OFF still reproduces each
      // live prod defect verbatim.
      'lib/budget-page-money.ts',
      'lib/checklist-budget-attribution.ts',
    ],
    locals: ['budgetTruth'],
  },
  {
    // PR-H · the vendor-agrees step (owner ruling 2026-07-27; funnel locked in
    // Service_Schedule_and_Quotation_Flow_2026-06-02.md). A couple pressing
    // Lock ASKS; the supplier's yes is what books them.
    env: 'NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED',
    helper: 'lib/lock-handshake-flag.ts',
    fn: 'isLockHandshakeEnabled',
    gates: [
      // The ONE lock path. `handshakeAsk` decides, in a single expression,
      // whether this press asks or books — and the whole slice hangs off it:
      // the date gate is skipped, the downpayment gate is disarmed, the slot
      // acquire is bypassed, the write records a request, and the action
      // returns before every effect that announces a booking.
      'app/dashboard/[eventId]/vendors/actions.ts',
    ],
    pureCores: [
      // Takes `enabled` as a PARAMETER — six surfaces derive their state from
      // it, so it must answer both worlds in one process. A gate that receives
      // the flag would redden property 2; this is the other bucket on purpose.
      'lib/lock-request-state.ts',
    ],
    // ⚠ `lib/lock-request-expiry.ts` is deliberately in NEITHER list: the sweep
    // does not read the flag at all. Gating it would strand every in-flight
    // request the moment the flag went back off — the pending indexes are DB
    // objects and keep holding their slot whatever the app believes.
    locals: ['handshakeAsk'],
  },
];

/** Strip comments — a docblock naming the helper must not read as a call. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ALL = ['app', 'lib'].flatMap((r) => walk(resolve(WEB, r)));
const isTest = (rel: string) => /\.test\.tsx?$/.test(rel);

for (const flag of FLAGS) {
  test(`${flag.env} — exactly one module reads the env var`, () => {
    const readers = ALL.map((f) => relative(WEB, f))
      // Tests legitimately set the var to drive both states.
      .filter((rel) => !isTest(rel))
      .filter((rel) =>
        new RegExp(`process\\.env\\.${flag.env}\\b`).test(code(readFileSync(resolve(WEB, rel), 'utf8'))),
      );
    assert.deepEqual(
      readers,
      [flag.helper],
      `${flag.env} must be read ONLY in ${flag.helper} — a second reader is a ` +
        `second default. Found: ${readers.join(', ') || 'none'}. (If the helper ` +
        `moved, update this registry entry; if a consumer started reading the ` +
        `env directly, route it through ${flag.fn}() instead.)`,
    );
  });

  test(`${flag.env} — every load-bearing gate still calls ${flag.fn}()`, () => {
    const dark: string[] = [];
    for (const gate of flag.gates) {
      const src = code(readFileSync(resolve(WEB, gate), 'utf8'));
      if (!new RegExp(`${flag.fn}\\s*\\(`).test(src)) dark.push(gate);
    }
    assert.deepEqual(
      dark,
      [],
      `These surfaces no longer ASK the flag, so it has stopped being a ` +
        `kill-switch for them — with the flag off they would still render the ` +
        `new behaviour:\n${dark.map((d) => `  • ${d}`).join('\n')}`,
    );
  });

  test(`${flag.env} — the pure cores take the flag, they don't read it`, () => {
    const leaked: string[] = [];
    for (const core of flag.pureCores) {
      const src = code(readFileSync(resolve(WEB, core), 'utf8'));
      if (new RegExp(`${flag.fn}\\s*\\(`).test(src)) leaked.push(core);
    }
    assert.deepEqual(
      leaked,
      [],
      `These modules are supposed to receive the flag as a parameter. Reading ` +
        `it directly means their unit tests can no longer drive both states in ` +
        `one run:\n${leaked.map((l) => `  • ${l}`).join('\n')}`,
    );
  });

  test(`${flag.env} — no consumer hardcodes the resolved flag`, () => {
    const hardcoded: string[] = [];
    for (const file of ALL) {
      const rel = relative(WEB, file);
      if (isTest(rel)) continue;
      const src = code(readFileSync(file, 'utf8'));
      if (!new RegExp(`${flag.fn}\\b`).test(src) && !flag.gates.includes(rel)) continue;
      for (const local of flag.locals) {
        // `const replan = true` / `= false` — the §5.3 bypass, in any file that
        // is supposed to be consulting the flag.
        const re = new RegExp(`(?:const|let|var)\\s+${local}\\s*(?::\\s*boolean\\s*)?=\\s*(?:true|false)\\b`);
        if (re.test(src)) hardcoded.push(`${rel} (${local})`);
      }
    }
    assert.deepEqual(
      hardcoded,
      [],
      `A flag local is pinned to a literal — the surface can no longer be ` +
        `turned off:\n${hardcoded.map((h) => `  • ${h}`).join('\n')}`,
    );
  });
}

test('the scan actually scanned something', () => {
  // A path or glob change that silently empties ALL would make every assertion
  // above pass vacuously.
  assert.ok(ALL.length > 500, `only ${ALL.length} files walked — the roots are wrong`);
  assert.ok(FLAGS.length > 0);
});
