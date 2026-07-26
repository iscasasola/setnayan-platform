/**
 * THE FREEZE — the exposure surface may not widen without a human saying so.
 *
 * Regenerates what `anon` and `authenticated` can reach from the FULL replayed
 * production schema (every migration, in order, into an in-memory PGlite) and
 * compares it to the committed baseline at
 * supabase/security/exposure-surface.baseline.txt.
 *
 *   WIDENING  → FAIL, with a message that names the object and explains why.
 *   NARROWING → PASS. Revoking access must never require ceremony, because a
 *               guard that punishes tightening gets deleted within a month.
 *
 * WHY: on 2026-07-26 seven production vulnerabilities were found in one day and
 * every one was the same mistake — the UI treated as the security boundary
 * while the database sits on the internet behind a public anon key. None of
 * them were caught by anything, because nothing anywhere wrote down what the
 * reachable surface actually was.
 *
 * ── ON NOT BEING A VACUOUS TEST ────────────────────────────────────────────
 * This repo has shipped vacuous DB tests twice: a connection that OWNS the
 * table skips RLS entirely, so an RLS assertion run as the owner passes no
 * matter what the policy says. Four defences here, all of them tests in their
 * own right rather than comments:
 *
 *   1. FLOORS — the collected surface must exceed SURFACE_FLOORS. A query that
 *      silently returns nothing can no longer look like a clean surface.
 *   2. BASELINE INTEGRITY — the committed file must exist, parse, be sorted,
 *      and match the fact count in its own header. A truncated or emptied
 *      baseline fails instead of trivially agreeing with everything.
 *   3. BEHAVIOURAL PROBE — the introspection is cross-checked by actually
 *      becoming `authenticated` (SET ROLE) and confirming that a privilege the
 *      surface says is absent really is refused, and one it says is present
 *      really is allowed. The probe asserts up front that the connected role is
 *      `authenticated`, is NOT the table owner, and has no BYPASSRLS.
 *   4. NEUTRALISATION — the differ is fed synthetic widenings and narrowings
 *      and must classify each correctly. Remove the guard logic and these fail.
 *
 * There is no skip path. PGlite is in-process, so "no database available" is
 * not a state this test can be in, and nothing here is wrapped in a try/catch
 * that could swallow a failure into a pass.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  collectSurface,
  renderBaseline,
  parseBaseline,
  declaredFactCount,
  diffSurface,
  sortFacts,
  formatWideningReport,
  BASELINE_PATH_FROM_REPO_ROOT,
  SURFACE_FLOORS,
  FACT_KINDS,
  type Fact,
} from './exposure-surface';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** apps/web/tests/db → repo root is four levels up. */
const REPO_ROOT = path.resolve(HERE, '../../../..');
const BASELINE_FILE = path.join(REPO_ROOT, BASELINE_PATH_FROM_REPO_ROOT);

let replay: ReplayResult;
let db: PGlite;
let current: Fact[];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  current = await collectSurface(db);
});

after(async () => {
  await db?.close();
});

/* ── 1. FLOORS ──────────────────────────────────────────────────────────────*/

test('meta: the collected surface is substantial, so an empty collection cannot pass', () => {
  const counts = new Map<string, number>();
  for (const f of current) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);

  for (const [kind, floor] of Object.entries(SURFACE_FLOORS)) {
    const n = counts.get(kind) ?? 0;
    assert.ok(
      n >= floor,
      `collected only ${n} "${kind}" facts, below the floor of ${floor}. The surface ` +
        `collector is broken or a catalog query returned nothing — do NOT lower the ` +
        `floor to make this pass, and do NOT regenerate the baseline from this run.`,
    );
  }
});

/* ── 2. BASELINE INTEGRITY ──────────────────────────────────────────────────*/

