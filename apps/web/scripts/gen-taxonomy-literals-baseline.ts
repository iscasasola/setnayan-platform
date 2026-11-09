/**
 * gen-taxonomy-literals-baseline.ts — regenerate `lib/no-taxonomy-literals.baseline.txt`.
 *
 *   pnpm exec tsx scripts/gen-taxonomy-literals-baseline.ts          # SHRINK (the normal run)
 *   pnpm exec tsx scripts/gen-taxonomy-literals-baseline.ts --seed   # first write only
 *
 * The normal run can only LOWER a count or DELETE a line — it never adds one, so
 * running it can never permit a new hard-coded copy of the taxonomy. A new copy
 * is fixed by reading `getTaxonomy()`, or (for a deliberate product list) by a
 * human adding ONE reasoned line by hand, reviewed in the PR.
 *
 * `--seed` writes every current finding with the reasons below. It was run once,
 * when the guard landed (2026-11-09); do not run it again to make a red test green.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isScannedPath, scanTaxonomyLiterals, type LiteralKind } from '../lib/taxonomy-literal-scan';

const WEB = join(import.meta.dirname, '..');
const BASELINE = join(WEB, 'lib/no-taxonomy-literals.baseline.txt');
const ROOTS = ['app', 'lib', 'components'];

const HEADER = `# Hard-coded copies of the service taxonomy that existed when
# lib/no-taxonomy-literals.test.ts landed (2026-11-09). file<TAB>kind<TAB>count<TAB># reason.
#
# A DEBT, NOT A PERMISSION. Owner, 9 Nov: "make sure the services are not hard
# coded and other codes that should live based on the taxonomy." Admin ›
# Categories is the one source; a screen that keeps its own list does not follow
# an admin's rename, move or new category.
#
# This file may only SHRINK. Fix a copy (read getTaxonomy() / the taxonomy
# tables), then run:
#   pnpm exec tsx scripts/gen-taxonomy-literals-baseline.ts
# which lowers counts and deletes lines and never adds one. A NEW copy fails the
# test; the only way to keep one is a hand-written line with a reason, in review.
#
# Reasons starting "PENDING" are files an integrating PR changes — pre-registered
# so that integration stays green, and allowed to go stale until it lands. Delete
# them once it has. (None today: #7416 and #7413 both landed 2026-11-09.)
`;

/** Reasons for the rows the 2026-11-09 audit read. Everything else is UNREVIEWED. */
const REASONS: Record<string, string> = {
  'lib/supplier-find.ts':
    'DELIBERATE · FIND_GROUP_OF_TILE (host-facing regrouping) + POPULAR_BY_TYPE (editorial "Popular for <type>", order-only — it can never ADD a category). No existing column encodes either. Exit: an admin find_group / popular field — owner sign-off on the new field first',
  'lib/supplier-access-by-category.ts':
    'PRIVACY GATE · who may see the seat plan, guest list, meal counts; mirrored in the SQL RPCs; fails CLOSED today (a new category sees nothing). Moving it needs an access column read by BOTH the RPC and the app — not provable safe without that migration + owner sign-off. Left on purpose',
  'lib/vendor-category-parents.ts':
    'PRIVACY GATE input · TILE_PARENT in parentsOfCategory feeds supplier-access-by-category; moves with it, not before it',
  'lib/coordinator-trade.ts':
    'GUARDED · COORDINATOR_TRADE_SERVICES is mirrored in SQL services_make_a_coordinator and held equal to the seed by coordinator-trade-is-one-list.test.ts. Exit: derive it in SQL from the tables',
  'lib/supplier-landing-data.ts':
    'FAIL-CLOSED · ADMIN_ONLY_TILES OR hiddenCategories — owner ruling 2026-08-27 keeps officiants + counseling shut; the constant keeps them shut even if a DB row loses its hidden flag',
  'lib/wedding-plan-groups.ts':
    'DELIBERATE · PLAN_GROUPS (the couple plan: hints, monthsBefore, catalogTile). Largest item; exit: an admin plan-group table — owner sign-off first',
  'app/onboarding/wedding/_components/onboarding-shell.tsx':
    'DELIBERATE · PICK_GROUPS_FALLBACK — curated couple copy for "What would you love?"; the live categories are merged in. Exit: build the picker from the snapshot (owner sign-off on the copy)',
  'lib/onboarding/persona-packs.ts': 'DELIBERATE · onboarding persona packs — curated picks keyed by category',
  'app/onboarding/wedding/_data/experience-personas.ts': 'DELIBERATE · onboarding persona picks (EXP_ESSENTIAL_PICKS)',
  'app/onboarding/wedding/_data/refinements.ts': 'DELIBERATE · onboarding refinement content keyed by category',
  'lib/onboarding-availability.ts': 'PICK_TO_GROUP — follows PLAN_GROUPS; exit with it',
  'lib/service-card-maker.ts':
    'DELIBERATE · maker profiles (church / caterer / studio defaults: lead months, per-pax, crew). Exit: an admin maker_profile column — owner sign-off first',
  'lib/vendor-service-tools.ts': 'DELIBERATE · SPECIALIST_TOOLS — which categories see which tools. Exit: an admin "tools offered" field',
  'lib/vendor-day-of.ts': 'DELIBERATE · PHOTO_/CATERER_CANONICALS choose the on-the-day console. Exit: an admin console-kind field',
  'lib/vendor-dayof-modules.ts': 'TILE_PARENT in a sync helper whose callers hold no snapshot. Exit: pass taxonomy.tileParent in',
  'lib/songs.ts': 'DELIBERATE · MUSIC_CANONICALS — who gets the song bank. Exit: an admin flag',
  'lib/appointments.ts': 'category → appointment type bridge. Exit: an admin column',
  'lib/vendor-timeline.ts': 'DELIBERATE · ALWAYS_PRIMARY / RELEVANCE_MAP timeline relevance. Exit: an admin flag',
  'lib/vendor-packages.ts': 'PACKAGE_CANONICAL_TO_VENDOR_CATEGORY — feeds stored package rows. Exit: read coarse_category',
  'lib/budget-allocation-data.ts': 'LEAF_CANONICAL_SERVICES budget-median inputs. Exit: read the buckets',
  'lib/taxonomy-folder-counts.ts': 'FRONT_DOOR_VISIBLE_FOLDERS + a seed count. Exit: an admin front_door_visible flag + a live count',
  'app/(shell)/explore/page.tsx':
    'module-level copies left: the TAXONOMY_OPTIONS autocomplete and the tile-slug URL pair (SLUG_TO_TILE + buildHref must change TOGETHER). JSON-LD + ?folder= now read getTaxonomy(). Exit: thread the snapshot',
  'lib/category-hints.ts': 'SEED DEFAULT · the ⓘ written in code for a category whose admin hint_en is blank',
  'lib/taxonomy-icons.ts': 'SEED DEFAULT · the icon for a category with no admin icon_name',
  'app/admin/categories/page.tsx': 'ADMIN · the editor’s own default selection',
  'app/admin/categories/_components/load.ts': 'ADMIN · the editor’s own load',
  'app/tour/vendors/page.tsx': 'DEMO · the product tour’s fixed sample',
  'app/_components/plan3d/kit/booth-templates.ts': 'DESIGN · 3D booth sign text per category',
  'lib/seating-3d.ts': 'CHANGED BY #7416/#7413 (both merged 2026-11-09) · a copy that existed before them and still does. Exit: read getTaxonomy()',
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx': 'CHANGED BY #7416/#7413 (both merged 2026-11-09) · a copy that existed before them and still does. Exit: read getTaxonomy()',
  'app/vendor-dashboard/services/_components/canvas-maker.tsx': 'CHANGED BY #7416/#7413 (both merged 2026-11-09) · a copy that existed before them and still does. Exit: read getTaxonomy()',
  'app/vendor-dashboard/services/_components/services-manager.tsx': 'CHANGED BY #7416/#7413 (both merged 2026-11-09) · a copy that existed before them and still does. Exit: read getTaxonomy()',
};

