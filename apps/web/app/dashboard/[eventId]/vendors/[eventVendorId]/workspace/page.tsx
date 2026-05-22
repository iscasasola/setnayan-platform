// ============================================================================
// /dashboard/[eventId]/vendors/[eventVendorId]/workspace — Per-vendor workspace
//
// Owner directive 2026-05-22 (verbatim):
//   "click finalized vendor → land on dedicated page with conversation +
//    payments + documents + schedules + status (plan_finalized →
//    downpayment → 2nd payment → final · etc.)"
//
// Single per-vendor landing page consolidating five workspace surfaces:
//   1. Header           — vendor identity + LOCKED chip + Switch vendor CTA
//   2. Status stepper   — payment-stage progress (event_vendors.workspace_status
//                          fallbacks to vendor_status enum for legacy rows)
//   3. Conversation     — link out to chat thread (orphan-prevention: deep-link
//                          when thread exists, fall back to /messages list)
//   4. Payments         — event_vendor_line_items milestones + payment history
//   5. Documents        — vendor_contracts list + upload affordance (future)
//   6. Schedules        — vendor_meetings upcoming + add affordance (future)
//   7. Package          — event_vendor_packages section (no-op until that
//                          table lands — Task #27)
//
// V1 minimum scope (per the directive's STEP 6):
//   - Renders all sections with existing data sources
//   - Header + stepper + payment list + meeting list + contract list visible
//   - Inline CRUD deferred to V1.1 — actions.ts ships the server actions but
//     the workspace page links to existing surfaces (/messages, /contracts)
//     for new-record creation in V1
//   - Package section renders empty-state until event_vendor_packages exists
//
// RLS handles auth — the layout above already gates on event membership; the
// page just selects against event_vendors filtered by both event_id +
// vendor_id. notFound() when the row is missing or RLS denies.
//
// Entry points (orphan-prevention per feedback_setnayan_orphan_prevention):
//   - finalized-chip-strip.tsx:252 chip click target (re-wired in this PR)
//   - planning-groups.tsx:744 LockedCard "View contract" CTA → ?#documents
//   - planning-groups.tsx:755 LockedCard "Open thread" CTA → ?#conversation
//   - vendor list page may add a workspace link in V1.1 (currently links to
//     /review for delivered+complete vendors only — workspace is broader)
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
  Plus,
  UserCheck,
  Upload,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import {
  buildClaimUrl,
  ensureAutoShareInvite,
  fetchActiveAutoShareInvite,
} from '@/lib/vendor-invites';
import { ClaimLinkShare } from './_components/claim-link-share';

export const metadata = { title: 'Vendor workspace · Setnayan' };

type Props = {
  params: Promise<{ eventId: string; eventVendorId: string }>;
};

// ----------------------------------------------------------------------------
// workspace_status stepper
//
// Maps event_vendors.workspace_status (new column from 20260604130000) to a
// 5-stage stepper that fits the common Filipino-wedding payment patterns:
//
//   plan_finalized        → "Plan finalized"
//   downpayment_paid      → "Downpayment paid"
//   second_payment_paid   → "Second payment paid" (or "_due" — pending state)
//   paid_in_full          → "Paid in full"
//   delivered             → "Delivered"
//
// Fallback inference from vendor_status enum when workspace_status IS NULL:
//   - 'contracted'        → 'plan_finalized'
//   - 'deposit_paid'      → 'downpayment_paid'
//   - 'delivered'         → 'delivered'
//   - 'complete'          → 'delivered'  (treat as past-delivered)
// ----------------------------------------------------------------------------

type WorkspaceStage =
  | 'plan_finalized'
  | 'downpayment_paid'
  | 'second_payment_paid'
  | 'paid_in_full'
  | 'delivered';

const STAGE_ORDER: ReadonlyArray<WorkspaceStage> = [
  'plan_finalized',
  'downpayment_paid',
  'second_payment_paid',
  'paid_in_full',
  'delivered',
];

const STAGE_LABEL: Record<WorkspaceStage, string> = {
  plan_finalized: 'Plan finalized',
  downpayment_paid: 'Downpayment paid',
  second_payment_paid: 'Second payment paid',
  paid_in_full: 'Paid in full',
  delivered: 'Delivered',
};

