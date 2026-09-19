/**
 * lib/ugat/both-ends.ts — EVERY CONNECTION HAS BOTH ENDS.
 *
 * ── THE DISEASE, MEASURED IN ONE DAY (2026-09-18) ──────────────────────────
 * The same defect shape came up five times: both ends of a connection were
 * built, and the join between them was missing or silent.
 *   · `guest_submit_song_request` (July) and the band's inbox both existed;
 *     no app code called the function (#5601 joined them).
 *   · `vendor_payment_methods`, its editor and the couple-facing pay sheet all
 *     existed and were not mounted at the deposit step (#5599). 0 rows.
 *   · `booking_fee_open_lock_charge` exists; the acknowledge completed; no
 *     ledger row was written, and the branch that skipped it discarded the
 *     reason (#5615).
 *   · The chat box was converted on two thread pages, not the one suppliers
 *     land on (S18). The delivery log had 0 writers for months (#5588).
 *
 * `schema-claims.ts` proves the Ugat map never LIES about the schema;
 * `concept-coverage.ts` proves it never FALLS BEHIND it. This is the third
 * half nobody had: that each thing the map (and the schema) describes has a
 * live counterpart on the other side. Five orphan classes:
 *
 *   rpc-no-caller            a public function nothing calls — not `.rpc()`
 *                            in the app, not another function body, policy,
 *                            trigger, view, column default or CHECK in SQL.
 *   table-no-writer          a table with no insert/upsert/update/delete in
 *                            the app, no SQL body that writes it, and no rows
 *                            seeded by a migration.
 *   notice-no-emitter        a NotificationType nobody ever passes to
 *                            emitNotification (or a DB enum label with no
 *                            union member, which nothing can emit at all).
 *   component-no-mount       an `_components/*.tsx` file no Next.js entry can
 *                            reach at runtime — or one that is imported and
 *                            never used, or mounted only behind a constant.
 *   result-dropped-silently  a Supabase result whose `error` is read ONLY as a
 *                            condition, and the branch it selects records
 *                            nothing: no log, no throw, no message, no
 *                            reference to the reason. The booking-fee shape.
 *
 * ── WHAT A ZERO MEANS HERE, AND WHAT IT DOES NOT ───────────────────────────
 * Every detector answers "did anything on the OTHER side name this?" Three
 * blind spots are deliberate and stated, all in the SAFE direction (a missed
 * orphan, never an invented one):
 *   · a name built at runtime (`.rpc(fn)`, `EXECUTE format(…)`) is invisible.
 *     For the app side a file with a dynamic `.from(x).write` has every quoted
 *     table name in it counted as written by that file.
 *   · a caller in a place we do not scan (a Supabase Edge Function, the
 *     desktop crate) is invisible. Neither calls PostgREST today; the floor
 *     on scanned files will say so if that changes.
 *   · a reference in a comment counts for nothing — TS and SQL comments are
 *     blanked before matching, so prose cannot vouch for code.
 * ⚠ A TS grep cannot see an RLS policy's caller (memory, 2026-08). That is why
 * the SQL side is read from pg_catalog after the replay, never from grep.
 *
 * ── RANKING ────────────────────────────────────────────────────────────────
 * The baseline is grouped by USER IMPACT — money > booking lifecycle >
 * couple-facing > supplier-facing > admin — because the controller turns the
 * top of that list into build sessions. The tier is a keyword judgement over
 * the name (and for a component, its route root); it is a sort order, not a
 * fact, and a wrong tier costs nothing but reading order.
 *
 * PURE: no fs, no database, no `server-only`. The db test feeds it pg_catalog
 * rows and file texts; the unit test feeds it fixtures and sabotages.
 */

import { stripComments } from '../security/source-text';
import { stripSqlComments } from '../security/events-column-privileges';
import { scanSourceDetailed } from '../supabase-unread-error-scan';

export type OrphanClass =
  | 'rpc-no-caller'
  | 'table-no-writer'
  | 'notice-no-emitter'
  | 'component-no-mount'
  | 'result-dropped-silently';

export const ORPHAN_CLASSES: readonly OrphanClass[] = [
  'rpc-no-caller',
  'table-no-writer',
  'notice-no-emitter',
  'component-no-mount',
  'result-dropped-silently',
];

