/**
 * EXPOSURE SURFACE — what `anon` and `authenticated` can reach in the database.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Supabase publishes every table in `public` as a REST endpoint and the anon
 * key ships in the page source by design. The database is therefore ON THE
 * INTERNET, and the UI is not a security boundary. In one day (2026-07-26)
 * seven separate production vulnerabilities were found that were all the same
 * mistake — a value or an object that the UI never showed, but the REST API
 * happily served or accepted.
 *
 * The recurring reason nobody caught them earlier is simple: NOBODY KNEW WHAT
 * THE SURFACE WAS. A new table ships with Supabase's stock
 * `GRANT ALL ... TO anon, authenticated`, or a policy is loosened to `USING
 * (true)` while debugging and never tightened, and no test, lint or review
 * step anywhere notices.
 *
 * This module turns that surface into a FILE. Every capability a low-trust
 * principal holds becomes one sorted, deterministic line. The file is
 * committed. A test regenerates it and diffs. Widening fails the build;
 * narrowing does not.
 *
 * WHAT COUNTS AS THE SURFACE
 * ──────────────────────────
 *   schema     USAGE on a schema (without it, nothing else in it is reachable)
 *   rls        a table in `public` with RLS switched OFF
 *   rlsforce   a table with FORCE ROW LEVEL SECURITY on (protection, not risk)
 *   tpriv      table-level SELECT/INSERT/UPDATE/DELETE held by anon/authenticated
 *   col        per-column SELECT/INSERT/UPDATE — RLS is ROW-level and can NEVER
 *              hide a column, so this is the only place column risk is visible
 *   policy     every policy's command, permissive/restrictive, roles, and its
 *              FULL `USING` / `WITH CHECK` predicate — the predicate is the
 *              thing that gets loosened, so it is stored verbatim, not hashed.
 *              Covers `public` AND `storage` (our migrations write bucket
 *              policies too); see POLICY_SCHEMAS
 *   view       views + materialized views reachable by anon/authenticated, and
 *              whether they honour the caller's RLS (`security_invoker`)
 *   func       functions anon/authenticated may EXECUTE, whether they are
 *              SECURITY DEFINER, and whether their search_path is pinned
 *
 * DETERMINISM IS THE WHOLE PRODUCT. Everything is sorted; nothing carries a
 * timestamp, an OID, or a row count. Two runs against the same schema produce
 * byte-identical output, so any diff a reviewer sees is a real change.
 */

/** Single source of truth for where the committed baseline lives. */
export const BASELINE_PATH_FROM_REPO_ROOT = 'supabase/security/exposure-surface.baseline.txt';

/**
 * Floors that make an empty or half-collected surface impossible to mistake
 * for a clean one. If a query silently returns nothing — a renamed catalog
 * column, a swallowed error, a truncated baseline file — these trip instead of
 * the suite going green on a comparison of nothing against nothing.
 *
 * Set well below the real numbers (measured 2026-07-26: 368 tables,
 * 4,482 columns, 813 policies, 218 callable functions) so ordinary growth or a
 * deliberate lockdown never trips them. They are a floor, not a target.
 */
export const SURFACE_FLOORS: Readonly<Record<string, number>> = {
  tpriv: 400,
  col: 3000,
  policy: 500,
  func: 100,
} as const;

/** Minimal shape shared by PGlite and node-postgres. */
export interface Queryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

/** The two principals a browser can act as. Ordered — never re-sort. */
export const LOW_TRUST_ROLES = ['anon', 'authenticated'] as const;

export type FactKind =
  | 'schema'
  | 'rls'
  | 'rlsforce'
  | 'tpriv'
  | 'col'
  | 'policy'
  | 'view'
  | 'func';

/** Kinds in the order they appear in the baseline file. */
export const FACT_KINDS: readonly FactKind[] = [
  'schema',
  'rls',
  'rlsforce',
  'tpriv',
  'col',
  'policy',
  'view',
  'func',
] as const;

export type Fact = {
  kind: FactKind;
  /** Unique within a kind. Sorted on. */
  key: string;
  /** Everything else about the fact, in a stable rendering. */
  value: string;
};

export type Verdict = 'WIDENING' | 'NARROWING' | 'NEUTRAL';