test('meta: the committed baseline exists, parses, is sorted, and is not truncated', () => {
  assert.ok(
    fs.existsSync(BASELINE_FILE),
    `${BASELINE_PATH_FROM_REPO_ROOT} is missing. Generate it with ` +
      `\`pnpm --filter @setnayan/web exposure:baseline\` and commit it — without the ` +
      `baseline this guard has nothing to compare against.`,
  );

  const text = fs.readFileSync(BASELINE_FILE, 'utf8');
  const parsed = parseBaseline(text); // throws on a malformed line — deliberately not caught

  const declared = declaredFactCount(text);
  assert.notEqual(declared, null, 'baseline header is missing its `# facts: N` line');
  assert.equal(
    parsed.length,
    declared,
    `baseline says it holds ${declared} facts but ${parsed.length} were parsed. The file ` +
      `has been truncated or hand-edited; regenerate it rather than patching it.`,
  );

  // Sorted + unique: the whole point is that a diff is meaningful, and an
  // unsorted file produces churn that trains reviewers to ignore it.
  const rendered = renderBaseline(parsed);
  assert.equal(
    rendered,
    text,
    'baseline is not in canonical order (or was hand-edited). Regenerate with ' +
      '`pnpm --filter @setnayan/web exposure:baseline`.',
  );

  const keys = new Set(parsed.map((f) => `${f.kind} ${f.key}`));
  assert.equal(keys.size, parsed.length, 'baseline contains duplicate fact keys');
});

/* ── 3. BEHAVIOURAL PROBE ───────────────────────────────────────────────────*/

