// ============================================================================
// /dashboard/[eventId]/vendors/[vendorId]/workspace — Per-SERVICE workspace
//
// Service-scoped reframe (2026-06-04). This is the page a couple lands on when
// they click a finalized SERVICE card in their plan. It leads with the booked
// service/package — name · blurb · inclusions · price · order status — and
// demotes the vendor to a "by {vendor}" attribution line.
//
// The route's [vendorId] is the event_vendors.vendor_id PK, which binds
// to AT MOST ONE locked package (event_vendor_package_id → event_vendor_packages
// → vendor_packages + vendor_package_items). So one URL == one service context;
// no route or schema change was needed to make this service-scoped.
//
// Supersedes the vendor-first layout from the 2026-05-22 owner directive.
// Section order: service hero · what's included · order & payment status +
// payments · conversation · documents · schedules · marketplace info ·
// costing (host's 3-line total) · your notes · bring-vendor-onto-Setnayan.
//
// Unit boundary: event_vendors.*_php are PESOS; the vendor_packages /
// event_vendor_packages / vendor_package_items *_centavos columns are CENTAVOS.
// Package money is rendered via formatCentavosPhp (÷100); peso columns via the
// local formatPHP. Never cross the two.
//
// RLS handles auth — event membership gates the row; notFound() when the
// event_vendors row is missing or RLS denies.
//
// Deep-link anchors PRESERVED (other surfaces link to them, e.g.
// planning-groups.tsx): #conversation · #documents · #payments.
// ============================================================================

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  BookmarkCheck,
  CalendarPlus,
  CheckCircle2,
  Circle,
  FileText,
  LinkIcon,
  MessageCircle,
  Package as PackageIcon,
  PiggyBank,
  Receipt,
  Sparkles,
  UserCheck,
  Upload,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { formatCentavosPhp } from '@/lib/vendor-packages';
import { updateVendorCosts } from '../../actions';
import { createAutoShareInviteAction } from './actions';
import { fetchVendorBudgetSummary } from '@/lib/budget';
import { fetchPublishedMethodsForCouple } from '@/lib/vendor-payment-methods.server';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import { buildClaimUrl, fetchActiveAutoShareInvite } from '@/lib/vendor-invites';
import { ClaimLinkShare } from './_components/claim-link-share';
import {
  CancelBookingButton,
  DisputeLinkButton,
} from '../../_components/cancel-booking-button';
import { VendorItemizationCard } from '../../../_components/vendor-itemization-card';
import {
  VendorMarketplaceInfo,
  fetchMarketplaceContact,
  fetchMarketplaceServices,
  fetchMarketplaceReviews,
} from '../../../_components/vendor-marketplace-info';

export const metadata = { title: 'Service workspace · Setnayan' };

type Props = {
  params: Promise<{ eventId: string; vendorId: string }>;
};

// ----------------------------------------------------------------------------
// Order & payment status stepper — 3 truthful stages.
//
// `event_vendors.workspace_status` (the 7-value column from migration
// 20260604130000) is NOT written anywhere in V1 — its only writer,
// advanceWorkspaceStatus in this folder's actions.ts, ships unwired. So the
// stepper is driven off the vendor_status enum, which is the only signal that
// actually moves. That yields exactly three reachable stages:
//
//   'contracted'        → 'plan_finalized'
//   'deposit_paid'      → 'downpayment_paid'
//   'delivered'/'complete' → 'delivered'
//
// (The old 5-stage stepper advertised "Second payment paid" + "Paid in full",
// which could never light up. Collapsed here so the UI tells the truth. Wiring
// the richer states is a deferred follow-up — see the workspace actions.ts.)
// ----------------------------------------------------------------------------

type WorkspaceStage = 'plan_finalized' | 'downpayment_paid' | 'delivered';

const STAGE_ORDER: ReadonlyArray<WorkspaceStage> = [
  'plan_finalized',
  'downpayment_paid',
  'delivered',
];

const STAGE_LABEL: Record<WorkspaceStage, string> = {
  plan_finalized: 'Plan finalized',
  downpayment_paid: 'Downpayment paid',
  delivered: 'Delivered',
};