export type Delta = {
  kind: FactKind;
  key: string;
  before: string | null;
  after: string | null;
  verdict: Verdict;
  /** Plain-English reason, shown in the failure message. */
  why: string;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Collection
 * ──────────────────────────────────────────────────────────────────────────*/

const PRIV_LETTER: Record<string, string> = {
  SELECT: 'S',
  INSERT: 'I',
  UPDATE: 'U',
  DELETE: 'D',
};

/**
 * Objects the replay harness itself creates, which do not exist in prod. Kept
 * out of the surface so the baseline describes the PRODUCT, not the test rig.
 * Anything added here must be provably a harness artifact — never use this to
 * silence a real table.
 */
const HARNESS_ARTIFACTS = new Set(['_replay_migrations']);

/**
 * Functions the replay harness shims in because PGlite lacks the extension
 * prod has. `gen_random_bytes` is a public wrapper over
 * extensions.gen_random_bytes that only exists so early migrations calling it
 * unqualified can apply; prod resolves it through pgcrypto instead.
 */
const HARNESS_FUNCTIONS = new Set(['gen_random_bytes']);

/** SQL fragment excluding harness artifacts from a query over pg_class. */
const NOT_HARNESS = `c.relname NOT IN (${[...HARNESS_ARTIFACTS].map((t) => `'${t}'`).join(',')})`;

/** SQL fragment excluding harness shims from a query over pg_proc. */
const NOT_HARNESS_FN = `p.proname NOT IN (${[...HARNESS_FUNCTIONS].map((f) => `'${f}'`).join(',')})`;

/**
 * Schemas whose POLICIES are ours to guard.
 *
 * `public` is the product. `storage` is included because our own migrations
 * write RLS policies on storage.objects (the moodboard-library bucket), and a
 * bucket policy relaxed to `USING (true)` is the same bug as a table policy
 * relaxed to `USING (true)`.
 *
 * Deliberately NOT extended to grants/RLS on storage: storage.objects itself is
 * Supabase-platform-managed and the replay harness stubs a simplified version of
 * it, so its table/column privileges here would be fiction. Policies written by
 * our migrations replay faithfully; the platform's own table does not.
 * `realtime` and `cron` policies are platform-managed too and are out of scope.
 */
const POLICY_SCHEMAS = ['public', 'storage'] as const;

/** `r`/`a`/`w`/`d`/`*` as stored in pg_policy.polcmd. */
const POLCMD: Record<string, string> = {
  r: 'SELECT',
  a: 'INSERT',
  w: 'UPDATE',
  d: 'DELETE',
  '*': 'ALL',
};

/**
 * Read the live exposure surface out of the system catalogs.
 *
 * NOTE ON THE CONNECTED ROLE: this function deliberately runs as the schema
 * owner. It is an INTROSPECTION pass — it reads what privileges are DECLARED,
 * it does not try to exercise them. That is the opposite of an RLS behaviour
 * test, where connecting as the owner silently bypasses the thing under test
 * and produces a vacuous pass. That gap is closed in exposure-freeze.db.test.ts
 * by the "a real unprivileged role behaves as the declared surface says" test,
 * which SET ROLEs to `authenticated` — after asserting it is not the table
 * owner, not a superuser, and has no BYPASSRLS — and checks that a privilege
 * this collector reports as absent is genuinely refused.
 */
export async function collectSurface(db: Queryable): Promise<Fact[]> {
  const facts: Fact[] = [];
  const roleList = LOW_TRUST_ROLES.join("','");

  /* ── schema USAGE ───────────────────────────────────────────────────────*/
  const schemas = await db.query<{ nspname: string; roles: string }>(`
    SELECT n.nspname,
           (SELECT string_agg(r, ',' ORDER BY r)
              FROM unnest(ARRAY['${roleList}']) AS r
             WHERE has_schema_privilege(r, n.nspname, 'USAGE')) AS roles
      FROM pg_namespace n
     WHERE n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema'
     ORDER BY n.nspname
  `);
  for (const s of schemas.rows) {
    if (s.roles) facts.push({ kind: 'schema', key: s.nspname, value: `usage=${s.roles}` });
  }

  /* ── tables: RLS state ──────────────────────────────────────────────────*/
  const tables = await db.query<{
    relname: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND ${NOT_HARNESS}
     ORDER BY c.relname
  `);
  for (const t of tables.rows) {
    // Sparse by design: a table WITH RLS emits nothing, so the common case is
    // silent. A table that has RLS off — new or newly disabled — appears as an
    // added line, which the differ reads as a widening.
    if (!t.relrowsecurity) {
      facts.push({ kind: 'rls', key: `public.${t.relname}`, value: 'DISABLED' });
    }
    // Mirror image: FORCE is a protection, so it is emitted when PRESENT and
    // its disappearance is the widening.
    if (t.relforcerowsecurity) {
      facts.push({ kind: 'rlsforce', key: `public.${t.relname}`, value: 'FORCED' });
    }
  }

  /* ── table-level privileges ─────────────────────────────────────────────*/
  const tprivs = await db.query<{ relname: string; role: string; privs: string | null }>(`
    SELECT c.relname, r AS role,
           (SELECT string_agg(p, ',' ORDER BY ord)
              FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) WITH ORDINALITY AS u(p, ord)
             WHERE has_table_privilege(r, c.oid, p)) AS privs
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN unnest(ARRAY['${roleList}']) AS r
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND ${NOT_HARNESS}
     ORDER BY c.relname, r
  `);
  for (const p of tprivs.rows) {
    if (!p.privs) continue; // no privilege at all → no line
    const letters = p.privs
      .split(',')
      .map((w) => PRIV_LETTER[w.trim()] ?? '')
      .join('');
    facts.push({
      kind: 'tpriv',
      key: `public.${p.relname}|${p.role}`,
      value: compactPrivs(letters),
    });
  }

  /* ── column-level privileges ────────────────────────────────────────────
   * The SEC-2b lens. RLS is row-level; it cannot hide a column. A table that
   * mixes `master_qr_token` with `venue_name` is structurally leaky no matter
   * how good its policy is, and the ONLY way to see that in review is to have
   * the per-column privileges written down.
   *
   * has_column_privilege() returns the EFFECTIVE privilege — it already folds
   * in table-level grants — so a column with no column-grant of its own still
   * reports true when the table grant covers it. That is what we want: the
   * question is "can they read it", not "how was it granted".                */
  const cols = await db.query<{
    relname: string;
    attname: string;
    anon: string | null;
    authenticated: string | null;
  }>(`
    SELECT c.relname, a.attname,
           ${LOW_TRUST_ROLES.map(
             (role) => `(SELECT string_agg(p, ',' ORDER BY ord)
              FROM unnest(ARRAY['SELECT','INSERT','UPDATE']) WITH ORDINALITY AS u(p, ord)
             WHERE has_column_privilege('${role}', c.oid, a.attname, p)) AS ${role}`,
           ).join(',\n           ')}
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND ${NOT_HARNESS}
       AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY c.relname, a.attname
  `);
  for (const c of cols.rows) {
    const parts = LOW_TRUST_ROLES.map((role) => {
      const raw = (c as unknown as Record<string, string | null>)[role];
      const letters = raw
        ? raw
            .split(',')
            .map((w) => PRIV_LETTER[w.trim()] ?? '')
            .join('')
        : '';
      return `${role}=${compactPrivs(letters) || '-'}`;
    });
    // Sparse: a column no low-trust role can touch emits nothing.
    if (parts.every((p) => p.endsWith('=-'))) continue;
    facts.push({
      kind: 'col',
      key: `public.${c.relname}.${c.attname}`,
      value: parts.join(' '),
    });
  }

  /* ── policies ───────────────────────────────────────────────────────────
   * The predicate is stored VERBATIM. A policy quietly relaxed from
   * `event_id IN current_event_ids()` to `true` changes no grant, no command
   * and no role — the predicate text is the only place that shows up.        */
  const policies = await db.query<{
    nspname: string;
    relname: string;
    polname: string;
    cmd: string;
    permissive: boolean;
    roles: string | null;
    qual: string | null;
    withcheck: string | null;
  }>(`
    SELECT n.nspname, c.relname, p.polname, p.polcmd::text AS cmd, p.polpermissive AS permissive,
           (SELECT string_agg(ro.rolname, ',' ORDER BY ro.rolname)
              FROM pg_roles ro WHERE ro.oid = ANY (p.polroles)) AS roles,
           pg_get_expr(p.polqual, p.polrelid)       AS qual,
           pg_get_expr(p.polwithcheck, p.polrelid)  AS withcheck
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN (${POLICY_SCHEMAS.map((s) => `'${s}'`).join(',')}) AND ${NOT_HARNESS}
     ORDER BY n.nspname, c.relname, p.polname
  `);
  for (const p of policies.rows) {
    // polroles = {0} means PUBLIC — which INCLUDES anon. The string_agg finds
    // no matching pg_roles row for oid 0, so NULL here means PUBLIC.
    const roles = p.roles ?? 'PUBLIC';
    facts.push({
      kind: 'policy',
      key: `${p.nspname}.${p.relname}|${p.polname}`,
      value: [
        `mode=${p.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'}`,
        `cmd=${POLCMD[p.cmd] ?? p.cmd}`,
        `roles=${roles}`,
        `using=${normalizeExpr(p.qual)}`,
        `check=${normalizeExpr(p.withcheck)}`,
      ].join(' '),
    });
  }

  /* ── views + materialized views ─────────────────────────────────────────
   * A view owned by a superuser with security_invoker=false runs as its owner
   * and therefore bypasses RLS on every base table it touches. Materialized
   * views have no security_invoker option AT ALL — they can never honour the
   * caller's RLS. Both facts are recorded so a reviewer sees them.           */
  const views = await db.query<{
    relname: string;
    relkind: string;
    owner: string;
    reloptions: string[] | null;
    grantees: string | null;
  }>(`
    SELECT c.relname, c.relkind::text AS relkind, pg_get_userbyid(c.relowner) AS owner,
           c.reloptions,
           (SELECT string_agg(r, ',' ORDER BY r)
              FROM unnest(ARRAY['${roleList}']) AS r
             WHERE has_table_privilege(r, c.oid, 'SELECT')) AS grantees
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
     ORDER BY c.relname
  `);
  for (const v of views.rows) {
    if (!v.grantees) continue; // unreachable by a browser → not on the surface
    const invoker = (v.reloptions ?? []).some(
      (o) => o.toLowerCase() === 'security_invoker=true' || o.toLowerCase() === 'security_invoker=on',
    );
    const honoursRls = v.relkind === 'm' ? false : invoker;
    facts.push({
      kind: 'view',
      key: `public.${v.relname}`,
      value: [
        `type=${v.relkind === 'm' ? 'matview' : 'view'}`,
        `owner=${v.owner}`,
        // The single most important bit: does a read through this object apply
        // the caller's RLS, or the owner's (i.e. none)?
        `honours_rls=${honoursRls ? 'yes' : 'NO'}`,
        `select=${v.grantees}`,
      ].join(' '),
    });
  }

  /* ── functions executable by a browser ──────────────────────────────────
   * PostgREST exposes every one of these at /rest/v1/rpc/<name>, so "the web
   * route validates it first" is not a control — the route can be skipped.
   * Trigger-returning functions are excluded: they are not directly callable. */
  const funcs = await db.query<{
    sig: string;
    secdef: boolean;
    proconfig: string[] | null;
    execs: string | null;
  }>(`
    SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig,
           p.prosecdef AS secdef,
           p.proconfig,
           (SELECT string_agg(r, ',' ORDER BY r)
              FROM unnest(ARRAY['${roleList}']) AS r
             WHERE has_function_privilege(r, p.oid, 'EXECUTE')) AS execs
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prorettype <> 'pg_catalog.trigger'::regtype
       AND ${NOT_HARNESS_FN}
     ORDER BY 1
  `);
  for (const f of funcs.rows) {
    if (!f.execs) continue; // no browser can call it → not on the surface
    const sp = (f.proconfig ?? []).find((c) => c.toLowerCase().startsWith('search_path='));
    facts.push({
      kind: 'func',
      key: f.sig,
      value: [
        `secdef=${f.secdef ? 'yes' : 'no'}`,
        `exec=${f.execs}`,
        // Only meaningful for SECURITY DEFINER; recorded for all so the pinned
        // → unpinned transition is always visible.
        `search_path=${sp ? sp.slice('search_path='.length) : 'UNPINNED'}`,
      ].join(' '),
    });
  }

  return sortFacts(facts);
}

