import { Sparkles } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  RecommendationRow,
  AddRecommendation,
  FeedbackCard,
  type MapRow,
  type FeedbackRow,
  type LeafOption,
  type SkuOption,
} from './_editor';

export const metadata = { title: 'Vendor recommendations · Admin' };

/**
 * /admin/vendor-recommendations — the admin-editable "recommend to your couples"
 * map + the two-way curation review queue.
 *
 * The map (vendor_service_recommendations) is a vendor-leaf → recommendable-SKU
 * table, sparse BY DESIGN: a SKU appears for a leaf only when it amplifies that
 * vendor's own deliverable. is_opt_in flags a recommendation that could compete
 * with the vendor's own service (hidden until the vendor turns it on).
 *
 * Vendors flag the map ("not a fit" / "I'd also recommend X") into
 * vendor_recommendation_feedback — the pending rows render as a review queue at
 * the bottom; resolving one can write back to the map (see actions.ts).
 *
 * All reads go through the service-role admin client. Joins are resolved as
 * separate batched lookups (the FK rows are small reference tables).
 */

type RawRec = {
  id: number;
  tile_id: string;
  service_code: string;
  is_opt_in: boolean;
  priority: number;
  rationale: string | null;
  is_active: boolean;
};

type RawFeedback = {
  id: number;
  vendor_profile_id: string;
  tile_id: string;
  feedback_type: 'not_a_fit' | 'suggest_add';
  service_code: string | null;
  note: string | null;
  created_at: string;
};

type Props = {
  searchParams: Promise<{
    added?: string;
    exists?: string;
    saved?: string;
    deleted?: string;
    feedback?: string;
    error?: string;
  }>;
};

function Banner({ search }: { search: Awaited<Props['searchParams']> }) {
  if (search.error) {
    const msg =
      search.error === 'missing'
        ? 'That action was missing a required field — nothing changed.'
        : "Something went wrong writing to the database — we've logged it. Try again.";
    return (
      <div className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 p-4">
        <p className="text-sm text-danger-900">{msg}</p>
      </div>
    );
  }
  const ok =
    search.added === '1'
      ? 'Recommendation added to the map.'
      : search.exists === '1'
        ? 'That leaf → SKU pairing already exists — nothing changed.'
        : search.saved === '1'
          ? 'Recommendation updated.'
          : search.deleted === '1'
            ? 'Recommendation removed from the map.'
            : search.feedback === 'accepted'
              ? 'Flag accepted — the map was updated.'
              : search.feedback === 'declined'
                ? 'Flag declined — the map is unchanged.'
                : search.feedback === 'stale'
                  ? 'That flag was already resolved by someone else.'
                  : null;
  if (!ok) return null;
  return (
    <div className="mb-6 rounded-2xl border border-success-300/60 bg-success-50/80 p-4">
      <p className="text-sm text-success-900">{ok}</p>
    </div>
  );
}