export type ImpactTier = 'money' | 'booking' | 'couple' | 'supplier' | 'admin' | 'other';
export const TIER_ORDER: readonly ImpactTier[] = ['money', 'booking', 'couple', 'supplier', 'admin', 'other'];

export interface OrphanFinding {
  cls: OrphanClass;
  /** The baseline key: a name or a path, never a line number. */
  key: string;
  /** Occurrences (only `result-dropped-silently` can exceed 1). */
  count: number;
  tier: ImpactTier;
  /** What was searched and what was found — for the reader, not the ratchet. */
  evidence: string;
}

/** A source file as read from disk. The module strips comments itself. */
export interface SourceFile {
  /** Path relative to apps/web, forward slashes. */
  path: string;
  text: string;
}

// ─── tiers ───────────────────────────────────────────────────────────────────

const TIER_WORDS: Record<Exclude<ImpactTier, 'other'>, RegExp> = {
  money:
    /pay|paid|order|fee|refund|ledger|charge|payout|wallet|credit|billing|invoice|price|pricing|catalog|discount|voucher|token|subscription|gcash|receipt|deposit|comp_grant|money|cost|budget|tip|gift|cash|bank|settle|reconcil|sku|plan|purchase|checkout|balance/i,
  booking:
    /book|lock|contract|proposal|quote|inquir|event_vendor|deal|amend|negotiat|appointment|schedule|availab|slot|waitlist|hire|thread|chat|message|finaliz|complet|dispute|review|rating|handshake|agree/i,
  couple:
    /guest|rsvp|invit|seat|event|std|save[-_]the[-_]date|papic|couple|sponsor|entourage|mood|registry|slug|day[-_]of|timeline|program|song|photo|album|face|memor|story|samahan|communit|join|dashboard|wedding|celebration|host/i,
  supplier:
    /vendor|shop|supplier|service|portfolio|creator|storefront|onboard|verification|profile|calendar|emcee|band|act_|activity|lines|encoder|studio|live/i,
  admin:
    /admin|seo|platform|social|cron|audit|internal|ops|health|ugat|telemetry|concierge|abuse|fraud|moderation|export|erasure|purge|retention|sweep|job|demo|fixture|search|analytics/i,
};

/** Keyword judgement over a NAME — money first, so `admin_payment_x` is money. */
export function tierOf(name: string): ImpactTier {
  for (const tier of TIER_ORDER) {
    if (tier === 'other') break;
    if (TIER_WORDS[tier].test(name)) return tier;
  }
  return 'other';
}

/**
 * A component's tier: money/booking words in its OWN name win; otherwise the
 * route root decides, because `app/vendor-dashboard/x` contains "dashboard"
 * and would otherwise read as couple-facing.
 */