/** `SIUD` in a fixed order, so the string is a comparable set. */
function compactPrivs(letters: string): string {
  return ['S', 'I', 'U', 'D'].filter((l) => letters.includes(l)).join('');
}

/**
 * Collapse whitespace inside a policy predicate. pg_get_expr already emits a
 * canonical form, but it wraps long expressions across lines; a fact must be
 * exactly one line.
 */
function normalizeExpr(expr: string | null): string {
  if (expr === null || expr === undefined) return 'NULL';
  return expr.replace(/\s+/g, ' ').trim();
}

export function sortFacts(facts: Fact[]): Fact[] {
  const kindRank = new Map(FACT_KINDS.map((k, i) => [k, i]));
  return [...facts].sort((a, b) => {
    const ka = kindRank.get(a.kind) ?? 99;
    const kb = kindRank.get(b.kind) ?? 99;
    if (ka !== kb) return ka - kb;
    // Locale-independent: the baseline must sort identically on every machine.
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Rendering + parsing
 * ──────────────────────────────────────────────────────────────────────────*/

export const BASELINE_HEADER_PREFIX = '#';

/**
 * One fact per line, TAB-separated: `kind <TAB> key <TAB> value`.
 *
 * Line-oriented on purpose. A reviewer looking at a PR diff should be able to
 * read the change directly — "+col public.vendor_profiles.tin_number
 * anon=SIU" is a sentence, not a JSON hunk.
 */
export function renderBaseline(facts: Fact[]): string {
  const sorted = sortFacts(facts);
  const counts = new Map<FactKind, number>();
  for (const f of sorted) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);

  const header = [
    '# SETNAYAN EXPOSURE SURFACE — GENERATED FILE, DO NOT HAND-EDIT',
    '#',
    '# Every line is one capability held by `anon` or `authenticated` — the two',
    '# principals any browser can act as, because the Supabase anon key is public',
    '# by design. Regenerate with:',
    '#',
    '#   pnpm --filter @setnayan/web exposure:baseline',
    '#',
    '# See README.md next to this file before changing it. Adding lines is a',
    '# WIDENING and fails CI; removing lines is a NARROWING and does not.',
    '#',
    `# facts: ${sorted.length}`,
    ...FACT_KINDS.map((k) => `#   ${k.padEnd(9)} ${counts.get(k) ?? 0}`),
    '#',
  ].join('\n');

  const body = sorted.map((f) => `${f.kind}\t${f.key}\t${f.value}`).join('\n');
  return `${header}\n${body}\n`;
}

export function parseBaseline(text: string): Fact[] {
  const facts: Fact[] = [];
  const kinds = new Set<string>(FACT_KINDS);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith(BASELINE_HEADER_PREFIX) || line.trim() === '') continue;
    const parts = line.split('\t');
    if (parts.length < 3) {
      throw new Error(
        `exposure baseline is malformed at line ${i + 1}: expected 3 tab-separated fields, got ${parts.length}\n  ${line}`,
      );
    }
    const [kind, key, ...rest] = parts as [string, string, ...string[]];
    if (!kinds.has(kind)) {
      throw new Error(`exposure baseline has unknown fact kind "${kind}" at line ${i + 1}`);
    }
    facts.push({ kind: kind as FactKind, key, value: rest.join('\t') });
  }
  return facts;
}

