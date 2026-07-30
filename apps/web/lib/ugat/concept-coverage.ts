/**
 * lib/ugat/concept-coverage.ts — a new SUBSYSTEM cannot ship invisible to the
 * Ugat entity map.
 *
 * ── THE FAILURE THIS EXISTS TO PREVENT ─────────────────────────────────────
 * `20270808218211_samahan_communities_foundation.sql` created `communities`,
 * `community_members`, `community_invite_tokens` and an `events.community_id`
 * FK — an entire product concept — and /admin/ugat/map did not learn about it
 * for three weeks. Nobody did anything wrong. There was simply no signal.
 *
 * `schema-claims.ts` closed the opposite hole: the map can no longer LIE about
 * what exists. This closes the one that remained — the map silently falling
 * BEHIND a schema that grows weekly.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
 * The map is a CONCEPT-level abstraction: ten nodes over ~380 tables and ~664
 * table-to-table bonds — under 2% coverage, by design. It is not an ERD and
 * must never become one. So this guard does NOT demand every table or every FK
 * be mapped. It asks one narrow question:
 *
 *     "Has something appeared that looks like a new SUBSYSTEM, which nobody has
 *      either put on the map or explicitly, in writing, declined to?"
 *
 * ── WHY THREE SENSORS AND NOT ONE ──────────────────────────────────────────
 * Each has a blind spot the others cover, so the union is the guard:
 *
 *   HUB      — a table two or more other tables point at. Samahan's
 *              `communities` had three. Misses star-shaped subsystems whose
 *              tables all hang off `events` instead of off each other.
 *   SPINE    — a table that a mapped CORE table points TO. This is the exact
 *              signature of a new concept attaching itself to the platform
 *              spine (`events.community_id → communities`). Misses leaf-only
 *              clusters nothing core references yet.
 *   FAMILY   — three or more tables sharing a name prefix with no mapped
 *              member. Catches the star-shaped case the other two miss.
 *
 * ── WHY IT CANNOT CRY WOLF ─────────────────────────────────────────────────
 * This repo built and DELETED a guard of this general kind: a regex schema
 * parser that produced 18 false positives out of 32 findings (see the autopsy
 * docblock in tests/db/schema-drift.db.test.ts). Every input here comes from
 * `pg_catalog` AFTER executing real SQL, so a finding can never point at
 * something that does not exist. Its findings are judgement prompts — "is this
 * three-table feature a concept?" — never factual errors. That distinction is
 * exactly what the deleted parser lacked.
 *
 * If it ever feels noisy the response is to raise a threshold, NOT to delete
 * the guard. Both thresholds are parameters for that reason.
 *
 * PURE: no PGlite, no `fs`, no database driver — mirroring `schema-claims.ts`,
 * so every case (including every way this SHOULD fire) unit-tests in
 * milliseconds against a synthetic schema.
 */

/** Default: a table two or more distinct tables reference is a hub. */
export const HUB_MIN_INBOUND = 2;

/** Default: three or more tables sharing a name prefix form a family. */
export const FAMILY_MIN = 3;

/** Minimum prefix length before a name family is considered meaningful. */
const MIN_PREFIX_LEN = 3;

/** A distinct table→table foreign-key bond. Self-references are excluded. */
export interface FkEdge {
  from: string;
  to: string;
}

export type CoverageReason = 'hub' | 'spine-referenced' | 'name-family';

export interface CoverageFinding {
  /** The unmapped table (or the family's representative table). */
  table: string;
  reason: CoverageReason;
  /** Human-readable evidence — what actually tripped the sensor. */
  evidence: string;
  /** For 'name-family', the sibling tables that formed it. */
  family?: string[];
}