function inferStage(vendorStatus: string): WorkspaceStage | null {
  switch (vendorStatus) {
    case 'contracted':
      return 'plan_finalized';
    case 'deposit_paid':
      return 'downpayment_paid';
    case 'delivered':
    case 'complete':
      return 'delivered';
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// formatPHP — peso formatter for event_vendors.*_php columns. (Package money
// uses formatCentavosPhp from @/lib/vendor-packages instead.)
// ----------------------------------------------------------------------------

function formatPHP(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMeetingDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(d);
}

function formatPaymentDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(d);
}

// Defense-in-depth: contract file URLs + vendor logo URLs are vendor-controlled.
// Only allow http(s) so a stored `javascript:` / `data:` URL can't execute when
// rendered as an <a href> or <img src>. Returns null for anything else.
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Page component
// ----------------------------------------------------------------------------

export default async function VendorWorkspacePage({ params }: Props) {
  const { eventId, vendorId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Primary fetch — event_vendors row, gated by RLS to host-on-event only.
  // `notFound()` covers both "row doesn't exist" and "row exists but RLS denied"
  // outcomes, since either way the host has no business viewing this URL.
  const { data: vendorRow, error: vendorErr } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id, event_id, category, vendor_name, contact_email, contact_phone, status, workspace_status, total_cost_php, transport_php, food_allowance_php, deposit_paid_php, notes, marketplace_vendor_id, manual_vendor_id, event_vendor_package_id, created_at',
    )
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (vendorErr || !vendorRow) notFound();

  const ev = vendorRow as {
    vendor_id: string;
    event_id: string;
    category: string;
    vendor_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
    workspace_status: string | null;
    total_cost_php: number | string | null;
    transport_php: number | string | null;
    food_allowance_php: number | string | null;
    deposit_paid_php: number | string | null;
    notes: string | null;
    marketplace_vendor_id: string | null;
    manual_vendor_id: string | null;
    event_vendor_package_id: string | null;
    created_at: string;
  };

  // ----------------------------------------------------------------------
  // Auto-share-link invite (2026-05-22 owner directive).
  //
  // ANY vendor without a Setnayan account (marketplace_vendor_id IS NULL) gets
  // the claim-link CTA — host-typed manual vendors, venue_directory entries,
  // etc. The post-signup hook (applyClaimAutoLink) populates
  // marketplace_vendor_id when the vendor registers via the claim URL.
  //
  // Read-only here: minting an invite is a write, and a GET render (incl.
  // Next.js prefetch) must never write. The invite is normally created at
  // finalize time; if a locked manual vendor still has none, the claim section
  // renders an explicit "Create link" action (createAutoShareInviteAction).
  // ----------------------------------------------------------------------
  const needsInvite = ev.marketplace_vendor_id === null;
  const autoShareInvite = needsInvite
    ? await fetchActiveAutoShareInvite(supabase, ev.vendor_id)
    : null;
  const canOfferInvite =
    needsInvite &&
    !autoShareInvite &&
    (ev.status === 'contracted' ||
      ev.status === 'deposit_paid' ||
      ev.status === 'delivered' ||
      ev.status === 'complete');

  // Parallel fetches for the panel data sources + the three marketplace-info
  // surfaces. None are critical-path — any failure renders that section's empty
  // state rather than crashing. The per-vendor budget snapshot (fetched below)
  // now also supplies the hero money, so the old standalone line-item / payment
  // fetches are gone.
  const [
    contractsRes,
    meetingsRes,
    marketplaceProfileRes,
    chatThreadRes,
    marketplaceServicesData,
    marketplaceContactData,
    marketplaceReviewsData,
  ] = await Promise.all([
    // Contracts (RLS scopes to host-on-event)
    ev.marketplace_vendor_id
      ? supabase
          .from('vendor_contracts')
          .select('contract_id, public_id, title, file_url, file_name, status, created_at, sent_for_signature_at, fully_signed_at')
          .eq('event_id', eventId)
          .eq('vendor_profile_id', ev.marketplace_vendor_id)
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    // Upcoming meetings
    supabase
      .from('vendor_meetings')
      .select('meeting_id, starts_at, ends_at, mode, title, location, agenda, notes')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .order('starts_at', { ascending: true }),

    // Marketplace profile — logo, business name, city, + is_setnayan_service
    // (drives the "Provided by Setnayan" attribution).
    ev.marketplace_vendor_id
      ? supabase
          .from('vendor_profiles')
          .select('business_name, business_slug, logo_url, city, is_setnayan_service')
          .eq('vendor_profile_id', ev.marketplace_vendor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Chat thread for deep-link (orphan-prevention)
    ev.marketplace_vendor_id
      ? supabase
          .from('chat_threads')
          .select('thread_id')
          .eq('event_id', eventId)
          .eq('vendor_profile_id', ev.marketplace_vendor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Marketplace info — services / contact / reviews. Each helper handles its
    // own 42P01 / 42703 graceful-degrade.
    ev.marketplace_vendor_id
      ? fetchMarketplaceServices(supabase, ev.marketplace_vendor_id)
      : Promise.resolve([]),
    ev.marketplace_vendor_id
      ? fetchMarketplaceContact(supabase, ev.marketplace_vendor_id)
      : Promise.resolve(null),
    ev.marketplace_vendor_id
      ? fetchMarketplaceReviews(supabase, ev.marketplace_vendor_id)
      : Promise.resolve({
          stats: {
            vendor_profile_id: '',
            avg_rating_overall: 0,
            total_count: 0,
            count_5_star: 0,
            count_4_star: 0,
            count_3_star: 0,
            count_2_star: 0,
            count_1_star: 0,
          },
          reviews: [],
        }),
  ]);

  // Per-vendor budget summary — single-vendor fetch (NOT the whole event's
  // snapshot). Supplies the embedded VendorItemizationCard AND the hero's
  // "Price / Paid so far" surfaces (itemizedTotal / paidTotal, both pesos).
  // Wrapped defensively — buildVendorPricingLookup graceful-degrades, but a
  // hard Postgres error shouldn't take down the page.
  let vendorBudgetSummary: Awaited<ReturnType<typeof fetchVendorBudgetSummary>> = null;
  try {
    vendorBudgetSummary = await fetchVendorBudgetSummary(supabase, eventId, ev.vendor_id);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[VendorWorkspacePage] fetchVendorBudgetSummary threw', e);
  }

  // Off-platform direct-pay: the vendor's PUBLISHED payment destinations,
  // resolved server-side via the secure helper (proves event ownership through
  // the couple RLS client before reading the owner-RLS'd table via the admin
  // client). Feeds the embedded VendorItemizationCard's "Pay {vendor} directly"
  // sheet. For off-platform/manual vendors the helper returns [] and the sheet
  // trigger collapses to the quiet "coordinate in chat" hint. Best-effort: a
  // failure degrades to [] rather than 500-ing the workspace.
  let directPayMethods: CoupleFacingMethod[] = [];
  try {
    directPayMethods = await fetchPublishedMethodsForCouple({
      authedClient: supabase,
      adminClient: createAdminClient(),
      eventId,
      eventVendorId: ev.vendor_id,
    });
  } catch {
    directPayMethods = [];
  }

  const contracts = (contractsRes.data ?? []) as Array<{
    contract_id: string;
    public_id: string;
    title: string;
    file_url: string;
    file_name: string;
    status: string;
    created_at: string;
    sent_for_signature_at: string | null;
    fully_signed_at: string | null;
  }>;

  const meetings = (meetingsRes.data ?? []) as Array<{
    meeting_id: string;
    starts_at: string;
    ends_at: string | null;
    mode: string;
    title: string;
    location: string | null;
    agenda: string | null;
    notes: string | null;
  }>;

  const marketplaceProfile = (marketplaceProfileRes.data ?? null) as {
    business_name: string;
    business_slug: string | null;
    logo_url: string | null;
    city: string | null;
    is_setnayan_service: boolean | null;
  } | null;

  const chatThread = (chatThreadRes.data ?? null) as { thread_id: string } | null;

  // --------------------------------------------------------------------------
  // The booked service/package — the HERO of this page.
  //
  // Two-hop FK: event_vendors.event_vendor_package_id →
  // event_vendor_packages.booking_id → .package_id → vendor_packages +
  // vendor_package_items. Only 'locked' bookings are treated as a live header
  // (mirrors lib/budget.ts). Best-effort: any null result falls back to the
  // category-label service title + host notes, never a 500.
  // --------------------------------------------------------------------------
  let packageHeader: {
    name: string;
    description: string | null;
    priceCentavos: number | null;
  } | null = null;
  let packageItems: { service_description: string; is_default_included: boolean }[] = [];

  if (ev.event_vendor_package_id) {
    const { data: bookingRow } = await supabase
      .from('event_vendor_packages')
      .select('package_id, status, total_locked_centavos')
      .eq('booking_id', ev.event_vendor_package_id)
      .maybeSingle();
    const booking = bookingRow as {
      package_id: string;
      status: string;
      total_locked_centavos: number | string | null;
    } | null;

    if (booking && booking.status === 'locked' && booking.package_id) {
      const [{ data: pkgRowRaw }, { data: itemsRaw }] = await Promise.all([
        supabase
          .from('vendor_packages')
          .select('package_name, description, total_price_centavos')
          .eq('package_id', booking.package_id)
          .maybeSingle(),
        supabase
          .from('vendor_package_items')
          .select('service_description, is_default_included, display_order')
          .eq('package_id', booking.package_id)
          .order('display_order', { ascending: true }),
      ]);

      const pkg = pkgRowRaw as {
        package_name: string;
        description: string | null;
        total_price_centavos: number | string | null;
      } | null;

      if (pkg) {
        const lockedTotal =
          booking.total_locked_centavos != null ? Number(booking.total_locked_centavos) : null;
        const listTotal =
          pkg.total_price_centavos != null ? Number(pkg.total_price_centavos) : null;
        packageHeader = {
          name: pkg.package_name,
          description: pkg.description,
          // Prefer the host's actual locked total; fall back to list price.
          priceCentavos: lockedTotal && lockedTotal > 0 ? lockedTotal : listTotal,
        };
      }

      packageItems = (
        (itemsRaw ?? []) as Array<{
          service_description: string;
          is_default_included: boolean;
        }>
      ).map((it) => ({
        service_description: it.service_description,
        is_default_included: it.is_default_included,
      }));
    }
  }

  // --------------------------------------------------------------------------
  // Derived display values
  // --------------------------------------------------------------------------
  const displayName = marketplaceProfile?.business_name ?? ev.vendor_name;
  const logoUrl = safeHttpUrl(marketplaceProfile?.logo_url);
  const isSetnayanService = marketplaceProfile?.is_setnayan_service === true;
  const categoryLabel =
    (VENDOR_CATEGORY_LABEL as Record<string, string>)[ev.category] ?? 'Service';

  // Service-scoped hero: package name is the service title; the category is the
  // fallback when this pick isn't tied to a locked package (manual/off-platform).
  const serviceTitle = packageHeader?.name ?? categoryLabel;
  const serviceDescription = packageHeader?.description ?? null;
  const attribution = isSetnayanService ? 'Provided by Setnayan' : `by ${displayName}`;

  const stage = inferStage(ev.status);
  const depositPaidFormatted = formatPHP(ev.deposit_paid_php);

  // Hero price precedence: package locked total (centavos) → snapshot itemized
  // (pesos) → host's total_cost_php (pesos).
  const heroPriceFormatted =
    packageHeader?.priceCentavos != null
      ? formatCentavosPhp(packageHeader.priceCentavos)
      : vendorBudgetSummary
        ? formatPHP(vendorBudgetSummary.itemizedTotal)
        : formatPHP(ev.total_cost_php);

  const paidSoFarFormatted =
    vendorBudgetSummary && vendorBudgetSummary.paidTotal > 0
      ? formatPHP(vendorBudgetSummary.paidTotal)
      : depositPaidFormatted;

  // 3-line total = Service + Transport + Food allowance (the Costing form).
  const serviceCostNum = Number(ev.total_cost_php ?? 0) || 0;
  const transportNum = Number(ev.transport_php ?? 0) || 0;
  const foodNum = Number(ev.food_allowance_php ?? 0) || 0;
  const rolledTotalNum = serviceCostNum + transportNum + foodNum;

  // Conversation deep-link target
  const conversationHref = chatThread
    ? `/dashboard/${eventId}/messages/${chatThread.thread_id}`
    : `/dashboard/${eventId}/messages`;

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* Back nav                                                         */}
      {/* ============================================================== */}
      <Link
        href={`/dashboard/${eventId}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/65 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to event home
      </Link>

      {/* ============================================================== */}
      {/* Section 1 — Service hero (vendor demoted to attribution)        */}
      {/* ============================================================== */}
      <section
        aria-labelledby="vendor-workspace-header"
        className="rounded-2xl border border-emerald-300/40 bg-emerald-50/40 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              {categoryLabel}
            </p>
            <h1
              id="vendor-workspace-header"
              className="font-display text-2xl italic tracking-tight text-ink sm:text-3xl"
            >
              {serviceTitle}
            </h1>
            {serviceDescription ? (
              <p className="max-w-prose text-sm text-ink/70">{serviceDescription}</p>
            ) : null}

            {/* Vendor attribution — secondary line, small avatar */}
            <div className="flex items-center gap-2 pt-1">
              <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-ink/10 bg-cream">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-xs text-ink/55 italic">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink/65">
                {attribution}
                {marketplaceProfile?.city ? ` · ${marketplaceProfile.city}` : ''}
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-800">
            <BookmarkCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
            Locked
          </span>
        </div>

        {/* Money summary strip */}
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Price
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {heroPriceFormatted ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Paid so far
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {paidSoFarFormatted ?? '—'}
            </dd>
          </div>
          {ev.contact_email || ev.contact_phone ? (
            <div className="col-span-2 sm:col-span-1">
              <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Contact
              </dt>
              <dd className="mt-1 truncate text-sm text-ink/80">
                {ev.contact_phone ?? ev.contact_email}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Action row — All services + (cancel | dispute) per status. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/${eventId}/vendors`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/70 transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            All services
          </Link>
          {!isSetnayanService && (() => {
            // Mirror the server-side downpaid signal from cancelBookingAsHost.
            const downpaid =
              ev.status === 'deposit_paid' ||
              ev.status === 'delivered' ||
              ev.status === 'complete';
            const depositValueNumeric =
              typeof ev.deposit_paid_php === 'string'
                ? Number(ev.deposit_paid_php)
                : ev.deposit_paid_php;
            const hasDeposit =
              Number.isFinite(depositValueNumeric) &&
              (depositValueNumeric ?? 0) > 0;

            if (downpaid || hasDeposit) {
              return <DisputeLinkButton eventId={eventId} variant="cta" />;
            }
            if (ev.status === 'contracted') {
              return (
                <CancelBookingButton
                  eventId={eventId}
                  vendorId={ev.vendor_id}
                  vendorName={displayName}
                  redirectToHomeOnSuccess
                  variant="cta"
                />
              );
            }
            return null;
          })()}
        </div>
      </section>

      {/* ============================================================== */}
      {/* Section 2 — What's included (the service's inclusions)          */}
      {/* ============================================================== */}
      {packageItems.length > 0 ? (
        <section
          aria-labelledby="included-heading"
          className="rounded-2xl border border-ink/10 bg-white/60 p-5 sm:p-6"
        >
          <h2
            id="included-heading"
            className="mb-3 flex items-center gap-2 font-display text-lg italic text-ink"
          >
            <PackageIcon aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            What&apos;s included
          </h2>
          <ul className="space-y-2">
            {packageItems.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink/80">
                <CheckCircle2
                  aria-hidden
                  className={`mt-0.5 h-4 w-4 shrink-0 ${it.is_default_included ? 'text-terracotta' : 'text-ink/30'}`}
                  strokeWidth={1.75}
                />
                <span>
                  {it.service_description}
                  {it.is_default_included ? '' : ' (optional add-on)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ============================================================== */}
      {/* Section 3 — Order & payment status (stepper + payments)         */}
      {/* ============================================================== */}
      <section aria-labelledby="status-heading" className="space-y-3">
        <h2
          id="status-heading"
          className="font-mono text-xs uppercase tracking-[0.18em] text-ink/65"
        >
          Order &amp; payment status
        </h2>

        <ol className="grid grid-cols-3 gap-1 sm:gap-2" role="list">
          {STAGE_ORDER.map((s, idx) => {
            const reached = stage !== null && STAGE_ORDER.indexOf(stage) >= idx;
            const isCurrent = stage === s;
            const Icon = reached ? CheckCircle2 : Circle;
            return (
              <li
                key={s}
                className="flex flex-col items-center gap-1.5 text-center"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={[
                    'grid h-7 w-7 place-items-center rounded-full border transition-colors',
                    reached
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-ink/15 bg-cream text-ink/30',
                    isCurrent ? 'ring-2 ring-emerald-300/60 ring-offset-2' : '',
                  ].join(' ')}
                >
                  <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
                <span
                  className={[
                    'text-[11px] leading-tight sm:text-xs',
                    reached ? 'text-ink/85' : 'text-ink/45',
                    isCurrent ? 'font-semibold' : '',
                  ].join(' ')}
                >
                  {STAGE_LABEL[s]}
                </span>
              </li>
            );
          })}
        </ol>

        {stage === null ? (
          <p className="text-xs text-ink/55">
            No payment progress recorded yet. Log a payment below as money moves.
          </p>
        ) : null}

        {/* Payments — embeds the same itemization card the budget page uses. */}
        <div
          id="payments"
          className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
        >
          <header className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <PiggyBank aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
              Payments
            </h3>
          </header>

          {vendorBudgetSummary ? (
            <VendorItemizationCard
              summary={vendorBudgetSummary}
              eventId={eventId}
              variant="embed"
              directPayMethods={directPayMethods}
            />
          ) : (
            <p className="text-xs text-ink/55">
              No payment milestones added yet. Add a line item or log a payment
              as money moves to {displayName}.
            </p>
          )}
        </div>
      </section>

      {/* ============================================================== */}
      {/* Coordination — Conversation / Documents / Schedules (2-col)     */}
      {/* ============================================================== */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ----------------------------------------------------------- */}
        {/* Conversation                                                 */}
        {/* ----------------------------------------------------------- */}
        <section
          id="conversation"
          aria-labelledby="conversation-heading"
          className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              id="conversation-heading"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <MessageCircle
                aria-hidden
                className="h-4 w-4 text-terracotta"
                strokeWidth={1.75}
              />
              Conversation
            </h2>
          </header>

          {ev.marketplace_vendor_id ? (
            chatThread ? (
              <>
                <p className="text-xs text-ink/65">
                  Your thread with {displayName} stays here. Open the full
                  conversation to read older messages or reply.
                </p>
                <Link
                  href={conversationHref}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-terracotta/30 bg-cream px-3 py-2 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  Open chat thread
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs text-ink/65">
                  You haven&rsquo;t started a chat with {displayName} yet. Open
                  Messages to send the first note.
                </p>
                <Link
                  href={`/dashboard/${eventId}/messages`}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-terracotta/30 bg-cream px-3 py-2 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  Go to Messages
                </Link>
              </>
            )
          ) : (
            <p className="text-xs text-ink/55">
              This vendor isn&rsquo;t connected to a Setnayan profile, so chat
              isn&rsquo;t available here. Reach out using the contact details
              above.
            </p>
          )}
        </section>

        {/* ----------------------------------------------------------- */}
        {/* Documents                                                    */}
        {/* ----------------------------------------------------------- */}
        <section
          id="documents"
          aria-labelledby="documents-heading"
          className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              id="documents-heading"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <FileText
                aria-hidden
                className="h-4 w-4 text-terracotta"
                strokeWidth={1.75}
              />
              Documents
            </h2>
            <Link
              href={`/dashboard/${eventId}/contracts`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta-700 hover:text-terracotta-800"
            >
              <Upload aria-hidden className="h-3 w-3" strokeWidth={2} />
              Manage
            </Link>
          </header>

          {!ev.marketplace_vendor_id ? (
            <p className="text-xs text-ink/55">
              Documents flow through the marketplace profile. This vendor
              isn&rsquo;t connected yet, so files aren&rsquo;t available here.
            </p>
          ) : contracts.length === 0 ? (
            <p className="text-xs text-ink/55">
              No contracts uploaded yet. {displayName} can upload PDFs from
              their dashboard for you to keep on file.
            </p>
          ) : (
            <ul className="space-y-2">
              {contracts.map((c) => {
                const fileHref = safeHttpUrl(c.file_url);
                return (
                <li
                  key={c.contract_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream/80 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    {fileHref ? (
                      <a
                        href={fileHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium text-ink hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                      >
                        {c.title}
                      </a>
                    ) : (
                      <span className="block truncate text-sm font-medium text-ink/70">
                        {c.title}
                      </span>
                    )}
                    <p className="text-[10px] text-ink/55">
                      Uploaded {formatPaymentDate(c.created_at)}
                    </p>
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]',
                      c.status === 'fully_signed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-50 text-emerald-700',
                    ].join(' ')}
                  >
                    {c.status === 'sent_for_signature'
                      ? 'Available'
                      : c.status.replace(/_/g, ' ')}
                  </span>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ----------------------------------------------------------- */}
        {/* Schedules                                                    */}
        {/* ----------------------------------------------------------- */}
        <section
          id="schedules"
          aria-labelledby="schedules-heading"
          className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              id="schedules-heading"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <CalendarPlus
                aria-hidden
                className="h-4 w-4 text-terracotta"
                strokeWidth={1.75}
              />
              Schedules
            </h2>
          </header>

          {meetings.length === 0 ? (
            <p className="text-xs text-ink/55">
              No meetings scheduled yet. Coordinate the next consult, tasting,
              or fitting via Messages.
            </p>
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li
                  key={m.meeting_id}
                  className="rounded-lg border border-ink/10 bg-cream/80 px-3 py-2"
                >
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  <p className="text-[11px] text-ink/65">
                    {formatMeetingDate(m.starts_at)}
                    {m.mode ? ` · ${m.mode.replace(/_/g, ' ')}` : ''}
                  </p>
                  {m.location ? (
                    <p className="mt-0.5 truncate text-[11px] text-ink/55">
                      {m.location}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ============================================================== */}
      {/* Marketplace info (marketplace-linked vendors only)              */}
      {/* ============================================================== */}
      {ev.marketplace_vendor_id ? (
        <VendorMarketplaceInfo
          services={marketplaceServicesData}
          contact={marketplaceContactData}
          reviewsData={marketplaceReviewsData}
          vendorBusinessName={displayName}
          vendorProfileSlug={marketplaceProfile?.business_slug ?? null}
          reviewLinkHref={
            ev.status === 'delivered' || ev.status === 'complete'
              ? `/dashboard/${eventId}/vendors/${ev.vendor_id}/review`
              : null
          }
        />
      ) : null}

      {/* ============================================================== */}
      {/* Payment mode                                                     */}
      {/* First-party Setnayan services aren't hand-tracked — payment runs */}
      {/* through the order flow (apply → pay → upload screenshot →        */}
      {/* verified within 24 hrs). External vendors keep the 3-line Costing */}
      {/* total (service + transport + crew-meal).                         */}
      {/* ============================================================== */}
      {isSetnayanService ? (
        <section
          aria-labelledby="managed-heading"
          className="rounded-2xl border border-mulberry/20 bg-mulberry/5 p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mulberry/10 text-mulberry">
              <Sparkles aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 id="managed-heading" className="text-sm font-semibold text-ink">
                Managed by Setnayan
              </h2>
              <p className="text-xs text-ink/70">
                This is a Setnayan service, so there&rsquo;s no separate vendor to
                pay. Apply, settle the amount via the instructions we send, then
                upload your payment screenshot — we verify and activate within 24
                hours.
              </p>
              <Link
                href={`/dashboard/${eventId}/orders`}
                className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-mulberry/30 bg-cream px-3 py-2 text-xs font-medium text-mulberry transition-colors hover:bg-mulberry/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                <Receipt aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Pay &amp; track in your Orders
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="costing-heading"
          className="rounded-2xl border border-ink/10 bg-white/60 p-5 sm:p-6"
        >
          <h2
            id="costing-heading"
            className="mb-1 font-display text-lg italic text-ink"
          >
            Costing
          </h2>
        <p className="mb-4 text-xs text-ink/55">
          What you&apos;ll budget is the service price + transport + food
          allowance. Leave a line blank to count it as ₱0.
        </p>
        <form action={updateVendorCosts} className="space-y-3">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="vendor_id" value={ev.vendor_id} />

          {[
            { name: 'total_cost_php', label: 'Service price', value: ev.total_cost_php },
            { name: 'transport_php', label: 'Transport cost', value: ev.transport_php },
            { name: 'food_allowance_php', label: 'Food allowance', value: ev.food_allowance_php },
          ].map((line) => (
            <label
              key={line.name}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-ink/65">{line.label}</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-ink/40">₱</span>
                <input
                  name={line.name}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={line.value ?? ''}
                  className="w-32 rounded-md border border-ink/15 bg-white px-2 py-1 text-right font-medium text-ink focus:border-terracotta focus:outline-none"
                />
              </span>
            </label>
          ))}

          <div className="flex items-center justify-between border-t border-ink/10 pt-3">
            <span className="text-sm font-medium text-ink">Total</span>
            <span className="font-display text-lg italic text-ink">
              {formatPHP(rolledTotalNum) ?? '₱0'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/65">Deposit paid</span>
            <span className="font-medium text-ink">{depositPaidFormatted ?? '—'}</span>
          </div>

          <button
            type="submit"
            className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Save costs
          </button>
        </form>
        </section>
      )}

      {/* ============================================================== */}
      {/* Your notes (single render, any pick that has them)              */}
      {/* ============================================================== */}
      {ev.notes ? (
        <section
          aria-labelledby="notes-heading"
          className="rounded-2xl border border-ink/10 bg-cream/40 p-5"
        >
          <h2
            id="notes-heading"
            className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Your notes
          </h2>
          <p className="whitespace-pre-line text-sm text-ink/80">{ev.notes}</p>
        </section>
      ) : null}

      {/* ============================================================== */}
      {/* Bring this vendor onto Setnayan (claim-link, demoted)           */}
      {/* ============================================================== */}
      {needsInvite && autoShareInvite && autoShareInvite.status === 'pending' ? (
        <section
          aria-labelledby="claim-invite-heading"
          className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-5 sm:p-6"
        >
          <header className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
              <LinkIcon aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-800">
                Bring this vendor onto Setnayan
              </p>
              <h2
                id="claim-invite-heading"
                className="text-sm font-semibold text-ink"
              >
                Send {displayName} this link
              </h2>
              <p className="text-xs text-ink/70">
                They don&rsquo;t have a Setnayan account yet. Share this link
                so they can register a free vendor account and see the
                schedule you&rsquo;ve locked for them.
              </p>
            </div>
          </header>

          <div className="mt-4">
            <ClaimLinkShare
              claimUrl={buildClaimUrl(autoShareInvite.claim_token)}
              shareTitle={`Setnayan invite for ${displayName}`}
              shareText={`Hi! I added you on Setnayan for our wedding. Claim your free vendor account here:`}
            />
          </div>

          <p className="mt-3 text-[11px] text-ink/55">
            Free vendor account · launch promo runs through 30 Jan 2027 ·
            Link expires in 90 days
          </p>
        </section>
      ) : needsInvite && autoShareInvite && autoShareInvite.status === 'claimed' ? (
        <section
          aria-labelledby="claim-linked-heading"
          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5"
        >
          <header className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
              <UserCheck aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800">
                Linked to vendor account
              </p>
              <h2
                id="claim-linked-heading"
                className="text-sm font-semibold text-ink"
              >
                {displayName} joined Setnayan
              </h2>
              <p className="text-xs text-ink/70">
                Chat unlocks above. They can confirm details, upload
                contracts, and sync their schedule directly with you.
              </p>
            </div>
          </header>
        </section>
      ) : needsInvite && autoShareInvite && autoShareInvite.status === 'expired' ? (
        <section
          aria-labelledby="claim-expired-heading"
          className="rounded-2xl border border-ink/15 bg-cream/60 p-5"
        >
          <header className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/5 text-ink/55">
              <LinkIcon aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                Invite link expired
              </p>
              <h2
                id="claim-expired-heading"
                className="text-sm font-semibold text-ink/85"
              >
                The previous invite link is no longer active
              </h2>
              <p className="text-xs text-ink/65">
                Re-lock this vendor to generate a fresh link, or reach out to
                them using the contact details above.
              </p>
            </div>
          </header>
        </section>
      ) : canOfferInvite ? (
        <section
          aria-labelledby="claim-create-heading"
          className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-5 sm:p-6"
        >
          <header className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
              <LinkIcon aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-800">
                Bring this vendor onto Setnayan
              </p>
              <h2 id="claim-create-heading" className="text-sm font-semibold text-ink">
                Invite {displayName} with a free account
              </h2>
              <p className="text-xs text-ink/70">
                They don&rsquo;t have a Setnayan account yet. Create a shareable
                link to send them — they register free and can see the schedule
                you&rsquo;ve locked for them.
              </p>
            </div>
          </header>
          <form action={createAutoShareInviteAction} className="mt-4">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={ev.vendor_id} />
            <input type="hidden" name="business_name" value={ev.vendor_name} />
            <input type="hidden" name="category" value={ev.category} />
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <LinkIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Create a shareable invite link
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