export function tierOfComponent(path: string): ImpactTier {
  const base = path.split('/').pop() ?? path;
  if (TIER_WORDS.money.test(base)) return 'money';
  if (TIER_WORDS.booking.test(base)) return 'booking';
  if (/^app\/admin\//.test(path)) return 'admin';
  if (/^app\/vendor-dashboard\//.test(path) || /^app\/(onboarding|storefront|creator)/.test(path)) return 'supplier';
  if (/^app\/(dashboard|\[slug\]|join|papic|invite|rsvp)\b/.test(path)) return 'couple';
  return tierOf(base);
}

// ─── text indexes ────────────────────────────────────────────────────────────

const LITERAL_RE = /(['"`])([A-Za-z0-9_./-]{2,80})\1/g;
/** `…/rpc/<name>` in RAW text (the stripper blanks a URL after its `//`). */
const RPC_URL_RE = /rpc\/([a-z0-9_]+)\b/g;
/** Is this a file whose job is to DESCRIBE other code (the map, the registries)? */
const DESCRIBER_RE = /^lib\/(ugat|admin-map)\//;
const TEST_RE = /\.(test|spec)\.tsx?$/;

export interface LiteralIndex {
  /** literal → files it appears in (comment-stripped). */
  byLiteral: Map<string, Set<string>>;
  /** rpc/<name> in raw text → files. */
  rpcUrl: Map<string, Set<string>>;
  files: number;
}

/** Index every quoted literal once, so 500 names × 4,000 files is a lookup. */
export function indexLiterals(sources: readonly SourceFile[]): LiteralIndex {
  const byLiteral = new Map<string, Set<string>>();
  const rpcUrl = new Map<string, Set<string>>();
  let files = 0;
  for (const f of sources) {
    if (TEST_RE.test(f.path) || DESCRIBER_RE.test(f.path)) continue;
    files++;
    const stripped = stripComments(f.text);
    for (const m of stripped.matchAll(LITERAL_RE)) {
      const lit = m[2]!;
      let set = byLiteral.get(lit);
      if (!set) byLiteral.set(lit, (set = new Set()));
      set.add(f.path);
    }
    for (const m of f.text.matchAll(RPC_URL_RE)) {
      const name = m[1]!;
      let set = rpcUrl.get(name);
      if (!set) rpcUrl.set(name, (set = new Set()));
      set.add(f.path);
    }
  }
  return { byLiteral, rpcUrl, files };
}

export { stripSqlComments };

const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/g;

/** The identifier words of a SQL text, lower-cased. */
export function sqlWords(sql: string): Set<string> {
  const out = new Set<string>();
  for (const m of stripSqlComments(sql).matchAll(IDENT_RE)) out.add(m[0].toLowerCase());
  return out;
}

// ─── class 1: RPCs with no caller ───────────────────────────────────────────

export interface CatalogFunction {
  name: string;
  /** `pg_proc.prosrc` */
  src: string;
  /** True for a function that RETURNS trigger — its only legitimate caller is a trigger. */
  returnsTrigger?: boolean;
}
export interface CatalogPolicy { table: string; name: string; qual: string | null; withCheck: string | null }
/** A row trigger (`pg_trigger`) or an EVENT trigger (`pg_event_trigger`, table = 'ddl'). */
export interface CatalogTrigger { table: string; name: string; fn: string }
export interface CatalogExpr { owner: string; def: string }

export interface Catalog {
  functions: readonly CatalogFunction[];
  policies: readonly CatalogPolicy[];
  triggers: readonly CatalogTrigger[];
  /** views, cron jobs, column defaults, CHECK constraints — anything with a SQL expression. */
  expressions: readonly CatalogExpr[];
  tables: readonly string[];
  /** rows present after the migration replay — a seeded table has a writer (the migration). */
  rowCounts: Readonly<Record<string, number>>;
}

export interface RpcStats { candidates: number; appCalled: number; sqlCalled: number; orphans: number }

export function findRpcOrphans(
  catalog: Catalog,
  index: LiteralIndex,
): { findings: OrphanFinding[]; stats: RpcStats } {
  const names = [...new Set(catalog.functions.map((f) => f.name))].sort();
  // Words of every SQL text, keyed by what it is — so evidence can say WHO called.
  const bodies = catalog.functions.map((f) => ({ who: `function ${f.name}`, self: f.name, words: sqlWords(f.src) }));
  const policies = catalog.policies.map((p) => ({ who: `policy ${p.name} on ${p.table}`, words: sqlWords(`${p.qual ?? ''} ${p.withCheck ?? ''}`) }));
  const exprs = catalog.expressions.map((e) => ({ who: e.owner, words: sqlWords(e.def) }));
  const triggerFns = new Map<string, string[]>();
  for (const t of catalog.triggers) triggerFns.set(t.fn, [...(triggerFns.get(t.fn) ?? []), `trigger ${t.name} on ${t.table}`]);
  const returnsTrigger = new Map(catalog.functions.map((f) => [f.name, Boolean(f.returnsTrigger)]));

  const findings: OrphanFinding[] = [];
  let appCalled = 0;
  let sqlCalled = 0;
  for (const name of names) {
    const lower = name.toLowerCase();
    const app = new Set<string>([...(index.byLiteral.get(name) ?? []), ...(index.rpcUrl.get(name) ?? [])]);
    const sql: string[] = [];
    for (const b of bodies) if (b.self !== name && b.words.has(lower)) sql.push(b.who);
    for (const p of policies) if (p.words.has(lower)) sql.push(p.who);
    for (const e of exprs) if (e.words.has(lower)) sql.push(e.who);
    for (const t of triggerFns.get(name) ?? []) sql.push(t);
    if (app.size > 0) appCalled++;
    if (sql.length > 0) sqlCalled++;
    if (app.size > 0 || sql.length > 0) continue;
    findings.push({
      cls: 'rpc-no-caller',
      key: name,
      count: 1,
      tier: tierOf(name),
      evidence: returnsTrigger.get(name)
        ? `RETURNS trigger and no trigger is bound to it`
        : `no '${name}' literal in any app file; no SQL body, policy, trigger, view, default or CHECK names it`,
    });
  }
  return { findings, stats: { candidates: names.length, appCalled, sqlCalled, orphans: findings.length } };
}

/**
 * Policies the replay CANNOT host. `realtime.messages` does not exist in PGlite,
 * so a `CREATE POLICY … ON realtime.messages USING (some_fn(topic))` never
 * reaches pg_policies there — and that is exactly the caller a TS grep missed
 * in August. Read those statements out of the migration text, non-public
 * schemas only, comments blanked. A dropped policy left in an old file can
 * only make a function look CALLED (the safe direction).
 */
export function policiesOutsidePublic(migrationSql: readonly string[]): CatalogExpr[] {
  const out: CatalogExpr[] = [];
  const re = /create\s+policy\s+"?([A-Za-z0-9_]+)"?\s+on\s+((?!public\.)[a-z_]+\.[a-z_]+)\b([\s\S]*?);/gi;
  for (const sql of migrationSql) {
    for (const m of stripSqlComments(sql).matchAll(re)) out.push({ owner: `policy ${m[1]} on ${m[2]} (migration text)`, def: m[3] ?? '' });
  }
  return out;
}

// ─── class 2: tables with no writer ─────────────────────────────────────────

const WRITE_OPS = 'insert|upsert|update|delete';
const LITERAL_WRITE_RE = new RegExp(`\\.from\\(\\s*(['"\`])([a-z0-9_]+)\\1\\s*\\)\\s*\\.\\s*(?:${WRITE_OPS})\\b`, 'g');
const DYNAMIC_WRITE_RE = new RegExp(`\\.from\\(\\s*[A-Za-z_$][\\w$.]*\\s*\\)\\s*\\.\\s*(?:${WRITE_OPS})\\b`);
const SQL_WRITE_RE = /\b(?:insert\s+into|update\s+(?:only\s+)?|delete\s+from\s+(?:only\s+)?|merge\s+into)\s*(?:public\.)?"?([a-z0-9_]+)"?/gi;

export interface WriterIndex {
  /** table → app files that write it (literal or dynamic-file rule). */
  app: Map<string, Set<string>>;
  /** table → SQL function names whose body writes it. */
  sql: Map<string, Set<string>>;
  literalSites: number;
  dynamicFiles: number;
}

export function indexWriters(sources: readonly SourceFile[], catalog: Pick<Catalog, 'functions' | 'tables'>): WriterIndex {
  const app = new Map<string, Set<string>>();
  const sql = new Map<string, Set<string>>();
  const tables = new Set(catalog.tables);
  const add = (m: Map<string, Set<string>>, k: string, v: string) => {
    let s = m.get(k);
    if (!s) m.set(k, (s = new Set()));
    s.add(v);
  };
  let literalSites = 0;
  let dynamicFiles = 0;
  for (const f of sources) {
    if (TEST_RE.test(f.path) || DESCRIBER_RE.test(f.path)) continue;
    const stripped = stripComments(f.text);
    for (const m of stripped.matchAll(LITERAL_WRITE_RE)) {
      literalSites++;
      add(app, m[2]!, f.path);
    }
    if (DYNAMIC_WRITE_RE.test(stripped)) {
      dynamicFiles++;
      for (const m of stripped.matchAll(LITERAL_RE)) if (tables.has(m[2]!)) add(app, m[2]!, `${f.path} (dynamic .from)`);
    }
  }
  for (const fn of catalog.functions) {
    for (const m of stripSqlComments(fn.src).matchAll(SQL_WRITE_RE)) add(sql, m[1]!.toLowerCase(), fn.name);
  }
  return { app, sql, literalSites, dynamicFiles };
}

export interface TableStats { candidates: number; appWritten: number; sqlWritten: number; seeded: number; orphans: number }

export function findTableOrphans(catalog: Catalog, writers: WriterIndex): { findings: OrphanFinding[]; stats: TableStats } {
  const findings: OrphanFinding[] = [];
  let appWritten = 0;
  let sqlWritten = 0;
  let seeded = 0;
  for (const t of [...catalog.tables].sort()) {
    const app = writers.app.get(t);
    const sql = writers.sql.get(t);
    const rows = catalog.rowCounts[t] ?? 0;
    if (app) appWritten++;
    if (sql) sqlWritten++;
    if (rows > 0) seeded++;
    if (app || sql || rows > 0) continue;
    findings.push({
      cls: 'table-no-writer',
      key: t,
      count: 1,
      tier: tierOf(t),
      evidence: `no .from('${t}').insert/upsert/update/delete in the app, no SQL body writes it, 0 rows after replay`,
    });
  }
  return { findings, stats: { candidates: catalog.tables.length, appWritten, sqlWritten, seeded, orphans: findings.length } };
}

// ─── class 3: notification types with no emitter ────────────────────────────

export interface NoticeInput {
  /** The TS union members (parsed from lib/notifications.ts). */
  union: readonly string[];
  emailAllowlist: ReadonlySet<string>;
  pushAllowlist: ReadonlySet<string>;
  /** `notification_type` enum labels from pg_enum. */
  enumLabels: readonly string[];
  /** The registry files — a literal there is a definition, not an emit. */
  registryPaths: readonly string[];
}

export interface NoticeStats { union: number; emitted: number; enumLabels: number; orphans: number; emittedNotAllowlisted: string[] }

/**
 * Parse the `NotificationType` union out of lib/notifications.ts text.
 * Same shape as every-notice-type-exists-in-the-database.test.ts — comments
 * name types too, so they are blanked first.
 */
export function parseNotificationUnion(notificationsTs: string): string[] {
  const lines = notificationsTs.split('\n');
  const start = lines.findIndex((l) => l.startsWith('export type NotificationType'));
  if (start < 0) return [];
  let end = start;
  while (end < lines.length && !/^\s*\|\s*'[a-z0-9_]+';\s*$/.test(lines[end] ?? '')) end += 1;
  const block = stripComments(lines.slice(start, end + 1).join('\n'));
  return [...block.matchAll(/\|\s*'([a-z0-9_]+)'/g)].map((m) => m[1]!);
}

/** Parse `const NAME: … = new Set([ 'a', 'b' ])` out of notification-emit.ts text. */
export function parseAllowlist(emitTs: string, constName: string): Set<string> {
  const stripped = stripComments(emitTs);
  const start = stripped.indexOf(`const ${constName}`);
  if (start < 0) return new Set();
  const open = stripped.indexOf('new Set([', start);
  const close = stripped.indexOf('])', open);
  if (open < 0 || close < 0) return new Set();
  return new Set([...stripped.slice(open, close).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!));
}

export function findNoticeOrphans(input: NoticeInput, index: LiteralIndex): { findings: OrphanFinding[]; stats: NoticeStats } {
  const registry = new Set(input.registryPaths);
  const emitters = (type: string) => [...(index.byLiteral.get(type) ?? [])].filter((p) => !registry.has(p));
  const findings: OrphanFinding[] = [];
  const unionSet = new Set(input.union);
  let emitted = 0;
  const emittedNotAllowlisted: string[] = [];
  for (const type of [...input.union].sort()) {
    const files = emitters(type);
    if (files.length > 0) {
      emitted++;
      if (!input.emailAllowlist.has(type) && !input.pushAllowlist.has(type)) emittedNotAllowlisted.push(type);
      continue;
    }
    const lists = [input.emailAllowlist.has(type) ? 'EMAIL' : '', input.pushAllowlist.has(type) ? 'PUSH' : ''].filter(Boolean);
    findings.push({
      cls: 'notice-no-emitter',
      key: type,
      count: 1,
      tier: tierOf(type),
      evidence: `in the NotificationType union${lists.length ? ` and on the ${lists.join('+')} allowlist` : ''}, never passed as a type in any app file`,
    });
  }
  for (const label of [...input.enumLabels].sort()) {
    if (unionSet.has(label)) continue;
    findings.push({
      cls: 'notice-no-emitter',
      key: label,
      count: 1,
      tier: tierOf(label),
      evidence: `a notification_type enum label with no member in the TS union — nothing in the app can emit it`,
    });
  }
  return {
    findings,
    stats: { union: input.union.length, emitted, enumLabels: input.enumLabels.length, orphans: findings.length, emittedNotAllowlisted },
  };
}

// ─── class 4: components with no mount ──────────────────────────────────────

/** Next.js entry files — the roots of runtime reachability. */
export const ENTRY_RE =
  /(^|\/)(page|layout|route|template|default|not-found|error|global-error|loading|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(ts|tsx)$|^(middleware|instrumentation(-client)?)\.ts$/;

const IMPORT_RE =
  /\bimport\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bexport\s+(\*|\{[\s\S]*?\})\s*from\s*['"]([^'"]+)['"]/g;

export interface ImportEdge { spec: string; locals: string[]; /** a `export … from` re-export */ reexport: boolean }

/**
 * Runtime import edges of one file. `import type` erases at compile time and
 * mounts nothing, so a specifier counts only if at least one binding is a
 * value (the rule the mounted-action guard learned from its own sabotage).
 */
export function runtimeImports(strippedSrc: string): ImportEdge[] {
  const out: ImportEdge[] = [];
  for (const m of strippedSrc.matchAll(IMPORT_RE)) {
    if (m[3]) { out.push({ spec: m[3], locals: [], reexport: false }); continue; }
    if (m[5]) {
      // `export * from` / `export { A, type B } from` — a value edge unless
      // every named binding is a type (`export type { … } from` never matches).
      const clause = m[4] ?? '';
      if (clause !== '*') {
        const names = clause.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
        if (names.length > 0 && names.every((n) => /^type\b/.test(n))) continue;
      }
      out.push({ spec: m[5], locals: [], reexport: true });
      continue;
    }
    const clause = (m[1] ?? '').trim();
    if (/^type\b/.test(clause)) continue;
    const locals: string[] = [];
    const braces = clause.match(/\{([\s\S]*)\}/);
    let outside = clause.replace(/\{[\s\S]*\}/, '');
    if (braces) {
      for (const raw of braces[1]!.split(',')) {
        const n = raw.trim();
        if (!n || /^type\b/.test(n)) continue;
        locals.push((n.split(/\s+as\s+/).pop() ?? n).trim());
      }
    }
    for (const part of outside.split(',')) {
      const n = part.trim().replace(/^\*\s+as\s+/, '');
      if (n) locals.push(n);
    }
    if (locals.length === 0) continue; // every binding was a type
    out.push({ spec: m[2]!, locals, reexport: false });
  }
  return out;
}

/** Resolve `@/…` and relative specifiers against the known file set, like the bundler. */
export function resolveImport(fromFile: string, spec: string, all: ReadonlySet<string>): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) {
    const dir = fromFile.split('/').slice(0, -1);
    for (const part of spec.split('/')) {
      if (part === '.' || part === '') continue;
      if (part === '..') dir.pop();
      else dir.push(part);
    }
    base = dir.join('/');
  } else return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (all.has(cand)) return cand;
  return null;
}

export interface ComponentInput {
  /** Every non-test source file (path → raw text). */
  files: ReadonlyMap<string, string>;
  /** Test files, so evidence can say "imported only by a test". */
  testFiles?: ReadonlyMap<string, string>;
  /** The files under judgement, e.g. every `app/**\/_components/*.tsx`. */
  candidates: readonly string[];
}

export interface ComponentStats { candidates: number; entries: number; reachable: number; orphans: number; inert: number; constantGated: number }

const CONSTANT_GATE = (local: string) => new RegExp(`\\{\\s*(?:false|true)\\s*(?:\\?|&&)\\s*\\(?\\s*<${local}\\b`);

export function findComponentOrphans(input: ComponentInput): { findings: OrphanFinding[]; stats: ComponentStats } {
  const all = new Set(input.files.keys());
  const stripped = new Map<string, string>();
  const strippedOf = (p: string) => {
    let s = stripped.get(p);
    if (s === undefined) stripped.set(p, (s = stripComments(input.files.get(p) ?? '')));
    return s;
  };
  // importers: target → [{ from, locals }]
  const importers = new Map<string, { from: string; locals: string[]; reexport: boolean }[]>();
  const edges = new Map<string, string[]>();
  for (const p of all) {
    const targets: string[] = [];
    for (const e of runtimeImports(strippedOf(p))) {
      const t = resolveImport(p, e.spec, all);
      if (!t) continue;
      targets.push(t);
      importers.set(t, [...(importers.get(t) ?? []), { from: p, locals: e.locals, reexport: e.reexport }]);
    }
    edges.set(p, targets);
  }
  const testImporters = new Map<string, string[]>();
  for (const [p, text] of input.testFiles ?? []) {
    for (const e of runtimeImports(stripComments(text))) {
      const t = resolveImport(p, e.spec, all);
      if (t) testImporters.set(t, [...(testImporters.get(t) ?? []), p]);
    }
  }
  const entries = [...all].filter((p) => ENTRY_RE.test(p));
  const reachable = new Set<string>(entries);
  const queue = [...entries];
  while (queue.length) {
    const p = queue.pop()!;
    for (const t of edges.get(p) ?? []) if (!reachable.has(t)) { reachable.add(t); queue.push(t); }
  }

  const findings: OrphanFinding[] = [];
  let inert = 0;
  let constantGated = 0;
  for (const c of [...input.candidates].sort()) {
    if (!all.has(c)) continue;
    const tier = tierOfComponent(c);
    if (!reachable.has(c)) {
      const imps = importers.get(c) ?? [];
      const tests = testImporters.get(c) ?? [];
      const evidence =
        imps.length === 0 && tests.length === 0
          ? `no runtime importer in any source file`
          : imps.length === 0
            ? `imported only by a test (${tests.join(', ')})`
            : `imported only by files no entry reaches (${imps.map((i) => i.from).slice(0, 3).join(', ')})`;
      findings.push({ cls: 'component-no-mount', key: c, count: 1, tier, evidence });
      continue;
    }
    // Reachable — but does anyone USE the binding, and is the mount real?
    const imps = (importers.get(c) ?? []).filter((i) => reachable.has(i.from));
    if (imps.length === 0) continue; // an entry itself, or reached via re-export chains
    let used = false;
    let gated: string | null = null;
    for (const i of imps) {
      // A re-export hands the binding on; a dynamic `import()` IS the mount.
      if (i.reexport || i.locals.length === 0) { used = true; continue; }
      const src = strippedOf(i.from).replace(IMPORT_RE, ' ');
      for (const local of i.locals) {
        const occurrences = src.match(new RegExp(`(?<![\\w$.])${local}(?![\\w$])`, 'g'))?.length ?? 0;
        if (occurrences === 0) continue;
        const gate = CONSTANT_GATE(local);
        const mounts = src.match(new RegExp(`<${local}\\b`, 'g'))?.length ?? 0;
        const gatedMounts = src.match(new RegExp(gate.source, 'g'))?.length ?? 0;
        if (mounts > 0 && gatedMounts >= mounts) { gated = `${i.from} mounts <${local}> only behind a constant condition`; continue; }
        used = true;
      }
    }
    if (used) continue;
    if (gated) {
      constantGated++;
      findings.push({ cls: 'component-no-mount', key: c, count: 1, tier, evidence: gated });
    } else {
      inert++;
      findings.push({ cls: 'component-no-mount', key: c, count: 1, tier, evidence: `imported but never referenced by ${imps.map((i) => i.from).slice(0, 3).join(', ')}` });
    }
  }
  return {
    findings,
    stats: { candidates: input.candidates.length, entries: entries.length, reachable: reachable.size, orphans: findings.length, inert, constantGated },
  };
}

// ─── class 5: results dropped silently ──────────────────────────────────────

export interface DropStats { files: number; calls: number; orphans: number }

/**
 * The decision lives in `supabase-unread-error-scan.ts` (S16's guard, #5596),
 * behind `silentDrops: true` so that guard's own sweep and fixtures are
 * unchanged. This only aggregates it per file and target, like S16's baseline.
 */
/** The target's name and the file's own name decide; the route root breaks a tie. */
function dropTier(path: string, target: string): ImpactTier {
  const byName = tierOf(`${target} ${path.split('/').pop() ?? ''}`);
  return byName === 'other' ? tierOfComponent(path) : byName;
}

export function findSilentDrops(sources: readonly SourceFile[]): { findings: OrphanFinding[]; stats: DropStats } {
  const counts = new Map<string, number>();
  let calls = 0;
  let files = 0;
  for (const f of sources) {
    if (TEST_RE.test(f.path)) continue;
    files++;
    const r = scanSourceDetailed(f.text, f.path, { silentDrops: true });
    calls += r.calls;
    for (const d of r.findings) {
      if (d.kind !== 'error-dropped-silently') continue;
      const k = `${f.path}\t${d.target}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const findings: OrphanFinding[] = [];
  for (const [k, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    const [path, target] = k.split('\t') as [string, string];
    findings.push({
      cls: 'result-dropped-silently',
      key: `${path} · ${target}`,
      count,
      tier: dropTier(path, target),
      evidence: `error read only as a condition; the branch it selects records nothing — no log, throw, message or reference to the reason`,
    });
  }
  return { findings, stats: { files, calls, orphans: findings.length } };
}

// ─── ranking + baseline ─────────────────────────────────────────────────────

export function rankFindings(findings: readonly OrphanFinding[]): OrphanFinding[] {
  const tierIx = (t: ImpactTier) => TIER_ORDER.indexOf(t);
  const clsIx = (c: OrphanClass) => ORPHAN_CLASSES.indexOf(c);
  return [...findings].sort((a, b) => tierIx(a.tier) - tierIx(b.tier) || clsIx(a.cls) - clsIx(b.cls) || a.key.localeCompare(b.key));
}

export const baselineKey = (f: Pick<OrphanFinding, 'cls' | 'key'>) => `${f.cls}\t${f.key}`;

const TIER_TITLE: Record<ImpactTier, string> = {
  money: 'MONEY — a payment, fee, price or ledger with a missing end',
  booking: 'BOOKING LIFECYCLE — inquiry → quote → lock → contract → deposit',
  couple: 'COUPLE-FACING — guests, invitations, the celebration itself',
  supplier: 'SUPPLIER-FACING — shops, services, the vendor dashboard',
  admin: 'ADMIN / OPS — the console, jobs, tooling',
  other: 'UNCLASSIFIED — no tier keyword matched; read the name',
};

/** The baseline text: ranked by tier, grouped, one tab-separated line each. */
export function formatBaseline(findings: readonly OrphanFinding[], header: readonly string[]): string {
  const ranked = rankFindings(findings);
  const lines: string[] = [...header, ''];
  let tier: ImpactTier | null = null;
  const perTier = new Map<ImpactTier, number>();
  for (const f of ranked) perTier.set(f.tier, (perTier.get(f.tier) ?? 0) + 1);
  for (const f of ranked) {
    if (f.tier !== tier) {
      tier = f.tier;
      lines.push(`# ══ ${TIER_TITLE[tier]} (${perTier.get(tier)}) ══`);
    }
    lines.push(`${f.cls}\t${f.key}\t${f.count}\t${f.evidence}`);
  }
  lines.push('');
  return lines.join('\n');
}

export interface BaselineEntry { count: number; evidence: string }

export function parseBaseline(text: string): Map<string, BaselineEntry> {
  const out = new Map<string, BaselineEntry>();
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.startsWith('#')) continue;
    const parts = raw.split('\t');
    if (parts.length < 4) throw new Error(`malformed baseline line: ${JSON.stringify(raw)}`);
    out.set(`${parts[0]}\t${parts[1]}`, { count: Number(parts[2]), evidence: parts.slice(3).join('\t') });
  }
  return out;
}

export interface BaselineDiff {
  /** New orphans, or counts that rose — the failure. */
  grown: OrphanFinding[];
  /** Baseline lines no longer found — paid down; delete them. */
  paidDown: string[];
}

export function diffBaseline(findings: readonly OrphanFinding[], baseline: ReadonlyMap<string, BaselineEntry>): BaselineDiff {
  const grown: OrphanFinding[] = [];
  const seen = new Map<string, number>();
  for (const f of findings) {
    const k = baselineKey(f);
    seen.set(k, f.count);
    const allowed = baseline.get(k)?.count ?? 0;
    if (f.count > allowed) grown.push(f);
  }
  const paidDown: string[] = [];
  for (const [k, e] of baseline) if ((seen.get(k) ?? 0) < e.count) paidDown.push(k.replace('\t', ' '));
  return { grown: rankFindings(grown), paidDown };
}

export function formatGrown(grown: readonly OrphanFinding[]): string {
  return grown.map((f) => `  [${f.tier}] ${f.cls}  ${f.key}${f.count > 1 ? ` ×${f.count}` : ''}\n      ${f.evidence}`).join('\n');
}
