import { createAdminClient } from '@/lib/supabase/admin';
import { type TaxonomyEntry } from '@/lib/taxonomy';
import { getTaxonomy, type TaxonomySnapshot } from '@/lib/taxonomy-db';
import { validateVendorCategoryMapping } from '@/lib/vendor-category-taxonomy';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  updatePlanningDeadline,
  setLastMinuteStart,
  clearLastMinuteStart,
  renameTaxonomyNode,
  remapCanonical,
  createTaxonomyNode,
  createCanonicalLeaf,
  deleteTaxonomyNode,
  moveTaxonomyNode,
  promoteCategoryRequest,
  mapCategoryRequest,
  resolveCategoryRequest,
  setCategoryEventTypes,
  setFolderEventTypes,
  setServiceFaith,
} from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Taxonomy · Admin' };
// Top-level DB reads (admin client + getTaxonomy) — keep this route dynamic so a
// future root app/loading.tsx can't pull it into build-time static generation.
export const dynamic = 'force-dynamic';

type SchemaRow = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
  shared_attribute_groups: string[];
  filter_facets: unknown;
  required_for_visibility: unknown;
};

/** A canonical service row joined to its live taxonomy placement (null = unfiled). */
type ServiceRow = SchemaRow & { meta: TaxonomyEntry | null };

type DeadlineRow = {
  deadline_id: string;
  kind: string;
  ref_key: string;
  scope: string;
  label: string | null;
  offset_value: number;
  offset_unit: string;
  applies_to: string | null;
  is_active: boolean;
};

type ReqRow = {
  request_id: string;
  proposed_label: string;
  proposed_note: string | null;
  status: string;
  mapped_to_canonical: string | null;
  proposed_by_vendor_id: string;
};

/** The `?q=` / `?view=` filter state every form echoes back through `redirectBack`. */
type Back = { q?: string; view?: string | null };

type FaithKey = NonNullable<TaxonomyEntry['faith']>;

const FAITH_TONE_BASE = 'bg-ink/5 text-ink/70';
const FAITH_TONE: Record<FaithKey, string> = {
  Catholic: 'bg-sky-100 text-sky-800',
  Christian: 'bg-violet-100 text-violet-800',
  'Born Again': 'bg-violet-50 text-violet-700',
  INC: 'bg-emerald-100 text-emerald-800',
  Muslim: 'bg-amber-100 text-amber-900',
  Jewish: 'bg-indigo-100 text-indigo-800',
  Chinese: 'bg-red-100 text-red-800',
  Cultural: 'bg-rose-100 text-rose-800',
  Aglipayan: 'bg-cyan-100 text-cyan-800',
  LDS: 'bg-slate-200 text-slate-800',
  SDA: 'bg-teal-100 text-teal-800',
  JW: 'bg-lime-100 text-lime-800',
  Hindu: 'bg-orange-100 text-orange-800',
  Sikh: 'bg-yellow-100 text-yellow-900',
  Buddhist: 'bg-amber-50 text-amber-800',
  Orthodox: 'bg-purple-100 text-purple-800',
  Civil: 'bg-stone-100 text-stone-700',
};

const PHASE_TONE_BASE = 'bg-ink/5 text-ink/70';
const PHASE_TONE: Record<string, string> = {
  'V1.1 base': 'bg-emerald-100 text-emerald-800',
  'V1.1.1': 'bg-emerald-50 text-emerald-700',
  'V1.1.2': 'bg-emerald-50 text-emerald-700',
  'V1.1.3': 'bg-emerald-50 text-emerald-700',
  'V1.1.4': 'bg-emerald-50 text-emerald-700',
  'V1.1.5': 'bg-emerald-50 text-emerald-700',
  'V1.1.6': 'bg-emerald-50 text-emerald-700',
  'V1.2': 'bg-amber-50 text-amber-800',
  'V1.3': 'bg-amber-50 text-amber-800',
  'V1.4': 'bg-amber-50 text-amber-800',
  'V1.5+': 'bg-rose-50 text-rose-800',
};

const JUMP_PILL =
  'rounded-full border border-ink/15 bg-white px-2.5 py-0.5 font-mono text-[11px] text-ink/70 hover:border-terracotta/50 hover:text-terracotta';

