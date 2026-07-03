import { createAdminClient } from '@/lib/supabase/admin';
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { validateVendorCategoryMapping } from '@/lib/vendor-category-taxonomy';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  updatePlanningDeadline,
  setLastMinuteStart,
  clearLastMinuteStart,
} from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { PROJECTABLE_LEAVES } from '@/lib/refinements-mutations';
import {
  TaxonomyStudio,
  type StudioData,
  type StudioView,
  type StudioService,
  type StudioLeafRefinement,
  type StudioRefinementLeaf,
  type StudioRefinementOption,
} from './_components/taxonomy-studio';

export const metadata = { title: 'Taxonomy Studio · Admin' };
// Top-level DB reads (admin client + getTaxonomy) — keep this route dynamic so a
// future root app/loading.tsx can't pull it into build-time static generation.
export const dynamic = 'force-dynamic';

type SchemaRow = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
  schema_version: number;
  shared_attribute_groups: string[] | null;
  category_specific_attributes: Record<string, AttributeFieldDef> | null;
};

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

type RefLeafRow = {
  leaf_key: string;
  label_en: string;
  description_en: string | null;
  main_photo: string | null;
  is_dynamic_ceremony: boolean | null;
  sort_order: number;
  status: string;
  tile_id: string | null;
};

type RefOptionRow = {
  leaf_key: string;
  option_key: string;
  emoji: string | null;
  label_en: string;
  photo: string | null;
  sort_order: number;
  status: string;
};

/** Couple-facing default folder icon per parent — mirrors the /explore strip's
 *  FOLDER_ICON map so the Studio's fallback icon matches what couples see. */
const FOLDER_DEFAULT_ICON: Record<string, string> = {
  venue: 'Building2',
  planning: 'ClipboardList',
  feast: 'UtensilsCrossed',
  design: 'Flower2',
  program: 'Music',
  documentary: 'Camera',
  look: 'Shirt',
  booths: 'Tent',
  prints: 'Mail',
  transport: 'Car',
};

async function toDisplay(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith('r2://')) {
    try {
      return await displayUrlForStoredAsset(raw);
    } catch {
      return null;
    }
  }
  return raw; // /public path used verbatim
}

