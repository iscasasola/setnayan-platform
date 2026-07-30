/**
 * lib/ugat/code-areas.ts — the AREA taxonomy for the code map.
 *
 * ── WHY AREAS AND NOT COMMUNITIES ──────────────────────────────────────────
 * The underlying knowledge graph assigns every node a detected "community"
 * (Louvain clustering). Using those as the map's buckets is the obvious idea and
 * it is wrong: they are NOT STABLE across rebuilds. Refreshing the graph over 83
 * commits moved the community count from 1,753 to 3,690 and auto-renamed 36 of
 * them. An admin view keyed on community ids would therefore re-shuffle its own
 * groupings every time the graph regenerates, and a map whose shape changes for
 * reasons the reader cannot see is worse than no map.
 *
 * Directory bucketing was the next attempt: 1,644 buckets and 5,015 bonds. Stable,
 * but not a readable altitude — barely better than the communities it replaced.
 *
 * AREAS are hand-declared, deliberately few, and derived from PATH PREFIXES, so
 * they are stable by construction: the same file always lands in the same area,
 * and the set only changes when a human edits this list. 17 areas / 64 bonds is
 * comparable to the entity map's 11 nodes — an altitude a person can actually
 * hold in their head.
 *
 * ── ORDER MATTERS ──────────────────────────────────────────────────────────
 * Rules are evaluated top-down and the FIRST match wins, so specific prefixes
 * must precede general ones. `apps/web/app/admin/` has to beat `apps/web/app/`.
 * `areaForPath` depends on that ordering; do not sort this array.
 */

export interface CodeArea {
  /** Stable id — used as a node key. Renaming one is a breaking change. */
  id: string;
  /** Human label shown on the map. */
  label: string;
  /** Path prefix that assigns a file to this area. */
  prefix: string;
  /** One line on what lives here. */
  blurb: string;
}

/** First match wins. Specific before general — see the note above. */
export const CODE_AREAS: readonly CodeArea[] = [
  { id: 'admin', label: 'Admin console', prefix: 'apps/web/app/admin/', blurb: 'the internal operations surfaces' },
  { id: 'couple', label: 'Couple dashboard', prefix: 'apps/web/app/dashboard/', blurb: 'the host’s event workspace' },
  { id: 'vendor', label: 'Vendor dashboard', prefix: 'apps/web/app/vendor-dashboard/', blurb: 'the vendor’s business surfaces' },
  { id: 'onboarding', label: 'Onboarding', prefix: 'apps/web/app/onboarding/', blurb: 'event creation and first-run' },
  { id: 'api', label: 'API routes', prefix: 'apps/web/app/api/', blurb: 'route handlers and webhooks' },
  { id: 'vendor-public', label: 'Public vendor page', prefix: 'apps/web/app/v/', blurb: 'the marketplace-facing profile' },
  { id: 'components', label: 'Shared components', prefix: 'apps/web/app/_components/', blurb: 'cross-surface UI' },
  // apps/web/components/ is a SECOND shared-UI root that predates app/_components.
  // Missing it put 20.8% of the graph in `other` on the first generation — which
  // is exactly what the `other` bucket exists to make visible.
  { id: 'components', label: 'Shared components', prefix: 'apps/web/components/', blurb: 'cross-surface UI' },
  { id: 'actions', label: 'Shared actions', prefix: 'apps/web/app/_actions/', blurb: 'cross-surface server actions' },
  { id: 'site', label: 'Public site', prefix: 'apps/web/app/', blurb: 'marketing, help, guest-facing pages' },
  { id: 'lib', label: 'lib', prefix: 'apps/web/lib/', blurb: 'the shared library everything depends on' },
  { id: 'tests', label: 'Tests', prefix: 'apps/web/tests/', blurb: 'db replay and integration guards' },
  { id: 'web-scripts', label: 'Web scripts', prefix: 'apps/web/scripts/', blurb: 'lint guards, generators, seeds' },
  { id: 'migrations', label: 'Migrations', prefix: 'supabase/migrations', blurb: 'the schema’s whole history' },
  { id: 'mobile', label: 'Mobile', prefix: 'apps/mobile', blurb: 'the native shells' },
  { id: 'desktop', label: 'Desktop', prefix: 'src-tauri/', blurb: 'the Tauri wrapper' },
  { id: 'packages', label: 'Packages', prefix: 'packages/', blurb: 'workspace packages' },
  { id: 'scripts', label: 'Repo scripts', prefix: 'scripts/', blurb: 'repo-level tooling' },
  { id: 'ci', label: 'CI & hooks', prefix: '.github/', blurb: 'workflows and required checks' },
  { id: 'githooks', label: 'Git hooks', prefix: '.githooks/', blurb: 'pre-push guards' },
  { id: 'db-security', label: 'DB security', prefix: 'supabase/security', blurb: 'the exposure baseline and its guards' },
  // LAST among prefixed rules: apps/web root files (next.config, package.json,
  // the PWA manifest). Must come after every apps/web/<dir>/ rule above.
  { id: 'config', label: 'Root config', prefix: 'apps/web/', blurb: 'workspace and build configuration' },
] as const;

