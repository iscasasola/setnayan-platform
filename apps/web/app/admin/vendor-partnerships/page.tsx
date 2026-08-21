import { Handshake } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ErrorState } from '@/app/_components/states/error-state';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { rejectPartnership, createPartnershipHq } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Vendor Partnerships · Admin' };

type SearchParams = {
  rejected?: string;
  created?: string;
  error?: string;
};

type PartnershipStatus = 'proposed' | 'accepted' | 'declined' | 'withdrawn';

type PartnershipRow = {
  id: number;
  recommending_vendor_id: string;
  recommended_vendor_id: string;
  relationship_type: string;
  additional_fee_centavos: number | null;
  discount_pct: number | null;
  covered_plan_groups: string[];
  is_active: boolean;
  status: PartnershipStatus;
  created_at: string;
  recommending: { business_name: string; services: string[] } | null;
  recommended: { business_name: string; services: string[] } | null;
};

type VendorOption = {
  vendor_profile_id: string;
  business_name: string;
};

type ServiceCategoryOption = {
  id: string;
  label_en: string;
  tier: number;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  accredited: 'Accredited',
  included_in_package: 'Included in package',
  discounted_together: 'Discounted',
  general: 'General referral',
};

const STATUS_LABELS: Record<PartnershipStatus, string> = {
  proposed: 'Proposed',
  accepted: 'Accepted · live',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

function formatFee(cents: number | null, type: string): string {
  if (type === 'included_in_package') return 'Included (₱0)';
  if (cents === null) return '—';
  if (cents === 0) return '₱0';
  return `₱${(cents / 100).toLocaleString('en-PH')}`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type Props = {
  searchParams: Promise<SearchParams>;
};

/**
 * A CEILING, NOT A PAGE SIZE — checked before wiring it as `cap`.
 *
 * Nothing pages past this: `SearchParams` carries only the three flash keys,
 * there is no offset/page/cursor anywhere in the file, and there is no next
 * control. So disclosing "there are more" is the only honest thing here — it is
 * not a second promise competing with an existing pager. The heading already
 * hinted at it by saying "N shown"; now the table says what "shown" costs.
 */
const LIVE_LIMIT = 25;

/**
 * ⚠ THE VENDOR PICKER SILENTLY TRUNCATES AND THAT IS NOT A TABLE PROBLEM.
 * The Add-partnership dropdowns are fed by a read capped at this number, so past
 * it a vendor simply cannot be chosen and nothing says why. Named here rather
 * than left as a literal; a `<select>` is not a ConsoleTable, so the disclosure
 * cannot be `cap`. Prod holds 2 shops, so it is far off — but it is a real
 * ceiling, not an absence of one.
 */
const VENDOR_OPTIONS_LIMIT = 500;

export default async function AdminVendorPartnershipsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;

  const admin = createAdminClient();

  // Live PROPOSALS — recipient hasn't accepted/declined yet, still active. This
  // is HQ's oversight cut (the queue badge keys on the same filter): nothing has
  // published to couples, and HQ can veto an abusive one before it ever can.
  const { data: rawProposed, error: proposedError } = await admin
    .from('vendor_partnerships')
    .select(
      'id, recommending_vendor_id, recommended_vendor_id, relationship_type, additional_fee_centavos, discount_pct, covered_plan_groups, is_active, status, created_at',
    )
    .eq('status', 'proposed')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  // Live (accepted + active) partnerships — the badges couples actually see.
  const { data: rawLive, error: liveError } = await admin
    .from('vendor_partnerships')
    .select(
      'id, recommending_vendor_id, recommended_vendor_id, relationship_type, additional_fee_centavos, discount_pct, covered_plan_groups, is_active, status, created_at',
    )
    .eq('status', 'accepted')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(LIVE_LIMIT);

  // NULL, not []: the OPEN PROPOSALS half was missed when the live half was
  // fixed — same file, same defect, one read apart. A refused read printed "No
  // open partnership proposals. Set na 'yan." on HQ's only veto surface, which
  // reads as "nothing to review" to the one person who could stop an abusive
  // partnership before it publishes.
  const proposedRowsRaw = rawProposed as Omit<PartnershipRow, 'recommending' | 'recommended'>[] | null;
  const proposedRows = proposedRowsRaw ?? [];
  // NULL, not []: a refused read must stay distinguishable from a real zero.
  // Worse than the usual shape here — the whole section was wrapped in
  // `{live.length > 0 ? … : null}`, so a refused read made it VANISH. A reader
  // cannot even tell there is a list, let alone that it failed.
  const liveRows = rawLive as Omit<PartnershipRow, 'recommending' | 'recommended'>[] | null;

  // Resolve vendor names for all rows in one round-trip
  const allVendorIds = new Set<string>();
  [...proposedRows, ...(liveRows ?? [])].forEach((r) => {
    allVendorIds.add(r.recommending_vendor_id);
    allVendorIds.add(r.recommended_vendor_id);
  });
  const vendorNameMap = new Map<string, { business_name: string; services: string[] }>();
  // A failed NAME lookup is invisible by construction: the rows still render,
  // and the fallback for a missing name is the raw vendor id, which looks like
  // data. So the failure is carried out and said on screen.
  let vendorNamesUnresolved = false;
  if (allVendorIds.size > 0) {
    const { data: vendorNames, error: vendorNamesError } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, services')
      .in('vendor_profile_id', [...allVendorIds]);
    vendorNamesUnresolved = Boolean(vendorNamesError) || vendorNames === null;
    for (const v of (vendorNames ?? []) as {
      vendor_profile_id: string;
      business_name: string;
      services: string[] | null;
    }[]) {
      vendorNameMap.set(v.vendor_profile_id, {
        business_name: v.business_name,
        services: v.services ?? [],
      });
    }
  }

  // All vendors for the "Add partnership" search dropdowns.
  // ⚠ Was `.eq('is_active', true)` — `vendor_profiles` HAS NO `is_active`
  // column, so PostgREST answered 42703 and this dropdown was ALWAYS EMPTY:
  // an admin could never add a partnership. The filter is dropped rather than
  // re-pointed because the comment's intent is "all vendors" and this is the
  // internal console, where an admin legitimately needs to see unverified and
  // hidden shops too. (The vendor-facing picker keeps a liveness filter.)
  //
  // 🔑 THIS EXACT DROPDOWN HAS ALREADY BEEN EMPTY-AND-SILENT ONCE — the comment
  // above records it. A refused read reaches the SAME end state by a different
  // route: `?? []` renders an empty `<select>`, the admin cannot pick anybody,
  // and nothing anywhere says why. Fixing the phantom column fixed one CAUSE;
  // the SYMPTOM stayed unreportable until now.
  const { data: allVendors, error: allVendorsError } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .order('business_name', { ascending: true })
    .limit(VENDOR_OPTIONS_LIMIT);
  const vendorOptionsUnreadable = Boolean(allVendorsError) || allVendors === null;
  const vendorOptions = (allVendors ?? []) as VendorOption[];

  // Top-level plan group categories for the covered_plan_groups multi-select
  const { data: cats, error: catsError } = await admin
    .from('service_categories')
    .select('id, label_en, tier')
    .eq('tier', 1)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });
  const categoryOptionsUnreadable = Boolean(catsError) || cats === null;
  const categoryOptions = (cats ?? []) as ServiceCategoryOption[];

  const enrich = (
    row: Omit<PartnershipRow, 'recommending' | 'recommended'>,
  ): PartnershipRow => ({
    ...row,
    recommending: vendorNameMap.get(row.recommending_vendor_id) ?? null,
    recommended: vendorNameMap.get(row.recommended_vendor_id) ?? null,
  });

  const proposed = proposedRows.map(enrich);
  const live = liveRows ? liveRows.map(enrich) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="Vendor Partnerships"
      />

      {sp.error ? (
        <FormFlash tone="error">{decodeURIComponent(sp.error)}</FormFlash>
      ) : null}
      {sp.rejected ? (
        <FormFlash tone="success">Partnership rejected and deactivated.</FormFlash>
      ) : null}
      {sp.created ? (
        <FormFlash tone="success">
          Partnership proposed on the vendor&apos;s behalf. It lands in the recommended
          vendor&apos;s inbox and only goes live once they accept it.
        </FormFlash>
      ) : null}

      {/* ── OPEN PROPOSALS (HQ oversight) ────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="sn-eye">
            Open proposals ({proposed.length})
          </h2>
          <p className="text-xs text-ink/45">
            {proposed.length === 0
              ? 'No proposals awaiting a recipient response.'
              : 'Awaiting the recommended vendor to accept or decline. Reject to veto.'}
          </p>
        </div>

        {proposedRowsRaw === null ? (
          <ErrorState
            title="Couldn’t read the open proposals"
            broke={
              proposedError?.message
                ? `The read was refused: ${proposedError.message}`
                : 'The read did not complete.'
            }
            survived="Nothing loaded, so this is NOT a statement that there are no proposals waiting — it is a statement that we do not know. Any proposal already filed is still live and can still be accepted by the vendor it names."
            todo="Reload. If it repeats, the query is being rejected rather than returning nothing, and the column, value or migration it names is the thing to check."
          />
        ) : proposed.length === 0 ? (
          <div className="sn-row p-8 text-center text-sm text-ink/70">
            No open partnership proposals. Set na &apos;yan.
          </div>
        ) : (
          <ul className="space-y-4">
            {proposed.map((row) => {
              const partnershipIdStr = String(row.id);

              return (
                <li key={row.id} className="sn-row p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-mulberry/10 px-2 py-0.5 text-[11px] font-bold text-mulberry">
                          {RELATIONSHIP_LABELS[row.relationship_type] ?? row.relationship_type}
                        </span>
                        <span className="rounded-md bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn-800">
                          {STATUS_LABELS[row.status]}
                        </span>
                        {row.discount_pct ? (
                          <span className="rounded-md bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                            {row.discount_pct}% off
                          </span>
                        ) : null}
                        {row.additional_fee_centavos !== null &&
                        row.relationship_type !== 'included_in_package' ? (
                          <span className="rounded-md bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn-800">
                            {formatFee(row.additional_fee_centavos, row.relationship_type)}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-sm font-semibold text-ink">
                        {row.recommending?.business_name ?? row.recommending_vendor_id}
                        <span className="mx-2 font-normal text-ink/40">recommends</span>
                        {row.recommended?.business_name ?? row.recommended_vendor_id}
                      </p>

                      {row.recommending?.services?.length ? (
                        <p className="text-xs text-ink/50">
                          Recommending:{' '}
                          {row.recommending.services.slice(0, 3).join(', ')}
                        </p>
                      ) : null}

                      {row.covered_plan_groups?.length ? (
                        <p className="text-xs text-ink/60">
                          Covers:{' '}
                          <span className="font-medium">
                            {row.covered_plan_groups.join(', ')}
                          </span>
                        </p>
                      ) : null}

                      <p className="text-xs text-ink/40">
                        Proposed {timeAgo(row.created_at)}
                      </p>
                    </div>

                    {/* Action — reject kill-switch only (no admin verify) */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <form>
                        <input type="hidden" name="partnership_id" value={partnershipIdStr} />
                        <SubmitButton
                          formAction={rejectPartnership}
                          pendingLabel="Rejecting…"
                          className="rounded-md border border-terracotta/40 bg-white px-3 py-1.5 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50"
                        >
                          Reject
                        </SubmitButton>
                      </form>
                      <p className="max-w-[180px] text-right text-[10px] text-ink/45">
                        Rejecting sets it inactive — no badge can ever show.
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── ADD PARTNERSHIP (HQ manual entry) ───────────────────────────── */}
      <section className="mb-10 rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/30 p-5 sm:p-6">
        <h2 className="mb-1 sn-eye">
          Add partnership (HQ entry)
        </h2>
        <p className="mb-4 text-xs text-ink/70">
          Propose a partnership on a vendor&apos;s behalf. It lands in the recommended
          vendor&apos;s partnerships inbox — the badge only goes live once THEY accept it.
        </p>

        {/* An UNREADABLE picker and a truncated one fail the same way — the shop
            is not in the list and nothing says why — but they need different
            sentences, because one is "try again" and the other is "it is there,
            just past the end". */}
        {vendorOptionsUnreadable || categoryOptionsUnreadable ? (
          <p
            role="alert"
            className="mb-4 rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900"
          >
            {vendorOptionsUnreadable && categoryOptionsUnreadable
              ? 'The shop list and the category list could not be read, so both are empty below — that is not a sign there are none.'
              : vendorOptionsUnreadable
                ? 'The shop list could not be read, so the two menus below are empty — that is not a sign there are no shops.'
                : 'The category list could not be read, so no categories are offered below — that is not a sign there are none.'}{' '}
            Anything recorded now would be incomplete, so reload before using this
            form.
          </p>
        ) : null}

        {vendorOptions.length >= VENDOR_OPTIONS_LIMIT ? (
          <p className="mb-4 rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
            The vendor lists below stop at the first{' '}
            {VENDOR_OPTIONS_LIMIT.toLocaleString()} shops by name. A shop past that point cannot
            be picked here yet — it is missing from the list, not missing from Setnayan.
          </p>
        ) : null}

        <form action={createPartnershipHq} className="grid gap-4 sm:grid-cols-2">
          {/* Recommending vendor */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Recommending vendor</span>
            <select
              name="recommending_vendor_id"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select vendor…</option>
              {vendorOptions.map((v) => (
                <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
                  {v.business_name}
                </option>
              ))}
            </select>
          </label>

          {/* Recommended vendor */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Recommended vendor</span>
            <select
              name="recommended_vendor_id"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select vendor…</option>
              {vendorOptions.map((v) => (
                <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
                  {v.business_name}
                </option>
              ))}
            </select>
          </label>

          {/* Relationship type */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Relationship type</span>
            <select
              name="relationship_type"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select type…</option>
              {Object.entries(RELATIONSHIP_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {/* Additional fee */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Additional fee (centavos)</span>
            <input
              type="number"
              name="additional_fee_centavos"
              min={0}
              placeholder="e.g. 100000 = ₱1,000 · leave blank = unknown"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>

          {/* Discount pct */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Discount % (for discounted type)</span>
            <input
              type="number"
              name="discount_pct"
              min={0}
              max={100}
              placeholder="e.g. 10"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>

          {/* Covered plan groups */}
          <div className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Covered plan groups</span>
            <p className="text-xs text-ink/50">
              Which checklist categories does this partnership help resolve?
            </p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {categoryOptions.map((cat) => (
                <label key={cat.id} className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="covered_plan_groups"
                    value={cat.id}
                    className="accent-mulberry"
                  />
                  {cat.label_en}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <SubmitButton
              pendingLabel="Creating…"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Propose partnership (lands in vendor inbox)
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* ── LIVE PARTNERSHIPS (accepted) ────────────────────────────────── */}
      <section>
        <h2 className="mb-3 sn-eye">
          Live partnerships {live ? `(${live.length} shown)` : '(not measured)'}
        </h2>

        {/* A dash where a shop's name should be is ALREADY the legitimate value
            for a shop with no name on file, so it cannot also be allowed to mean
            "we could not look it up". The page says which. */}
        {vendorNamesUnresolved ? (
          <p
            role="alert"
            className="mb-3 rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900"
          >
            Shop names could not be looked up, so the rows below and the proposals
            above fall back to internal reference codes. The partnerships
            themselves are real — only the names are missing.
          </p>
        ) : null}
        <ConsoleTable
          rows={live}
          readPermitted
          readError={liveError}
          reads="the live partnerships"
          cap={LIVE_LIMIT}
          label="Live partnerships"
          minWidth="52rem"
          rowKey={(row) => String(row.id)}
          empty={{
            Icon: Handshake,
            title: 'No live partnerships yet',
            blurb:
              'A partnership only appears here once BOTH vendors have agreed — one proposes above, the other accepts from their own inbox. Until then it sits in Open proposals.',
          }}
          columns={[
            {
              header: 'Recommending',
              cell: (row) => (
                <span className="font-medium text-ink">
                  {row.recommending?.business_name ?? '—'}
                </span>
              ),
            },
            {
              header: 'Recommended',
              cell: (row) => (
                <span className="text-ink/80">{row.recommended?.business_name ?? '—'}</span>
              ),
            },
            {
              header: 'Type',
              hideBelow: 'md',
              cell: (row) => (
                <span className="whitespace-nowrap rounded-md bg-mulberry/10 px-2 py-0.5 text-[11px] font-semibold text-mulberry">
                  {RELATIONSHIP_LABELS[row.relationship_type] ?? row.relationship_type}
                </span>
              ),
            },
            {
              header: 'Fee / Discount',
              hideBelow: 'lg',
              cell: (row) => (
                <span className="whitespace-nowrap text-ink/70">
                  {row.discount_pct ? `${row.discount_pct}% off` : null}
                  {row.discount_pct && row.additional_fee_centavos !== null ? ' · ' : null}
                  {formatFee(row.additional_fee_centavos, row.relationship_type)}
                </span>
              ),
            },
            {
              header: 'Accepted',
              hideBelow: 'md',
              mono: true,
              cell: (row) => (
                <span className="whitespace-nowrap text-ink/70">{timeAgo(row.created_at)}</span>
              ),
            },
            {
              header: 'Take down',
              align: 'right',
              // Its own form in its own cell — ConsoleTable has no actions API.
              cell: (row) => (
                <form>
                  <input type="hidden" name="partnership_id" value={String(row.id)} />
                  <SubmitButton
                    formAction={rejectPartnership}
                    pendingLabel="Removing…"
                    className="whitespace-nowrap rounded-md border border-terracotta/40 bg-white px-2.5 py-1 text-[11px] font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50"
                  >
                    Take down
                  </SubmitButton>
                </form>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
