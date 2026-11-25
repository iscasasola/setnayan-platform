import Link from 'next/link';
import { readEventTypeNames, type EventTypeName } from '@/lib/admin/event-type-names.server';
import { AlertTriangle, CheckCircle2, Gift, Store, Ticket } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { ActionButton } from '@/components/action-button';
import { actionButtonClass } from '@/components/action-button-class';
import { InfoTip } from '@/app/_components/info-tip';
import { FormRow, FormRows } from '@/app/_components/form-row';
import {
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { ReadFailed } from '@/app/admin/_components/read-failed';
import { PostedPickRow, PostedTypedRow } from './_components/posted-rows';
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
import { fetchShopGiftHolds, fetchShopGiftLedger, fetchShopGiftPacks } from '@/lib/shop-gifts.server';
import { fetchBadgeRewardLedger, readRewardNames } from '@/lib/badge-rewards.server';
import { BadgeRewardsLedger } from './_components/badge-rewards-ledger';
import { BadgeUpgradesLedger } from './_components/badge-upgrades-ledger';
import { fetchBadgeUpgradeLedger } from '@/lib/badge-upgrades.server';
import { ShopGiftsLedger } from './_components/shop-gifts-ledger';
import { GiftLimitForm } from './_components/gift-limit-form';
import { SetnayanGiftPicks } from './_components/setnayan-gift-picks';
import { saveGiftLimitPct } from './gift-limit-actions';
import { getGiftLimitPct } from '@/lib/gift-limit-settings.server';
import { readShopGiftsForAdmin } from '@/lib/setnayan-shop-gift.server';
import { SHOP_GIFT_MAX_UNITS, SHOP_GIFT_PLAN_TIERS, adminGiftLine } from '@/lib/setnayan-shop-gift';

/**
 * One row of the vendor list — a single comped vendor, or one cohort DEAL
 * (a `promo_free_windows` row with a vendor audience) sitting beside it.
 */
type VendorGiftRow =
  | ({ kind: 'vendor' } & CompedVendorRow)
  | ({ kind: 'window' } & VendorDealRow);

/** The "Applies to" dropdown's every-event choice — posts an EMPTY `event_id`, as the select's `<option value="">` did. */
const EVERY_EVENT = '__every_event__';

const DEAL_WHO: Record<VendorDealRow['audience_type'], string> = {
  all_vendors: 'All verified suppliers',
  new_verified_vendors: 'Suppliers who register + get verified in the window',
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });

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
    /** 🎁 The panel's "Send a Setnayan gift" answer: 'sent', or the refusal's words. */
    shop_gift?: string;
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
  // 🏷 F-A-15: event types by their admin-managed names.
  const typeName = await readEventTypeNames();
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
  // ── Supplier gifts (owner 2026-11-04) — every bought / given / reversed credit, and what live quotes promise ──
  // ── Badge rewards (owner 2026-11-05) — what each badge gave, and every free booking fee with its history ──
  // ── Badge upgrades (owner, 6 Nov) — every 4-week personal upgrade a badge gave, and whether it has started ──
  const [shopGiftLedger, shopGiftHolds, badgeRewards, badgeRewardNames, badgeUpgrades, giftLimitPct] = await Promise.all([
    fetchShopGiftLedger(admin),
    fetchShopGiftHolds(admin),
    fetchBadgeRewardLedger(admin),
    readRewardNames(admin),
    fetchBadgeUpgradeLedger(admin),
    getGiftLimitPct(admin),
  ]);
  const badgeUpgradesError = badgeUpgrades ? null : { message: 'the badge upgrades read was refused' };
  const badgeRewardsError = badgeRewards ? null : { message: 'the badge rewards read was refused' };
  const shopGiftLedgerError = shopGiftLedger ? null : { message: 'the supplier gift ledger read was refused' };
  const shopGiftHoldsError = shopGiftHolds ? null : { message: 'the quote gift lines read was refused' };

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
  // A8·F-23 / A-24: a refused search is not "no match" — keep the two apart.
  let vendorSearchFailed = false;
  if (vendorQuery.length >= 2) {
    const { data, error: vendorSearchErr } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, public_id, business_name')
      .ilike('business_name', `%${vendorQuery}%`)
      .order('business_name', { ascending: true })
      .limit(8);
    if (vendorSearchErr) {
      vendorSearchFailed = true;
      logQueryError('admin/gifts.vendorSearch', vendorSearchErr);
    }
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
  // 🎁 What Setnayan can send this shop (the live gift catalogue) and what it was already sent.
  const [giftPacks, sentShopGifts] = grantVendor
    ? await Promise.all([fetchShopGiftPacks(admin), readShopGiftsForAdmin(admin, grantVendor.vendor_profile_id)])
    : [null, null];

  // ── User search + selection ────────────────────────────────────────────
  const userQuery = sp.user_q?.trim() ?? '';
  let userResults: { user_id: string; email: string | null; display_name: string | null }[] = [];
  let userSearchFailed = false;
  if (userQuery.length >= 2) {
    const { data, error: userSearchErr } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .or(`email.ilike.%${userQuery}%,display_name.ilike.%${userQuery}%`)
      .limit(8);
    if (userSearchErr) {
      userSearchFailed = true;
      logQueryError('admin/gifts.userSearch', userSearchErr);
    }
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

  // 📐 ADMIN CLEAN PORT (owner "ok", 19 Nov 2026 — reposition only). The pinned row ("Offers & gifts · Gifts & comps ▾")
  // names the page, so the visible title and the lede went (the lede is the first section's ⓘ). Section labels are
  // the template's; every explaining paragraph sits behind an ⓘ; each grant form is Form rows in ONE frame; the two
  // selects and the radio sets are dropdowns that post the same names and values; the search results are rows with
  // ONE action. The four comp tables stay `ConsoleTable` (the admin archetype). Same reads, same server actions.
  const FIELD = 'input-field w-[200px] max-w-full flex-none rounded-full';
  const FRAME = `${ADMIN_FRAME} px-4 py-2`;
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      <PageMasthead titleNode="Gifts" />

      {sp.banner && (
        <div className="mb-3 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ {sp.banner}
        </div>
      )}
      {sp.created && (
        <div className="mb-3 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Deal created.
        </div>
      )}
      {sp.saved && (
        <div className="mb-3 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Deal updated.
        </div>
      )}
      {sp.createError && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {FREE_WINDOW_CREATE_ERROR_COPY[sp.createError] ?? 'Could not create the deal.'}
        </div>
      )}
      {sp.error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Something went wrong. Please try again.
        </div>
      )}

      {/* ══════════════════ VENDOR SIDE ══════════════════ */}
      <TemplateSection
        label="Supplier tier comps"
        first
        data="supplier-tier-comps"
        tip={
          <>
            Every supplier tier comp, supplier cohort deal and user/event comp currently active, in one
            place. Grants a single named supplier or user account, or opens a deal for all verified
            suppliers or for every supplier who registers and gets verified inside a window.
          </>
        }
      >
        <form className="mb-2.5 flex gap-2" action="/admin/gifts">
          <input
            type="search"
            name="vendor_q"
            defaultValue={vendorQuery}
            placeholder="Search suppliers by business name…"
            className="input-field min-w-0 flex-1 rounded-full"
          />
          <SubmitButton className={actionButtonClass('neutral')} overlay={false}>
            Search
          </SubmitButton>
        </form>

        {vendorResults.length > 0 && !grantVendor && (
          <div className="mb-2.5">
            <TemplateRows label="Matching suppliers">
              {vendorResults.map((v) => (
                <TemplateRow
                  key={v.vendor_profile_id}
                  data={v.vendor_profile_id}
                  title={v.business_name}
                  line={v.public_id}
                  right={<ActionButton tone="brand" href={`/admin/gifts?grant_vendor=${v.vendor_profile_id}`} label="Comp this supplier" icon={<Store aria-hidden strokeWidth={1.9} />} />}
                />
              ))}
            </TemplateRows>
          </div>
        )}
        {vendorSearchFailed && !grantVendor && <ReadFailed what="the supplier search" />}
        {!vendorSearchFailed && vendorQuery.length >= 2 && vendorResults.length === 0 && !grantVendor && (
          <TemplateEmpty data="supplier-search">No suppliers match &ldquo;{vendorQuery}&rdquo;.</TemplateEmpty>
        )}

        {grantVendor && (
          <div className={`${FRAME} mb-2.5`}>
            <p className="py-2 text-sm">
              Comping <strong>{grantVendor.business_name}</strong> — current tier:{' '}
              <span className="font-medium">{TIER_LABEL[asVendorTier(grantVendor.tier_state)]}</span>.{' '}
              <Link href="/admin/gifts" className="text-link hover:underline">
                Cancel
              </Link>
            </p>
            <form action={setVendorTier}>
              <input type="hidden" name="vendor_id" value={grantVendor.vendor_profile_id} />
              <input type="hidden" name="return_to" value="/admin/gifts" />
              <FormRows width="wide">
                <PostedPickRow
                  name="Tier"
                  fieldName="tier_state"
                  initial={asVendorTier(grantVendor.tier_state)}
                  options={VENDOR_TIER_SETTABLE.map((t) => ({ key: t, label: TIER_LABEL[t] }))}
                  data="tier_state"
                />
                <FormRow name="Ends (optional)">
                  <input type="date" id="tier_expires_at" aria-label="Ends (optional)" name="tier_expires_at" className={FIELD} />
                </FormRow>
                <PostedTypedRow
                  name="Reason (logged, min. 10 characters)"
                  fieldName="reason"
                  placeholder="e.g. Founding cohort — verified before Oct 15"
                  data="tier-reason"
                />
              </FormRows>
              <div className="flex justify-end pb-2 pt-1">
                <SubmitButton className={actionButtonClass('brand', { main: true })} pendingLabel="Saving…">
                  Set tier
                </SubmitButton>
              </div>
            </form>

            {/* SKU-level, not the whole tier — comps ONE add-on
                (comp_grants.vendor_profile_id, source='external_promo', never
                'vendor_self_comp' — see issueVendorSkuComp's docblock for the
                self-comp-quota trigger this deliberately never trips). */}
            <form action={issueVendorSkuComp} className="border-t border-ink/10 pt-2">
              <input type="hidden" name="vendor_id" value={grantVendor.vendor_profile_id} />
              <input type="hidden" name="sku" value={VENDOR_PHOTO_CHALLENGE_SKU_CODE} />
              <input type="hidden" name="return_to" value="/admin/gifts" />
              <p className={`py-1 ${TEMPLATE_SUBLINE}`}>
                Or comp Papic Challenges only ({VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS} days,
                stacking) — no tier change.
              </p>
              <FormRows width="wide">
                <PostedTypedRow
                  name="Reason"
                  fieldName="reason"
                  placeholder="Reason (logged, min. 10 characters)"
                  data="papic-comp-reason"
                />
              </FormRows>
              <div className="flex justify-end pb-2 pt-1">
                <SubmitButton className={actionButtonClass('brand')} pendingLabel="Saving…">
                  Comp Papic Challenges
                </SubmitButton>
              </div>
            </form>

            {/* 🎁 SEND A SETNAYAN GIFT (owner 14 Nov 2026) — gift stock to give couples (outside the 40% limit, like a
                badge reward), or 28 days of Plus / Pro / Ultra the shop chooses when to start. Nothing is
                granted here: the shop opens it on Today, and its press is the claim (exactly once). */}
            <form
              id="setnayan-shop-gift"
              action={setVendorTier}
              className="mt-4 space-y-3 border-t border-ink/10 pt-4"
              data-admin-setnayan-shop-gift=""
            >
              <input type="hidden" name="op" value="setnayan_gift" />
              <input type="hidden" name="vendor_id" value={grantVendor.vendor_profile_id} />
              <p className="text-xs font-medium text-ink/70">
                Or send a gift from Setnayan — the shop taps it open on Today.
              </p>
              {sp.shop_gift ? (
                <p role="status" className={`text-sm ${sp.shop_gift === 'sent' ? 'text-success-700' : 'text-danger-700'}`}>
                  {sp.shop_gift === 'sent' ? 'Sent. It waits on the shop’s Today until they open it.' : sp.shop_gift}
                </p>
              ) : null}
              <SetnayanGiftPicks
                maxUnits={SHOP_GIFT_MAX_UNITS}
                gifts={[
                  ...(giftPacks ?? []).map((p) => ({ key: `stock:${p.code}`, label: `${p.title} · gift stock` })),
                  ...SHOP_GIFT_PLAN_TIERS.map((t) => ({ key: `plan:${t}`, label: `28 days of ${TIER_LABEL[t]}` })),
                ]}
              />
              {giftPacks === null ? (
                <p className="text-xs text-danger-700">The gift catalogue couldn’t be read — only plan time can be sent now.</p>
              ) : null}
              <SubmitButton className="button-secondary h-11 px-4 text-sm" pendingLabel="Sending…">
                Send the gift
              </SubmitButton>
              {sentShopGifts === null ? (
                <p className="text-xs text-danger-700">This shop’s Setnayan gifts couldn’t be read.</p>
              ) : sentShopGifts.length > 0 ? (
                <ul className="divide-y divide-ink/10 rounded-md border border-ink/10 text-sm">
                  {sentShopGifts.map((g) => (
                    <li key={g.gift_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span>
                        {adminGiftLine({
                          type: g.gift_type,
                          stockLine: g.stockLine ?? undefined,
                          planTier: g.plan_tier,
                          planDays: g.plan_days,
                        })}{' '}
                        <span className="text-xs text-ink/50">· sent {fmtDay(g.sent_at)}</span>
                      </span>
                      <span className="text-xs text-ink/70">
                        {!g.claimed_at
                          ? 'Waiting to be opened'
                          : g.finished_at
                            ? `Ended · ${g.finish_reason ?? 'done'}`
                            : g.claim_choice === 'after' && !g.plan_starts_at
                              ? 'Starts when their plan ends'
                              : g.plan_ends_at
                                ? `Opened · runs to ${fmtDay(g.plan_ends_at)}`
                                : 'Opened'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </form>
          </div>
        )}

        <ConsoleTable<VendorGiftRow>
          rows={vendorRows}
          readError={vendorRowsReadError}
          readPermitted
          reads="the comped suppliers and supplier deals"
          label="Comped suppliers and deals"
          cap={200}
          minWidth="36rem"
          rowKey={(r) => (r.kind === 'window' ? `window:${r.promo_window_id}` : `vendor:${r.vendor_profile_id}`)}
          empty={{
            Icon: Store,
            title: 'No supplier is comped onto a paid tier, and no deal is open',
            blurb: 'Search a supplier above to set a tier, or open a deal below for a cohort.',
          }}
          columns={[
            {
              header: 'Supplier',
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
        <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
          Every non-free tier here is a comp — self-serve supplier billing doesn&rsquo;t exist yet.
        </p>
      </TemplateSection>

      {/* ══════════════════ VENDOR COHORT DEALS ══════════════════
          🚨 THIS FORM DID NOT EXIST until 2026-09-06, and everything behind it
          did. `createFreeWindow` already accepted `service_keys` picked from
          the live vendor catalogue, `new_verified_vendors` was a valid
          audience, `deal_length_days` was a column, and BOTH surfaces' copy
          pointed here — the Catalog Studio tab says in so many words "use the
          Deals section on Gifts". There was nothing to use. A post-merge audit
          found it: two of the feature's three shapes were uncreatable from any
          UI. This renders the writer that was already wired. */}
      <TemplateSection label="Supplier cohort deals" data="supplier-cohort-deals">
        {/* 🔑 THE KILL-SWITCH, SAID OUT LOUD. `dealsFlagOn` was computed on this
            page and never rendered, so a deal listed above as "currently
            active" was indistinguishable from one that grants nothing —
            `getPromotedVendorTierFor` returns null before any read while the
            flag is off. The state is the line; the full sentence is its ⓘ. */}
        {dealsFlagOn ? (
          <div className="flex min-h-11 items-center gap-2 py-1" style={{ color: 'rgb(var(--color-success))' }} data-deals-flag="on">
            <CheckCircle2 aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
            <InfoTip label="Supplier deals are live" labelClassName="text-[14px] font-semibold" align="start">
              Supplier deals are <strong>live</strong>. A deal below promotes every supplier it
              covers for as long as it runs.
            </InfoTip>
          </div>
        ) : (
          <div className="flex min-h-11 items-center gap-2 py-1" style={{ color: 'rgb(var(--color-warn))' }} data-deals-flag="off">
            <AlertTriangle aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
            <InfoTip label="Supplier deals are switched off" labelClassName="text-[14px] font-semibold" align="start">
              Supplier deals are <strong>switched off</strong> — <code className="font-mono text-[11px]">PROMO_FREE_WINDOWS_ENABLED</code>{' '}
              is not set in Vercel. Anything listed above or created below is recorded and
              dated, and promotes <strong>nobody</strong> until the owner flips it. Deals are
              not retroactive: a supplier who qualifies while it is off gets nothing for that time.
            </InfoTip>
          </div>
        )}

        {sp.created === 'window' && (
          <p className="mb-2.5 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-900">
            ✓ Deal created.
          </p>
        )}
        {sp.createError && (
          <p className="mb-2.5 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-900">
            {FREE_WINDOW_CREATE_ERROR_COPY[sp.createError] ?? 'Could not create the deal.'}
          </p>
        )}

        <form action={createFreeWindow} className={FRAME}>
          <input type="hidden" name="return_to" value="/admin/gifts" />
          <FormRows width="wide">
            <PostedPickRow
              name="Who qualifies"
              fieldName="audience_type"
              initial="all_vendors"
              options={[
                { key: 'all_vendors', label: 'Every verified supplier' },
                { key: 'new_verified_vendors', label: 'Suppliers who register and get verified inside the window' },
              ]}
              about={{
                words: (
                  <>
                    Both mean <strong>verified</strong> suppliers only — a pending or unverified shop
                    never qualifies.
                  </>
                ),
              }}
              data="deal-audience"
            />
            <PostedTypedRow
              name="Title"
              fieldName="title"
              required
              maxLength={120}
              placeholder="Founding shops — free Pro for the September intake"
              data="deal-title"
            />
            <PostedTypedRow
              name="Banner blurb (optional)"
              fieldName="blurb"
              maxLength={240}
              placeholder="Pro is on us while you set up your shop."
              data="deal-blurb"
            />
            <FormRow name="Window opens">
              <input type="datetime-local" id="deal_starts" aria-label="Window opens" name="starts_at" required className={FIELD} />
            </FormRow>
            <FormRow name="Window closes">
              <input type="datetime-local" id="deal_ends" aria-label="Window closes" name="ends_at" required className={FIELD} />
            </FormRow>
            <FormRow
              name="Each supplier keeps it (days, optional)"
              about={{
                words: (
                  <>
                    The window decides <strong>who gets in</strong>; this decides{' '}
                    <strong>how long each of them keeps it</strong>, counted from the moment they
                    qualify. Leave it blank and the deal simply runs until the window closes.
                  </>
                ),
              }}
            >
              <input
                type="number"
                id="deal_length"
                aria-label="Each supplier keeps it (days, optional)"
                name="deal_length_days"
                min={1}
                max={365}
                placeholder="28"
                className="input-field w-[120px] flex-none rounded-full"
              />
            </FormRow>
            <FormRow
              name="What’s free"
              about={{
                words: (
                  <>
                    Prices come from the live supplier catalogue, never from code. Only <strong>tier</strong>{' '}
                    plans can be given away: a supplier add-on can never be ₱0 (the catalogue CHECKs
                    <code className="font-mono text-[11px]"> price_php &gt; 0</code>) and each add-on has its
                    own gate, so freeing one is not a thing this deal can do. The highest tier you tick
                    is the one suppliers get; the rest are kept on the record so the deal shows what it
                    waived.
                  </>
                ),
              }}
              below={
                <div className="flex flex-wrap gap-x-4 gap-y-2 pb-3">
                  {tierSkus.map((sku: V2VendorSku) => (
                    <label key={sku.sku_code} className="text-sm">
                      <input type="checkbox" name="service_keys" value={sku.sku_code} />{' '}
                      {sku.title} <span className="text-ink/50">₱{formatPeso(sku.price_php)}</span>
                    </label>
                  ))}
                </div>
              }
            />
            <PostedTypedRow
              name="Reason (logged, min. 10 characters)"
              fieldName="reason"
              placeholder="Founding-shop intake incentive, approved by ops"
              data="deal-reason"
            />
          </FormRows>

          <div className="flex flex-wrap items-center justify-end gap-3 pb-2 pt-1">
            <label className="text-xs text-ink/60">
              <input type="checkbox" name="show_banner" /> Show a banner to suppliers
            </label>
            <SubmitButton className={actionButtonClass('brand', { main: true })} pendingLabel="Creating…">
              Create deal
            </SubmitButton>
          </div>
        </form>
      </TemplateSection>

      {/* ══════════════════ COUPLE FREE WINDOWS (G5) ══════════════════
          Owner ask 2026-09-05, verbatim: "for an event for a specific date"
          (a) and "for any event" (c) — (b), a NAMED event, already ships via
          comp_grants.event_id (PR #5193). A live row here makes its covered
          services free for every couple (a), or every couple whose event
          falls in the row's event_date_from/to range (c when both are blank).
          Own ConsoleTable, not merged into the vendor list above — a couple
          window has no vendor/tier, and the vendor table's columns
          (Vendor/Tier/Ends/Manage) don't fit it. */}
      <TemplateSection label="Couple free windows" data="couple-free-windows">
        {dealsFlagOn ? (
          <div className="flex min-h-11 items-center gap-2 py-1" style={{ color: 'rgb(var(--color-success))' }} data-couple-flag="on">
            <CheckCircle2 aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
            <InfoTip label="Couple windows are live" labelClassName="text-[14px] font-semibold" align="start">
              Couple windows are <strong>live</strong>. A window below frees its services for
              every couple it covers, for as long as it runs.
            </InfoTip>
          </div>
        ) : (
          <div className="flex min-h-11 items-center gap-2 py-1" style={{ color: 'rgb(var(--color-warn))' }} data-couple-flag="off">
            <AlertTriangle aria-hidden className="h-4 w-4 flex-none" strokeWidth={2} />
            <InfoTip label="Couple windows are switched off" labelClassName="text-[14px] font-semibold" align="start">
              Couple windows are <strong>switched off</strong> —{' '}
              <code className="font-mono text-[11px]">PROMO_FREE_WINDOWS_ENABLED</code> is not set
              in Vercel. Anything listed below or created here is recorded and dated, and frees{' '}
              <strong>nothing</strong> until the owner flips it.
            </InfoTip>
          </div>
        )}

        {sp.created === 'window' && (
          <p className="mb-2.5 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-900">
            ✓ Free window created.
          </p>
        )}
        {sp.createError && (
          <p className="mb-2.5 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-900">
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

        <form action={createFreeWindow} className={`${FRAME} mt-2.5`}>
          <input type="hidden" name="return_to" value="/admin/gifts" />
          <input type="hidden" name="audience_type" value="all_couples" />
          <FormRows width="wide">
            <PostedTypedRow
              name="Title"
              fieldName="title"
              required
              maxLength={120}
              placeholder="Free Papic for December weddings"
              data="couple-title"
            />
            <PostedTypedRow
              name="Banner blurb (optional)"
              fieldName="blurb"
              maxLength={240}
              placeholder="Every Papic camera is on us this weekend."
              data="couple-blurb"
            />
            <FormRow name="Starts (PH time)">
              <input type="datetime-local" id="couple_starts" aria-label="Starts (PH time)" name="starts_at" required className={FIELD} />
            </FormRow>
            <FormRow name="Ends (PH time)">
              <input type="datetime-local" id="couple_ends" aria-label="Ends (PH time)" name="ends_at" required className={FIELD} />
            </FormRow>
            <FormRow
              name="Only for events dated (optional)"
              about={{
                words: (
                  <>
                    Leave both blank to free these services for <strong>any event</strong>. Set one or
                    both to restrict the freebie to couples whose event date falls in that range
                    (inclusive) — use the same date in both fields for one specific date. An event with
                    no locked date yet does not qualify for a date-restricted window.
                  </>
                ),
              }}
            >
              <input type="date" id="couple_event_from" aria-label="Only for events dated (optional)" name="event_date_from" className={FIELD} />
            </FormRow>
            <FormRow name="through (optional)">
              <input type="date" id="couple_event_to" aria-label="through (optional)" name="event_date_to" className={FIELD} />
            </FormRow>
            <FormRow
              name="Services to make free"
              below={
                <div className="flex flex-wrap gap-x-4 gap-y-2 pb-3">
                  {customerCatalog.map((s: V2CustomerSku) => (
                    <label key={s.service_code} className="text-sm">
                      <input type="checkbox" name="service_keys" value={s.service_code} />{' '}
                      {s.title} <span className="text-ink/50">₱{formatPeso(s.retail_price_php)}</span>
                    </label>
                  ))}
                </div>
              }
            />
            <PostedTypedRow
              name="Reason (logged, min. 10 characters)"
              fieldName="reason"
              required
              placeholder="Launch promo, approved by ops"
              data="couple-reason"
            />
          </FormRows>

          <div className="flex flex-wrap items-center justify-end gap-3 pb-2 pt-1">
            <label className="text-xs text-ink/60">
              <input type="checkbox" name="show_banner" defaultChecked /> Show a banner to couples
            </label>
            <SubmitButton className={actionButtonClass('brand', { main: true })} pendingLabel="Creating…">
              Create free window
            </SubmitButton>
          </div>
        </form>
      </TemplateSection>

      {/* 🎁 SUPPLIER GIFTS (owner 2026-11-04) — shops buy gifts as stock, put them on quotes, and they leave the stock
          for the couple's event when that couple's first payment clears. Read-only here: the money moves through the
          order (approve / refund on Orders) and the one delivery door. */}
      {/* 🎁 GIFT LIMIT (owner v112, 8 Nov 2026) — one setting for the Setnayan gift and shop gifts. Audited save. */}
      <GiftLimitForm action={saveGiftLimitPct} giftLimitPct={giftLimitPct} />
      <ShopGiftsLedger
        giftLimitPct={giftLimitPct}
        ledger={shopGiftLedger}
        ledgerError={shopGiftLedgerError}
        holds={shopGiftHolds}
        holdsError={shopGiftHoldsError}
      />

      {/* 🏅 BADGE REWARDS (owner 2026-11-05) — every reward a badge gave, and the free booking fees (take back an unused
          one). */}
      <BadgeRewardsLedger rows={badgeRewards} readError={badgeRewardsError} names={badgeRewardNames} />
      <BadgeUpgradesLedger rows={badgeUpgrades} readError={badgeUpgradesError} />

      {/* ══════════════════ USER SIDE ══════════════════ */}
      <TemplateSection label="User & event comps" data="user-event-comps">
        <form className="mb-2.5 flex gap-2" action="/admin/gifts">
          <input
            type="search"
            name="user_q"
            defaultValue={userQuery}
            placeholder="Search users by name or email…"
            className="input-field min-w-0 flex-1 rounded-full"
          />
          <SubmitButton className={actionButtonClass('neutral')} overlay={false}>
            Search
          </SubmitButton>
        </form>

        {userResults.length > 0 && !grantUser && (
          <div className="mb-2.5">
            <TemplateRows label="Matching users">
              {userResults.map((u) => (
                <TemplateRow
                  key={u.user_id}
                  data={u.user_id}
                  title={u.display_name ?? u.email ?? u.user_id}
                  right={<ActionButton tone="brand" href={`/admin/gifts?grant_user=${u.user_id}`} label="Comp this user" icon={<Ticket aria-hidden strokeWidth={1.9} />} />}
                />
              ))}
            </TemplateRows>
          </div>
        )}
        {userSearchFailed && !grantUser && <ReadFailed what="the user search" />}
        {!userSearchFailed && userQuery.length >= 2 && userResults.length === 0 && !grantUser && (
          <TemplateEmpty data="user-search">No user matches &ldquo;{userQuery}&rdquo;.</TemplateEmpty>
        )}

        {grantUser && (
          <div className={`${FRAME} mb-2.5`}>
            <p className="py-2 text-sm">
              Comping <strong>{grantUser.display_name ?? grantUser.email ?? grantUser.user_id}</strong>.{' '}
              <Link href="/admin/gifts" className="text-link hover:underline">
                Cancel
              </Link>
            </p>
            <form action={issueCompGrant}>
              <input type="hidden" name="user_id" value={grantUser.user_id} />
              <input type="hidden" name="return_to" value="/admin/gifts" />
              <FormRows width="wide">
                {grantUserEvents.length === 0 ? (
                  <FormRow
                    name="Applies to"
                    about={{
                      words:
                        'This account hosts no events yet — the comp will apply account-wide, to whichever event they create next.',
                    }}
                  >
                    <span className={TEMPLATE_SUBLINE}>This account hosts no events yet</span>
                  </FormRow>
                ) : (
                  <PostedPickRow
                    name="Applies to"
                    fieldName="event_id"
                    initial={EVERY_EVENT}
                    blankKey={EVERY_EVENT}
                    options={[
                      { key: EVERY_EVENT, label: 'Every event this account hosts' },
                      ...grantUserEvents.map((e) => ({
                        key: e.event_id,
                        label: `${e.display_name} (${typeName(e.event_type)}${
                          e.event_date
                            ? `, ${new Date(e.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })}`
                            : ''
                        })`,
                      })),
                    ]}
                    data="event_id"
                  />
                )}
                <PostedPickRow
                  name="Scope"
                  fieldName="scope"
                  initial="all_services"
                  options={[
                    { key: 'all_services', label: 'All services' },
                    { key: 'specific_skus', label: 'Specific services (comma-separated SKUs below)' },
                  ]}
                  data="scope"
                />
                <PostedTypedRow
                  name="SKUs"
                  fieldName="scoped_skus"
                  about={{ words: '(only used when scope is specific services)' }}
                  placeholder="e.g. PAPIC_ONE_50, SEATING_3D"
                  data="scoped_skus"
                />
                <FormRow name="Expires (optional, blank = lifetime)">
                  <input type="datetime-local" id="expiry_at" aria-label="Expires (optional, blank = lifetime)" name="expiry_at" className={FIELD} />
                </FormRow>
                <FormRow name="Retail value, ₱ (optional)">
                  <input
                    type="number"
                    id="retail_value_php"
                    aria-label="Retail value, ₱ (optional)"
                    name="retail_value_php"
                    min={0}
                    className="input-field w-[120px] flex-none rounded-full"
                  />
                </FormRow>
                <PostedTypedRow
                  name="Rationale (logged, min. 20 characters)"
                  fieldName="rationale"
                  long
                  placeholder="Why this account, why this scope, who approved it."
                  data="rationale"
                />
              </FormRows>
              <div className="flex justify-end pb-2 pt-1">
                <SubmitButton className={actionButtonClass('brand', { main: true })} pendingLabel="Saving…">
                  Issue comp
                </SubmitButton>
              </div>
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
                  return `${g.vendor_business_name ?? g.vendor_profile_id} (supplier)`;
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
                  ? new Date(g.expiry).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila',
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
      </TemplateSection>
    </div>
  );
}