/**
 * Repo-root files (turbo.json, tsconfig, package.json…) are configuration.
 *
 * Handled in `areaForPath` rather than as a `prefix: ''` catch-all RULE, and the
 * distinction matters: a rule matching everything would make `other` unreachable,
 * and `other` is the only thing that shows what the taxonomy has failed to
 * classify. It earned that on the first generation by surfacing
 * `apps/web/components/` as 20.8% of the graph. A catch-all would have hidden
 * that inside "config" and the gap would still be there, invisible.
 *
 * So: no-slash paths are config; a NEW top-level directory still lands in
 * `other`, loudly.
 */
const ROOT_CONFIG: CodeArea = {
  id: 'config',
  label: 'Root config',
  prefix: '',
  blurb: 'workspace and build configuration',
};

/** Areas plus the root-config pseudo-area, for label lookup. */
export const ALL_CODE_AREAS: readonly CodeArea[] = [...CODE_AREAS, ROOT_CONFIG];

export type CodeAreaId = (typeof CODE_AREAS)[number]['id'] | 'other';

/**
 * The area a repo-relative path belongs to.
 *
 * Everything unmatched lands in `other` rather than being dropped — a silently
 * discarded file is a hole in the map you cannot see. `other` shows up as a real
 * node with a real count, so the size of what we failed to classify is visible.
 */
export function areaForPath(path: string | null | undefined): CodeAreaId {
  if (!path) return 'other';
  for (const a of CODE_AREAS) {
    if (a.prefix && path.startsWith(a.prefix)) return a.id as CodeAreaId;
  }
  // A repo-root file (no directory) is configuration.
  if (!path.includes('/')) return 'config';
  // Anything else is genuinely unclassified — a new top-level directory, or a
  // shape the taxonomy has not been taught. It stays visible.
  return 'other';
}

/** A bond between two areas, with the number of underlying references. */
export interface CodeAreaEdge {
  from: CodeAreaId;
  to: CodeAreaId;
  /** How many individual EXTRACTED references underlie this bond. */
  weight: number;
}

export interface CodeAreaNode {
  id: CodeAreaId;
  label: string;
  blurb: string;
  /** Graph nodes (files, symbols) attributed to this area. */
  size: number;
  /** The most depended-upon files in this area, heaviest first. */
  hubs: Array<{ path: string; dependents: number }>;
}

/** The committed derivative. Small by design — see scripts/gen-ugat-code-map.ts. */
export interface CodeMap {
  /** The commit the underlying graph was built from. */
  builtAtCommit: string;
  /** ISO date the derivative was generated. */
  generatedAt: string;
  /** Total nodes/edges in the SOURCE graph, for honesty about what was summarised. */
  source: { nodes: number; edges: number };
  areas: CodeAreaNode[];
  edges: CodeAreaEdge[];
}

/** Areas sorted heaviest-first — the render order. */
export function areasBySize(map: CodeMap): CodeAreaNode[] {
  return [...map.areas].sort((a, b) => b.size - a.size);
}

/**
 * Everything that depends ON an area — its blast radius at area altitude.
 *
 * "What breaks if I change this" is the question the code map exists to answer,
 * and this is its coarsest honest form: not which file, but which surfaces.
 */
export function dependentsOf(map: CodeMap, id: CodeAreaId): CodeAreaEdge[] {
  return map.edges.filter((e) => e.to === id).sort((a, b) => b.weight - a.weight);
}

/** Everything an area depends on. */
export function dependenciesOf(map: CodeMap, id: CodeAreaId): CodeAreaEdge[] {
  return map.edges.filter((e) => e.from === id).sort((a, b) => b.weight - a.weight);
}