export default async function AdminVendorRecommendationsPage({ searchParams }: Props) {
  const search = await searchParams;
  const admin = createAdminClient();

  const [recRes, leafRes, skuRes, feedbackRes] = await Promise.all([
    admin
      .from('vendor_service_recommendations')
      .select('id, tile_id, service_code, is_opt_in, priority, rationale, is_active')
      .order('tile_id', { ascending: true })
      .order('priority', { ascending: true }),
    admin
      .from('service_categories')
      .select('id, label_en')
      .eq('tier', 2)
      .order('label_en', { ascending: true }),
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, title')
      .eq('is_active', true)
      .order('title', { ascending: true }),
    admin
      .from('vendor_recommendation_feedback')
      .select('id, vendor_profile_id, tile_id, feedback_type, service_code, note, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  if (recRes.error) logQueryError('AdminVendorRecommendations (map)', recRes.error);
  if (leafRes.error) logQueryError('AdminVendorRecommendations (leaves)', leafRes.error);
  if (skuRes.error) logQueryError('AdminVendorRecommendations (skus)', skuRes.error);
  if (feedbackRes.error) logQueryError('AdminVendorRecommendations (feedback)', feedbackRes.error);

  const recs = (recRes.data ?? []) as RawRec[];
  const leaves = (leafRes.data ?? []).map(
    (l): LeafOption => ({ id: l.id as string, label: (l.label_en as string) ?? (l.id as string) }),
  );
  const skus = (skuRes.data ?? []).map(
    (s): SkuOption => ({ service_code: s.service_code as string, title: s.title as string }),
  );
  const feedback = (feedbackRes.data ?? []) as RawFeedback[];

  // Lookup maps for the joins.
  const leafLabel = new Map(leaves.map((l) => [l.id, l.label]));
  const skuTitle = new Map(skus.map((s) => [s.service_code, s.title]));

  // Some recommended SKUs in the map may be inactive (so absent from the active
  // SKU picker) — fetch any titles we still need so the map rows aren't blank.
  const missingCodes = Array.from(
    new Set(
      recs
        .map((r) => r.service_code)
        .filter((c) => !skuTitle.has(c))
        .concat(feedback.map((f) => f.service_code).filter((c): c is string => !!c && !skuTitle.has(c))),
    ),
  );
  if (missingCodes.length > 0) {
    const { data: extra } = await admin
      .from('platform_retail_catalog_v2')
      .select('service_code, title')
      .in('service_code', missingCodes);
    for (const s of extra ?? []) skuTitle.set(s.service_code as string, s.title as string);
  }

  // Vendor business names for the feedback queue.
  const vendorName = new Map<string, string>();
  const vendorIds = Array.from(new Set(feedback.map((f) => f.vendor_profile_id)));
  if (vendorIds.length > 0) {
    const { data: vendors } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorIds);
    for (const v of vendors ?? []) {
      vendorName.set(
        v.vendor_profile_id as string,
        (v.business_name as string | null) ?? 'A vendor',
      );
    }
  }

  // Group the map rows by leaf, preserving the priority order from the query.
  const groups = new Map<string, MapRow[]>();
  for (const r of recs) {
    const row: MapRow = {
      id: r.id,
      tile_id: r.tile_id,
      service_code: r.service_code,
      sku_title: skuTitle.get(r.service_code) ?? r.service_code,
      is_opt_in: r.is_opt_in,
      priority: r.priority,
      rationale: r.rationale,
      is_active: r.is_active,
    };
    const arr = groups.get(r.tile_id);
    if (arr) arr.push(row);
    else groups.set(r.tile_id, [row]);
  }
  // Sort the leaf groups by their display label.
  const groupedLeaves = Array.from(groups.keys()).sort((a, b) =>
    (leafLabel.get(a) ?? a).localeCompare(leafLabel.get(b) ?? b),
  );

  const feedbackRows: FeedbackRow[] = feedback.map((f) => ({
    id: f.id,
    tile_id: f.tile_id,
    leaf_label: leafLabel.get(f.tile_id) ?? f.tile_id,
    vendor_name: vendorName.get(f.vendor_profile_id) ?? 'A vendor',
    feedback_type: f.feedback_type,
    service_code: f.service_code,
    sku_title: f.service_code ? skuTitle.get(f.service_code) ?? f.service_code : null,
    note: f.note,
    created_at: f.created_at,
  }));

  const activeCount = recs.filter((r) => r.is_active).length;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Vendor recommendations</h1>
        </div>
        <p className="max-w-3xl text-sm text-ink/65">
          Recommend only what helps them — a SKU appears for a leaf only when it amplifies that
          vendor&apos;s own deliverable. Sparse by design. Mark a recommendation{' '}
          <span className="font-medium text-ink">Opt-in</span> when it could compete with the
          vendor&apos;s own service (it stays hidden until the vendor turns it on).
        </p>
      </header>

      <Banner search={search} />

      <div className="mb-8 grid grid-cols-2 gap-2 rounded-2xl border border-ink/10 bg-paper p-4 sm:grid-cols-4">
        <Stat label="Leaves with recs" value={String(groupedLeaves.length)} />
        <Stat label="Active recs" value={String(activeCount)} />
        <Stat label="Total recs" value={String(recs.length)} />
        <Stat label="Pending flags" value={String(feedbackRows.length)} />
      </div>

      {/* ─── The map, grouped by leaf ─────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-4 text-base font-semibold tracking-tight">
          Recommendation map ({recs.length})
        </h2>
        {groupedLeaves.length === 0 ? (
          <p className="rounded-2xl border border-ink/10 bg-cream px-4 py-6 text-center text-sm text-ink/60">
            No recommendations yet — add one below.
          </p>
        ) : (
          <div className="space-y-8">
            {groupedLeaves.map((leafId) => (
              <div key={leafId}>
                <h3 className="mb-3 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {leafLabel.get(leafId) ?? leafId}
                  </span>
                  <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                    {leafId}
                  </code>
                </h3>
                <div className="space-y-3">
                  {(groups.get(leafId) ?? []).map((row) => (
                    <RecommendationRow key={row.id} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Add a recommendation ─────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-1 text-base font-semibold tracking-tight">Add a recommendation</h2>
        <p className="mb-3 text-sm text-ink/60">
          Pair a vendor leaf with a Setnayan SKU. The pairing is unique — adding an existing one is
          a no-op.
        </p>
        <AddRecommendation leaves={leaves} skus={skus} />
      </section>

      {/* ─── Pending vendor flags ─────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold tracking-tight">
          Vendor flags ({feedbackRows.length} pending)
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Vendors flag the map as <span className="font-medium">not a fit</span> or{' '}
          <span className="font-medium">suggest add</span>. Accepting acts on the map (deactivate /
          add); declining just resolves the flag.
        </p>
        {feedbackRows.length === 0 ? (
          <p className="rounded-2xl border border-ink/10 bg-cream px-4 py-6 text-center text-sm text-ink/60">
            No pending flags.
          </p>
        ) : (
          <div className="space-y-3">
            {feedbackRows.map((row) => (
              <FeedbackCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/5 bg-cream p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}