/** The declared fact count from the header — used to detect truncation. */
export function declaredFactCount(text: string): number | null {
  const m = /^#\s*facts:\s*(\d+)\s*$/m.exec(text);
  return m ? Number(m[1]) : null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The asymmetric differ
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * WHY THE ASYMMETRY IS DELIBERATE
 * ───────────────────────────────
 * A guard that punishes tightening gets disabled within a month. If revoking
 * a grant made CI red, the next engineer in a hurry deletes the job — and then
 * the guard protects nothing at all. So:
 *
 *   WIDENING  → FAIL. A new grant, a newly exposed column, RLS switched off, a
 *               new anon-callable SECURITY DEFINER function, a view that stops
 *               honouring RLS, a new permissive policy, a dropped restrictive
 *               one. These are the seven-findings shapes.
 *
 *   NARROWING → PASS, and reported so the author can refresh the baseline at
 *               leisure. Revoking must never require ceremony.
 *
 * ONE HONEST EXCEPTION. A policy PREDICATE that changes from one non-trivial
 * expression to another cannot be mechanically proven to narrow — deciding
 * whether `a AND b` implies `a OR c` is not something a diff can do. Those are
 * reported as WIDENING so a human looks. The two cases we CAN decide are
 * decided: a predicate becoming `true` is always a widening, and a predicate
 * that stops being `true` is always a narrowing.
 */
export function diffSurface(baseline: Fact[], current: Fact[]): Delta[] {
  const idx = (fs: Fact[]) => {
    const m = new Map<string, Fact>();
    for (const f of fs) m.set(`${f.kind} ${f.key}`, f);
    return m;
  };
  const before = idx(baseline);
  const after = idx(current);

  const deltas: Delta[] = [];
  const allKeys = new Set([...before.keys(), ...after.keys()]);

  for (const k of [...allKeys].sort()) {
    const b = before.get(k);
    const a = after.get(k);
    if (b && a && b.value === a.value) continue;

    const kind = (a ?? b)!.kind;
    const key = (a ?? b)!.key;
    const { verdict, why } = classify(kind, b?.value, a?.value);
    if (verdict === 'NEUTRAL') continue;
    deltas.push({ kind, key, before: b?.value ?? null, after: a?.value ?? null, verdict, why });
  }

  // Widenings first — they are what fails the build.
  const rank = { WIDENING: 0, NARROWING: 1, NEUTRAL: 2 } as const;
  return deltas.sort(
    (x, y) => rank[x.verdict] - rank[y.verdict] || x.kind.localeCompare(y.kind) || x.key.localeCompare(y.key),
  );
}

function classify(
  kind: FactKind,
  before: string | undefined,
  after: string | undefined,
): { verdict: Verdict; why: string } {
  switch (kind) {
    /* Presence == exposure. Appearing is bad. */
    case 'rls':
      return before === undefined
        ? {
            verdict: 'WIDENING',
            why: 'Row Level Security is OFF on this table. Every row is readable and writable by anyone holding the public anon key.',
          }
        : { verdict: 'NARROWING', why: 'Row Level Security was enabled on this table.' };

    /* Presence == protection. Disappearing is bad. */
    case 'rlsforce':
      return after === undefined
        ? {
            verdict: 'WIDENING',
            why: 'FORCE ROW LEVEL SECURITY was removed. The table owner — and every SECURITY DEFINER function owned by it — now bypasses RLS on this table again.',
          }
        : { verdict: 'NARROWING', why: 'FORCE ROW LEVEL SECURITY was enabled.' };

    case 'schema':
      return setDelta(
        parseKv(before)['usage'],
        parseKv(after)['usage'],
        'schema USAGE',
        'A role that can USE a schema can reach every object in it that grants it privileges.',
      );

    case 'tpriv':
      return setDelta(
        before,
        after,
        'table privileges',
        'Table privileges are the ONLY defence in depth behind RLS. One wrong policy on a fully-granted table exposes the whole table.',
        { letters: true },
      );

    case 'col': {
      const b = parseKv(before);
      const a = parseKv(after);
      const reasons: string[] = [];
      for (const role of LOW_TRUST_ROLES) {
        const d = setDelta(
          b[role] === '-' ? undefined : b[role],
          a[role] === '-' ? undefined : a[role],
          `${role} column privileges`,
          '',
          { letters: true },
        );
        if (d.verdict === 'WIDENING') reasons.push(`${role}: ${d.why}`);
      }
      if (reasons.length > 0) {
        return {
          verdict: 'WIDENING',
          why: `${reasons.join('; ')} — RLS is ROW-level and can never hide a column, so an exposed column on a readable table is exposed to everyone the row policy admits.`,
        };
      }
      return { verdict: 'NARROWING', why: 'Column privileges were reduced.' };
    }

    case 'policy': {
      const b = parseKv(before);
      const a = parseKv(after);

      if (before === undefined) {
        return a['mode'] === 'PERMISSIVE'
          ? {
              verdict: 'WIDENING',
              why: 'A new PERMISSIVE policy was added. Permissive policies are OR-ed together, so each one can only ever admit MORE rows.',
            }
          : { verdict: 'NARROWING', why: 'A new RESTRICTIVE policy was added (AND-ed — it can only remove rows).' };
      }
      if (after === undefined) {
        return b['mode'] === 'RESTRICTIVE'
          ? {
              verdict: 'WIDENING',
              why: 'A RESTRICTIVE policy was dropped. Restrictive policies are AND-ed gates; removing one admits every row it was blocking.',
            }
          : { verdict: 'NARROWING', why: 'A PERMISSIVE policy was dropped.' };
      }

      const reasons: string[] = [];
      if (b['mode'] !== a['mode'] && a['mode'] === 'PERMISSIVE') {
        reasons.push('policy changed from RESTRICTIVE (an AND-ed gate) to PERMISSIVE (an OR-ed grant)');
      }
      if (b['cmd'] !== a['cmd']) {
        if (a['cmd'] === 'ALL') reasons.push(`command broadened from ${b['cmd']} to ALL`);
        else if (b['cmd'] !== 'ALL') reasons.push(`command changed ${b['cmd']} → ${a['cmd']}`);
      }
      const roleDelta = setDelta(b['roles'], a['roles'], 'policy roles', '');
      if (roleDelta.verdict === 'WIDENING') reasons.push(roleDelta.why);

      for (const clause of ['using', 'check'] as const) {
        const bv = b[clause];
        const av = a[clause];
        if (bv === av) continue;
        const bTrue = isAlwaysTrue(bv);
        const aTrue = isAlwaysTrue(av);
        if (aTrue && !bTrue) {
          reasons.push(
            `${clause.toUpperCase()} predicate was replaced with an unconditional \`true\` — this policy now admits every row`,
          );
        } else if (bTrue && !aTrue) {
          // provably tighter
        } else if (bv === 'NULL' && av !== 'NULL') {
          // absent → present is a tightening for USING; for WITH CHECK an
          // absent clause inherits USING, so adding one is at worst neutral.
        } else if (bv !== 'NULL' && av === 'NULL') {
          reasons.push(`${clause.toUpperCase()} predicate was removed entirely`);
        } else {
          reasons.push(
            `${clause.toUpperCase()} predicate changed, and a predicate change cannot be mechanically proven to narrow — a human must read it`,
          );
        }
      }

      return reasons.length > 0
        ? { verdict: 'WIDENING', why: reasons.join('; ') }
        : { verdict: 'NARROWING', why: 'Policy became more restrictive.' };
    }

    case 'view': {
      const b = parseKv(before);
      const a = parseKv(after);
      if (before === undefined) {
        return {
          verdict: 'WIDENING',
          why:
            a['honours_rls'] === 'NO'
              ? `A new ${a['type']} readable by ${a['select']} that does NOT honour the caller's RLS. It runs as ${a['owner']} and therefore reads straight past every policy on its base tables.`
              : `A new ${a['type']} became readable by ${a['select']}.`,
        };
      }
      if (after === undefined) return { verdict: 'NARROWING', why: 'A view left the surface.' };

      const reasons: string[] = [];
      if (b['honours_rls'] !== 'NO' && a['honours_rls'] === 'NO') {
        reasons.push(
          `the view stopped honouring the caller's RLS (security_invoker lost) — it now runs as ${a['owner']} and bypasses every policy on its base tables`,
        );
      }
      if (b['owner'] !== a['owner']) reasons.push(`owner changed ${b['owner']} → ${a['owner']}`);
      const g = setDelta(b['select'], a['select'], 'view SELECT', '');
      if (g.verdict === 'WIDENING') reasons.push(g.why);
      return reasons.length > 0
        ? { verdict: 'WIDENING', why: reasons.join('; ') }
        : { verdict: 'NARROWING', why: 'View exposure was reduced.' };
    }

    case 'func': {
      const b = parseKv(before);
      const a = parseKv(after);
      if (before === undefined) {
        return {
          verdict: 'WIDENING',
          why:
            a['secdef'] === 'yes'
              ? `A new SECURITY DEFINER function callable by ${a['exec']}. PostgREST publishes it at /rest/v1/rpc/, it runs with the owner's privileges, and it bypasses RLS — so it must do its own authorization with auth.uid(); a check in the web route can simply be skipped.`
              : `A new function callable by ${a['exec']}.`,
        };
      }
      if (after === undefined) return { verdict: 'NARROWING', why: 'A function left the surface.' };

      const reasons: string[] = [];
      const e = setDelta(
        b['exec'],
        a['exec'],
        'EXECUTE',
        a['secdef'] === 'yes'
          ? "this is a SECURITY DEFINER function, so it runs with the owner's privileges and bypasses RLS; PostgREST publishes it at /rest/v1/rpc/ and the web route that validates the caller can simply be skipped"
          : 'PostgREST publishes it at /rest/v1/rpc/, so it is callable directly with the public anon key',
      );
      if (e.verdict === 'WIDENING') reasons.push(e.why);
      if (b['secdef'] === 'no' && a['secdef'] === 'yes') {
        reasons.push(
          'function became SECURITY DEFINER — it now runs with the owner\'s privileges and bypasses RLS, so it needs its own auth.uid()/is_admin() check',
        );
      }
      if (b['search_path'] !== 'UNPINNED' && a['search_path'] === 'UNPINNED') {
        reasons.push(
          'search_path is no longer pinned — an unqualified table reference inside a SECURITY DEFINER function can be hijacked by a same-named temp table (authenticated holds TEMP on the database)',
        );
      }
      return reasons.length > 0
        ? { verdict: 'WIDENING', why: reasons.join('; ') }
        : { verdict: 'NARROWING', why: 'Function exposure was reduced.' };
    }
  }
}

/** Parse `k=v k=v` into a record. Values never contain a space by construction. */
function parseKv(s: string | undefined): Record<string, string> {
  if (!s) return {};
  const out: Record<string, string> = {};
  // `using=` / `check=` hold whole SQL predicates, so split on the KNOWN keys
  // rather than on whitespace.
  const keys = ['mode', 'cmd', 'roles', 'using', 'check', 'type', 'owner', 'honours_rls', 'select', 'secdef', 'exec', 'search_path', 'usage', 'anon', 'authenticated'];
  const re = new RegExp(`(?:^| )(${keys.join('|')})=`, 'g');
  const hits: Array<{ key: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    hits.push({ key: m[1]!, start: m.index + m[0].length });
  }
  if (hits.length === 0) return out;
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1]!.start - hits[i + 1]!.key.length - 2 : s.length;
    out[hits[i]!.key] = s.slice(hits[i]!.start, end);
  }
  return out;
}