export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<Record<'ok' | 'error' | 'q' | 'view' | 'open' | 'openf', string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Next delivers repeated params (`?q=a&q=b`) as string[] — coerce to the first
  // value so a crafted URL can't 500 the page (A2).
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (first(sp.q) ?? '').trim().toLowerCase().slice(0, 80);
  const viewRaw = first(sp.view);
  const view = viewRaw === 'faith' || viewRaw === 'scoped' || viewRaw === 'unfiled' ? viewRaw : null;
  const open = first(sp.open) ?? null;
  const openf = first(sp.openf) ?? null;
  const ok = first(sp.ok);
  const error = first(sp.error);

  const admin = createAdminClient();

  // The 6 independent top-level reads run in parallel (A7) — only the
  // vendor_profiles byline lookup depends on the requests rows, so it stays
  // sequential after. The redirect contract makes this page's render the
  // per-edit loop latency, so the serial → parallel change pays on every save.
  const [schemasRes, tax, eventVocabRes, faithRes, reqRes, deadlinesRes] = await Promise.all([
    admin
      .from('canonical_service_schemas')
      .select(
        'canonical_service, display_name_en, display_name_tl, shared_attribute_groups, filter_facets, required_for_visibility',
      )
      .order('canonical_service', { ascending: true }),
    // DB-backed taxonomy (Phase 2): the tree + canonical mapping are read from
    // service_categories + canonical_service_taxonomy, falling back to the
    // lib/taxonomy.ts constant if the tables are unseeded — see lib/taxonomy-db.ts.
    getTaxonomy(),
    // Event-type vocabulary for the per-tile multi-event applicability control
    // (Phase 1). Public catalogue data; admins assign which events a tile serves.
    admin
      .from('event_type_vocab')
      .select('event_type, label_en, sort_order')
      .eq('status', 'active')
      .order('sort_order', { ascending: true }),
    // Faith vocabulary for the per-service faith control (Phase 2). Faith is
    // INCLUDE-only match-scope — reserved for officiants/seminars/counseling.
    admin
      .from('faith_vocab')
      .select('faith_key, label_en, sort_order')
      .eq('status', 'active')
      .order('sort_order', { ascending: true }),
    // Vendor "request a category" queue (§3.2c). Pending = the review queue;
    // mapped history feeds the demand signal. Missing table (migration not yet
    // applied) → [].
    admin
      .from('taxonomy_category_requests')
      .select('request_id, proposed_label, proposed_note, status, mapped_to_canonical, proposed_by_vendor_id')
      .order('created_at', { ascending: false }),
    // Admin-managed deadlines (planning_deadlines) — the recommended lock-by
    // dates the Home reminders read. A missing table (migration not applied)
    // returns null → the section degrades to "0 set" + the coverage flag shows
    // every category as falling back to code.
    admin
      .from('planning_deadlines')
      .select(
        'deadline_id, kind, ref_key, scope, label, offset_value, offset_unit, applies_to, is_active',
      )
      .order('kind', { ascending: true })
      .order('offset_value', { ascending: false }),
  ]);

  const schemas = (schemasRes.data ?? []) as SchemaRow[];
  const eventTypeVocab = (eventVocabRes.data ?? []) as { event_type: string; label_en: string }[];
  const faithVocab = (faithRes.data ?? []) as { faith_key: string; label_en: string }[];
  const allRequests = (reqRes.data ?? []) as ReqRow[];
  const deadlines = (deadlinesRes.data ?? []) as DeadlineRow[];

  // Phase rank so each tile's services read V1.1 base first, then V1.1.x, then
  // V1.2+ — shared by the per-tile sort below.
  const phaseRank: Record<string, number> = {
    'V1.1 base': 0,
    'V1.1.1': 1,
    'V1.1.2': 2,
    'V1.1.3': 3,
    'V1.1.4': 4,
    'V1.1.5': 5,
    'V1.1.6': 6,
    'V1.2': 7,
    'V1.3': 8,
    'V1.4': 9,
    'V1.5+': 10,
  };

  // Unified tree grouping: file every canonical service under its TILE (from the
  // live taxonomy mapping). Rows with no mapping — or a mapping that points at no
  // tile / a tile that no longer exists — fall into `unfiled` so an admin can
  // file them straight from the tree (the merged tree + mapping surface).
  const rowsByTile = new Map<string, ServiceRow[]>();
  for (const t of tax.tileOrder) rowsByTile.set(t, []);
  const unfiled: ServiceRow[] = [];
  for (const row of schemas) {
    const meta = tax.map[row.canonical_service] ?? null;
    if (meta && meta.tile && rowsByTile.has(meta.tile)) {
      rowsByTile.get(meta.tile)!.push({ ...row, meta });
    } else {
      unfiled.push({ ...row, meta });
    }
  }
  const sortRows = (rows: ServiceRow[]) =>
    rows.sort((a, b) => {
      const ra = a.meta ? phaseRank[a.meta.phase] ?? 99 : 99;
      const rb = b.meta ? phaseRank[b.meta.phase] ?? 99 : 99;
      if (ra !== rb) return ra - rb;
      return a.display_name_en.localeCompare(b.display_name_en);
    });
  for (const rows of rowsByTile.values()) sortRows(rows);
  sortRows(unfiled);

  const totalRows = schemas.length;
  const totalMapped = totalRows - unfiled.length;
  const facetedCount = schemas.filter((r) => {
    const facets = Array.isArray(r.filter_facets) ? r.filter_facets : [];
    return facets.length > 0;
  }).length;

  // Couple-side anchoring — are all legacy vendor_category values still mapped to
  // a live canonical tile? Surfaces drift if an admin deleted/re-keyed a tile the
  // couple-side budget list (event_vendors.category) points at. See
  // lib/vendor-category-taxonomy.ts for the A/B/C bucket study.
  const coupleSideDrift = validateVendorCategoryMapping(tax);

  // Pending requests resolve to a vendor business_name for the ghost-card byline
  // (the one read that depends on the requests rows — kept sequential).
  const pendingRequests = allRequests.filter((r) => r.status === 'pending');
  const reqVendorName = new Map<string, string>();
  const reqVendorIds = [...new Set(pendingRequests.map((r) => r.proposed_by_vendor_id))];
  if (reqVendorIds.length > 0) {
    const { data: vps } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', reqVendorIds);
    for (const vp of (vps ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>) {
      reqVendorName.set(vp.vendor_profile_id, vp.business_name ?? 'a vendor');
    }
  }
  // Demand signal: a canonical with many requests mapped to it has earned its
  // own promotion (owner-gated, demand-driven expansion · §3.2c).
  const demandCounts = new Map<string, number>();
  for (const r of allRequests) {
    if (r.status === 'mapped' && r.mapped_to_canonical) {
      demandCounts.set(r.mapped_to_canonical, (demandCounts.get(r.mapped_to_canonical) ?? 0) + 1);
    }
  }
  const demandSignals = [...demandCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);

  // Last-minute START (Setnayan AI §4) lives in the same table under
  // kind='last_minute_start'. Split it out: it has its own editor section below
  // and must NOT show in the recommended-deadlines list.
  const recommendedDeadlines = deadlines.filter((d) => d.kind !== 'last_minute_start');
  const lmStartByGroup = new Map<string, number>();
  for (const d of deadlines) {
    if (d.kind === 'last_minute_start' && d.scope === 'category') {
      lmStartByGroup.set(d.ref_key, d.offset_value);
    }
  }
  // Bookable categories the admin can set a last-minute window for (the same set
  // the deadline coverage uses).
  const lastMinuteGroups = PLAN_GROUPS.filter((g) => g.countsTowardLockable !== false);

  // Coverage flag — which of the reminder plan-groups have no category deadline
  // (they fall back to PLAN_GROUPS.monthsBefore in code). This is the
  // category-level "missing deadline" surface; per-leaf overrides are a
  // follow-up (the leaf→category map lives in code, not the DB).
  const serviceDeadlineKeys = new Set(
    deadlines.filter((d) => d.kind === 'service' && d.scope === 'category').map((d) => d.ref_key),
  );
  const missingCategories = PLAN_GROUPS.filter(
    (g) => g.countsTowardLockable !== false && !serviceDeadlineKeys.has(g.id),
  );

  // ── Filter derivations (`?q=` + `?view=`) — server-side, in-memory, zero JS ──
  // The filter touches ONLY the category tree + the unfiled tray; the request
  // queue + both deadline sections are PLAN_GROUPS vocabulary and render
  // unconditionally (scope honesty — the result bar says so).
  const filtered = Boolean(q) || Boolean(view);

  const svcHaystack = (r: ServiceRow) =>
    `${r.display_name_en} ${r.display_name_tl ?? ''} ${r.canonical_service}`.toLowerCase();
  const svcVisible = (r: ServiceRow) =>
    (!q || svcHaystack(r).includes(q)) && (view !== 'faith' || Boolean(r.meta?.faith));

  // Per tile: a label match shows ALL rows; otherwise only matching rows.
  const tileLabelMatch = (t: string) => Boolean(q) && (tax.tileLabel[t] ?? t).toLowerCase().includes(q);
  const visibleRowsByTile = new Map(
    [...rowsByTile].map(([t, rows]) => [
      t,
      tileLabelMatch(t) && view !== 'faith' ? rows : rows.filter(svcVisible),
    ]),
  );
  // The pure filter predicate (no `?open=` clause) — counts read this; render
  // visibility adds the open-tile exception so the tile you just edited is
  // always on screen even when the edit made it stop matching (A3).
  const tileMatches = (t: string) =>
    view === 'scoped'
      ? (tax.tileEventTypes[t]?.length ?? 0) > 0 &&
        (!q || tileLabelMatch(t) || (visibleRowsByTile.get(t)?.length ?? 0) > 0)
      : tileLabelMatch(t) || (visibleRowsByTile.get(t)?.length ?? 0) > 0;
  // Precomputed once — the sticky bar and the tree both read these Sets (5c).
  const visibleTiles = new Set(tax.tileOrder.filter((t) => (filtered ? tileMatches(t) : true) || open === t));
  const visibleFolders = new Set(
    tax.folderOrder.filter(
      (f) => !filtered || openf === f || (tax.tilesByParent[f] ?? []).some((t) => visibleTiles.has(t)),
    ),
  );
  const matchedTileList = filtered ? tax.tileOrder.filter(tileMatches) : tax.tileOrder;
  const visibleSvcTotal = matchedTileList.reduce((n, t) => n + (visibleRowsByTile.get(t)?.length ?? 0), 0);
  const visibleTileCount = matchedTileList.length;
  const visibleUnfiled = filtered ? unfiled.filter(svcVisible) : unfiled;

  // Chip + pill counts — O(n) over data already in memory.
  const faithCount = schemas.filter((r) => Boolean(tax.map[r.canonical_service]?.faith)).length;
  const scopedTileCount = tax.tileOrder.filter((t) => (tax.tileEventTypes[t]?.length ?? 0) > 0).length;
  const folderSvcCount: Record<string, number> = {};
  for (const f of tax.folderOrder) {
    folderSvcCount[f] = (tax.tilesByParent[f] ?? []).reduce(
      (n, t) => n + (rowsByTile.get(t)?.length ?? 0),
      0,
    );
  }
  const eventLabel = (e: string) => eventTypeVocab.find((v) => v.event_type === e)?.label_en ?? e;
  const back: Back = { q, view };

  const viewChip = (v: 'faith' | 'scoped' | 'unfiled' | null, label: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (v) p.set('view', v);
    const qs = p.toString();
    const active = view === v;
    return (
      <a
        href={qs ? `/admin/taxonomy?${qs}` : '/admin/taxonomy'}
        aria-current={active ? 'page' : undefined}
        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] ${
          active ? 'bg-terracotta text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
        }`}
      >
        {label}
      </a>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Iteration 0044 · V1.1 vendor taxonomy
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Taxonomy</h1>
        <p className="text-base text-ink/65">
          The single live taxonomy — one tree of{' '}
          <code className="font-mono text-sm">service_categories</code> (parents → tiles) with every{' '}
          <code className="font-mono text-sm">canonical_service_schemas</code> service filed onto a tile via{' '}
          <code className="font-mono text-sm">canonical_service_taxonomy</code>. Edits save to the{' '}
          <strong>{tax.source === 'db' ? 'DB' : 'code fallback'}</strong> and publish live to the marketplace,
          vendor onboarding, and the couple planner with no deploy
          {tax.source === 'fallback' ? ' (tables unseeded — using lib/taxonomy.ts)' : ''}. Faith badges surface on{' '}
          <code className="font-mono text-sm">events.ceremony_type</code>; phase badges show launch sequencing.
        </p>
      </header>

      {ok ? (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {/* Sticky utility bar — search + filtered views + section jump pills.
          Zero JS: a GET form, server-rendered chips, plain hash anchors. The
          feedback strip duplicates the top banners so anchored landings see
          them. NOTE (A8): do NOT wrap the tree below in a Suspense boundary —
          fragment scroll + layout stability depend on the single-pass render. */}
      <div className="sticky top-[57px] z-[15] -mx-4 mb-6 border-b border-ink/10 bg-cream/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-cream/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {ok ? (
          <p role="status" title={ok} className="mb-1.5 truncate text-xs font-medium text-emerald-700">
            ✓ {ok}
          </p>
        ) : null}
        {error ? (
          <p role="alert" title={error} className="mb-1.5 truncate text-xs font-medium text-rose-700">
            ⚠ {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <form method="get" action="/admin/taxonomy" className="flex items-center gap-1.5">
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              placeholder="Find a service or tile…"
              aria-label="Find a service or tile"
              className="w-44 rounded-md border border-ink/15 bg-white px-2 py-1 text-xs text-ink"
            />
            {view ? <input type="hidden" name="view" value={view} /> : null}
            <button
              type="submit"
              className="rounded-md border border-ink/15 bg-white px-2 py-1 text-[11px] font-medium text-ink hover:border-terracotta/50 hover:text-terracotta"
            >
              Find
            </button>
            {q ? (
              <a
                href={view ? `/admin/taxonomy?view=${view}` : '/admin/taxonomy'}
                className="text-[11px] text-ink/50 underline"
              >
                Clear
              </a>
            ) : null}
          </form>
          {viewChip(null, 'All')}
          {viewChip('faith', `Faith-tagged ${faithCount}`)}
          {viewChip('scoped', `Event-scoped ${scopedTileCount}`)}
          {viewChip('unfiled', `Unfiled ${unfiled.length}`)}
          <span className="mx-1 h-4 w-px bg-ink/15" aria-hidden />
          <nav aria-label="Page sections" className="flex flex-wrap items-center gap-1.5">
            {tax.folderOrder.map((f) => {
              const label = tax.folderLabel[f] ?? f;
              const count = folderSvcCount[f] ?? 0;
              if (view === 'unfiled') {
                return (
                  <span key={f} title="Tree hidden in Unfiled view" className={`${JUMP_PILL} opacity-40`}>
                    {label} <span className="text-ink/40">{count}</span>
                  </span>
                );
              }
              const noMatch = filtered && !visibleFolders.has(f);
              return (
                <a
                  key={f}
                  href={`#f-${f}`}
                  title={noMatch ? 'No matches in this folder' : undefined}
                  className={`${JUMP_PILL} ${noMatch ? 'opacity-40' : ''}`}
                >
                  {label} <span className="text-ink/40">{count}</span>
                  {noMatch ? <span className="sr-only"> (no matches)</span> : null}
                </a>
              );
            })}
            <a href="#queue" className={JUMP_PILL}>
              Queue{pendingRequests.length > 0 ? <span className="text-ink/40"> {pendingRequests.length}</span> : null}
            </a>
            <a href="#deadlines" className={JUMP_PILL}>
              Deadlines
            </a>
            <a href="#advanced" className={JUMP_PILL}>
              + Advanced
            </a>
            {unfiled.length > 0 ? (
              <a
                href="#unfiled"
                className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-[11px] text-amber-800"
              >
                Unfiled {unfiled.length}
              </a>
            ) : null}
          </nav>
        </div>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total rows" value={totalRows} />
        <Stat label="Filed on a tile" value={totalMapped} />
        <Stat label="With filter_facets" value={facetedCount} />
        <Stat label="Unfiled" value={unfiled.length} />
      </section>

      <p
        className={`mb-8 -mt-4 rounded-lg border px-4 py-2 text-sm ${
          coupleSideDrift.length === 0
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {coupleSideDrift.length === 0 ? (
          <>
            ✓ Couple-side anchoring — every <code className="font-mono text-xs">vendor_category</code> maps
            to a live canonical tile (or is intentionally exempt: officiant · church_fees · security · misc).
          </>
        ) : (
          <>
            ⚠ {coupleSideDrift.length} couple-side{' '}
            {coupleSideDrift.length === 1 ? 'category points' : 'categories point'} at a missing tile:{' '}
            {coupleSideDrift.map((d) => `${d.category} → ${d.missingTiles.join(', ')}`).join(' · ')}
          </>
        )}
      </p>

      <section id="queue" className="mb-10 scroll-mt-32">
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Vendor category requests{' '}
            <span className="font-normal text-ink/55">(§3.2c — promote · map · keep-private · reject)</span>
          </h2>
          <span className="font-mono text-xs text-ink/55">{pendingRequests.length} pending</span>
        </header>
        {demandSignals.length > 0 ? (
          <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
            📈 Demand signal — repeatedly requested, mapped to:{' '}
            {demandSignals.map(([c, n]) => `${c} (${n})`).join(' · ')}. Consider promoting to its own node.
          </p>
        ) : null}
        {pendingRequests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/55">
            No pending requests. Vendor proposals from the services editor land here.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendingRequests.map((r) => (
              <li
                key={r.request_id}
                className="space-y-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{r.proposed_label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                    from {reqVendorName.get(r.proposed_by_vendor_id) ?? 'a vendor'}
                  </span>
                </div>
                {r.proposed_note ? <p className="text-xs text-ink/65">{r.proposed_note}</p> : null}
                <div className="flex flex-wrap items-end gap-2">
                  <form action={promoteCategoryRequest} className="flex items-center gap-1">
                    <input type="hidden" name="request_id" value={r.request_id} />
                    <BackFields q={back.q} view={back.view} anchor="queue" />
                    <select
                      name="tile_id"
                      defaultValue=""
                      required
                      aria-label="Promote under tile"
                      className="max-w-[160px] rounded-md border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
                    >
                      <option value="" disabled>
                        promote under tile…
                      </option>
                      {tax.folderOrder.map((folder) => (
                        <optgroup key={folder} label={tax.folderLabel[folder] ?? folder}>
                          {(tax.tilesByParent[folder] ?? []).map((t) => (
                            <option key={t} value={t}>
                              {tax.tileLabel[t] ?? t}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <SubmitButton
                      className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                      pendingLabel="Promoting…"
                    >
                      Promote ✓
                    </SubmitButton>
                  </form>
                  <form action={mapCategoryRequest} className="flex items-center gap-1">
                    <input type="hidden" name="request_id" value={r.request_id} />
                    <BackFields q={back.q} view={back.view} anchor="queue" />
                    <select
                      name="mapped_to_canonical"
                      defaultValue=""
                      required
                      aria-label="Map to existing service"
                      className="max-w-[160px] rounded-md border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
                    >
                      <option value="" disabled>
                        map to existing…
                      </option>
                      {schemas.map((s) => (
                        <option key={s.canonical_service} value={s.canonical_service}>
                          {s.display_name_en}
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      className="rounded-md border border-sky-300 bg-white px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                      pendingLabel="Mapping…"
                    >
                      Map →
                    </SubmitButton>
                  </form>
                  <form action={resolveCategoryRequest}>
                    <input type="hidden" name="request_id" value={r.request_id} />
                    <input type="hidden" name="outcome" value="kept_private" />
                    <BackFields q={back.q} view={back.view} anchor="queue" />
                    <SubmitButton
                      className="rounded-md border border-ink/20 bg-white px-2 py-1 text-[11px] font-medium text-ink/70 hover:border-ink/40"
                      pendingLabel="Saving…"
                    >
                      Keep private
                    </SubmitButton>
                  </form>
                  <form action={resolveCategoryRequest} className="flex items-center gap-1">
                    <input type="hidden" name="request_id" value={r.request_id} />
                    <input type="hidden" name="outcome" value="rejected" />
                    <BackFields q={back.q} view={back.view} anchor="queue" />
                    <input
                      name="resolution_note"
                      placeholder="reason (optional)"
                      aria-label="Reject reason"
                      className="w-28 rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[11px] text-ink"
                    />
                    <SubmitButton
                      className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                      pendingLabel="Rejecting…"
                    >
                      Reject
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="deadlines" className="mb-10 scroll-mt-32">
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Recommended deadlines</h2>
          <span className="font-mono text-xs text-ink/55">{recommendedDeadlines.length} set</span>
        </header>
        <p className="mb-3 text-sm text-ink/60">
          The lock-by dates the couple&apos;s Home reminders read (couple-side — distinct from the vendor&apos;s own delivery plan). A category with no row falls back to the code default. <strong>Months</strong> for services, <strong>days</strong> for documents — edit either.
        </p>
        {deadlines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/20 bg-cream/60 px-4 py-3 text-sm text-ink/60">
            No deadline rows — the <code className="font-mono text-xs">planning_deadlines</code> migration isn&apos;t applied yet (<code className="font-mono text-xs">supabase db push</code>). Reminders run on code defaults until then.
          </p>
        ) : (
          <>
            {missingCategories.length > 0 ? (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                ⚠ {missingCategories.length}{' '}
                {missingCategories.length === 1 ? 'reminder category has' : 'reminder categories have'} no deadline (using code fallback):{' '}
                {missingCategories.map((g) => g.label).join(', ')}
              </p>
            ) : (
              <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                ✓ Every reminder category has a deadline set.
              </p>
            )}
            <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
              {recommendedDeadlines.map((d) => (
                <li key={d.deadline_id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{d.label ?? d.ref_key}</span>
                      <Badge tone={d.kind === 'document' ? 'bg-blue-50 text-blue-700' : 'bg-ink/5 text-ink/55'}>
                        {d.kind}
                      </Badge>
                      {d.scope === 'leaf' ? <Badge tone="bg-violet-50 text-violet-700">override</Badge> : null}
                      {d.applies_to ? <Badge tone="bg-sky-50 text-sky-700">{d.applies_to}</Badge> : null}
                      {!d.is_active ? <Badge tone="bg-rose-50 text-rose-700">off</Badge> : null}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-ink/45">{d.ref_key}</div>
                  </div>
                  <form action={updatePlanningDeadline} className="flex shrink-0 items-center gap-2">
                    <input type="hidden" name="deadline_id" value={d.deadline_id} />
                    <BackFields q={back.q} view={back.view} anchor="deadlines" />
                    <input
                      type="number"
                      name="offset_value"
                      defaultValue={d.offset_value}
                      min={0}
                      className="w-16 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
                    />
                    <select
                      name="offset_unit"
                      defaultValue={d.offset_unit}
                      className="rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
                    >
                      <option value="day">days</option>
                      <option value="week">weeks</option>
                      <option value="month">months</option>
                    </select>
                    <span className="text-xs text-ink/50">before</span>
                    <SubmitButton
                      className="rounded-md border border-ink/15 bg-white px-3 py-1 text-sm font-medium text-ink transition-colors hover:border-terracotta/50 hover:text-terracotta"
                      pendingLabel="Saving…"
                    >
                      Save
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section id="lastminute" className="mb-10 scroll-mt-32">
        <header className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Last-minute window start{' '}
            <span className="font-normal text-ink/55">(Setnayan AI)</span>
          </h2>
          <span className="font-mono text-xs text-ink/55">{lmStartByGroup.size} set</span>
        </header>
        <p className="mb-3 text-sm text-ink/60">
          The month before the wedding when a category enters its{' '}
          <strong>last-minute</strong> window. Inside it, vendors who still accept
          a booking (their own floor) surface <strong>only to Setnayan AI couples</strong>,
          and a category already in its window shows nothing in the free search.
          Leave blank to keep a category <strong>off</strong> (no last-minute behavior).
          The vendor&apos;s own cutoff + surcharge are set per service in the vendor dashboard.
        </p>
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
          {lastMinuteGroups.map((g) => {
            const current = lmStartByGroup.get(g.id);
            return (
              <li
                key={g.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{g.label}</span>
                    {current != null ? (
                      <Badge tone="bg-amber-100 text-amber-900">{current} mo</Badge>
                    ) : (
                      <Badge tone="bg-ink/5 text-ink/45">off</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-ink/45">{g.id}</div>
                </div>
                <form action={setLastMinuteStart} className="flex shrink-0 items-center gap-2">
                  <input type="hidden" name="ref_key" value={g.id} />
                  <input type="hidden" name="label" value={g.label} />
                  <BackFields q={back.q} view={back.view} anchor="lastminute" />
                  <input
                    type="number"
                    name="months"
                    defaultValue={current ?? ''}
                    min={0}
                    max={60}
                    placeholder="—"
                    aria-label={`Last-minute starts how many months before for ${g.label}`}
                    className="w-16 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
                  />
                  <span className="text-xs text-ink/50">mo before</span>
                  <SubmitButton
                    className="rounded-md border border-ink/15 bg-white px-3 py-1 text-sm font-medium text-ink transition-colors hover:border-terracotta/50 hover:text-terracotta"
                    pendingLabel="Saving…"
                  >
                    Save
                  </SubmitButton>
                </form>
                {current != null ? (
                  <form action={clearLastMinuteStart} className="shrink-0">
                    <input type="hidden" name="ref_key" value={g.id} />
                    <BackFields q={back.q} view={back.view} anchor="lastminute" />
                    <SubmitButton
                      className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                      pendingLabel="Clearing…"
                    >
                      Clear
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {view !== 'unfiled' ? (
        <section id="tree" className="mb-10 scroll-mt-32">
          <header className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              Category tree{' '}
              <span className="font-normal text-ink/55">— rename · file services · reorder · add · remove (live, no deploy)</span>
            </h2>
            <span className="font-mono text-xs text-ink/55">
              {tax.source === 'db' ? 'editing the DB tree' : 'fallback — DB unseeded'}
            </span>
          </header>
          <p className="mb-3 text-sm text-ink/60">
            One tree for the whole taxonomy. Rename a parent or tile, reorder (▲▼) or
            remove a tile, and see every bookable service filed under it — re-file any
            service to another tile inline. Adding a tile or a service publishes live to{' '}
            <code className="font-mono text-xs">/vendors</code> + onboarding with no deploy.
          </p>
          {filtered ? (
            <p className="mb-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-1.5 text-xs text-ink/60">
              {visibleSvcTotal} service{visibleSvcTotal === 1 ? '' : 's'} in {visibleTileCount} tile
              {visibleTileCount === 1 ? '' : 's'} match ·{' '}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                  deliberate full-reload <a>: clearing ?q=/?view= must drop ALL
                  params + re-render server-side (zero-JS contract, §3). */}
              <a href="/admin/taxonomy" className="underline">
                Clear
              </a>{' '}
              · Filter applies to the category tree only.
            </p>
          ) : null}
          <div className="space-y-5">
            {tax.folderOrder.map((folder, idx) => {
              if (!visibleFolders.has(folder)) return null;
              const tiles = tax.tilesByParent[folder] ?? [];
              const folderCount = folderSvcCount[folder] ?? 0;
              const scopedTiles = tiles.filter((t) => (tax.tileEventTypes[t]?.length ?? 0) > 0).length;
              const folderFaithCount = tiles.reduce(
                (n, t) => n + (rowsByTile.get(t) ?? []).filter((r) => Boolean(r.meta?.faith)).length,
                0,
              );
              return (
                <div key={folder} id={`f-${folder}`} className="scroll-mt-32 rounded-xl border border-ink/10 bg-cream p-4">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <NodeRenameForm
                        id={folder}
                        label={tax.folderLabel[folder] ?? folder}
                        kind="Parent"
                        back={back}
                        anchor={`f-${folder}`}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-ink/45">
                      Folder {idx + 1} · {folderCount} svc
                      {scopedTiles > 0 ? ` · ${scopedTiles}/${tiles.length} scoped` : ''}
                      {folderFaithCount > 0 ? ` · ${folderFaithCount} faith` : ''}
                    </span>
                  </div>
                  {/* Folder-grain bulk event-type set (§5). Explicit overwrite by
                      construction: required scope_mode radio + required confirm
                      checkbox (A4) — never a silent cascade. */}
                  <details className="mb-2 rounded-md border border-sky-200/60 bg-sky-50/40 px-2 py-1.5">
                    <summary className="cursor-pointer text-[11px] text-ink/60">
                      Events — all {tiles.length} tiles:{' '}
                      <span className="font-medium">
                        {scopedTiles === 0
                          ? 'All universal'
                          : scopedTiles === tiles.length
                            ? `all ${tiles.length} scoped`
                            : `mixed — ${scopedTiles} scoped`}
                      </span>
                    </summary>
                    <form action={setFolderEventTypes} className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="parent_id" value={folder} />
                      <BackFields q={back.q} view={back.view} anchor={`f-${folder}`} />
                      <label className="flex items-center gap-1 rounded-md border border-ink/15 bg-white px-1.5 py-0.5 text-[11px] text-ink/70">
                        <input type="radio" name="scope_mode" value="universal" required className="h-3 w-3" />
                        Universal (all events)
                      </label>
                      <label className="flex items-center gap-1 rounded-md border border-ink/15 bg-white px-1.5 py-0.5 text-[11px] text-ink/70">
                        <input type="radio" name="scope_mode" value="scoped" required className="h-3 w-3" />
                        Scoped to:
                      </label>
                      {eventTypeVocab.map((v) => (
                        <label
                          key={v.event_type}
                          className="flex items-center gap-1 rounded-md border border-ink/15 bg-white px-1.5 py-0.5 text-[11px] text-ink/70"
                        >
                          <input type="checkbox" name="event_types" value={v.event_type} className="h-3 w-3" />
                          {v.label_en}
                        </label>
                      ))}
                      <label className="flex items-center gap-1 text-[11px] font-medium text-rose-700">
                        <input type="checkbox" name="confirm_overwrite" required className="h-3 w-3" />
                        Overwrite the scopes of all {tiles.length} tiles
                      </label>
                      <SubmitButton
                        className="rounded-md border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                        pendingLabel="Applying…"
                      >
                        Apply to all {tiles.length} tiles
                      </SubmitButton>
                      <span className="text-[10px] text-ink/40">overwrites every tile in this folder</span>
                    </form>
                  </details>
                  <div className="ml-1 space-y-3 border-l border-ink/10 pl-3">
                    {tiles.map((tile) => {
                      if (!visibleTiles.has(tile)) return null;
                      const services = rowsByTile.get(tile) ?? [];
                      const visibleRows = visibleRowsByTile.get(tile) ?? [];
                      const contentMatch = tileLabelMatch(tile) || visibleRows.length > 0;
                      // `open` wins unconditionally (A3): the tile you just edited is
                      // always expanded, even if the edit made it stop matching.
                      const tileOpen = open === tile || (filtered && contentMatch);
                      const evts = tax.tileEventTypes[tile] ?? [];
                      const faithSvcCount = services.filter((r) => Boolean(r.meta?.faith)).length;
                      const hiddenCount = services.length - visibleRows.length;
                      return (
                        <details
                          key={tile}
                          id={`t-${tile}`}
                          open={tileOpen}
                          className="group scroll-mt-32 rounded-lg border border-ink/10 bg-white/60"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-t-lg px-2 py-1.5 text-sm">
                            <span
                              aria-hidden="true"
                              className="shrink-0 text-[10px] text-ink/40 transition-transform group-open:rotate-90"
                            >
                              ▸
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium text-ink">
                              {tax.tileLabel[tile] ?? tile}
                            </span>
                            {evts.length > 0 ? (
                              <Badge tone="bg-sky-50 text-sky-700">
                                {evts.length === 1 ? `${eventLabel(evts[0]!)}-only` : `${evts.length} events`}
                              </Badge>
                            ) : null}
                            {faithSvcCount > 0 ? (
                              <Badge tone="bg-amber-50 text-amber-800">{faithSvcCount} faith</Badge>
                            ) : null}
                            {services.length === 0 ? <Badge tone="bg-ink/5 text-ink/45">empty</Badge> : null}
                            <span className="shrink-0 font-mono text-[10px] text-ink/40">{services.length} svc</span>
                          </summary>
                          <div className="border-t border-ink/10">
                            <div className="flex items-center gap-1.5 border-b border-ink/10 px-2 py-1.5">
                              <div className="min-w-0 flex-1">
                                <NodeRenameForm
                                  id={tile}
                                  label={tax.tileLabel[tile] ?? tile}
                                  kind="Tile"
                                  back={back}
                                  anchor={`t-${tile}`}
                                />
                              </div>
                              <span className="shrink-0 font-mono text-[10px] text-ink/40">{services.length}</span>
                              <form action={moveTaxonomyNode}>
                                <input type="hidden" name="id" value={tile} />
                                <input type="hidden" name="direction" value="up" />
                                <BackFields q={back.q} view={back.view} anchor={`t-${tile}`} />
                                <SubmitButton
                                  aria-label={`Move ${tile} up`}
                                  title="Move up"
                                  className="shrink-0 rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[11px] text-ink/70 transition-colors hover:border-ink/40"
                                  pendingLabel="…"
                                >
                                  ▲
                                </SubmitButton>
                              </form>
                              <form action={moveTaxonomyNode}>
                                <input type="hidden" name="id" value={tile} />
                                <input type="hidden" name="direction" value="down" />
                                <BackFields q={back.q} view={back.view} anchor={`t-${tile}`} />
                                <SubmitButton
                                  aria-label={`Move ${tile} down`}
                                  title="Move down"
                                  className="shrink-0 rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[11px] text-ink/70 transition-colors hover:border-ink/40"
                                  pendingLabel="…"
                                >
                                  ▼
                                </SubmitButton>
                              </form>
                              <form action={deleteTaxonomyNode}>
                                <input type="hidden" name="id" value={tile} />
                                <BackFields q={back.q} view={back.view} anchor={`t-${tile}`} />
                                <SubmitButton
                                  aria-label={`Delete ${tile}`}
                                  title="Delete — blocked if services are still filed here"
                                  className="shrink-0 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
                                  pendingLabel="…"
                                >
                                  ✕
                                </SubmitButton>
                              </form>
                            </div>
                            <TileEventTypes
                              tile={tile}
                              current={tax.tileEventTypes[tile] ?? null}
                              vocab={eventTypeVocab}
                              back={back}
                            />
                            {open === tile && filtered && !contentMatch ? (
                              <p className="px-3 py-2 text-xs italic text-ink/45">
                                This tile no longer matches the active filter.
                              </p>
                            ) : null}
                            {visibleRows.length > 0 ? (
                              <ul className="divide-y divide-ink/10">
                                {visibleRows.map((row) => (
                                  <ServiceLine
                                    key={row.canonical_service}
                                    row={row}
                                    tax={tax}
                                    faiths={faithVocab}
                                    back={back}
                                    anchor={`t-${tile}`}
                                  />
                                ))}
                                {filtered && hiddenCount > 0 ? (
                                  <li className="px-3 py-2 text-xs italic text-ink/45">
                                    {hiddenCount} hidden by the filter
                                  </li>
                                ) : null}
                              </ul>
                            ) : filtered && services.length > 0 ? (
                              <p className="px-3 py-2 text-xs italic text-ink/45">
                                {services.length} hidden by the filter
                              </p>
                            ) : (
                              <p className="px-3 py-2 text-xs text-ink/45">No services filed here yet.</p>
                            )}
                            <form
                              action={createCanonicalLeaf}
                              className="flex items-center gap-2 rounded-b-lg border-t border-ink/10 bg-emerald-50/30 px-2 py-1.5"
                            >
                              <input type="hidden" name="tile_id" value={tile} />
                              <BackFields q={back.q} view={back.view} anchor={`t-${tile}`} />
                              <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-700/70">
                                ＋ svc
                              </span>
                              <input
                                name="display_name_en"
                                placeholder="New service name…"
                                aria-label={`Add a service under ${tile}`}
                                className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
                              />
                              <SubmitButton
                                className="shrink-0 rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                                pendingLabel="Adding…"
                              >
                                Add
                              </SubmitButton>
                            </form>
                          </div>
                        </details>
                      );
                    })}
                    <form
                      action={createTaxonomyNode}
                      className="flex items-center gap-2 rounded-md border border-dashed border-emerald-300/60 bg-emerald-50/30 px-2 py-1.5"
                    >
                      <input type="hidden" name="parent_id" value={folder} />
                      <BackFields q={back.q} view={back.view} anchor={`f-${folder}`} />
                      <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-700/70">
                        ＋ tile
                      </span>
                      <input
                        name="label_en"
                        placeholder="New tile name…"
                        aria-label={`Add a tile under ${folder}`}
                        className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
                      />
                      <SubmitButton
                        className="shrink-0 rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                        pendingLabel="Adding…"
                      >
                        Add
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section id="advanced" className="mb-10 scroll-mt-32">
        <details className="rounded-xl border border-ink/10 bg-cream/60 p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink/80">
            Advanced — add a service with a starter refinement
          </summary>
          <p className="mb-3 mt-2 text-sm text-ink/60">
            The quick <strong>＋ svc</strong> box on each tile adds a plain service. Use this when you also want
            to seed its first refinement or mark it Rental / PH-specific. Writes the{' '}
            <code className="font-mono text-xs">canonical_service_schemas</code> stub (vendor onboarding) + the{' '}
            <code className="font-mono text-xs">canonical_service_taxonomy</code> mapping (marketplace).
          </p>
          <form action={createCanonicalLeaf} className="grid gap-3 sm:grid-cols-2">
            <BackFields q={back.q} view={back.view} anchor="advanced" />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink/75">Service name</span>
              <input
                name="display_name_en"
                required
                placeholder="e.g. Table Linen Rental"
                className="rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink/75">Under tile</span>
              <select
                name="tile_id"
                required
                defaultValue=""
                className="rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
              >
                <option value="" disabled>
                  — pick a tile —
                </option>
                {tax.folderOrder.map((folder) => (
                  <optgroup key={folder} label={tax.folderLabel[folder] ?? folder}>
                    {(tax.tilesByParent[folder] ?? []).map((t) => (
                      <option key={t} value={t}>
                        {tax.tileLabel[t] ?? t}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink/75">
                Faith scope <span className="text-ink/45">(officiants/seminars only — leave Universal otherwise)</span>
              </span>
              <select
                name="faith"
                defaultValue=""
                className="rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
              >
                <option value="">Universal (everyone)</option>
                {faithVocab.map((f) => (
                  <option key={f.faith_key} value={f.faith_key}>
                    {f.label_en}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink/75">
                Starter refinement <span className="text-ink/45">(optional)</span>
              </span>
              <input
                name="refinement_label"
                placeholder="e.g. Customization"
                className="rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink/75">
                Refinement options <span className="text-ink/45">(comma-separated)</span>
              </span>
              <input
                name="refinement_options"
                placeholder="e.g. plain, custom monogram, custom logo"
                className="rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-1.5 text-sm text-ink/75">
                <input type="checkbox" name="is_rental" className="h-4 w-4" />
                Rental
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink/75">
                <input type="checkbox" name="is_ph" className="h-4 w-4" />
                PH-specific
              </label>
              <SubmitButton
                className="ml-auto rounded-md border border-emerald-300 bg-white px-4 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                pendingLabel="Adding…"
              >
                Add service
              </SubmitButton>
            </div>
          </form>
        </details>
      </section>

      {unfiled.length > 0 || view === 'unfiled' ? (
        <section id="unfiled" className="mb-10 scroll-mt-32">
          <header className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-amber-800">
              ⚠ Unfiled services{' '}
              <span className="font-normal text-ink/55">— not on any tile</span>
            </h2>
            <span className="font-mono text-xs text-amber-800">{unfiled.length}</span>
          </header>
          <p className="mb-3 text-sm text-ink/60">
            These <code className="font-mono text-xs">canonical_service_schemas</code> rows aren&apos;t placed on a
            tile — no <code className="font-mono text-xs">canonical_service_taxonomy</code> mapping, or it points at
            a tile that no longer exists. They still appear in the vendor &quot;add a service&quot; picker, but the
            marketplace can&apos;t bucket them until they&apos;re filed. Pick a tile and File.
          </p>
          {unfiled.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/55">
              Nothing unfiled — every service is placed on a tile.
            </p>
          ) : (
            <ul className="divide-y divide-amber-200 rounded-xl border border-amber-200 bg-amber-50/50">
              {visibleUnfiled.map((row) => (
                <ServiceLine
                  key={row.canonical_service}
                  row={row}
                  tax={tax}
                  faiths={faithVocab}
                  back={back}
                  anchor="unfiled"
                />
              ))}
              {filtered && visibleUnfiled.length < unfiled.length ? (
                <li className="px-3 py-2 text-xs italic text-ink/45">
                  {unfiled.length - visibleUnfiled.length} hidden by the filter
                </li>
              ) : null}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Hidden return-address fields (`_q` / `_view` / `_anchor`) every mutating form
 * carries so `redirectBack` in actions.ts can land the admin back where they
 * were — filter intact, edited tile re-opened, anchored on screen.
 */
function BackFields({ q, view, anchor }: { q?: string; view?: string | null; anchor: string }) {
  return (
    <>
      {q ? <input type="hidden" name="_q" value={q} /> : null}
      {view ? <input type="hidden" name="_view" value={view} /> : null}
      <input type="hidden" name="_anchor" value={anchor} />
    </>
  );
}

/**
 * Per-tile multi-event applicability control (Phase 1). Admins pick which event
 * types a tile serves; none checked = universal (serves all events) — the
 * FAIL-OPEN default. Writes service_categories.applicable_event_types live.
 */
function TileEventTypes({
  tile,
  current,
  vocab,
  back,
}: {
  tile: string;
  current: string[] | null;
  vocab: { event_type: string; label_en: string }[];
  back: Back;
}) {
  const sel = current ?? [];
  const restricted = sel.length > 0;
  const summary = restricted
    ? sel.map((e) => vocab.find((v) => v.event_type === e)?.label_en ?? e).join(' · ')
    : 'All events (universal)';
  return (
    <details className="border-b border-ink/10 bg-sky-50/30 px-2 py-1.5">
      <summary className="cursor-pointer text-[11px] text-ink/60">
        Events:{' '}
        <span className={`font-medium ${restricted ? 'text-sky-800' : 'text-ink/70'}`}>{summary}</span>
      </summary>
      <form action={setCategoryEventTypes} className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="category_id" value={tile} />
        <BackFields q={back.q} view={back.view} anchor={`t-${tile}`} />
        {vocab.map((v) => (
          <label
            key={v.event_type}
            className="flex items-center gap-1 rounded-md border border-ink/15 bg-white px-1.5 py-0.5 text-[11px] text-ink/70"
          >
            <input
              type="checkbox"
              name="event_types"
              value={v.event_type}
              defaultChecked={sel.includes(v.event_type)}
              className="h-3 w-3"
            />
            {v.label_en}
          </label>
        ))}
        <SubmitButton
          className="rounded-md border border-ink/20 bg-ink px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-ink/80"
          pendingLabel="Saving…"
        >
          Save
        </SubmitButton>
        <span className="text-[10px] text-ink/40">none = universal</span>
      </form>
    </details>
  );
}

/**
 * Per-service faith control (Phase 2). The badge is now editable: expanding it
 * reveals a faith_vocab dropdown backed by `setServiceFaith` (INCLUDE-only
 * match-scope — a tagged service surfaces ONLY for matching couples; clear =
 * universal). Dietary services are guarded server-side (never faith-gated).
 */
function ServiceFaithControl({
  canonical,
  current,
  faiths,
  back,
  anchor,
}: {
  canonical: string;
  current: FaithKey | undefined;
  faiths: { faith_key: string; label_en: string }[];
  back: Back;
  anchor: string;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none">
        <Badge tone={current ? (FAITH_TONE[current] ?? FAITH_TONE_BASE) : 'bg-white text-ink/45 border border-ink/15'}>
          {current ?? 'faith: all'} ▾
        </Badge>
      </summary>
      <form
        action={setServiceFaith}
        className="absolute right-0 z-10 mt-1 flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white p-1.5 shadow-md"
      >
        <input type="hidden" name="canonical_service" value={canonical} />
        <BackFields q={back.q} view={back.view} anchor={anchor} />
        <select
          name="faith"
          defaultValue={current ?? ''}
          aria-label={`Faith scope for ${canonical}`}
          className="rounded-md border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
        >
          <option value="">Universal (everyone)</option>
          {faiths.map((f) => (
            <option key={f.faith_key} value={f.faith_key}>
              {f.label_en}
            </option>
          ))}
        </select>
        <SubmitButton
          className="rounded-md border border-ink/20 bg-ink px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-ink/80"
          pendingLabel="Setting…"
        >
          Set
        </SubmitButton>
      </form>
    </details>
  );
}

/**
 * One bookable service line — name + slug, metadata badges, and an inline
 * re-file control (remap to another tile). Used both under each tile in the
 * tree and in the Unfiled tray (where `row.meta` is null / has no tile, so the
 * select shows a "— pick a tile —" placeholder and the button reads "File").
 */
function ServiceLine({
  row,
  tax,
  faiths,
  back,
  anchor,
}: {
  row: ServiceRow;
  tax: TaxonomySnapshot;
  faiths: { faith_key: string; label_en: string }[];
  back: Back;
  anchor: string;
}) {
  const facets = Array.isArray(row.filter_facets) ? row.filter_facets : [];
  const required = (row.required_for_visibility ?? {}) as Record<string, unknown>;
  const hasRequired = Object.keys(required).length > 0;
  const meta = row.meta;
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{row.display_name_en}</span>
          {row.display_name_tl ? (
            <span className="hidden truncate font-mono text-[11px] text-ink/45 sm:inline">
              ({row.display_name_tl})
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-ink/45">{row.canonical_service}</div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {meta ? (
          <>
            <Badge tone={PHASE_TONE[meta.phase] ?? PHASE_TONE_BASE}>{meta.phase}</Badge>
            <ServiceFaithControl
              canonical={row.canonical_service}
              current={meta.faith}
              faiths={faiths}
              back={back}
              anchor={anchor}
            />
            {meta.setnayan ? <Badge tone="bg-terracotta/10 text-terracotta">Setnayan</Badge> : null}
            {meta.ph ? <Badge tone="bg-sky-50 text-sky-700">PH-specific</Badge> : null}
            {meta.rental ? <Badge tone="bg-ink/5 text-ink/70">Rental</Badge> : null}
          </>
        ) : null}
        <Badge tone="bg-ink/5 text-ink/55">
          {facets.length} facet{facets.length === 1 ? '' : 's'}
        </Badge>
        {hasRequired ? <Badge tone="bg-emerald-50 text-emerald-700">visibility gate</Badge> : null}
        <Badge tone="bg-ink/5 text-ink/55">{row.shared_attribute_groups.length} shared</Badge>
      </div>
      <form action={remapCanonical} className="flex shrink-0 items-center gap-1.5">
        <input type="hidden" name="canonical_service" value={row.canonical_service} />
        <BackFields q={back.q} view={back.view} anchor={anchor} />
        <select
          name="tile_id"
          required
          defaultValue={meta?.tile ?? ''}
          aria-label={`File ${row.canonical_service} under a tile`}
          className="max-w-[150px] rounded-md border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
        >
          {meta?.tile ? null : (
            <option value="" disabled>
              — pick a tile —
            </option>
          )}
          {tax.folderOrder.map((folder) => (
            <optgroup key={folder} label={tax.folderLabel[folder] ?? folder}>
              {(tax.tilesByParent[folder] ?? []).map((t) => (
                <option key={t} value={t}>
                  {tax.tileLabel[t] ?? t}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <SubmitButton
          className="rounded-md border border-ink/15 bg-white px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:border-terracotta/50 hover:text-terracotta"
          pendingLabel="Moving…"
        >
          {meta?.tile ? 'Move' : 'File'}
        </SubmitButton>
      </form>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}

function NodeRenameForm({
  id,
  label,
  kind,
  back,
  anchor,
}: {
  id: string;
  label: string;
  kind: string;
  back: Back;
  anchor: string;
}) {
  return (
    <form action={renameTaxonomyNode} className="flex items-center gap-2">
      <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
        {kind}
      </span>
      <input type="hidden" name="id" value={id} />
      <BackFields q={back.q} view={back.view} anchor={anchor} />
      <input
        name="label_en"
        defaultValue={label}
        aria-label={`Rename ${id}`}
        className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
      />
      <span className="hidden font-mono text-[10px] text-ink/40 sm:inline">{id}</span>
      <SubmitButton
        className="shrink-0 rounded-md border border-ink/15 bg-white px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-terracotta/50 hover:text-terracotta"
        pendingLabel="Saving…"
      >
        Save
      </SubmitButton>
    </form>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}>
      {children}
    </span>
  );
}