export interface CoverageInput {
  /** Every table in the public schema. */
  tables: readonly string[];
  /** Distinct table→table FK bonds. */
  fkEdges: readonly FkEdge[];
  /**
   * Tables the map already accounts for — derived from graph.ts at check time
   * (node `table` bindings + joint `joint` tables + tables named in claims), so
   * that properly mapping a concept greens this check with no baseline edit.
   */
  mapped: ReadonlySet<string>;
  /**
   * The map's CORE tables — the platform spine. A new table these point at is
   * the strongest single signal of a new concept.
   */
  spine: ReadonlySet<string>;
  /**
   * table → written reason for staying off the map.
   *
   * A key ending in `_*` is a PREFIX entry covering a whole family. Without it,
   * declining a 13-table subsystem would need 13 identical lines, and the file
   * would stop being something a human reads — at which point the reasons stop
   * being real, which is the only thing the escape hatch is for.
   */
  baseline: ReadonlyMap<string, string>;
  hubMinInbound?: number;
  familyMin?: number;
}

/** True when a baseline key covers this table (exact name, or `prefix_*`). */
export function baselineCovers(baseline: ReadonlyMap<string, string>, table: string): boolean {
  if (baseline.has(table)) return true;
  for (const key of baseline.keys()) {
    if (key.endsWith('_*') && table.startsWith(key.slice(0, -1))) return true;
  }
  return false;
}

/** Distinct inbound referencing tables per target. */
export function inboundCounts(fkEdges: readonly FkEdge[]): Map<string, Set<string>> {
  const inbound = new Map<string, Set<string>>();
  for (const e of fkEdges) {
    if (e.from === e.to) continue; // self-FK is not a relationship between things
    let set = inbound.get(e.to);
    if (!set) {
      set = new Set();
      inbound.set(e.to, set);
    }
    set.add(e.from);
  }
  return inbound;
}

/** The leading underscore-delimited segments of a table name, longest first. */
function prefixesOf(table: string): string[] {
  const parts = table.split('_');
  const out: string[] = [];
  for (let n = parts.length - 1; n >= 1; n--) {
    const p = parts.slice(0, n).join('_');
    if (p.length >= MIN_PREFIX_LEN) out.push(p);
  }
  return out;
}

/**
 * Groups tables into name families of at least `familyMin` members.
 *
 * Uses the LONGEST qualifying prefix per group so that `papic_pool_*` is its own
 * family rather than being swallowed by `papic_*` — a coarser grouping would
 * hide a genuinely new sub-concept inside an already-mapped one.
 */
export function computePrefixFamilies(
  tables: readonly string[],
  familyMin: number = FAMILY_MIN,
): Map<string, string[]> {
  const byPrefix = new Map<string, string[]>();
  for (const t of tables) {
    for (const p of prefixesOf(t)) {
      const list = byPrefix.get(p) ?? [];
      list.push(t);
      byPrefix.set(p, list);
    }
  }
  const families = new Map<string, string[]>();
  const claimed = new Set<string>();
  // Longest prefixes first so specific families win over generic ones.
  for (const p of [...byPrefix.keys()].sort((a, b) => b.length - a.length)) {
    const members = (byPrefix.get(p) ?? []).filter((t) => !claimed.has(t));
    if (members.length >= familyMin) {
      families.set(p, members.sort());
      for (const m of members) claimed.add(m);
    }
  }
  return families;
}

/**
 * Every unmapped, unbaselined thing that looks like a subsystem.
 *
 * Returns ALL findings rather than failing fast — one new cluster should not
 * hide the next.
 */