/**
 * Compare two sets rendered as either a comma list (`anon,authenticated`) or a
 * letter string (`SIUD`). Gaining a member is a widening.
 */
function setDelta(
  before: string | undefined,
  after: string | undefined,
  label: string,
  note: string,
  opts: { letters?: boolean } = {},
): { verdict: Verdict; why: string } {
  const split = (v: string | undefined) =>
    new Set(v === undefined || v === '' || v === '-' ? [] : opts.letters ? v.split('') : v.split(','));
  const b = split(before);
  const a = split(after);
  const gained = [...a].filter((x) => !b.has(x)).sort();
  const lost = [...b].filter((x) => !a.has(x)).sort();
  if (gained.length > 0) {
    const expanded = opts.letters ? gained.map(expandPriv).join(', ') : gained.join(', ');
    return {
      verdict: 'WIDENING',
      why: `${label} gained ${expanded}${note ? ` — ${note}` : ''}`,
    };
  }
  if (lost.length > 0) {
    const expanded = opts.letters ? lost.map(expandPriv).join(', ') : lost.join(', ');
    return { verdict: 'NARROWING', why: `${label} lost ${expanded}` };
  }
  return { verdict: 'NEUTRAL', why: '' };
}

function expandPriv(l: string): string {
  return { S: 'SELECT', I: 'INSERT', U: 'UPDATE', D: 'DELETE' }[l] ?? l;
}