export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<'ok' | 'error' | 'q' | 'view' | 'open' | 'opentab', string | string[] | undefined>
  >;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (first(sp.q) ?? '').trim().slice(0, 80);
  const openTileId = (first(sp.open) ?? '').trim() || null;
  const openTabRaw = first(sp.opentab);
  const openTab =
    openTabRaw === 'refinements' || openTabRaw === 'services' || openTabRaw === 'details'
      ? openTabRaw
      : null;
  const viewRaw = first(sp.view);
  const view: StudioView =
    viewRaw === 'faith' || viewRaw === 'scoped' || viewRaw === 'unfiled' || viewRaw === 'requests'
      ? viewRaw
      : 'all';
  const ok = first(sp.ok);
  const error = first(sp.error);

  const admin = createAdminClient();

  const [schemasRes, tax, eventVocabRes, faithRes, reqRes, deadlinesRes, refLeafRes, refOptRes] =
    await Promise.all([
      admin
        .from('canonical_service_schemas')
        .select(
          'canonical_service, display_name_en, display_name_tl, schema_version, shared_attribute_groups, category_specific_attributes',
        )
        .order('canonical_service', { ascending: true }),
      getTaxonomy(),
      admin
        .from('event_type_vocab')
        .select('event_type, label_en, sort_order')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
      admin
        .from('faith_vocab')
        .select('faith_key, label_en, sort_order')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
      admin
        .from('taxonomy_category_requests')
        .select(
          'request_id, proposed_label, proposed_note, status, mapped_to_canonical, proposed_by_vendor_id',
        )
        .order('created_at', { ascending: false }),
      admin
        .from('planning_deadlines')
        .select(
          'deadline_id, kind, ref_key, scope, label, offset_value, offset_unit, applies_to, is_active',
        )
        .order('kind', { ascending: true })
        .order('offset_value', { ascending: false }),
      // Full refinement leaves anchored to tiles (tile_id) — the Studio's
      // Refinements tab edits these; counts derive from the same rows.
      admin
        .from('onboarding_refinements')
        .select('leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order,status,tile_id')
        .order('sort_order', { ascending: true }),
      admin
        .from('onboarding_refinement_options')
        .select('leaf_key,option_key,emoji,label_en,photo,sort_order,status')
        .order('sort_order', { ascending: true }),
    ]);

  const schemas = (schemasRes.data ?? []) as SchemaRow[];
  const eventTypeVocab = (eventVocabRes.data ?? []) as { event_type: string; label_en: string }[];
  const faithVocab = (faithRes.data ?? []) as { faith_key: string; label_en: string }[];
  const allRequests = (reqRes.data ?? []) as ReqRow[];
  const deadlines = (deadlinesRes.data ?? []) as DeadlineRow[];
  const refLeafRows = (refLeafRes.data ?? []) as RefLeafRow[];
  const refOptRows = (refOptRes.data ?? []) as RefOptionRow[];

  const refinementCountByTile = new Map<string, number>();
  for (const r of refLeafRows) {
    if (r.tile_id) refinementCountByTile.set(r.tile_id, (refinementCountByTile.get(r.tile_id) ?? 0) + 1);
  }

  // ── Refinement leaves + options → StudioRefinementLeaf[] keyed by tile ──
  // Presign every distinct photo ref ONCE (main photos + option photos), in
  // parallel; a failed presign degrades to null (emoji fallback) so a broken
  // r2:// ref never renders a dead <img>.
  const refPhotoRefs = new Set<string>();
  for (const l of refLeafRows) if (l.main_photo) refPhotoRefs.add(l.main_photo);
  for (const o of refOptRows) if (o.photo) refPhotoRefs.add(o.photo);
  const refUrlByRef = new Map(
    await Promise.all([...refPhotoRefs].map(async (r) => [r, await toDisplay(r)] as const)),
  );

  const optsByLeaf = new Map<string, StudioRefinementOption[]>();
  for (const o of refOptRows) {
    const list = optsByLeaf.get(o.leaf_key) ?? [];
    list.push({
      optionKey: o.option_key,
      emoji: o.emoji ?? '',
      label: o.label_en,
      status: o.status,
      photoRaw: o.photo,
      photoUrl: o.photo ? refUrlByRef.get(o.photo) ?? null : null,
    });
    optsByLeaf.set(o.leaf_key, list);
  }

  const refinementsByTile = new Map<string, StudioRefinementLeaf[]>();
  for (const l of refLeafRows) {
    if (!l.tile_id) continue;
    const list = refinementsByTile.get(l.tile_id) ?? [];
    list.push({
      leafKey: l.leaf_key,
      label: l.label_en,
      description: l.description_en ?? '',
      status: l.status,
      dynamic: l.is_dynamic_ceremony === true,
      isProjectable: PROJECTABLE_LEAVES.has(l.leaf_key),
      mainPhotoRaw: l.main_photo,
      mainPhotoUrl: l.main_photo ? refUrlByRef.get(l.main_photo) ?? null : null,
      options: optsByLeaf.get(l.leaf_key) ?? [],
    });
    refinementsByTile.set(l.tile_id, list);
  }

  // ── Services (canonical schema + live taxonomy placement) ──
  // Each service carries its full leaf-refinement schema (the vendor
  // attribute fields in category_specific_attributes) so the Services tab can
  // edit them inline. Fields are serialized to a stable array (JSONB key order
  // isn't guaranteed to survive the client boundary otherwise).
  const services: StudioService[] = schemas.map((s) => {
    const meta = tax.map[s.canonical_service] ?? null;
    const tileId = meta?.tile && tax.tileLabel[meta.tile] ? meta.tile : null;
    const catAttrs = (s.category_specific_attributes ?? {}) as Record<string, AttributeFieldDef>;
    const refinementFields: StudioLeafRefinement[] = Object.entries(catAttrs).map(([key, def]) => {
      const d = def as AttributeFieldDef & { retired?: boolean; retired_options?: string[] };
      const retiredOptions = Array.isArray(d.retired_options) ? d.retired_options : [];
      return {
        key,
        type: d.type,
        label: d.label ?? key,
        retired: d.retired === true,
        options: Array.isArray(d.options)
          ? d.options.map((value) => ({ value, retired: retiredOptions.includes(value) }))
          : [],
      };
    });
    return {
      canonical: s.canonical_service,
      displayEn: s.display_name_en,
      displayTl: s.display_name_tl,
      tileId,
      phase: meta?.phase ?? '—',
      faith: meta?.faith ?? null,
      ph: Boolean(meta?.ph),
      setnayan: Boolean(meta?.setnayan),
      rental: Boolean(meta?.rental),
      hidden: Boolean(meta?.marketplaceHidden),
      schemaVersion: s.schema_version ?? 1,
      sharedGroups: Array.isArray(s.shared_attribute_groups) ? s.shared_attribute_groups : [],
      refinements: refinementFields,
    };
  });

  const serviceCountByTile = new Map<string, number>();
  const faithCountByTile = new Map<string, number>();
  for (const s of services) {
    if (!s.tileId) continue;
    serviceCountByTile.set(s.tileId, (serviceCountByTile.get(s.tileId) ?? 0) + 1);
    if (s.faith) faithCountByTile.set(s.tileId, (faithCountByTile.get(s.tileId) ?? 0) + 1);
  }

  // ── Tiles + folders ──
  const tilesRaw = tax.tileOrder.map((id) => ({
    id,
    parentId: tax.tileParent[id] ?? '',
    label: tax.tileLabel[id] ?? id,
    slug: tax.tileSlug[id] ?? id,
    iconName: tax.categoryIcons[id] ?? null,
    photoRaw: tax.categoryPhotos[id] ?? null,
    eventTypes: tax.tileEventTypes[id] ?? null,
    serviceCount: serviceCountByTile.get(id) ?? 0,
    faithCount: faithCountByTile.get(id) ?? 0,
    refinementCount: refinementCountByTile.get(id) ?? 0,
  }));
  // Resolve tile photos to display URLs (presign r2:// refs) in parallel.
  const tilePhotoUrls = await Promise.all(tilesRaw.map((t) => toDisplay(t.photoRaw)));
  const tiles = tilesRaw.map((t, i) => ({ ...t, photoUrl: tilePhotoUrls[i] ?? null }));

  const folders = tax.folderOrder.map((id) => ({
    id,
    label: tax.folderLabel[id] ?? id,
    iconName: tax.categoryIcons[id] ?? null,
  }));

  // ── Requests → vendor byline ──
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
  const demandCounts = new Map<string, number>();
  for (const r of allRequests) {
    if (r.status === 'mapped' && r.mapped_to_canonical) {
      demandCounts.set(r.mapped_to_canonical, (demandCounts.get(r.mapped_to_canonical) ?? 0) + 1);
    }
  }
  const demandSignals = [...demandCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);

  // ── Preserved sections: drift, deadlines, last-minute ──
  const coupleSideDrift = validateVendorCategoryMapping(tax);

  const recommendedDeadlines = deadlines.filter((d) => d.kind !== 'last_minute_start');
  const lmStartByGroup = new Map<string, number>();
  for (const d of deadlines) {
    if (d.kind === 'last_minute_start' && d.scope === 'category') {
      lmStartByGroup.set(d.ref_key, d.offset_value);
    }
  }
  const lastMinuteGroups = PLAN_GROUPS.filter((g) => g.countsTowardLockable !== false);
  const serviceDeadlineKeys = new Set(
    deadlines.filter((d) => d.kind === 'service' && d.scope === 'category').map((d) => d.ref_key),
  );
  const missingCategories = PLAN_GROUPS.filter(
    (g) => g.countsTowardLockable !== false && !serviceDeadlineKeys.has(g.id),
  );

  const totalRows = schemas.length;
  const totalMapped = services.filter((s) => s.tileId).length;
  const unfiledCount = totalRows - totalMapped;

  const studioData: StudioData = {
    source: tax.source,
    folders,
    tiles,
    services,
    eventVocab: eventTypeVocab.map((v) => ({ key: v.event_type, label: v.label_en })),
    faithVocab: faithVocab.map((f) => ({ key: f.faith_key, label: f.label_en })),
    requests: pendingRequests.map((r) => ({
      requestId: r.request_id,
      proposedLabel: r.proposed_label,
      proposedNote: r.proposed_note,
      vendorName: reqVendorName.get(r.proposed_by_vendor_id) ?? 'a vendor',
    })),
    iconNames: [], // filled below (import kept server-side)
    folderDefaultIcon: FOLDER_DEFAULT_ICON,
    refinementsByTile: Object.fromEntries(refinementsByTile),
    initialQ: q,
    initialView: view,
    initialOpenTileId: openTileId,
    initialOpenTab: openTab,
  };

  // Icon allowlist for the picker (server-imported to keep the client bundle lean).
  const { NAV_ICON_NAMES } = await import('@/lib/nav-icons');
  studioData.iconNames = [...NAV_ICON_NAMES];

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Iteration 0044 · V1.1 vendor taxonomy</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Taxonomy Studio</h1>
        <p className="text-base text-ink/65">
          The single live taxonomy, edited visually. Ten folders, {tiles.length} tiles, {totalRows} services.
          Drag a tile to reorder it, drop it on a folder to re-home it, and open any tile to edit its icon,
          photo, event scope, and services. Every change publishes live to the marketplace and onboarding with
          no deploy
          {tax.source === 'fallback' ? ' (tables unseeded — using lib/taxonomy.ts)' : ''}. Editing the{' '}
          <strong>{tax.source === 'db' ? 'DB tree' : 'code fallback'}</strong>.
        </p>
      </header>

      {ok ? (
        <div className="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          {ok}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
        </div>
      ) : null}

      {/* Stats */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Folders" value={folders.length} />
        <Stat label="Tiles" value={tiles.length} />
        <Stat label="Filed services" value={totalMapped} />
        <Stat label="Unfiled" value={unfiledCount} />
      </section>

      {/* The three-pane studio (client) */}
      <TaxonomyStudio data={studioData} />

      {/* ── Preserved server panels below the studio ──────────────────────── */}
      <div className="mt-10 space-y-4">
        <p
          className={`rounded-lg border px-4 py-2 text-sm ${
            coupleSideDrift.length === 0
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-warn-200 bg-warn-50 text-warn-900'
          }`}
        >
          {coupleSideDrift.length === 0 ? (
            <>
              ✓ Couple-side anchoring — every <code className="font-mono text-xs">vendor_category</code> maps
              to a live canonical tile (or is intentionally exempt).
            </>
          ) : (
            <>
              ⚠ {coupleSideDrift.length} couple-side{' '}
              {coupleSideDrift.length === 1 ? 'category points' : 'categories point'} at a missing tile:{' '}
              {coupleSideDrift.map((d) => `${d.category} → ${d.missingTiles.join(', ')}`).join(' · ')}
            </>
          )}
        </p>

        {demandSignals.length > 0 ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
            📈 Demand signal — repeatedly requested, mapped to:{' '}
            {demandSignals.map(([c, n]) => `${c} (${n})`).join(' · ')}. Consider promoting to its own node.
          </p>
        ) : null}

        {/* Recommended deadlines */}
        <details className="rounded-xl border border-ink/10 bg-cream/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Recommended deadlines{' '}
            <span className="font-normal text-ink/55">({recommendedDeadlines.length} set)</span>
          </summary>
          <p className="mb-3 mt-2 text-sm text-ink/60">
            The lock-by dates the couple&apos;s Home reminders read. A category with no row falls back to the
            code default. <strong>Months</strong> for services, <strong>days</strong> for documents.
          </p>
          {deadlines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink/20 bg-cream/60 px-4 py-3 text-sm text-ink/60">
              No deadline rows — the <code className="font-mono text-xs">planning_deadlines</code> migration
              isn&apos;t applied yet. Reminders run on code defaults until then.
            </p>
          ) : (
            <>
              {missingCategories.length > 0 ? (
                <p className="mb-3 rounded-lg border border-warn-200 bg-warn-50 px-4 py-2 text-sm text-warn-900">
                  ⚠ {missingCategories.length}{' '}
                  {missingCategories.length === 1 ? 'reminder category has' : 'reminder categories have'} no
                  deadline (using code fallback): {missingCategories.map((g) => g.label).join(', ')}
                </p>
              ) : (
                <p className="mb-3 rounded-lg border border-success-200 bg-success-50 px-4 py-2 text-sm text-success-800">
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
                        {!d.is_active ? <Badge tone="bg-danger-50 text-danger-700">off</Badge> : null}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-ink/45">{d.ref_key}</div>
                    </div>
                    <form action={updatePlanningDeadline} className="flex shrink-0 items-center gap-2">
                      <input type="hidden" name="deadline_id" value={d.deadline_id} />
                      <input type="hidden" name="_anchor" value="deadlines" />
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
        </details>

        {/* Last-minute window start */}
        <details className="rounded-xl border border-ink/10 bg-cream/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Last-minute window start{' '}
            <span className="font-normal text-ink/55">(Setnayan AI · {lmStartByGroup.size} set)</span>
          </summary>
          <p className="mb-3 mt-2 text-sm text-ink/60">
            The month before the wedding when a category enters its <strong>last-minute</strong> window. Leave
            blank to keep a category <strong>off</strong>.
          </p>
          <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
            {lastMinuteGroups.map((g) => {
              const current = lmStartByGroup.get(g.id);
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{g.label}</span>
                      {current != null ? (
                        <Badge tone="bg-warn-100 text-warn-900">{current} mo</Badge>
                      ) : (
                        <Badge tone="bg-ink/5 text-ink/45">off</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-ink/45">{g.id}</div>
                  </div>
                  <form action={setLastMinuteStart} className="flex shrink-0 items-center gap-2">
                    <input type="hidden" name="ref_key" value={g.id} />
                    <input type="hidden" name="label" value={g.label} />
                    <input type="hidden" name="_anchor" value="lastminute" />
                    <input
                      type="number"
                      name="months"
                      defaultValue={current ?? ''}
                      min={0}
                      max={60}
                      placeholder="—"
                      aria-label={`Last-minute months before for ${g.label}`}
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
                      <input type="hidden" name="_anchor" value="lastminute" />
                      <SubmitButton
                        className="rounded-md border border-danger-200 bg-white px-2 py-1 text-[11px] font-medium text-danger-700 hover:bg-danger-50"
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
        </details>
      </div>
    </div>
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

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}
    >
      {children}
    </span>
  );
}