export function verifyConceptCoverage(input: CoverageInput): CoverageFinding[] {
  const hubMin = input.hubMinInbound ?? HUB_MIN_INBOUND;
  const familyMin = input.familyMin ?? FAMILY_MIN;
  const inbound = inboundCounts(input.fkEdges);
  const findings: CoverageFinding[] = [];

  /** Accounted for = on the map, or explicitly declined in the baseline. */
  const accountedFor = (t: string) =>
    input.mapped.has(t) || baselineCovers(input.baseline, t);

  // ── sensor 1: hubs ───────────────────────────────────────────────────────
  for (const [target, referrers] of inbound) {
    if (accountedFor(target)) continue;
    if (referrers.size < hubMin) continue;
    findings.push({
      table: target,
      reason: 'hub',
      evidence: `${referrers.size} tables reference it (${[...referrers].sort().slice(0, 4).join(', ')}${
        referrers.size > 4 ? ', …' : ''
      })`,
    });
  }

  // ── sensor 2: referenced by the spine ────────────────────────────────────
  const alreadyFound = new Set(findings.map((f) => f.table));
  for (const e of input.fkEdges) {
    if (e.from === e.to) continue;
    if (!input.spine.has(e.from)) continue;
    if (accountedFor(e.to) || alreadyFound.has(e.to)) continue;
    findings.push({
      table: e.to,
      reason: 'spine-referenced',
      evidence: `the mapped core table "${e.from}" points at it — a new concept attaching to the spine`,
    });
    alreadyFound.add(e.to);
  }

  // ── sensor 3: name families with no mapped member ─────────────────────────
  for (const [prefix, members] of computePrefixFamilies(input.tables, familyMin)) {
    if (members.some((m) => input.mapped.has(m))) continue; // the concept IS mapped
    const unaccounted = members.filter((m) => !accountedFor(m));
    if (unaccounted.length < familyMin) continue; // baselined away, or too small
    const rep = unaccounted[0]!;
    if (alreadyFound.has(rep)) continue;
    findings.push({
      table: rep,
      reason: 'name-family',
      evidence: `${unaccounted.length} tables named "${prefix}_*" and not one of them is on the map`,
      family: unaccounted,
    });
    alreadyFound.add(rep);
  }

  return findings.sort((a, b) => a.table.localeCompare(b.table));
}

/**
 * Baseline lines naming a table that no longer exists, or that no longer looks
 * like a subsystem.
 *
 * Without this the escape hatch rots into fiction — the same failure the health
 * findings had, where a written record outlived the thing it described.
 */
export function staleBaselineEntries(input: CoverageInput): string[] {
  const present = new Set(input.tables);
  const stale: string[] = [];
  for (const key of input.baseline.keys()) {
    if (key.endsWith('_*')) {
      // A prefix entry rots when nothing matches it any more — the subsystem was
      // renamed or removed and the reason now describes nothing.
      const stem = key.slice(0, -1);
      if (!input.tables.some((t) => t.startsWith(stem))) {
        stale.push(`${key} — matches no table any more; delete this line`);
      }
      continue;
    }
    if (!present.has(key)) {
      stale.push(`${key} — no longer exists; delete this line`);
    } else if (input.mapped.has(key)) {
      stale.push(`${key} — now ON the map; delete this line (it is no longer declined)`);
    }
  }
  return stale.sort();
}

/** Failure text that tells the developer exactly what to do, in one line each. */
export function formatConceptFindings(findings: readonly CoverageFinding[]): string {
  if (findings.length === 0) return 'Ugat concept coverage: nothing unaccounted for.';
  const lines = findings.map((f) => {
    const what = f.family ? `${f.table} (+${f.family.length - 1} siblings)` : f.table;
    return `  · ${what} [${f.reason}] — ${f.evidence}`;
  });
  return [
    `${findings.length} thing(s) look like a new subsystem the Ugat map does not know about:`,
    ...lines,
    '',
    'Pick ONE for each, in the PR that introduced it:',
    '  (a) it IS a concept  → add a node to UGAT_TYPES in apps/web/lib/ugat/graph.ts',
    '                         (and a joint, with its REQUIRED claims), then re-run;',
    '  (b) it is NOT        → add one line to',
    '                         apps/web/tests/db/ugat-concept.baseline.txt as',
    '                         "<table> | <why it stays off the map>".',
    '',
    'Do NOT delete or weaken this check to go green. Samahan shipped invisible for',
    'three weeks because no signal like this existed. If it is firing too often,',
    'raise hubMinInbound / familyMin — the thresholds are parameters for exactly',
    'that reason.',
  ].join('\n');
}