/** `true` / `(true)` — the classic debug loosening. */
function isAlwaysTrue(expr: string | undefined): boolean {
  if (!expr) return false;
  return /^\(*\s*true\s*\)*$/i.test(expr.trim());
}

/* ────────────────────────────────────────────────────────────────────────────
 * The failure message
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Render widenings into something that TEACHES rather than just fails.
 * Someone hitting this may never have thought about PostgREST at all, so the
 * message has to explain what happened, why it is dangerous, and exactly what
 * to do next.
 */
export function formatWideningReport(widenings: Delta[], narrowings: Delta[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('━'.repeat(78));
  lines.push(`EXPOSURE SURFACE WIDENED — ${widenings.length} new capabilit${widenings.length === 1 ? 'y' : 'ies'} for anon / authenticated`);
  lines.push('━'.repeat(78));
  lines.push('');
  lines.push('Something in this branch gave the PUBLIC internet more reach into the');
  lines.push('database than the committed baseline allows. Supabase publishes every');
  lines.push('table in `public` as a REST endpoint and the anon key is in the page');
  lines.push('source by design, so this is reachable with curl — the UI is not a gate.');
  lines.push('');

  for (const d of widenings) {
    lines.push(`  ✗ ${d.kind}  ${d.key}`);
    if (d.before === null) lines.push(`      added:   ${d.after}`);
    else if (d.after === null) lines.push(`      removed: ${d.before}`);
    else {
      lines.push(`      was:  ${d.before}`);
      lines.push(`      now:  ${d.after}`);
    }
    lines.push(`      why this matters: ${d.why}`);
    lines.push('');
  }

  if (narrowings.length > 0) {
    lines.push(`(Also ${narrowings.length} narrowing${narrowings.length === 1 ? '' : 's'} in this branch — those are fine and never fail the build.)`);
    lines.push('');
  }

  lines.push('─'.repeat(78));
  lines.push('TWO WAYS FORWARD. Pick one — there is no third.');
  lines.push('');
  lines.push('  1. NARROW IT. If this exposure was not intended, take it back:');
  lines.push('       • REVOKE the grant (prefer column-level: RLS is ROW-level and can');
  lines.push('         never hide a column from someone the row policy admits);');
  lines.push('       • or move the operation behind service_role and call it from a');
  lines.push('         server action instead of exposing an RPC or a table;');
  lines.push('       • or tighten the policy predicate.');
  lines.push('     Then re-run. Narrowing needs no baseline update and never fails.');
  lines.push('');
  lines.push('  2. ACCEPT IT DELIBERATELY. If the exposure is genuinely intended,');
  lines.push('     regenerate the baseline and commit it IN THIS SAME PULL REQUEST:');
  lines.push('');
  lines.push('       pnpm --filter @setnayan/web exposure:baseline');
  lines.push('');
  lines.push('     The diff then shows up in review, where a human decides whether the');
  lines.push(`     public internet should have it. That is the entire point of the file.`);
  lines.push('');
  lines.push(`  Baseline: ${BASELINE_PATH_FROM_REPO_ROOT}`);
  lines.push('  Background: supabase/security/README.md');
  lines.push('─'.repeat(78));
  return lines.join('\n');
}
