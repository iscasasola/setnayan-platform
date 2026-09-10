import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Gift, Store, Ticket } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { issueCompGrant, revokeCompGrant } from '@/app/admin/users/actions';
import { setVendorTier, issueVendorSkuComp } from '@/app/admin/vendors/actions';
import {
  VENDOR_PHOTO_CHALLENGE_SKU_CODE,
  VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS,
} from '@/lib/vendor-photo-challenge';
import {
  fetchAllActiveCompGrants,
  fetchEventsHostedBy,
  formatRetailValueCentavos,
  describeReach,
  describeScope,
  describeSource,
  type CompGrantRow,
} from '@/lib/comp-grants';
import {
  fetchCompedVendors,
  fetchVendorDealWindows,
  type CompedVendorRow,
  type VendorDealRow,
} from '@/lib/vendor-tier-comps';
import { fetchCoupleFreeWindows, type CoupleFreeWindowRow } from '@/lib/promo-free-window-admin';
import { VENDOR_TIER_SETTABLE, TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';
import {
  createFreeWindow,
  setFreeWindowActive,
} from '@/app/admin/pricing/_surfaces/free-windows-actions';
import { FREE_WINDOW_CREATE_ERROR_COPY } from '@/app/admin/pricing/_surfaces/free-windows-copy';
import {
  fetchV2VendorCatalog,
  fetchV2CustomerCatalog,
  formatPeso,
  type V2VendorSku,
  type V2CustomerSku,
} from '@/lib/v2-catalog';
import { isPromoFreeWindowsEnabled, vendorTierOfSku } from '@/lib/promo-free-windows';

/**
 * One row of the vendor list — a single comped vendor, or one cohort DEAL
 * (a `promo_free_windows` row with a vendor audience) sitting beside it.
 */
type VendorGiftRow =
  | ({ kind: 'vendor' } & CompedVendorRow)
  | ({ kind: 'window' } & VendorDealRow);

const DEAL_WHO: Record<VendorDealRow['audience_type'], string> = {
  all_vendors: 'All verified vendors',
  new_verified_vendors: 'Vendors who register + get verified in the window',
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

/** 'YYYY-MM-DD' → 'Dec 25, 2026', forced to UTC so the date-only column
 * always reads back as the calendar day it says (a Date parsed from a bare
 * date string at midnight UTC would print the PREVIOUS day under a
 * negative-offset local zone otherwise). */
const fmtEventDay = (dateOnly: string) =>
  new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateOnly}T00:00:00Z`));

/** Human summary of a couple window's event-date filter, or null when unset
 * (applies to any event — unchanged pre-G5 behavior). */
function eventDateRangeLabel(w: Pick<CoupleFreeWindowRow, 'event_date_from' | 'event_date_to'>): string | null {
  if (!w.event_date_from && !w.event_date_to) return null;
  if (w.event_date_from && w.event_date_to) {
    return w.event_date_from === w.event_date_to
      ? `Events dated ${fmtEventDay(w.event_date_from)}`
      : `Events dated ${fmtEventDay(w.event_date_from)} – ${fmtEventDay(w.event_date_to)}`;
  }
  return w.event_date_from
    ? `Events dated ${fmtEventDay(w.event_date_from)} onward`
    : `Events dated through ${fmtEventDay(w.event_date_to!)}`;
}

export const metadata = {
  title: 'Gifts · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    vendor_q?: string;
    user_q?: string;
    grant_vendor?: string;
    grant_user?: string;
    banner?: string;
    created?: string;
    createError?: string;
    saved?: string;
    error?: string;
  }>;
};

/**
 * /admin/gifts — everything currently comped, for a vendor or a user, in one
 * place. v1 (owner-picked 2026-09-04): list + grant a SINGLE named target.
 * v2 (2026-09-05): the vendor half also carries COHORT DEALS — one
 * `promo_free_windows` row with a vendor audience, granting every vendor who
 * qualifies: all VERIFIED vendors, or every vendor who registers and gets
 * verified inside the window. Resolved statelessly per vendor at gate time
 * (lib/promo-free-windows.ts); no per-vendor row, no job, no trigger.
 *
 * Deliberately reuses the EXISTING write paths rather than inventing a third:
 *   - Vendor comps write through `setVendorTier` (tier only — comp_grants
 *     explicitly excludes vendors, see its own docblock in admin/users/actions.ts).
 *   - Vendor deals write through `createFreeWindow` / `setFreeWindowActive`
 *     (app/admin/pricing/_surfaces/free-windows-actions.ts — the Catalog
 *     Studio tab's own actions, posted with `return_to=/admin/gifts`).
 *   - User/event comps write through `issueCompGrant` / `revokeCompGrant`
 *     (comp_grants is scoped to a USER account; since migration
 *     20271205612762 an optional `event_id` narrows a grant to ONE of that
 *     user's events — NULL still means every event they host).
 *
 * This page is the READ-side union of those writers plus a lightweight
 * search-and-select flow to reach either grant form without already knowing
 * the target's ID.
 *
 * ⚠ Deals ship DARK: env PROMO_FREE_WINDOWS_ENABLED (default off) is checked
 * before any window is read, so a live deal grants nothing until the owner
 * flips it in Vercel. The page says which state the switch is in.
 *
 * Both lists render through `ConsoleTable`, so a REFUSED read says "couldn't
 * read" instead of "nobody is comped" — the readers throw, and a throw caught
 * here becomes `rows: null` + `readError`, which the archetype reports and can
 * never fall through to Empty.
 */
export default async function AdminGiftsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createAdminClient();

  const asReadError = (e: unknown): { message: string } => ({
    message: e instanceof Error ? e.message : String(e),
  });
  let compedVendors: CompedVendorRow[] | null = null;
  let vendorsReadError: { message: string } | null = null;
  try {
    compedVendors = await fetchCompedVendors(admin);
  } catch (e) {
    vendorsReadError = asReadError(e);
  }
  let dealWindows: VendorDealRow[] | null = null;
  let dealsReadError: { message: string } | null = null;
  try {
    dealWindows = await fetchVendorDealWindows(admin);
  } catch (e) {
    dealsReadError = asReadError(e);
  }
  // ONE vendor list: deals first (each reaches many vendors), then the named
  // vendors. Either read refused → the whole list says "couldn't read"; a
  // half-list would read as "these are all the comps", which is the lie the
  // archetype exists to prevent.
  const vendorRows: VendorGiftRow[] | null =
    compedVendors && dealWindows
      ? [
          ...dealWindows.map((w): VendorGiftRow => ({ kind: 'window', ...w })),
          ...compedVendors.map((v): VendorGiftRow => ({ kind: 'vendor', ...v })),
        ]
      : null;
  const vendorRowsReadError = vendorsReadError ?? dealsReadError;
  let activeGrants: CompGrantRow[] | null = null;
  let grantsReadError: { message: string } | null = null;
  try {
    activeGrants = await fetchAllActiveCompGrants(admin);
  } catch (e) {
    grantsReadError = asReadError(e);
  }
  // What a deal can make free — READ FROM vendor_billing_catalog, never typed.
  // Only the tier rows can be picked: a deal is a tier promotion, and no
  // add-on has a shared gate a window could reach today.
  const vendorCatalog = await fetchV2VendorCatalog();
  const tierSkus = vendorCatalog.filter((r) => vendorTierOfSku(r.sku_code) !== null);
  const dealsFlagOn = isPromoFreeWindowsEnabled();

  // ── Couple free windows (G5) ───────────────────────────────────────────
  // Own ConsoleTable, not merged into VendorGiftRow — a couple window has no
  // "vendor" or "tier" concept, so folding it into the vendor-shaped table
  // (Vendor/Tier/Ends/Manage) would force blank cells on every row of one
  // kind or the other. See the PR body for the fuller reasoning.
  let coupleWindows: CoupleFreeWindowRow[] | null = null;
  let coupleWindowsReadError: { message: string } | null = null;
  try {
    coupleWindows = await fetchCoupleFreeWindows(admin);
  } catch (e) {
    coupleWindowsReadError = asReadError(e);
  }
  const customerCatalog = await fetchV2CustomerCatalog();
  const coupleTitleFor = new Map<string, string>(
    customerCatalog.map((s: V2CustomerSku) => [s.service_code, s.title]),
  );

  // Resolve display info for every user_id on an active grant, one query.
  const userIds = Array.from(
    new Set((activeGrants ?? []).map((g) => g.user_id).filter((id): id is string => !!id)),
  );
  const { data: grantUsers } = userIds.length
    ? await admin.from('users').select('user_id, email, display_name').in('user_id', userIds)
    : { data: [] as { user_id: string; email: string | null; display_name: string | null }[] };
  const userById = new Map((grantUsers ?? []).map((u) => [u.user_id, u]));

  // ── Vendor search + selection ──────────────────────────────────────────
  const vendorQuery = sp.vendor_q?.trim() ?? '';
  let vendorResults: { vendor_profile_id: string; public_id: string; business_name: string }[] = [];
  if (vendorQuery.length >= 2) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, public_id, business_name')
      .ilike('business_name', `%${vendorQuery}%`)
      .order('business_name', { ascending: true })
      .limit(8);
    vendorResults = data ?? [];
  }
  let grantVendor: { vendor_profile_id: string; public_id: string; business_name: string; tier_state: string; tier_expires_at: string | null } | null = null;
  if (sp.grant_vendor) {
    const { data } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, public_id, business_name, tier_state, tier_expires_at')
      .eq('vendor_profile_id', sp.grant_vendor)
      .maybeSingle();
    grantVendor = data ?? null;
  }

  // ── User search + selection ────────────────────────────────────────────
  const userQuery = sp.user_q?.trim() ?? '';
  let userResults: { user_id: string; email: string | null; display_name: string | null }[] = [];
  if (userQuery.length >= 2) {
    const { data } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .or(`email.ilike.%${userQuery}%,display_name.ilike.%${userQuery}%`)
      .limit(8);
    userResults = data ?? [];
  }
  let grantUser: { user_id: string; email: string | null; display_name: string | null } | null = null;
  let grantUserEvents: Awaited<ReturnType<typeof fetchEventsHostedBy>> = [];
  if (sp.grant_user) {
    const { data } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .eq('user_id', sp.grant_user)
      .maybeSingle();
    grantUser = data ?? null;
    if (grantUser) {
      grantUserEvents = await fetchEventsHostedBy(admin, grantUser.user_id);
    }
  }

  // (Event display names arrive on the grant rows themselves — `event_name`,
  // embedded by fetchAllActiveCompGrants — so the separate lookup this page
  // used to run is gone. One resolver, `describeReach`, renders it here and on
  // both per-user surfaces, which is how those two stopped disagreeing.)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMasthead titleNode="Gifts" />
      <div className="mb-6 space-y-1">
        <p className="text-2xl font-semibold tracking-tight">Gifts</p>
        <p className="text-sm text-ink/60">
          Every vendor tier comp, vendor cohort deal and user/event comp currently active, in one
          place. Grants a single named vendor or user account, or opens a deal for all verified
          vendors or for every vendor who registers and gets verified inside a window.
        </p>
      </div>

      {sp.banner && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ {sp.banner}
        </div>
      )}
      {sp.created && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Deal created.
        </div>
      )}
      {sp.saved && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Deal updated.
        </div>
      )}
      {sp.createError && (
        <div className="mb-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {FREE_WINDOW_CREATE_ERROR_COPY[sp.createError] ?? 'Could not create the deal.'}
        </div>
      )}
      {sp.error && (
        <div className="mb-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Something went wrong. Please try again.
        </div>
      )}

      {/* ══════════════════ VENDOR SIDE ══════════════════ */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Vendor tier comps
        </h2>

        <form className="mb-4 flex gap-2" action="/admin/gifts">
          <input
            type="text"
            name="vendor_q"
            defaultValue={vendorQuery}
            placeholder="Search vendors by business name…"
            className="flex-1 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
          />
          <SubmitButton className="button-secondary h-10 px-4 text-sm" overlay={false}>
            Search
          </SubmitButton>
        </form>

        {vendorResults.length > 0 && !grantVendor && (
          <ul className="mb-4 divide-y divide-ink/10 rounded-md border border-ink/10">
            {vendorResults.map((v) => (
              <li key={v.vendor_profile_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {v.business_name} <span className="font-mono text-xs text-ink/50">{v.public_id}</span>
                </span>
                <Link
                  href={`/admin/gifts?grant_vendor=${v.vendor_profile_id}`}
                  className="text-xs font-medium text-link hover:underline"
                >
                  Comp this vendor
                </Link>
              </li>
            ))}
          </ul>
        )}
        {vendorQuery.length >= 2 && vendorResults.length === 0 && !grantVendor && (
          <p className="mb-4 text-xs text-ink/50">No vendors match &ldquo;{vendorQuery}&rdquo;.</p>
        )}

        {grantVendor && (
          <div className="mb-4 rounded-md border border-ink/10 bg-paper p-4">
            <p className="mb-3 text-sm">
              Comping <strong>{grantVendor.business_name}</strong> — current tier:{' '}
              <span className="font-medium">{TIER_LABEL[asVendorTier(grantVendor.tier_state)]}</span>.{' '}
              <Link href="/admin/gifts" className="text-link hover:underline">
                Cancel
              </Link>
            </p>
            <form action={setVendorTier} className="space-y-3">
              <input type="hidden" name="vendor_id" value={grantVendor.vendor_profile_id} />
              <input type="hidden" name="return_to" value="/admin/gifts" />
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="tier_state" className="block text-xs font-medium text-ink/70 mb-1">
                    Tier
                  </label>
                  <select
                    id="tier_state"
                    name="tier_state"
                    defaultValue={asVendorTier(grantVendor.tier_state)}
                    className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  >
                    {VENDOR_TIER_SETTABLE.map((t) => (
                      <option key={t} value={t}>
                        {TIER_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tier_expires_at" className="block text-xs font-medium text-ink/70 mb-1">
                    Ends <span className="text-ink/50">(optional)</span>
                  </label>
                  <input
                    type="date"
                    id="tier_expires_at"
                    name="tier_expires_at"
                    className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reason" className="block text-xs font-medium text-ink/70 mb-1">
                  Reason <span className="text-ink/50">(logged, min. 10 characters)</span>
                </label>
                <input
                  type="text"
                  id="reason"
                  name="reason"
                  placeholder="e.g. Founding cohort — verified before Oct 15"
                  className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                />
              </div>
              <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Saving…">
                Set tier
              </SubmitButton>
            </form>

            {/* SKU-level, not the whole tier — comps ONE add-on
                (comp_grants.vendor_profile_id, source='external_promo', never
                'vendor_self_comp' — see issueVendorSkuComp's docblock for the
                self-comp-quota trigger this deliberately never trips). */}
            <form action={issueVendorSkuComp} className="mt-4 space-y-3 border-t border-ink/10 pt-4">
              <input type="hidden" name="vendor_id" value={grantVendor.vendor_profile_id} />
              <input type="hidden" name="sku" value={VENDOR_PHOTO_CHALLENGE_SKU_CODE} />
              <input type="hidden" name="return_to" value="/admin/gifts" />
              <p className="text-xs font-medium text-ink/70">
                Or comp Papic Challenges only ({VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS} days,
                stacking) — no tier change.
              </p>
              <input
                type="text"
                name="reason"
                placeholder="Reason (logged, min. 10 characters)"
                className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
              <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Saving…">
                Comp Papic Challenges
              </SubmitButton>
            </form>
          </div>
        )}

        <ConsoleTable<VendorGiftRow>
          rows={vendorRows}
          readError={vendorRowsReadError}
          readPermitted
          reads="the comped vendors and vendor deals"
          label="Comped vendors and deals"
          cap={200}
          minWidth="36rem"
          rowKey={(r) => (r.kind === 'window' ? `window:${r.promo_window_id}` : `vendor:${r.vendor_profile_id}`)}
          empty={{
            Icon: Store,
            title: 'No vendor is comped onto a paid tier, and no deal is open',
            blurb: 'Search a vendor above to set a tier, or open a deal below for a cohort.',
          }}
          columns={[
            {
              header: 'Vendor',
              cell: (r) =>
                r.kind === 'window' ? (
                  <span>
                    <span className="mr-1.5 inline-flex rounded-md bg-terracotta/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-terracotta-700">
                      Deal
                    </span>
                    {r.title}
                    <span className="block text-xs text-ink/55">
                      {DEAL_WHO[r.audience_type]} · {fmtDay(r.starts_at)} → {fmtDay(r.ends_at)}
                      {new Date(r.starts_at).getTime() > Date.now() ? ' · scheduled' : ''}
                    </span>
                  </span>
                ) : (
                  r.business_name
                ),
            },
            { header: 'Tier', cell: (r) => TIER_LABEL[r.kind === 'window' ? r.promoted_vendor_tier : r.tier_state] },
            {
              header: 'Ends',
              mono: true,
              cell: (r) =>
                r.kind === 'window'
                  ? r.deal_length_days
                    ? `${r.deal_length_days} days each`
                    : fmtDay(r.ends_at)
                  : r.tier_expires_at
                    ? fmtDay(r.tier_expires_at)
                    : 'Open-ended',
            },
            {
              header: 'Manage',
              align: 'right',
              // A row that settles on one click renders its own form in its own
              // cell — the archetype offers no actions API, on purpose.
              cell: (r) =>
                r.kind === 'window' ? (
                  <form action={setFreeWindowActive} className="inline-flex items-center gap-2">
                    <input type="hidden" name="return_to" value="/admin/gifts" />
                    <input type="hidden" name="promo_window_id" value={r.promo_window_id} />
                    <input type="hidden" name="is_active" value="false" />
                    <SubmitButton
                      className="text-xs font-medium text-mulberry hover:underline"
                      overlay={false}
                      pendingLabel="…"
                    >
                      End deal
                    </SubmitButton>
                  </form>
                ) : (
                  <Link
                    href={`/admin/vendors/${r.vendor_profile_id}/plan`}
                    className="text-xs font-medium text-link hover:underline"
                  >
                    Manage
                  </Link>
                ),
            },
          ]}
        />
        <p className="mt-2 text-xs text-ink/40">
          Every non-free tier here is a comp — self-serve vendor billing doesn&rsquo;t exist yet.
        </p>
      </section>

      {/* ══════════════════ VENDOR COHORT DEALS ══════════════════
          🚨 THIS FORM DID NOT EXIST until 2026-09-06, and everything behind it
          did. `createFreeWindow` already accepted `service_keys` picked from
          the live vendor catalogue, `new_verified_vendors` was a valid
          audience, `deal_length_days` was a column, and BOTH surfaces' copy
          pointed here — the Catalog Studio tab says in so many words "use the
          Deals section on Gifts". There was nothing to use. A post-merge audit
          found it: two of the feature's three shapes were uncreatable from any
          UI. This renders the writer that was already wired. */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Vendor cohort deals
        </h2>

        {/* 🔑 THE KILL-SWITCH, SAID OUT LOUD. `dealsFlagOn` was computed on this
            page and never rendered, so a deal listed above as "currently
            active" was indistinguishable from one that grants nothing —
            `getPromotedVendorTierFor` returns null before any read while the
            flag is off. The page's own docblock claimed it said which state the
            switch was in; now it does. */}
        {dealsFlagOn ? (
          <p className="mb-4 flex items-start gap-2 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-900">
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} />
            <span>
              Vendor deals are <strong>live</strong>. A deal below promotes every vendor it
              covers for as long as it runs.
            </span>
          </p>
        ) : (
          <p className="mb-4 flex items-start gap-2 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-900">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} />
            <span>
              Vendor deals are <strong>switched off</strong> — <code className="font-mono text-[11px]">PROMO_FREE_WINDOWS_ENABLED</code>{' '}
              is not set in Vercel. Anything listed above or created below is recorded and
              dated, and promotes <strong>nobody</strong> until the owner flips it. Deals are
              not retroactive: a vendor who qualifies while it is off gets nothing for that time.
            </span>
          </p>
        )}

        {sp.created === 'window' && (
          <p className="mb-4 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-900">
            ✓ Deal created.
          </p>
        )}
        {sp.createError && (
          <p className="mb-4 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-900">
            {FREE_WINDOW_CREATE_ERROR_COPY[sp.createError] ?? 'Could not create the deal.'}
          </p>
        )}

        <form action={createFreeWindow} className="rounded-md border border-ink/10 bg-paper p-4 space-y-4">
          <input type="hidden" name="return_to" value="/admin/gifts" />

          <div>
            <span className="mb-1 block text-xs font-medium text-ink/70">Who qualifies</span>
            <label className="mr-4 text-sm">
              <input type="radio" name="audience_type" value="all_vendors" defaultChecked />{' '}
              Every verified vendor
            </label>
            <label className="text-sm">
              <input type="radio" name="audience_type" value="new_verified_vendors" />{' '}
              Vendors who register <em>and</em> get verified inside the window
            </label>
            <p className="mt-1 text-xs text-ink/50">
              Both mean <strong>verified</strong> vendors only — a pending or unverified shop
              never qualifies.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="deal_title" className="block text-xs font-medium text-ink/70 mb-1">
                Title
              </label>
              <input
                type="text"
                id="deal_title"
                name="title"
                required
                maxLength={120}
                placeholder="Founding shops — free Pro for the September intake"
                className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <label htmlFor="deal_blurb" className="block text-xs font-medium text-ink/70 mb-1">
                Banner blurb <span className="text-ink/50">(optional)</span>
              </label>
              <input
                type="text"
                id="deal_blurb"
                name="blurb"
                maxLength={240}
                placeholder="Pro is on us while you set up your shop."
                className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="deal_starts" className="block text-xs font-medium text-ink/70 mb-1">
                Window opens
              </label>
              <input
                type="datetime-local"
                id="deal_starts"
                name="starts_at"
                required
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="deal_ends" className="block text-xs font-medium text-ink/70 mb-1">
                Window closes
              </label>
              <input
                type="datetime-local"
                id="deal_ends"
                name="ends_at"
                required
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="deal_length" className="block text-xs font-medium text-ink/70 mb-1">
                Each vendor keeps it <span className="text-ink/50">(days, optional)</span>
              </label>
              <input
                type="number"
                id="deal_length"
                name="deal_length_days"
                min={1}
                max={365}
                placeholder="28"
                className="w-40 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-ink/50">
            The window decides <strong>who gets in</strong>; this decides{' '}
            <strong>how long each of them keeps it</strong>, counted from the moment they
            qualify. Leave it blank and the deal simply runs until the window closes.
          </p>

          <div>
            <span className="mb-1 block text-xs font-medium text-ink/70">What&rsquo;s free</span>
            <div className="flex flex-wrap gap-2">
              {tierSkus.map((sku: V2VendorSku) => (
                <label key={sku.sku_code} className="text-sm">
                  <input type="checkbox" name="service_keys" value={sku.sku_code} />{' '}
                  {sku.title} <span className="text-ink/50">₱{formatPeso(sku.price_php)}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink/50">
              Prices come from the live vendor catalogue, never from code. Only <strong>tier</strong>{' '}
              plans can be given away: a vendor add-on can never be ₱0 (the catalogue CHECKs
              <code className="font-mono text-[11px]"> price_php &gt; 0</code>) and each add-on has its
              own gate, so freeing one is not a thing this deal can do. The highest tier you tick
              is the one vendors get; the rest are kept on the record so the deal shows what it
              waived.
            </p>
          </div>

          <div>
            <label htmlFor="deal_reason" className="block text-xs font-medium text-ink/70 mb-1">
              Reason <span className="text-ink/50">(logged, min. 10 characters)</span>
            </label>
            <input
              type="text"
              id="deal_reason"
              name="reason"
              placeholder="Founding-shop intake incentive, approved by ops"
              className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Creating…">
              Create deal
            </SubmitButton>
            <label className="text-xs text-ink/60">
              <input type="checkbox" name="show_banner" /> Show a banner to vendors
            </label>
          </div>
        </form>
      </section>

      {/* ══════════════════ COUPLE FREE WINDOWS (G5) ══════════════════
          Owner ask 2026-09-05, verbatim: "for an event for a specific date"
          (a) and "for any event" (c) — (b), a NAMED event, already ships via
          comp_grants.event_id (PR #5193). A live row here makes its covered
          services free for every couple (a), or every couple whose event
          falls in the row's event_date_from/to range (c when both are blank).
          Own ConsoleTable, not merged into the vendor list above — a couple
          window has no vendor/tier, and the vendor table's columns
          (Vendor/Tier/Ends/Manage) don't fit it. */}
      <section className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          Couple free windows
        </h2>

        {dealsFlagOn ? (
          <p className="mb-4 flex items-start gap-2 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-900">
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} />
            <span>
              Couple windows are <strong>live</strong>. A window below frees its services for
              every couple it covers, for as long as it runs.
            </span>
          </p>
        ) : (
          <p className="mb-4 flex items-start gap-2 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-900">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} />
            <span>
              Couple windows are <strong>switched off</strong> —{' '}
              <code className="font-mono text-[11px]">PROMO_FREE_WINDOWS_ENABLED</code> is not set
              in Vercel. Anything listed below or created here is recorded and dated, and frees{' '}
              <strong>nothing</strong> until the owner flips it.
            </span>
          </p>
        )}

        {sp.created === 'window' && (
          <p className="mb-4 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-900">
            ✓ Free window created.
          </p>
        )}
        {sp.createError && (
          <p className="mb-4 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-900">
            {FREE_WINDOW_CREATE_ERROR_COPY[sp.createError] ?? 'Could not create the free window.'}
          </p>
        )}

        <ConsoleTable<CoupleFreeWindowRow>
          rows={coupleWindows}
          readError={coupleWindowsReadError}
          readPermitted
          reads="the couple free windows"
          label="Couple free windows"
          cap={200}
          minWidth="36rem"
          rowKey={(w) => w.promo_window_id}
          empty={{
            Icon: Gift,
            title: 'No couple free window is open right now',
            blurb: 'Create one below — for any event, or restricted to a date range.',
          }}
          columns={[
            {
              header: 'Title',
              cell: (w) => (
                <span>
                  {w.title}
                  {w.blurb ? <span className="block text-xs text-ink/55">{w.blurb}</span> : null}
                </span>
              ),
            },
            {
              header: 'Event dates',
              cell: (w) => eventDateRangeLabel(w) ?? 'Any event',
            },
            {
              header: 'Services',
              cell: (w) => (
                <span className="flex flex-wrap gap-1">
                  {w.covered_service_keys.map((code) => (
                    <span
                      key={code}
                      className="inline-flex rounded-md bg-ink/[0.04] px-1.5 py-0.5 text-[11px] text-ink/70"
                    >
                      {coupleTitleFor.get(code) ?? code}
                    </span>
                  ))}
                </span>
              ),
            },
            { header: 'Ends', mono: true, cell: (w) => fmtDay(w.ends_at) },
            {
              header: 'Manage',
              align: 'right',
              cell: (w) => (
                <form action={setFreeWindowActive} className="inline-flex items-center gap-2">
                  <input type="hidden" name="return_to" value="/admin/gifts" />
                  <input type="hidden" name="promo_window_id" value={w.promo_window_id} />
                  <input type="hidden" name="is_active" value="false" />
                  <SubmitButton
                    className="text-xs font-medium text-mulberry hover:underline"
                    overlay={false}
                    pendingLabel="…"
                  >
                    End window
                  </SubmitButton>
                </form>
              ),
            },
          ]}
        />

        <form
          action={createFreeWindow}
          className="mt-4 rounded-md border border-ink/10 bg-paper p-4 space-y-4"
        >
          <input type="hidden" name="return_to" value="/admin/gifts" />
          <input type="hidden" name="audience_type" value="all_couples" />

          <div className="flex flex-wrap gap-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="couple_title" className="block text-xs font-medium text-ink/70 mb-1">
                Title
              </label>
              <input
                type="text"
                id="couple_title"
                name="title"
                required
                maxLength={120}
                placeholder="Free Papic for December weddings"
                className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <label htmlFor="couple_blurb" className="block text-xs font-medium text-ink/70 mb-1">
                Banner blurb <span className="text-ink/50">(optional)</span>
              </label>
              <input
                type="text"
                id="couple_blurb"
                name="blurb"
                maxLength={240}
                placeholder="Every Papic camera is on us this weekend."
                className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="couple_starts" className="block text-xs font-medium text-ink/70 mb-1">
                Starts <span className="text-ink/50">(PH time)</span>
              </label>
              <input
                type="datetime-local"
                id="couple_starts"
                name="starts_at"
                required
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="couple_ends" className="block text-xs font-medium text-ink/70 mb-1">
                Ends <span className="text-ink/50">(PH time)</span>
              </label>
              <input
                type="datetime-local"
                id="couple_ends"
                name="ends_at"
                required
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="couple_event_from" className="block text-xs font-medium text-ink/70 mb-1">
                Only for events dated <span className="text-ink/50">(optional)</span>
              </label>
              <input
                type="date"
                id="couple_event_from"
                name="event_date_from"
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="couple_event_to" className="block text-xs font-medium text-ink/70 mb-1">
                through <span className="text-ink/50">(optional)</span>
              </label>
              <input
                type="date"
                id="couple_event_to"
                name="event_date_to"
                className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-ink/50">
            Leave both blank to free these services for <strong>any event</strong>. Set one or
            both to restrict the freebie to couples whose event date falls in that range
            (inclusive) — use the same date in both fields for one specific date. An event with
            no locked date yet does not qualify for a date-restricted window.
          </p>

          <div>
            <span className="mb-1 block text-xs font-medium text-ink/70">Services to make free</span>
            <div className="flex flex-wrap gap-2">
              {customerCatalog.map((s: V2CustomerSku) => (
                <label key={s.service_code} className="text-sm">
                  <input type="checkbox" name="service_keys" value={s.service_code} />{' '}
                  {s.title} <span className="text-ink/50">₱{formatPeso(s.retail_price_php)}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="couple_reason" className="block text-xs font-medium text-ink/70 mb-1">
              Reason <span className="text-ink/50">(logged, min. 10 characters)</span>
            </label>
            <input
              type="text"
              id="couple_reason"
              name="reason"
              required
              minLength={10}
              placeholder="Launch promo, approved by ops"
              className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Creating…">
              Create free window
            </SubmitButton>
            <label className="text-xs text-ink/60">
              <input type="checkbox" name="show_banner" defaultChecked /> Show a banner to couples
            </label>
          </div>
        </form>
      </section>

      {/* ══════════════════ USER SIDE ══════════════════ */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-ink/60">
          User &amp; event comps
        </h2>

        <form className="mb-4 flex gap-2" action="/admin/gifts">
          <input
            type="text"
            name="user_q"
            defaultValue={userQuery}
            placeholder="Search users by name or email…"
            className="flex-1 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
          />
          <SubmitButton className="button-secondary h-10 px-4 text-sm" overlay={false}>
            Search
          </SubmitButton>
        </form>

        {userResults.length > 0 && !grantUser && (
          <ul className="mb-4 divide-y divide-ink/10 rounded-md border border-ink/10">
            {userResults.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{u.display_name ?? u.email ?? u.user_id}</span>
                <Link
                  href={`/admin/gifts?grant_user=${u.user_id}`}
                  className="text-xs font-medium text-link hover:underline"
                >
                  Comp this user
                </Link>
              </li>
            ))}
          </ul>
        )}
        {userQuery.length >= 2 && userResults.length === 0 && !grantUser && (
          <p className="mb-4 text-xs text-ink/50">No user matches &ldquo;{userQuery}&rdquo;.</p>
        )}

        {grantUser && (
          <div className="mb-4 rounded-md border border-ink/10 bg-paper p-4">
            <p className="mb-3 text-sm">
              Comping <strong>{grantUser.display_name ?? grantUser.email ?? grantUser.user_id}</strong>.{' '}
              <Link href="/admin/gifts" className="text-link hover:underline">
                Cancel
              </Link>
            </p>
            <form action={issueCompGrant} className="space-y-3">
              <input type="hidden" name="user_id" value={grantUser.user_id} />
              <input type="hidden" name="return_to" value="/admin/gifts" />
              <div>
                <label htmlFor="event_id" className="block text-xs font-medium text-ink/70 mb-1">
                  Applies to
                </label>
                {grantUserEvents.length === 0 ? (
                  <p className="text-xs text-ink/50">
                    This account hosts no events yet — the comp will apply account-wide, to whichever
                    event they create next.
                  </p>
                ) : (
                  <select
                    id="event_id"
                    name="event_id"
                    defaultValue=""
                    className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  >
                    <option value="">Every event this account hosts</option>
                    {grantUserEvents.map((e) => (
                      <option key={e.event_id} value={e.event_id}>
                        {e.display_name} ({e.event_type}
                        {e.event_date
                          ? `, ${new Date(e.event_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}`
                          : ''}
                        )
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-ink/70">Scope</span>
                <label className="mr-4 text-sm">
                  <input type="radio" name="scope" value="all_services" defaultChecked /> All services
                </label>
                <label className="text-sm">
                  <input type="radio" name="scope" value="specific_skus" /> Specific services (comma-separated SKUs below)
                </label>
              </div>
              <div>
                <label htmlFor="scoped_skus" className="block text-xs font-medium text-ink/70 mb-1">
                  SKUs <span className="text-ink/50">(only used when scope is specific services)</span>
                </label>
                <input
                  type="text"
                  id="scoped_skus"
                  name="scoped_skus"
                  placeholder="e.g. PAPIC_ONE_50, SEATING_3D"
                  className="w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label htmlFor="expiry_at" className="block text-xs font-medium text-ink/70 mb-1">
                    Expires <span className="text-ink/50">(optional, blank = lifetime)</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="expiry_at"
                    name="expiry_at"
                    className="rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="retail_value_php" className="block text-xs font-medium text-ink/70 mb-1">
                    Retail value, ₱ <span className="text-ink/50">(optional)</span>
                  </label>
                  <input
                    type="number"
                    id="retail_value_php"
                    name="retail_value_php"
                    min={0}
                    className="w-32 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="rationale" className="block text-xs font-medium text-ink/70 mb-1">
                  Rationale <span className="text-ink/50">(logged, min. 20 characters)</span>
                </label>
                <textarea
                  id="rationale"
                  name="rationale"
                  rows={2}
                  placeholder="Why this account, why this scope, who approved it."
                  className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm"
                />
              </div>
              <SubmitButton className="button-secondary h-10 px-4 text-sm" pendingLabel="Saving…">
                Issue comp
              </SubmitButton>
            </form>
          </div>
        )}

        <ConsoleTable<CompGrantRow>
          rows={activeGrants}
          readError={grantsReadError}
          readPermitted
          reads="the active comp grants"
          label="Active comp grants"
          cap={200}
          rowKey={(g) => g.grant_id}
          empty={{
            Icon: Ticket,
            title: 'No user is comped right now',
            blurb: 'Search a user above to issue a comp — account-wide, or scoped to one of their events.',
          }}
          columns={[
            {
              header: 'User',
              cell: (g) => {
                // A vendor SKU comp (issueVendorSkuComp) has no user_id at
                // all — show the targeted vendor's name instead of '—', which
                // would otherwise read as a grant nobody can identify.
                if (!g.user_id && g.vendor_profile_id) {
                  return `${g.vendor_business_name ?? g.vendor_profile_id} (vendor)`;
                }
                const u = g.user_id ? userById.get(g.user_id) : null;
                return u?.display_name ?? u?.email ?? g.user_id ?? '—';
              },
            },
            { header: 'Applies to', cell: (g) => describeReach(g) },
            { header: 'Covers', cell: (g) => describeScope(g.scope, g.scoped_skus) },
            {
              header: 'Value',
              mono: true,
              align: 'right',
              hideBelow: 'md',
              cell: (g) => formatRetailValueCentavos(g.retail_value_centavos),
            },
            {
              header: 'Ends',
              mono: true,
              cell: (g) =>
                g.expiry
                  ? new Date(g.expiry).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Lifetime',
            },
            { header: 'Source', hideBelow: 'lg', cell: (g) => describeSource(g.source) },
            {
              header: 'Revoke',
              align: 'right',
              // A row that settles on one click renders its own form in its own
              // cell — the archetype offers no actions API, on purpose.
              cell: (g) => (
                <form action={revokeCompGrant} className="inline-flex items-center gap-1">
                  <input type="hidden" name="grant_id" value={g.grant_id} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="Revoke reason…"
                    required
                    minLength={10}
                    className="w-32 rounded-md border border-ink/15 bg-paper px-2 py-1 text-xs"
                  />
                  <SubmitButton
                    className="text-xs font-medium text-mulberry hover:underline"
                    overlay={false}
                    pendingLabel="…"
                  >
                    Revoke
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