const DEFAULT_REASON = 'UNREVIEWED · found when the guard landed (2026-11-09). Exit: read getTaxonomy() / the taxonomy tables';

/**
 * Findings that exist on an integrating branch but not yet on main — pre-registered
 * so that branch's integration does not go red on a line it is already removing.
 */
const PENDING_EXTRA: Array<[string, LiteralKind, number, string]> = [
  // Empty: Supplier Builds 3 (#7416) and 4 (#7413) both landed 2026-11-09, and
  // Build 3's TAXONOMY_MAP import in lib/supplier-hero.server.ts went with them.
];

export type BaselineRow = { file: string; kind: LiteralKind; count: number; reason: string };

export function readBaseline(path = BASELINE): BaselineRow[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const [file, kind, count, ...rest] = l.split('\t');
      return { file: file!, kind: kind as LiteralKind, count: Number(count), reason: rest.join('\t').replace(/^#\s*/, '') };
    });
}

export function currentCounts(): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.next') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(WEB, p);
        if (!isScannedPath(rel)) continue;
        for (const f of scanTaxonomyLiterals(rel, readFileSync(p, 'utf8'))) {
          const k = `${rel}\t${f.kind}`;
          out.set(k, (out.get(k) ?? 0) + 1);
        }
      }
    }
  };
  for (const r of ROOTS) walk(join(WEB, r));
  return out;
}

function write(rows: BaselineRow[]) {
  rows.sort((a, b) => (a.file === b.file ? a.kind.localeCompare(b.kind) : a.file.localeCompare(b.file)));
  const body = rows.map((r) => `${r.file}\t${r.kind}\t${r.count}\t# ${r.reason}`).join('\n');
  writeFileSync(BASELINE, `${HEADER}\n${body}\n`);
}

if (process.argv[1] && /gen-taxonomy-literals-baseline/.test(process.argv[1])) {
  const now = currentCounts();
  if (process.argv.includes('--seed')) {
    const rows: BaselineRow[] = [...now].map(([k, count]) => {
      const [file, kind] = k.split('\t') as [string, LiteralKind];
      return { file, kind, count, reason: REASONS[file] ?? DEFAULT_REASON };
    });
    for (const [file, kind, count, reason] of PENDING_EXTRA) {
      if (!now.has(`${file}\t${kind}`)) rows.push({ file, kind, count, reason });
    }
    write(rows);
    console.log(`seeded ${rows.length} rows`);
  } else {
    // SHRINK: lower to what is there now; never raise, never add. PENDING rows wait for their PR.
    const rows = readBaseline()
      .map((r) => {
        const actual = now.get(`${r.file}\t${r.kind}`) ?? 0;
        if (r.reason.startsWith('PENDING') && actual < r.count) return r;
        return { ...r, count: Math.min(r.count, actual) };
      })
      .filter((r) => r.count > 0);
    write(rows);
    console.log(`baseline now ${rows.length} rows`);
  }
}