function inferStageFromVendorStatus(status: string): WorkspaceStage | null {
  switch (status) {
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

function resolveStage(
  workspaceStatus: string | null,
  vendorStatus: string,
): WorkspaceStage | null {
  if (workspaceStatus === null) {
    return inferStageFromVendorStatus(vendorStatus);
  }
  // workspace_status has 7 raw values; the stepper collapses *_due rows into
  // the previous *_paid stage (a "due" state means waiting on the host, not
  // a separate completed stage).
  switch (workspaceStatus) {
    case 'plan_finalized':
      return 'plan_finalized';
    case 'downpayment_paid':
    case 'second_payment_due':
      return 'downpayment_paid';
    case 'second_payment_paid':
    case 'final_payment_due':
      return 'second_payment_paid';
    case 'paid_in_full':
      return 'paid_in_full';
    case 'delivered':
      return 'delivered';
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// formatPHP — local helper matching planning-groups.tsx convention
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
  }).format(d);
}

function formatPaymentDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

// ----------------------------------------------------------------------------
// Page component
// ----------------------------------------------------------------------------

export default async function VendorWorkspacePage({ params }: Props) {
  const { eventId, eventVendorId } = await params;
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
      'vendor_id, event_id, category, vendor_name, contact_email, contact_phone, status, workspace_status, total_cost_php, deposit_paid_php, notes, marketplace_vendor_id, manual_vendor_id, created_at',
    )
    .eq('vendor_id', eventVendorId)
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
    deposit_paid_php: number | string | null;
    notes: string | null;
    marketplace_vendor_id: string | null;
    manual_vendor_id: string | null;
    created_at: string;
  };

  // ----------------------------------------------------------------------
  // Auto-share-link invite (2026-05-22 owner directive). Reads the current
  // invite (if any) so the CTA can render the right state.
  // ----------------------------------------------------------------------
  const needsInvite =
    ev.manual_vendor_id !== null && ev.marketplace_vendor_id === null;
  let autoShareInvite = needsInvite
    ? await fetchActiveAutoShareInvite(supabase, ev.vendor_id)
    : null;
  // Self-heal path — if the vendor is in a state that warrants an invite
  // (manual-vendor-locked + no marketplace link) but no auto_share_link row
  // exists yet (e.g. finalize fired before this feature shipped, or the
  // invite insert failed at lock time), generate one on this render so the
  // host always sees a fresh shareable link. This is idempotent — if the
  // row already exists it just gets re-read.
  if (needsInvite && !autoShareInvite && (ev.status === 'contracted'
    || ev.status === 'deposit_paid' || ev.status === 'delivered'
    || ev.status === 'complete')) {
    autoShareInvite = await ensureAutoShareInvite(supabase, {
      eventVendorId: ev.vendor_id,
      invitedByUserId: user.id,
      businessName: ev.vendor_name,
      serviceCategory: ev.category,
    });
  }

  // Parallel fetches for the 5 panel data sources. None of these are critical-
  // path — if any fail (e.g. RLS edge case, table doesn't exist on prod yet),
  // we render the empty state for that section rather than crashing the page.
  const [
    lineItemsRes,
    paymentsRes,
    contractsRes,
    meetingsRes,
    marketplaceProfileRes,
    chatThreadRes,
  ] = await Promise.all([
    // 1. Payment milestones
    supabase
      .from('event_vendor_line_items')
      .select('line_item_id, label, amount_php, due_date, sort_order, created_at')
      .eq('event_id', eventId)
      .eq('vendor_id', eventVendorId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    // 2. Payment history
    supabase
      .from('event_vendor_payments')
      .select('payment_id, line_item_id, amount_php, paid_at, method, reference, notes, created_at')
      .eq('event_id', eventId)
      .eq('vendor_id', eventVendorId)
      .order('paid_at', { ascending: false }),

    // 3. Contracts (RLS scopes to host-on-event)
    ev.marketplace_vendor_id
      ? supabase
          .from('vendor_contracts')
          .select('contract_id, public_id, title, file_url, file_name, status, created_at, sent_for_signature_at, fully_signed_at')
          .eq('event_id', eventId)
          .eq('vendor_profile_id', ev.marketplace_vendor_id)
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    // 4. Upcoming meetings
    supabase
      .from('vendor_meetings')
      .select('meeting_id, starts_at, ends_at, mode, title, location, agenda, notes')
      .eq('event_id', eventId)
      .eq('vendor_id', eventVendorId)
      .order('starts_at', { ascending: true }),

    // 5. Marketplace profile (for richer header — logo, business name)
    ev.marketplace_vendor_id
      ? supabase
          .from('vendor_profiles')
          .select('business_name, business_slug, logo_url, city')
          .eq('vendor_profile_id', ev.marketplace_vendor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // 6. Chat thread for deep-link (orphan-prevention — link to specific thread
    //    when it exists, fall back to /messages list otherwise)
    ev.marketplace_vendor_id
      ? supabase
          .from('chat_threads')
          .select('thread_id')
          .eq('event_id', eventId)
          .eq('vendor_profile_id', ev.marketplace_vendor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const lineItems = (lineItemsRes.data ?? []) as Array<{
    line_item_id: string;
    label: string;
    amount_php: number | string;
    due_date: string | null;
    sort_order: number;
    created_at: string;
  }>;

  const payments = (paymentsRes.data ?? []) as Array<{
    payment_id: string;
    line_item_id: string | null;
    amount_php: number | string;
    paid_at: string;
    method: string | null;
    reference: string | null;
    notes: string | null;
    created_at: string;
  }>;

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
  } | null;

  const chatThread = (chatThreadRes.data ?? null) as { thread_id: string } | null;

  // Derived display values
  const displayName = marketplaceProfile?.business_name ?? ev.vendor_name;
  const categoryLabel =
    (VENDOR_CATEGORY_LABEL as Record<string, string>)[ev.category] ?? 'Vendor';
  const stage = resolveStage(ev.workspace_status, ev.status);
  const totalCostFormatted = formatPHP(ev.total_cost_php);
  const depositPaidFormatted = formatPHP(ev.deposit_paid_php);

  // Sum payments for the "Total paid" header surface.
  const totalPaidNumeric = payments.reduce((sum, p) => {
    const n = typeof p.amount_php === 'string' ? Number(p.amount_php) : p.amount_php;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const totalPaidFormatted = totalPaidNumeric > 0 ? formatPHP(totalPaidNumeric) : null;

  // Sum line items for the "Plan total" surface (vs ev.total_cost_php which is
  // the host's at-finalize estimate). When milestones exist they're the
  // canonical total; otherwise we fall back to event_vendors.total_cost_php.
  const milestonesTotal = lineItems.reduce((sum, li) => {
    const n = typeof li.amount_php === 'string' ? Number(li.amount_php) : li.amount_php;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const planTotalFormatted =
    lineItems.length > 0 ? formatPHP(milestonesTotal) : totalCostFormatted;

  // Resolve which line items have been paid (sum of payments per line item)
  const paidByLineItem = new Map<string, number>();
  for (const p of payments) {
    if (!p.line_item_id) continue;
    const n = typeof p.amount_php === 'string' ? Number(p.amount_php) : p.amount_php;
    if (!Number.isFinite(n)) continue;
    paidByLineItem.set(p.line_item_id, (paidByLineItem.get(p.line_item_id) ?? 0) + n);
  }

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
      {/* Section 1 — Header                                               */}
      {/* ============================================================== */}
      <section
        aria-labelledby="vendor-workspace-header"
        className="rounded-2xl border border-emerald-300/40 bg-emerald-50/40 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {/* Avatar — logo or initials */}
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-ink/10 bg-cream sm:h-16 sm:w-16">
              {marketplaceProfile?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={marketplaceProfile.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-xl text-ink/55 italic">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                {categoryLabel}
              </p>
              <h1
                id="vendor-workspace-header"
                className="font-display text-2xl italic tracking-tight text-ink sm:text-3xl"
              >
                {displayName}
              </h1>
              {marketplaceProfile?.city ? (
                <p className="text-xs text-ink/60">{marketplaceProfile.city}</p>
              ) : null}
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
              Plan total
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {planTotalFormatted ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Paid so far
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {totalPaidFormatted ?? depositPaidFormatted ?? '—'}
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

        {/* Switch vendor — destructive, links to vendor tracker for the
         *  existing confirm-modal flow rather than building a duplicate one */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/${eventId}/vendors`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/70 transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            All vendors
          </Link>
        </div>
      </section>

      {/* ============================================================== */}
      {/* Section 1b — Bring this vendor onto Setnayan                     */}
      {/* ============================================================== */}
      {/* Renders when the locked vendor is a manual contact (no Setnayan  */}
      {/* account). Surfaces a shareable claim link the host sends to the  */}
      {/* vendor via Viber/Messenger/SMS/email/etc. — the vendor opens it, */}
      {/* registers a free vendor account, and applyClaimAutoLink fires:   */}
      {/* event_vendors.marketplace_vendor_id ← new vendor_profile_id.     */}
      {/* CLAUDE.md 2026-05-22 owner directive.                             */}
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
                Chat unlocks below. They can confirm details, upload
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
      ) : null}

      {/* ============================================================== */}
      {/* Section 2 — Status stepper                                       */}
      {/* ============================================================== */}
      <section aria-labelledby="status-heading" className="space-y-3">
        <h2
          id="status-heading"
          className="font-mono text-xs uppercase tracking-[0.18em] text-ink/65"
        >
          Status
        </h2>

        <ol className="grid grid-cols-5 gap-1 sm:gap-2" role="list">
          {STAGE_ORDER.map((s, idx) => {
            const reached =
              stage !== null && STAGE_ORDER.indexOf(stage) >= idx;
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
                  <Icon
                    aria-hidden
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                  />
                </div>
                <span
                  className={[
                    'text-[10px] leading-tight sm:text-xs',
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
            No payment progress recorded yet. Add a payment milestone below to
            start tracking.
          </p>
        ) : null}
      </section>

      {/* ============================================================== */}
      {/* Sections 3-6 — Two-column on desktop, stacked on mobile          */}
      {/* ============================================================== */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ----------------------------------------------------------- */}
        {/* Section 3 — Conversation                                     */}
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
        {/* Section 4 — Payments                                         */}
        {/* ----------------------------------------------------------- */}
        <section
          id="payments"
          aria-labelledby="payments-heading"
          className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              id="payments-heading"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <PiggyBank
                aria-hidden
                className="h-4 w-4 text-terracotta"
                strokeWidth={1.75}
              />
              Payments
            </h2>
            <Link
              href={`/dashboard/${eventId}/budget#vendor-${ev.vendor_id}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta-700 hover:text-terracotta-800"
            >
              <Plus aria-hidden className="h-3 w-3" strokeWidth={2} />
              Add milestone
            </Link>
          </header>

          {lineItems.length === 0 && payments.length === 0 ? (
            <p className="text-xs text-ink/55">
              No payment milestones added yet. Use the budget tracker to plan
              and record payments to {displayName}.
            </p>
          ) : (
            <>
              {lineItems.length > 0 ? (
                <ul className="space-y-2">
                  {lineItems.map((li) => {
                    const liAmount =
                      typeof li.amount_php === 'string'
                        ? Number(li.amount_php)
                        : li.amount_php;
                    const paid = paidByLineItem.get(li.line_item_id) ?? 0;
                    const settled =
                      Number.isFinite(liAmount) && paid >= Number(liAmount);
                    return (
                      <li
                        key={li.line_item_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream/80 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">
                            {li.label}
                          </p>
                          {li.due_date ? (
                            <p className="text-[10px] text-ink/55">
                              Due {formatPaymentDate(li.due_date)}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-ink">
                            {formatPHP(liAmount) ?? '—'}
                          </p>
                          <p
                            className={[
                              'font-mono text-[9px] uppercase tracking-[0.15em]',
                              settled ? 'text-emerald-700' : 'text-ink/45',
                            ].join(' ')}
                          >
                            {settled ? 'Paid' : 'Pending'}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {payments.length > 0 ? (
                <details className="rounded-lg bg-cream/40 px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-ink/70">
                    Payment history ({payments.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {payments.map((p) => {
                      const amt = formatPHP(p.amount_php);
                      return (
                        <li
                          key={p.payment_id}
                          className="flex items-center justify-between text-xs text-ink/75"
                        >
                          <span>
                            {formatPaymentDate(p.paid_at)}
                            {p.method ? ` · ${p.method}` : ''}
                          </span>
                          <span className="font-medium text-ink">{amt}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </section>

        {/* ----------------------------------------------------------- */}
        {/* Section 5 — Documents                                        */}
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
              {contracts.map((c) => (
                <li
                  key={c.contract_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream/80 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={c.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium text-ink hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                    >
                      {c.title}
                    </a>
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
              ))}
            </ul>
          )}
        </section>

        {/* ----------------------------------------------------------- */}
        {/* Section 6 — Schedules                                        */}
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
      {/* Section 7 — Package                                              */}
      {/* ============================================================== */}
      {/* No-op until event_vendor_packages table lands (Task #27). Renders */}
      {/* a calm empty-state so the surface is visible but doesn't crash    */}
      {/* the page. Once the table exists, this section will fetch + render  */}
      {/* the locked-in package details (deliverables, line items, terms).  */}
      <section
        id="package"
        aria-labelledby="package-heading"
        className="space-y-3 rounded-xl border border-dashed border-ink/15 bg-cream/40 p-5"
      >
        <header className="flex items-center justify-between gap-3">
          <h2
            id="package-heading"
            className="flex items-center gap-2 text-sm font-semibold text-ink/75"
          >
            <PackageIcon
              aria-hidden
              className="h-4 w-4 text-ink/45"
              strokeWidth={1.75}
            />
            Package details
          </h2>
        </header>
        <p className="text-xs text-ink/55">
          The package breakdown lands here once we ship the package builder.
          For now, see Documents above for the signed contract.
        </p>
        {ev.notes ? (
          <div className="rounded-lg bg-cream/70 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Your notes
            </p>
            <p className="mt-1 whitespace-pre-line text-xs text-ink/80">
              {ev.notes}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