test('meta: a real unprivileged role behaves as the declared surface says', async () => {
  // Pick probe subjects OUT OF the collected surface rather than hardcoding
  // them, so this keeps working as the schema changes.
  const colFacts = current.filter((f) => f.kind === 'col');
  const readable = colFacts.find((f) => /authenticated=S/.test(f.value));
  assert.ok(readable, 'no authenticated-readable column found — the collector is broken');

  const withheld = await db.query<{ relname: string; attname: string }>(`
    SELECT c.relname, a.attname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND a.attnum > 0 AND NOT a.attisdropped
       AND NOT has_column_privilege('authenticated', c.oid, a.attname, 'SELECT')
     ORDER BY c.relname, a.attname
     LIMIT 1
  `);
  assert.equal(
    withheld.rows.length,
    1,
    'no column is withheld from `authenticated` anywhere in the schema — that is ' +
      'itself the finding, but it also means this probe cannot verify a denial.',
  );
  const denied = withheld.rows[0]!;

  await db.exec('SET ROLE authenticated');
  try {
    // The house rule: prove we are NOT the owner and NOT privileged, or every
    // assertion below is worthless.
    const who = await db.query<{ me: string; su: boolean; bypass: boolean }>(
      `SELECT current_user AS me,
              (SELECT rolsuper      FROM pg_roles WHERE rolname = current_user) AS su,
              (SELECT rolbypassrls  FROM pg_roles WHERE rolname = current_user) AS bypass`,
    );
    assert.equal(who.rows[0]!.me, 'authenticated', 'SET ROLE did not take effect');
    assert.equal(who.rows[0]!.su, false, 'probe role is a superuser — it would bypass all checks');
    assert.equal(who.rows[0]!.bypass, false, 'probe role has BYPASSRLS — the probe would be vacuous');

    const owner = await db.query<{ owner: string }>(
      `SELECT pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [denied.relname],
    );
    assert.notEqual(
      owner.rows[0]!.owner,
      'authenticated',
      'probe role owns the probe table — owners skip RLS and column checks',
    );

    // (a) a column the surface says is WITHHELD must actually be refused.
    await assert.rejects(
      db.query(`SELECT "${denied.attname}" FROM public."${denied.relname}" LIMIT 1`),
      (e: unknown) =>
        /permission denied/i.test(e instanceof Error ? e.message : String(e)),
      `the surface says authenticated cannot SELECT ${denied.relname}.${denied.attname}, ` +
        `but the database allowed it — introspection and reality disagree`,
    );

    // (b) a column the surface says is READABLE must not be refused. RLS may
    //     still return zero rows; that is fine and expected.
    const [, tbl, colName] = /^public\.([^.]+)\.(.+)$/.exec(readable.key)!;
    await db.query(`SELECT "${colName}" FROM public."${tbl}" LIMIT 1`);
  } finally {
    await db.exec('RESET ROLE');
  }
});

/* ── 4. NEUTRALISATION ──────────────────────────────────────────────────────*/

test('meta: the differ fails widenings and passes narrowings (neutralisation proof)', () => {
  const base: Fact[] = sortFacts([
    { kind: 'tpriv', key: 'public.secrets|anon', value: 'S' },
    { kind: 'col', key: 'public.users.email', value: 'anon=- authenticated=S' },
    { kind: 'policy', key: 'public.t|p_sel', value: 'mode=PERMISSIVE cmd=SELECT roles=authenticated using=(user_id = auth.uid()) check=NULL' },
    { kind: 'policy', key: 'public.t|p_guard', value: 'mode=RESTRICTIVE cmd=ALL roles=authenticated using=is_admin() check=NULL' },
    { kind: 'view', key: 'public.v', value: 'type=view owner=postgres honours_rls=yes select=anon' },
    { kind: 'func', key: 'public.f()', value: 'secdef=yes exec=authenticated search_path=public' },
    { kind: 'rlsforce', key: 'public.t', value: 'FORCED' },
  ]);

  const widenings: Array<[string, Fact[]]> = [
    ['RLS switched off on a table', [...base, { kind: 'rls', key: 'public.t', value: 'DISABLED' }]],
    ['FORCE ROW LEVEL SECURITY removed', base.filter((f) => f.kind !== 'rlsforce')],
    ['table gained a privilege', swap(base, 'tpriv', 'public.secrets|anon', 'SIUD')],
    ['a new table became reachable', [...base, { kind: 'tpriv', key: 'public.brand_new|anon', value: 'S' }]],
    ['a withheld column became anon-readable', swap(base, 'col', 'public.users.email', 'anon=S authenticated=S')],
    ['a new exposed column appeared', [...base, { kind: 'col', key: 'public.users.tin', value: 'anon=S authenticated=S' }]],
    ['a policy predicate became `true`', swap(base, 'policy', 'public.t|p_sel', 'mode=PERMISSIVE cmd=SELECT roles=authenticated using=true check=NULL')],
    ['a policy predicate changed at all', swap(base, 'policy', 'public.t|p_sel', 'mode=PERMISSIVE cmd=SELECT roles=authenticated using=(1 = 1) check=NULL')],
    ['a policy gained the anon role', swap(base, 'policy', 'public.t|p_sel', 'mode=PERMISSIVE cmd=SELECT roles=anon,authenticated using=(user_id = auth.uid()) check=NULL')],
    ['a policy command broadened to ALL', swap(base, 'policy', 'public.t|p_sel', 'mode=PERMISSIVE cmd=ALL roles=authenticated using=(user_id = auth.uid()) check=NULL')],
    ['a new PERMISSIVE policy appeared', [...base, { kind: 'policy', key: 'public.t|p_extra', value: 'mode=PERMISSIVE cmd=SELECT roles=anon using=true check=NULL' }]],
    ['a RESTRICTIVE policy was dropped', base.filter((f) => f.key !== 'public.t|p_guard')],
    ['a view stopped honouring RLS', swap(base, 'view', 'public.v', 'type=view owner=postgres honours_rls=NO select=anon')],
    ['a view gained a reader', swap(base, 'view', 'public.v', 'type=view owner=postgres honours_rls=yes select=anon,authenticated')],
    ['a function became anon-callable', swap(base, 'func', 'public.f()', 'secdef=yes exec=anon,authenticated search_path=public')],
    ['a new SECURITY DEFINER RPC appeared', [...base, { kind: 'func', key: 'public.g(uuid)', value: 'secdef=yes exec=anon search_path=public' }]],
    ['a definer function lost its pinned search_path', swap(base, 'func', 'public.f()', 'secdef=yes exec=authenticated search_path=UNPINNED')],
  ];

  for (const [label, mutated] of widenings) {
    const deltas = diffSurface(base, sortFacts(mutated));
    const w = deltas.filter((d) => d.verdict === 'WIDENING');
    assert.ok(w.length > 0, `differ MISSED a widening: ${label}`);
    assert.ok(w.every((d) => d.why.length > 20), `widening "${label}" produced no useful explanation`);
  }

  // A narrowing is `before` → `after`. Most are expressed as a mutation of the
  // clean base; the two "reversal" cases start from an ALREADY-LOOSE surface
  // and tighten back to the clean base, which is the shape a real fix takes.
  const loosePolicy = swap(base, 'policy', 'public.t|p_sel', 'mode=PERMISSIVE cmd=SELECT roles=authenticated using=true check=NULL');
  const looseView = swap(base, 'view', 'public.v', 'type=view owner=postgres honours_rls=NO select=anon');

  const narrowings: Array<[label: string, before: Fact[], after: Fact[]]> = [
    ['a grant was partially revoked', swap(base, 'tpriv', 'public.secrets|anon', 'SIUD'), base],
    ['a table left the surface entirely', base, base.filter((f) => f.key !== 'public.secrets|anon')],
    ['a column was withheld', base, swap(base, 'col', 'public.users.email', 'anon=- authenticated=-')],
    ['a PERMISSIVE policy was dropped', base, base.filter((f) => f.key !== 'public.t|p_sel')],
    ['a RESTRICTIVE policy was added', base, [...base, { kind: 'policy', key: 'public.t|p_guard2', value: 'mode=RESTRICTIVE cmd=ALL roles=authenticated using=is_admin() check=NULL' }]],
    ['a predicate stopped being `true`', loosePolicy, base],
    ['a view started honouring RLS again', looseView, base],
    ['a function stopped being callable', base, base.filter((f) => f.key !== 'public.f()')],
    ['FORCE ROW LEVEL SECURITY was added', base, [...base, { kind: 'rlsforce', key: 'public.other', value: 'FORCED' }]],
  ];

  for (const [label, from, to] of narrowings) {
    const deltas = diffSurface(sortFacts(from), sortFacts(to));
    const w = deltas.filter((d) => d.verdict === 'WIDENING');
    assert.equal(
      w.length,
      0,
      `differ WRONGLY failed a narrowing: ${label}\n  ${w.map((d) => `${d.kind} ${d.key}: ${d.why}`).join('\n  ')}`,
    );
    assert.ok(
      deltas.some((d) => d.verdict === 'NARROWING'),
      `differ did not even notice the narrowing: ${label}`,
    );
  }
});

function swap(facts: Fact[], kind: string, key: string, value: string): Fact[] {
  return facts.map((f) => (f.kind === kind && f.key === key ? { ...f, value } : f));
}

/* ── 5. THE FREEZE ITSELF ───────────────────────────────────────────────────*/

test('THE FREEZE: the exposure surface has not widened against the committed baseline', () => {
  const baseline = parseBaseline(fs.readFileSync(BASELINE_FILE, 'utf8'));

  // Guard against comparing nothing to nothing.
  assert.ok(baseline.length > 1000, `baseline holds only ${baseline.length} facts — it looks empty or truncated`);
  assert.ok(current.length > 1000, `collected only ${current.length} facts — collection looks broken`);

  const deltas = diffSurface(baseline, current);
  const widenings = deltas.filter((d) => d.verdict === 'WIDENING');
  const narrowings = deltas.filter((d) => d.verdict === 'NARROWING');

  if (widenings.length > 0) {
    assert.fail(formatWideningReport(widenings, narrowings));
  }

  if (narrowings.length > 0) {
    // Deliberately NOT a failure. Say so loudly, then move on.
    console.log(
      `\n  ✓ exposure surface NARROWED by ${narrowings.length} fact(s) — allowed, no action required.\n` +
        narrowings.slice(0, 40).map((d) => `      · ${d.kind} ${d.key} — ${d.why}`).join('\n') +
        (narrowings.length > 40 ? `\n      … and ${narrowings.length - 40} more` : '') +
        `\n    Refresh the baseline at your convenience:\n` +
        `      pnpm --filter @setnayan/web exposure:baseline\n`,
    );
  }
});

test('meta: every fact kind is actually represented or explicitly expected to be empty', () => {
  const present = new Set(current.map((f) => f.kind));
  // These two are emitted only when something is WRONG (rls off) or unusually
  // strong (force rls). Both are legitimately empty today.
  const mayBeEmpty = new Set(['rls', 'rlsforce']);
  for (const kind of FACT_KINDS) {
    if (mayBeEmpty.has(kind)) continue;
    assert.ok(present.has(kind), `fact kind "${kind}" collected nothing — its query is broken`);
  }
});
