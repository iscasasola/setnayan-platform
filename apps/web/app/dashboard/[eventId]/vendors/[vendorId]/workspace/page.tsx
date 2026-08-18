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
// Deep-link anchors PRESERVED (other surfaces link to them, e.g. the
// Vendors-tab cards): #conversation · #documents · #payments.
// ============================================================================

import type { ReactNode } from 'react';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { lockRequestStateOf } from '@/lib/lock-request-state';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  BookmarkCheck,
  Hourglass,
  CalendarPlus,
  CheckCircle2,
  Circle,
  FileText,
  Info,
  LinkIcon,
  MessageCircle,
  Package as PackageIcon,
  Phone,
  PiggyBank,
  Receipt,
  Sparkles,
  UserCheck,
  Upload,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { PLAN_GROUPS, planGroupForCategory } from '@/lib/wedding-plan-groups';
import {
  formatCentavosPhp,
  VENDOR_PACKAGE_ITEM_SELECT,
  VENDOR_PACKAGE_SELECT,
  type VendorPackageItemRow,
  type VendorPackageRow,
} from '@/lib/vendor-packages';
import { AppointmentsSection } from '@/app/_components/appointments-section';
import {
  appointmentCategoriesFor,
  resolveAppointmentLabel,
  type AppointmentKind,
  type AppointmentTypePreset,
  type AppointmentView,
} from '@/lib/appointments';
import { updateVendorCosts } from '../../actions';
import { createAutoShareInviteAction } from './actions';
import { HostServiceDetails } from './_components/host-service-details';
import { parseRemovedItemIds, workspaceSections } from './package-sections';
import {
  readPricingSnapshot,
  snapshotChargeLines,
  type SnapshotChargeLine,
} from '@/lib/package-pricing-snapshot';
import { DepositReservation } from './_components/deposit-reservation';
import { ChangeOrderTrail, type ChangeOrderRow } from './_components/change-order-trail';
import { HandoverInbox, type HandoverRow } from './_components/handover-inbox';
import { fetchVendorBudgetSummary } from '@/lib/budget';
import { fetchPublishedMethodsForCouple } from '@/lib/vendor-payment-methods.server';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import {
  fetchPlanForCouple,
  fetchPlanProgressForCouple,
  fetchPolicyAcknowledgementForCouple,
  type PolicyAcknowledgement,
} from '@/lib/vendor-service-payment-schedules.server';
import type {
  PlanInstance,
  PlanProgress,
} from '@/lib/vendor-service-payment-schedules';
import { PaymentPlanStepper } from '@/app/_components/payment-plan-stepper';
import { ReservationTermsAck } from './_components/reservation-terms-ack';
// REMOVED 2026-07-26 (owner ruling — "all setnayan in app services are either on
// their exact location on the dashboard or on suites"): the first-party
// "Setnayan-as-a-vendor" order-and-pay path that used to live on this page
// (InlineCheckoutDrawer + fetchPlatformSettings + fetchOrdersForEvent, keyed by a
// runtime-synthesised `setnayan_service__{category}`) is gone. Setnayan's own
// services are bought where they LIVE — the suite (/dashboard/[eventId]/suite) or
// the service's own studio page — from an admin-priced catalog SKU. This page is
// now only ever a THIRD-PARTY vendor relationship: a deal the couple records and
// settles off-platform.
import { buildClaimUrl, fetchActiveAutoShareInvite } from '@/lib/vendor-invites';
import { ClaimLinkShare } from './_components/claim-link-share';
import { VendorProposalsCard } from './_components/vendor-proposals-card';
// Working folder — private-vs-shared per-vendor notes (Coordinator P4).
// Flag-gated (NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED, default OFF): the
// component itself returns null with ZERO queries while the flag is off, so
// today's page is byte-for-byte unchanged.
import { WorkingFolderNotes } from './_components/working-folder-notes';
import { QuoteBridge, type QuoteCandidate } from './_components/quote-bridge';
import {
  detectAmountsFromVendorMessages,
  shouldOfferQuoteLog,
  splitProposalToCosting,
} from '@/lib/quote-detection';
import type { ProposalLineItem } from '@/lib/vendor-proposals';
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
// Person-spine · Phase 2 · COUNSEL-GATED · FLAG-OFF. Renders null (no DB read)
// while NEXT_PUBLIC_PEOPLE_CONNECTIONS !== '1' — production-inert. Fed the true
// vendor_profiles id (ev.marketplace_vendor_id), never the event_vendors PK.
import { TrustedCircleBadge } from '../../_components/trusted-circle-badge';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  deriveBookingContractState,
  bookingContractStateLabel,
  type ContractStatus,
} from '@/lib/contracts';
// Relationship Workspace shell (flag-gated · 2026-07-11). When
// NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED is set, the same section JSX is
// re-grouped into the unified chat-first tabbed shell; otherwise the current
// long-scroll page renders byte-for-byte unchanged.
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';
import {
  RelationshipTabShell,
  type RelationshipTab,
} from '@/app/_components/relationship-tab-shell';
// Chat-tab embed — mirror the couple thread page (Chat tab = the live thread).
import { fetchMessages, fetchThreadById } from '@/lib/chat';
import { markThreadRead, sendChatMessage } from '@/lib/chat-actions';
import { getThreadBlockState } from '@/lib/chat-block';
import { withdrawInquiry } from '@/app/dashboard/[eventId]/messages/actions';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
// Call launcher is code-split (WebRTC · ssr:false) so the Call tab's bundle
// stays out of the initial page JS until that tab mounts — see the lazy loader.
import { ThreadCallLauncherLazy } from '@/app/_components/thread-call-launcher-lazy';
import { resolveThreadCallsEnabled } from '@/lib/thread-calls-gate';
import { ChatSafetyBanner } from '@/app/_components/chat-privacy-notice';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';
import { ChatThreadMenu } from '@/app/_components/chat-thread-menu';
// Completion handshake (Event Lifecycle Menu §6.1) — surface the couple's
// "confirm received" + review prompt inside the shell (flag-ON only). Reuses the
// same actions + review-state logic the standalone /review page uses.
import { reviewState, type ReviewState } from '@/lib/completion-handshake';
import { coupleConfirmReceived, coupleReportNonDelivery } from '../review/actions';

export const metadata = { title: 'Service workspace' };

type Props = {
  params: Promise<{ eventId: string; vendorId: string }>;
  // searchParams added for mark-read parity with the vendor side: the shell
  // reflects the active tab in `?tab=`, and a deep-link / quick-action landing
  // on a non-chat tab must NOT clear the unread badge. Read RAW below.
  searchParams: Promise<{ tab?: string }>;
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

export default async function VendorWorkspacePage({ params, searchParams }: Props) {
  const { eventId, vendorId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const relationshipShellEnabled = isRelationshipWorkspaceEnabled();

  // Primary fetch — event_vendors row, gated by RLS to host-on-event only.
  // `notFound()` covers both "row doesn't exist" and "row exists but RLS denied"
  // outcomes, since either way the host has no business viewing this URL.
  const { data: vendorRow, error: vendorErr } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id, event_id, category, vendor_name, contact_email, contact_phone, status, workspace_status, lock_request_state, lock_request_expires_at, total_cost_php, transport_php, food_allowance_php, deposit_paid_php, deposit_recorded_at, deposit_acknowledged_at, deposit_proof_url, notes, marketplace_vendor_id, manual_vendor_id, event_vendor_package_id, host_inclusions, covers_plan_groups, crew_size, crew_meal_covered, created_at',
    )
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (vendorErr || !vendorRow) notFound();

  // ── PR-H · IS THIS BOOKED, OR MERELY ASKED? ─────────────────────────────
  // The workspace is the screen a couple opens to manage a booking, and every
  // word on it — the "Locked" chip, the next-step rail, "hold the date" — was
  // written when reaching this page meant the booking existed. Under the
  // handshake it can be reached on an ASK, where none of that is true yet.
  // Derived ONCE here by the shared core and read below; deriving it twice on
  // one page is how the header and the rail come to disagree.
  const awaitingSupplier =
    lockRequestStateOf(
      {
        status: (vendorRow as { status?: string | null }).status ?? null,
        lock_request_state:
          (vendorRow as { lock_request_state?: string | null }).lock_request_state ?? null,
      },
      isLockHandshakeEnabled(),
    ) === 'requested';

  const ev = vendorRow as {
    vendor_id: string;
    event_id: string;
    category: string;
    vendor_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
    workspace_status: string | null;
    lock_request_state: string | null;
    lock_request_expires_at: string | null;
    total_cost_php: number | string | null;
    transport_php: number | string | null;
    food_allowance_php: number | string | null;
    deposit_paid_php: number | string | null;
    deposit_recorded_at: string | null;
    deposit_acknowledged_at: string | null;
    deposit_proof_url: string | null;
    notes: string | null;
    marketplace_vendor_id: string | null;
    manual_vendor_id: string | null;
    event_vendor_package_id: string | null;
    host_inclusions: string[] | null;
    covers_plan_groups: string[] | null;
    crew_size: number | null;
    crew_meal_covered: boolean | null;
    created_at: string;
  };

  // Crew-meal coverage context (2026-07-09): does the event have a crew-meal
  // provider booked (gates the "covered by crew meals" toggle on other vendors),
  // and how many meals does it cover (Σ crew_size of the vendors marked covered)?
  const { data: eventVendorCrewRows, error: eventVendorCrewRowsError } = await supabase
    .from('event_vendors')
    .select('vendor_id, category, crew_size, crew_meal_covered, marketplace_vendor_id')
    .eq('event_id', eventId);
  // ⚠ crew counts for this booking. Refused, the crew reads as zero, which on a
  // ⚠ meals-and-headcount surface is a number somebody plans catering against.
  if (eventVendorCrewRowsError) {
    logQueryError('VendorWorkspacePage.eventVendorCrewRows', eventVendorCrewRowsError, { eventId }, 'graceful_degrade');
  }
  const crewRows = (eventVendorCrewRows ?? []) as Array<{
    vendor_id: string;
    category: string;
    crew_size: number | null;
    crew_meal_covered: boolean | null;
    marketplace_vendor_id: string | null;
  }>;

  // "Quantity set by vendors" (owner 2026-07-09): a marketplace vendor DECLARES
  // its crew size on its listing — that's the source of truth. So crew_size flows
  // through automatically; the couple never has to re-key it. event_vendors.crew_size
  // is only the couple's optional OVERRIDE. Effective crew = override ?? the
  // vendor's largest listed crew_size (a vendor may list several services).
  const mpIds = Array.from(
    new Set(
      crewRows.map((r) => r.marketplace_vendor_id).filter((x): x is string => !!x),
    ),
  );
  const listingCrewByProfile = new Map<string, number>();
  if (mpIds.length > 0) {
    const { data: svcCrewRows, error: svcCrewRowsError } = await supabase
      .from('vendor_services')
      .select('vendor_profile_id, crew_size')
      .in('vendor_profile_id', mpIds)
      .not('crew_size', 'is', null);
    // ⚠ the service's own declared crew size. Refused, it falls back silently and the
    // ⚠ headcount above becomes the only source.
    if (svcCrewRowsError) {
      logQueryError('VendorWorkspacePage.svcCrewRows', svcCrewRowsError, { eventId }, 'graceful_degrade');
    }
    for (const s of (svcCrewRows ?? []) as Array<{
      vendor_profile_id: string;
      crew_size: number | null;
    }>) {
      const cur = listingCrewByProfile.get(s.vendor_profile_id) ?? 0;
      if ((s.crew_size ?? 0) > cur) listingCrewByProfile.set(s.vendor_profile_id, s.crew_size ?? 0);
    }
  }
  const effectiveCrew = (r: {
    crew_size: number | null;
    marketplace_vendor_id: string | null;
  }): number | null =>
    r.crew_size ??
    (r.marketplace_vendor_id ? listingCrewByProfile.get(r.marketplace_vendor_id) ?? null : null);

  const hasCrewMealProvider = crewRows.some((r) => r.category === 'crew_meals');
  const coveredCrewMeals = crewRows.reduce(
    (sum, r) => sum + (r.crew_meal_covered ? effectiveCrew(r) ?? 0 : 0),
    0,
  );
  // This vendor's crew size, pre-filled from its listing so the couple sees the
  // vendor-declared number (editable as an override).
  const thisVendorCrew = effectiveCrew(ev);

  // Change-Order Trail (Wave 3) — the both-acknowledged add-on/removal log for
  // this booking. RLS-gated to couple-on-event reads. Rendered immutable-trail
  // style; the couple raises + responds to vendor-raised orders via the RPCs.
  const { data: changeOrderRows, error: changeOrderRowsError } = await supabase
    .from('vendor_change_orders')
    .select(
      'change_order_id, raised_by, title, description, delta_amount_php, proposed_due_date, status, acknowledged_at, decline_reason, created_at',
    )
    .eq('event_vendor_id', ev.vendor_id)
    .order('created_at', { ascending: false });
  // ⚠ a SUPPLIER'S REQUEST to change the agreed deal. Refused, the couple sees none
  // ⚠ waiting — and the supplier is left waiting on an answer that never appears.
  // ⚠ The cost of this refusal falls on somebody who cannot see this page.
  if (changeOrderRowsError) {
    logQueryError('VendorWorkspacePage.changeOrderRows', changeOrderRowsError, { eventId }, 'graceful_degrade');
  }
  const changeOrders = (changeOrderRows ?? []) as ChangeOrderRow[];

  // Delivery Handover (Wave 4) — the vendor-posted deliverables for this
  // booking. RLS-gated to couple-on-event reads (current_event_ids). The couple
  // confirms receipt via the single-winner acknowledge_handover RPC.
  const { data: handoverRows, error: handoverRowsError } = await supabase
    .from('booking_handovers')
    .select(
      'handover_id, kind, label, payload, status, delivered_at, couple_acknowledged_at',
    )
    .eq('event_vendor_id', ev.vendor_id)
    .order('created_at', { ascending: false });
  // ⚠ 🚨 THE COUPLE'S DELIVERY LOOKS UNDELIVERED. These rows ARE the supplier's
  // ⚠ handover — the gallery link, the files, the thing the couple is waiting for.
  // ⚠ `?? []` on a refused read empties the list, so a delivered wedding gallery
  // ⚠ reads as never delivered, on the most emotional asset in the product.
  // ⚠ 🔑 Same family as the couple's saved plans: an absence that reads as their
  // ⚠ own things being gone, not as an empty list.
  if (handoverRowsError) {
    logQueryError('VendorWorkspacePage.handoverRows', handoverRowsError, { eventId }, 'graceful_degrade');
  }
  const handovers = (handoverRows ?? []) as HandoverRow[];
  // Offer the "also mark delivered" opt-in only when the booking hasn't already
  // reached delivered/complete (matches updateVendorStatus's own emit guard).
  const canAdvanceToDelivered = ev.status !== 'delivered' && ev.status !== 'complete';

  // DIY parity (2026-06-11): "also covers" options for the host-authored
  // links on a manual vendor — every plan group except this vendor's own.
  const ownGroupId = planGroupForCategory(ev.category as VendorCategory);
  const coverOptions = PLAN_GROUPS.filter((g) => g.id !== ownGroupId).map((g) => ({
    id: g.id as string,
    label: g.label,
  }));

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

  // Couple-visibility fix (2026-07-01): the couple's OWN picked-vendor
  // marketplace HEADER (business_name / logo / city / slug),
  // SERVICES, and CONTACT are resolved via the ADMIN client. Ownership is
  // already proven above — the event_vendors row was fetched through the couple
  // RLS client keyed on (vendor_id, event_id), and a miss/deny hits notFound().
  // WHY: a vendor a couple added-manually + had claim (the #2463/#2470 flow) is
  // real but UNPUBLISHED (is_published=false); the public-read RLS on
  // vendor_profiles / vendor_services (USING is_published=TRUE) returns nothing,
  // so the header + services + contact came back empty and the couple saw their
  // just-connected vendor stripped. This mirrors the proven-ownership admin path
  // already used for direct-pay methods (fetchPublishedMethodsForCouple, below).
  // REVIEWS stay on the couple RLS client — vendor_reviews / vendor_review_stats
  // are public-read for marketplace consumption and carry no is_published gate.
  // This does NOT widen non-owner visibility: only this couple's own event's
  // booked vendor is read, and only when the ownership-proven row exists.
  const marketplaceAdmin = createAdminClient();
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

    // Marketplace profile — logo, business name, city, slug. ADMIN read
    // (ownership proven above) so an unpublished claimed vendor still hydrates
    // the header.
    //
    // ⚠ FIXED 2026-07-26 — this select also asked for `is_setnayan_service`, a
    // column that DOES NOT EXIST on `vendor_profiles`. It is a computed column of
    // the `vendor_market_stats` VIEW (an array-membership test over
    // `vendor_profiles.services`, migration 20260607020000), so PostgREST failed
    // the WHOLE query with a hard 42703 and `data` came back null — the header
    // silently lost the business name, logo, city and slug for every marketplace
    // pick, not just the attribution it was added for. Invisible in production
    // only because no `event_vendors` row has a `marketplace_vendor_id` yet.
    // It is NOT re-pointed at the view: the "Provided by Setnayan" attribution it
    // fed was removed together with the first-party buy path (owner ruling
    // 2026-07-26), and prod has 0 profiles with `is_setnayan_service = true`.
    ev.marketplace_vendor_id
      ? marketplaceAdmin
          .from('vendor_profiles')
          // ⚠ 2026-07-26 · #3769 removed `is_setnayan_service` from this list
          // but LEFT `city`, which also does not exist on vendor_profiles (the
          // column is `location_city`). One unknown column 42703s the WHOLE
          // row, so the fix was incomplete and this header STILL lost
          // business_name / business_slug / logo_url for every marketplace pick.
          .select('business_name, business_slug, logo_url, location_city')
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
    // own 42P01 / 42703 graceful-degrade. Services + contact go through the
    // ADMIN client (couple's OWN pick, ownership proven above → unpublished
    // claimed vendors still hydrate). Reviews stay on the RLS client (public-
    // read, no is_published gate).
    ev.marketplace_vendor_id
      ? fetchMarketplaceServices(marketplaceAdmin, ev.marketplace_vendor_id)
      : Promise.resolve([]),
    ev.marketplace_vendor_id
      ? fetchMarketplaceContact(marketplaceAdmin, ev.marketplace_vendor_id)
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
          // ANTI-FRAUD (2026-07-05): trusted aggregate fallback for the no-
          // marketplace-vendor branch (0/0 → hero renders "No reviews yet").
          trustedStats: {
            vendor_profile_id: '',
            trusted_avg_rating: 0,
            trusted_review_count: 0,
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

  // Per-booking PAYMENT PLAN (Phase 2 PR-B) — the installments frozen at lock
  // from the booked service's schedule template. Couple-RLS-scoped (the plan is
  // the couple's own booking), so the authed client reads it directly. null =
  // not locked / pre-PR-B; [] = locked but no schedule (direct-pay fallback);
  // [...] = render the installment list above the how-to-pay sheet. Best-effort.
  let paymentPlan: PlanInstance[] | null = null;
  try {
    paymentPlan = await fetchPlanForCouple({
      authedClient: supabase,
      eventId,
      eventVendorId: ev.vendor_id,
    });
  } catch {
    paymentPlan = null;
  }

  // Per-booking PLAN PROGRESS (Phase 2 PR-D) — the same frozen installments
  // folded with the couple's logged payments into per-installment states
  // (due / pending / paid), plus the plan-level cleared_at. Drives the progress
  // STEPPER that replaces the flat PR-B installment list. Couple-RLS read (both
  // tables are the couple's own). Best-effort.
  let planProgress: PlanProgress = { steps: null, clearedAt: null };
  try {
    planProgress = await fetchPlanProgressForCouple({
      authedClient: supabase,
      eventId,
      eventVendorId: ev.vendor_id,
    });
  } catch {
    planProgress = { steps: null, clearedAt: null };
  }

  // No-Show Downpayment Protection — the frozen reservation-terms acknowledgement
  // (when the booking locked under a protected downpayment policy). Read-only
  // here; couple-RLS read of the couple's own immutable evidence row. Best-effort.
  let policyAck: PolicyAcknowledgement | null = null;
  try {
    policyAck = await fetchPolicyAcknowledgementForCouple({
      authedClient: supabase,
      eventId,
      eventVendorId: ev.vendor_id,
    });
  } catch {
    policyAck = null;
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

  // Booking↔contract derived indicator (2026-06-22). The couple's contract
  // fetch above already excludes drafts (RLS + .neq('status','draft')), so from
  // here this resolves to 'none' / 'awaiting' / 'signed' — an honest read of
  // what the couple can actually see, derived from the linked contracts.
  const contractState = deriveBookingContractState(
    contracts.map((c) => c.status as ContractStatus),
  );

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
    location_city: string | null;
  } | null;

  const chatThread = (chatThreadRes.data ?? null) as { thread_id: string } | null;

  // --------------------------------------------------------------------------
  // The booked service/package — the HERO of this page.
  //
  // Two-hop FK: event_vendors.event_vendor_package_id →
  // event_vendor_packages.booking_id → .package_id → vendor_packages +
  // vendor_package_items. Only 'locked' bookings are treated as a live header
  // (mirrors lib/budget.ts). Best-effort on a MISSING row: any null result
  // falls back to the category-label service title + host notes, never a 500.
  //
  // ⚠ A FAILED READ IS NOT A MISSING ROW. The booking row carries
  // `customizations_json`, i.e. which lines the couple REMOVED, and "no row"
  // and "the query errored" mean opposite things there: the first is a package
  // that isn't booked, the second is removals we cannot see. Swallowing the
  // error would print removed lines under "What's included" — so this read
  // throws. (A swallowed select error shipped a destructive bug in this repo
  // on 2026-07-27; the same shape, one table over.)
  // --------------------------------------------------------------------------
  let packageHeader: {
    name: string;
    description: string | null;
    priceCentavos: number | null;
  } | null = null;
  // 🔧 TWO LISTS, and neither re-derives the inclusion rule here — see
  // ./package-sections for the ruling and the shared helper.
  let packageIncludedItems: ReadonlyArray<VendorPackageItemRow> = [];
  let packageAddOnItems: ReadonlyArray<VendorPackageItemRow> = [];
  /** The couple's charged picks + extra hours, itemised from the lock snapshot. */
  let packageChoiceLines: ReadonlyArray<SnapshotChargeLine> = [];

  if (ev.event_vendor_package_id) {
    const { data: bookingRow, error: bookingErr } = await supabase
      .from('event_vendor_packages')
      // `customizations_json` is the whole point: `removed_item_ids` lives in
      // it, and without it this page had no way to know a line was removed.
      .select(
        'package_id, status, total_locked_centavos, customizations_json',
      )
      .eq('booking_id', ev.event_vendor_package_id)
      .maybeSingle();
    if (bookingErr) throw new Error(bookingErr.message);
    const booking = bookingRow as {
      package_id: string;
      status: string;
      total_locked_centavos: number | string | null;
      customizations_json: unknown;
    } | null;

    if (booking && booking.status === 'locked' && booking.package_id) {
      const [{ data: pkgRowRaw }, { data: itemsRaw }] = await Promise.all([
        supabase
          .from('vendor_packages')
          // The canonical constant, not a hand-typed subset — the row is handed
          // whole to `workspaceSections`, so it has to BE a package row.
          .select(VENDOR_PACKAGE_SELECT)
          .eq('package_id', booking.package_id)
          .maybeSingle(),
        supabase
          .from('vendor_package_items')
          // The canonical list, not a hand-typed copy of it. The old literal
          // asked for four columns and omitted both `item_id` — without which
          // no removal id can ever match a line — and `is_required`, which
          // `isRemovableItem` reads to decide that a MANDATORY line survives a
          // removal id. An absent column reads as `undefined` → falsy, so a
          // required line carrying a stale removal id would have vanished from
          // this page while the vendor was still delivering and charging for
          // it. `parent_option_id` used to be appended here; it is inside the
          // constant now (the charge path needs it on every money read), so
          // appending it would ask PostgREST for the same column twice.
          .select(VENDOR_PACKAGE_ITEM_SELECT)
          .eq('package_id', booking.package_id)
          .order('display_order', { ascending: true }),
      ]);

      const pkg = pkgRowRaw as VendorPackageRow | null;

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

        // A FOLLOW-UP is in neither list. `workspaceSections` drops them (the
        // DB forces every follow-up to `is_default_included = FALSE`, which is
        // also the add-on shape, so the add-on section is exactly where an
        // unguarded filter would leak "which style of lechon?" detached from
        // the lechon), but the filter stays here too: it is what makes the
        // object handed over already free of them.
        const lines = ((itemsRaw ?? []) as VendorPackageItemRow[]).filter(
          (it) => it.parent_option_id == null,
        );
        const removedItemIds = parseRemovedItemIds(booking.customizations_json);
        const { included, addOns } = workspaceSections(
          { ...pkg, items: lines },
          removedItemIds,
        );
        packageIncludedItems = included;
        packageAddOnItems = addOns;
        // 🧾 THE CHOICES BEHIND THE TOTAL — from the frozen snapshot already on
        // the booking row this page loads, so no extra query.
        //
        // `lockedTotal` above now contains follow-up option deltas, every pick
        // on a pick-N line, and extra hours, and none of it appeared anywhere on
        // this surface. The extra hours matter most here: this is the vendor's
        // own workspace, and they were never told about time the couple bought
        // and paid for.
        packageChoiceLines = snapshotChargeLines(
          readPricingSnapshot(
            (booking.customizations_json as { pricing_snapshot?: unknown } | null)
              ?.pricing_snapshot,
          ),
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Derived display values
  // --------------------------------------------------------------------------
  const displayName = marketplaceProfile?.business_name ?? ev.vendor_name;
  const logoUrl = safeHttpUrl(marketplaceProfile?.logo_url);
  const categoryLabel =
    (VENDOR_CATEGORY_LABEL as Record<string, string>)[ev.category] ?? 'Service';

  // Service-scoped hero: package name is the service title; the category is the
  // fallback when this pick isn't tied to a locked package (manual/off-platform).
  const serviceTitle = packageHeader?.name ?? categoryLabel;
  const serviceDescription = packageHeader?.description ?? null;
  const attribution = `by ${displayName}`;

  // --------------------------------------------------------------------------
  // 🚫 REMOVED 2026-07-26 — "Setnayan as a vendor" order-and-pay (was: owner
  // directive 2026-06-04, interim).
  //
  // This page used to synthesise a `setnayan_service__{ev.category}` service_key
  // at RUNTIME and mount an InlineCheckoutDrawer against it, pricing the order
  // from a three-tier precedence whose LAST tier was `ev.total_cost_php` — a
  // number the COUPLE types into the Costing form below. That made it the third
  // instance of "a value the customer can edit decides what they are charged"
  // (after `events.event_type`/SEC-5 and the latent `events.estimated_pax`).
  //
  // The owner's ruling deletes the path outright rather than repricing it: every
  // in-app Setnayan service is sold from its OWN location — the suite
  // (/dashboard/[eventId]/suite) or its studio page — as an ordinary catalog SKU
  // with an admin-set price in `platform_retail_catalog_v2`. Monogram and Papic
  // already work that way.
  //
  // `event_vendors.total_cost_php` stays exactly where it is. It is the couple's
  // own BUDGET record, which is its real job; it simply stops being a price.
  //
  // The matching server resolver was removed from `lib/order-charge-authority.ts`
  // in the same change, so the key is inert on the POST path too.
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Vendor-authored quote bridge (host-search improvement #1).
  //
  // ADVISORY ONLY. Scan recent VENDOR chat messages + the vendor's structured
  // proposals for a ₱ figure the couple can log into the Costing form with one
  // tap + an editable confirm modal. The detector never writes — the modal
  // posts to the existing updateVendorCosts. Every fetch is best-effort and
  // null-tolerant: a failure (or no thread / pre-migration table) simply means
  // no affordance shows.
  // --------------------------------------------------------------------------
  let chatQuoteAmounts: number[] = [];
  if (chatThread) {
    try {
      const { data: msgRows, error: msgRowsError } = await supabase
        .from('chat_messages')
        .select('sender_role, body, created_at')
        .eq('thread_id', chatThread.thread_id)
        .order('created_at', { ascending: false })
        .limit(20);
      // ⚠ A SWALLOW INSIDE A SWALLOW. This read is unbound AND sits in a try whose
      // catch resolves the amounts to []. Both arms make the same claim — that the
      // supplier quoted nothing in chat — by two different routes, and a quote the
      // couple was shown yesterday simply stops appearing.
      // 🔑 The fail-soft is defensible (a quote-detection helper must not take the
      // page down) but a DELIBERATE swallow still has to be visible.
      if (msgRowsError) {
        logQueryError('VendorWorkspacePage.msgRows', msgRowsError, { eventId }, 'graceful_degrade');
      }
      chatQuoteAmounts = detectAmountsFromVendorMessages(
        (msgRows ?? []) as Array<{
          sender_role: string | null;
          body: string | null;
          created_at: string | null;
        }>,
      );
    } catch {
      chatQuoteAmounts = [];
    }
  }
  const showChatQuoteChip = shouldOfferQuoteLog(chatQuoteAmounts, serviceCostNum);

  // Structured proposals the couple can SEE (sent/viewed/accepted — drafts
  // never cross RLS). Mirrors VendorProposalsCard's query so we only ever offer
  // a "Log as service price" action for a proposal already visible to them.
  let proposalCandidates: QuoteCandidate[] = [];
  if (ev.marketplace_vendor_id) {
    try {
      const { data: propRows, error: propRowsError } = await supabase
        .from('vendor_proposals')
        .select('proposal_id, title, status, total_centavos, line_items')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', ev.marketplace_vendor_id)
        .in('status', ['sent', 'viewed', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(3);
      // ⚠ the supplier's proposals. Refused, none are shown, so a quote awaiting the
      // ⚠ couple's answer is invisible to them.
      if (propRowsError) {
        logQueryError('VendorWorkspacePage.propRows', propRowsError, { eventId }, 'graceful_degrade');
      }
      proposalCandidates = ((propRows ?? []) as Array<{
        proposal_id: string;
        title: string | null;
        total_centavos: number | null;
        line_items: ProposalLineItem[] | null;
      }>)
        .map((p) => {
          const split = splitProposalToCosting(p.total_centavos, p.line_items);
          return {
            id: p.proposal_id,
            label: p.title?.trim() || 'Proposal',
            source: 'proposal' as const,
            servicePesos: split.servicePesos,
            transportPesos: split.transportPesos,
            foodPesos: split.foodPesos,
          };
        })
        // Only offer proposals that carry a real number to log.
        .filter(
          (c) => c.servicePesos + (c.transportPesos ?? 0) + (c.foodPesos ?? 0) > 0,
        );
    } catch {
      proposalCandidates = [];
    }
  }

  // Appointments (Relationship Workspace + Appointments, PR 12) — the two-sided
  // scheduler for THIS booked vendor. Only a connected (marketplace) vendor has
  // an "other side" to confirm, so the section is skipped for manual/off-platform
  // vendors (coordinated externally). One cheap reference read of the category →
  // meeting-type catalog + this (event, vendor) row set, both under couple RLS.
  let appointmentPresets: AppointmentTypePreset[] = [];
  let appointmentViews: AppointmentView[] = [];
  if (ev.marketplace_vendor_id) {
    const apptCats = appointmentCategoriesFor([ev.category]);
    const [{ data: catalogRows }, { data: apptRows }] = await Promise.all([
      supabase
        .from('appointment_type_catalog')
        .select('category, type, label, default_mode, default_duration_min, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('event_appointments')
        .select(
          'appointment_id, kind, type, custom_label, location, scheduled_at, duration_min, status, initiated_by, note, thread_id',
        )
        .eq('event_id', eventId)
        .eq('vendor_profile_id', ev.marketplace_vendor_id)
        .order('created_at', { ascending: false }),
    ]);
    const catalog = (catalogRows ?? []) as Array<{
      category: string;
      type: string;
      label: string;
      default_mode: AppointmentKind;
      default_duration_min: number;
    }>;
    const typeLabels: Record<string, string> = {};
    for (const r of catalog) typeLabels[r.type] = r.label;
    appointmentPresets = catalog
      .filter((r) => apptCats.includes(r.category))
      .map((r) => ({
        type: r.type,
        label: r.label,
        default_mode: r.default_mode,
        default_duration_min: r.default_duration_min,
      }));
    appointmentViews = ((apptRows ?? []) as Array<Omit<AppointmentView, 'label'>>).map((a) => ({
      ...a,
      label: resolveAppointmentLabel(a, typeLabels),
    }));
  }

  // ------------------------------------------------------------------------
  // Section variables — each holds the EXACT JSX previously rendered inline in
  // the long-scroll return. Flag OFF renders them in the original order inside
  // the original wrappers (byte-identical); flag ON re-groups them into the
  // RelationshipTabShell tabs. Nothing INSIDE any section changed.
  // ------------------------------------------------------------------------

  const backNav = (
      <Link
        href={`/dashboard/${eventId}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/65 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to event home
      </Link>
  );

  const heroSection = (
      <section
        aria-labelledby="vendor-workspace-header"
        className="rounded-2xl border border-success-300/40 bg-success-50/40 p-5 sm:p-6"
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
                {marketplaceProfile?.location_city
                  ? ` · ${marketplaceProfile.location_city}`
                  : ''}
              </p>
            </div>
          </div>

          {/* PR-H · a green "Locked" over a supplier who has not answered is the
              single most misleading thing this page could say — it is the word
              the couple would quote back at us. */}
          {awaitingSupplier ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warn-900">
              <Hourglass aria-hidden className="h-3 w-3" strokeWidth={2} />
              Asked
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-success-800">
              <BookmarkCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
              Locked
            </span>
          )}
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
          {/* Cancel / dispute. The `!isSetnayanService &&` guard that used to
              wrap this was dropped 2026-07-26: it existed to hide "cancel this
              booking" / "raise a dispute" on a service Setnayan itself provided
              (you don't dispute your own platform). With the first-party path
              gone, this page is always a third-party vendor relationship, so the
              affordance is always the right one. */}
          {(() => {
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
  );

  // The manual-vendor fallback below fires only when the package contributed NO
  // lines at all — the same condition as before the two lists were split apart.
  const hasPackageLines =
    packageIncludedItems.length + packageAddOnItems.length > 0;

  const includedSection =
      packageIncludedItems.length > 0 ? (
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
            {packageIncludedItems.map((it) => (
              <li
                key={it.item_id}
                className="flex items-start gap-2 text-sm text-ink/80"
              >
                {/* One list, one meaning: every line here IS being delivered.
                    The dimmed-tick + " (optional add-on)" variant is gone —
                    add-ons have their own section below, and its heading
                    carries what the inline suffix used to have to. */}
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                  strokeWidth={1.75}
                />
                <span>{it.service_description}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : !hasPackageLines && ev.manual_vendor_id && !ev.marketplace_vendor_id ? (
        /* DIY parity (owner doctrine 2026-06-11): a manual vendor has no
           vendor-authored package, so the HOST describes the order — what's
           included + which other plan categories it covers. The covers links
           flow to the Shortlist card chips + Compare inclusions. */
        <HostServiceDetails
          eventId={eventId}
          vendorId={ev.vendor_id}
          initialInclusions={ev.host_inclusions ?? []}
          initialCovers={ev.covers_plan_groups ?? []}
          options={coverOptions}
        />
      ) : null;

  /* The vendor's optional add-ons on this package, in their OWN labelled
     section — never folded into "What's included", never hidden. On a
     service-detail view "what else this vendor offers on this package" is live,
     useful context, and the owner's design models the couple side as
     Included · add-ons · requests.

     The copy names the STATUS and stops there: no CTA, because there is no
     purchase path for add-ons yet and an invitation would promise something the
     product cannot deliver; and no peso figure, because
     `replacement_value_centavos` is a replacement VALUE and printing one beside
     a line that was never billed reads as a charge.

     No count in the heading — no heading on this page carries one. */
  const addOnsSection =
      packageAddOnItems.length > 0 ? (
        <section
          aria-labelledby="add-ons-heading"
          className="rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6"
        >
          <h2
            id="add-ons-heading"
            className="mb-2 flex items-center gap-2 font-display text-lg italic text-ink"
          >
            <Circle aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
            Not included
          </h2>
          <p className="mb-3 text-xs text-ink/55">
            Optional extras {displayName} offers on this package. They
            weren&apos;t part of what you booked, and nothing was charged for
            them.
          </p>
          <ul className="space-y-2">
            {packageAddOnItems.map((it) => (
              <li
                key={it.item_id}
                className="flex items-start gap-2 text-sm text-ink/70"
              >
                <Circle
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink/30"
                  strokeWidth={1.75}
                />
                <span>{it.service_description}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null;

  /* 🧾 THE COUPLE'S CHOICES — picks and extra hours, itemised from the lock
     snapshot. This is the half of the booking the vendor could not see: the
     locked total already contained these charges, and nothing on any surface
     named them. Extra hours especially — the vendor is owed time here.

     Amounts ARE printed, unlike the add-ons section above, and the reason is
     the opposite one: these were charged. A ₱0 pick still shows, because a
     choice the vendor must honour is delivery information whether or not it
     cost anything. */
  const choicesSection =
      packageChoiceLines.length > 0 ? (
        <section
          aria-labelledby="choices-heading"
          className="rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6"
        >
          <h2
            id="choices-heading"
            className="mb-2 flex items-center gap-2 font-display text-lg italic text-ink"
          >
            <Circle aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
            Their choices
          </h2>
          <p className="mb-3 text-xs text-ink/55">
            What was picked when this package was locked, at the prices agreed
            then. These are part of the locked total.
          </p>
          <ul className="space-y-2">
            {packageChoiceLines.map((line) => (
              <li
                key={line.key}
                className="flex items-start justify-between gap-3 text-sm text-ink/75"
              >
                <span className="min-w-0 flex-1">
                  {line.label}
                  {line.detail ? (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                      {line.detail}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-xs text-ink/70">
                  {line.amountCentavos > 0
                    ? `+${formatCentavosPhp(line.amountCentavos)}`
                    : 'Included'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null;

  const statusSection = (
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
                      ? 'border-success-400 bg-success-50 text-success-700'
                      : 'border-ink/15 bg-cream text-ink/30',
                    isCurrent ? 'ring-2 ring-success-300/60 ring-offset-2' : '',
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

          {/*
            Payment plan PROGRESS STEPPER (Phase 2 PR-D — replaces the flat
            PR-B installment list). When the booked service carried a payment
            schedule, finalizeVendor froze it into a per-booking plan at lock.
            The stepper folds those installments with the couple's logged
            payments into per-installment states (due → pending → paid) and
            crowns the list with a "cleared" banner once the vendor settles the
            whole plan. When there's no plan yet (not locked / pre-PR-B) the
            stepper is omitted and the existing direct-pay UI below carries the
            "pay the vendor directly" guidance, unchanged. A locked-but-no-
            schedule booking ([] steps) still renders the banner once cleared.
          */}
          {planProgress.steps !== null &&
          (planProgress.steps.length > 0 || planProgress.clearedAt) ? (
            <div className="space-y-2 rounded-lg border border-ink/10 bg-white/60 p-4">
              <p className="text-xs font-semibold text-ink">
                Payment plan{planProgress.isDefaultSeeded ? ' (estimated)' : ''}
              </p>
              {planProgress.steps.length > 0 ? (
                planProgress.isDefaultSeeded ? (
                  <p className="text-[11px] text-ink/55">
                    {displayName} hasn&apos;t set payment terms yet, so this is a
                    typical 50/50 estimate. Confirm the amounts and dates with
                    {' '}
                    {displayName} before paying.
                  </p>
                ) : (
                  <p className="text-[11px] text-ink/55">
                    {displayName} set up this plan. Pay each installment using the
                    methods below; {displayName} confirms each as received.
                  </p>
                )
              ) : null}
              <PaymentPlanStepper
                steps={planProgress.steps}
                clearedAt={planProgress.clearedAt}
              />
            </div>
          ) : null}

          {/*
            No-Show Downpayment Protection — the frozen reservation terms the
            couple acknowledged at lock, rendered read-only beside the plan. The
            snapshot is immutable evidence (a later vendor policy edit can't
            rewrite it). Only shows when the booking locked under a protected
            downpayment policy.
          */}
          {policyAck ? <ReservationTermsAck ack={policyAck} vendorName={displayName} /> : null}

          {/*
            Deposit Reservation Lock-Free — record a deposit to HOLD the date
            the instant it's logged, distinct from a cleared payment, with a
            vendor-acknowledgement handshake. Setnayan never holds the money;
            recording does not change the order status (orthogonal markers).
          */}
          <DepositReservation
            eventId={eventId}
            vendorId={ev.vendor_id}
            vendorName={displayName}
            depositRecordedAt={ev.deposit_recorded_at}
            depositAcknowledgedAt={ev.deposit_acknowledged_at}
            depositProofUrl={ev.deposit_proof_url}
          />

          {/*
            Change-Order Trail — the both-acknowledged add-on/removal log. The
            couple raises a change order; the vendor accepts/declines on their
            client page. On accept the delta settles into the budget ledger.
            Setnayan never holds the money — the amount is the couple's record.
          */}
          <ChangeOrderTrail
            eventId={eventId}
            vendorId={ev.vendor_id}
            vendorName={displayName}
            changeOrders={changeOrders}
          />

          {/*
            Delivery Handover — the vendor posted finished work (gallery link /
            proof image / note / sign-off); the couple confirms receipt here.
            Acknowledge is a single-winner RPC; confirming can also mark the
            booking delivered (reuses the existing review-request emit).
          */}
          <HandoverInbox
            eventId={eventId}
            vendorId={ev.vendor_id}
            vendorName={displayName}
            handovers={handovers}
            canAdvanceToDelivered={canAdvanceToDelivered}
          />

          {vendorBudgetSummary ? (
            <VendorItemizationCard
              summary={vendorBudgetSummary}
              eventId={eventId}
              variant="embed"
              directPayMethods={directPayMethods}
              installments={paymentPlan}
            />
          ) : (
            <p className="text-xs text-ink/55">
              No payment milestones added yet. Add a line item or log a payment
              as money moves to {displayName}.
            </p>
          )}
        </div>
      </section>
  );

  const conversationSection = (
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
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-terracotta/30 bg-cream px-3 py-2 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
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
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-terracotta/30 bg-cream px-3 py-2 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
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
  );

  const documentsSection = (
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
            <div className="flex items-center gap-2">
              {/* Derived contract indicator (2026-06-22) — shows this booking's
                  contract status at a glance, linking to the contract. */}
              <span
                className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]',
                  contractState === 'signed'
                    ? 'bg-success-100 text-success-800'
                    : contractState === 'awaiting'
                      ? 'bg-success-50 text-success-700'
                      : 'bg-ink/10 text-ink/60',
                ].join(' ')}
              >
                {bookingContractStateLabel(contractState)}
              </span>
              <Link
                href={`/dashboard/${eventId}/contracts`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta-700 hover:text-terracotta-800"
              >
                <Upload aria-hidden className="h-3 w-3" strokeWidth={2} />
                Manage
              </Link>
            </div>
          </header>

          {!ev.marketplace_vendor_id ? (
            <p className="text-xs text-ink/55">
              Documents flow through the marketplace profile. This vendor
              isn&rsquo;t connected yet, so files aren&rsquo;t available here.
            </p>
          ) : contracts.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-ink/55">
                No contracts uploaded yet. {displayName} can upload PDFs from
                their dashboard for you to keep on file.
              </p>
              {/* Booking→contract (2026-06-22): couples can't upload contracts
                  (vendors do), so the start-a-contract path is to ask the vendor
                  in the thread. Deep-links straight to the conversation. */}
              <Link
                href={conversationHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta/30 bg-terracotta/[0.04] px-3 py-1.5 text-[11px] font-medium text-terracotta-700 transition hover:bg-terracotta/[0.08]"
              >
                <MessageCircle aria-hidden className="h-3 w-3" strokeWidth={2} />
                Ask {displayName} for a contract
              </Link>
            </div>
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
                        ? 'bg-success-100 text-success-800'
                        : c.status === 'cancelled'
                          ? 'bg-danger-100 text-danger-800'
                          : 'bg-success-50 text-success-700',
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
  );

  const proposalsCard = (
        <VendorProposalsCard
          eventId={eventId}
          marketplaceVendorId={ev.marketplace_vendor_id}
          displayName={displayName}
        />
  );

  const schedulesSection = (
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
  );

  const appointmentsSection =
      ev.marketplace_vendor_id ? (
        <AppointmentsSection
          role="couple"
          eventId={eventId}
          vendorProfileId={ev.marketplace_vendor_id}
          returnPath={`/dashboard/${eventId}/vendors/${ev.vendor_id}/workspace`}
          threadId={chatThread?.thread_id ?? null}
          currentUserId={user.id}
          counterpartyName={displayName}
          presets={appointmentPresets}
          appointments={appointmentViews}
        />
      ) : null;

  const marketplaceInfoSection =
      ev.marketplace_vendor_id ? (
        <>
          {/* Person-spine Phase 2 (flag-off · counsel-gated): trusted-circle
              signal for THIS marketplace vendor. Renders null in production
              (flag off ⇒ no DB read) and whenever there's no circle trust, so
              this mount is inert. `ev.marketplace_vendor_id` is the true
              vendor_profiles id (proven above by the ownership-scoped fetch). */}
          <TrustedCircleBadge
            eventId={eventId}
            vendorProfileId={ev.marketplace_vendor_id}
          />
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
        </>
      ) : null;

  // Costing — the host's own 3-line budget record for this vendor.
  //
  // This used to be the ELSE arm of an `isSetnayanService ? … : …` ternary whose
  // other arm was the "Managed by Setnayan" pay card (a runtime-keyed
  // InlineCheckoutDrawer). That arm was deleted 2026-07-26 on the owner ruling —
  // see the block comment above `const stage` — so Costing is now unconditional,
  // which is what it always was for every real row.
  const paymentModeSection = (
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

        {/* Vendor-authored quote bridge — calm, advisory chips that open an
            editable confirm modal; nothing saves without the couple's tap. */}
        <div className="mb-4">
          <QuoteBridge
            eventId={eventId}
            vendorId={ev.vendor_id}
            chatAmountsPesos={chatQuoteAmounts}
            proposalCandidates={proposalCandidates}
            currentServicePesos={serviceCostNum || null}
            currentTransportPesos={transportNum || null}
            currentFoodPesos={foodNum || null}
            showChatChip={showChatQuoteChip}
          />
        </div>

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

          {/* Crew-meal coverage (2026-07-09). On the crew-meal PROVIDER: the
              derived meal count. On every OTHER vendor: its crew size + a toggle
              to have the provider feed this crew (supersedes its food allowance,
              so the cost is counted once — in the provider's package). */}
          {ev.category === 'crew_meals' ? (
            <p className="rounded-md bg-cream/60 px-3 py-2 text-xs text-ink/70">
              Covering{' '}
              <span className="font-medium text-ink">
                {coveredCrewMeals} meal{coveredCrewMeals === 1 ? '' : 's'}
              </span>{' '}
              across the vendors you&rsquo;ve marked as crew-meal covered. Set the Service
              price above to your per-meal rate × this count.
            </p>
          ) : (
            <>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink/65">Crew size on the day</span>
                <input
                  name="crew_size"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={thisVendorCrew ?? ''}
                  className="w-32 rounded-md border border-ink/15 bg-white px-2 py-1 text-right font-medium text-ink focus:border-terracotta focus:outline-none"
                />
              </label>
              {hasCrewMealProvider ? (
                <label className="flex items-start gap-2 rounded-md bg-cream/60 px-2 py-2 text-sm text-ink/75">
                  <input
                    type="checkbox"
                    name="crew_meal_covered"
                    defaultChecked={ev.crew_meal_covered ?? false}
                    className="mt-0.5 h-4 w-4 accent-mulberry"
                  />
                  <span>
                    Crew fed by your crew-meal provider
                    <span className="block text-xs text-ink/50">
                      Covers this crew&rsquo;s meals in that booking — its food allowance
                      above won&rsquo;t be counted again.
                    </span>
                  </span>
                </label>
              ) : null}
            </>
          )}

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

          <SubmitButton pendingLabel="Saving…" className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta">Save costs</SubmitButton>
        </form>
        </section>
      );

  // Working folder — coordinator-private vs couple-shared notes on this
  // vendor (Coordinator P4). Self-gating server component: flag off ⇒ null.
  const workingFolderSection = (
    <WorkingFolderNotes
      eventId={eventId}
      vendorId={ev.vendor_id}
      displayName={displayName}
    />
  );

  const notesSection =
      ev.notes ? (
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
      ) : null;

  const claimSection =
      needsInvite && autoShareInvite && autoShareInvite.status === 'pending' ? (
        <section
          aria-labelledby="claim-invite-heading"
          className="rounded-2xl border border-warn-300/60 bg-warn-50/60 p-5 sm:p-6"
        >
          <header className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn-100 text-warn-800">
              <LinkIcon aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-warn-800">
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
          className="rounded-2xl border border-success-200/80 bg-success-50/60 p-5"
        >
          <header className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success-100 text-success-800">
              <UserCheck aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-success-800">
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
          className="rounded-2xl border border-warn-300/60 bg-warn-50/60 p-5 sm:p-6"
        >
          <header className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn-100 text-warn-800">
              <LinkIcon aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-warn-800">
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
            <SubmitButton pendingLabel="Creating…" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-warn-400/60 bg-warn-50 px-3 py-2 text-xs font-medium text-warn-900 transition-colors hover:bg-warn-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta">
              <LinkIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Create a shareable invite link
            </SubmitButton>
          </form>
        </section>
      ) : null;

  // ------------------------------------------------------------------------
  // Flag OFF — the current long-scroll page, byte-identical to before: the
  // same section variables, in the same order, inside the same wrappers (incl.
  // the 2-col coordination grid).
  // ------------------------------------------------------------------------
  if (!relationshipShellEnabled) {
    return (
      <div className="space-y-6">
        {backNav}
        {heroSection}
        {includedSection}
        {choicesSection}
        {addOnsSection}
        {statusSection}
        <div className="grid gap-5 lg:grid-cols-2">
          {conversationSection}
          {documentsSection}
          {proposalsCard}
          {schedulesSection}
        </div>
        {appointmentsSection}
        {marketplaceInfoSection}
        {paymentModeSection}
        {notesSection}
        {workingFolderSection}
        {claimSection}
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // Flag ON — the unified RelationshipTabShell. Everything below runs ONLY on
  // this branch, so the flag-OFF path adds zero queries and stays untouched.
  //
  // Chat tab: mirror the couple thread page (privacy notice + interest chips +
  // ChatMessageStream + gated composer). Falls back to the existing
  // conversation link block when there's no thread / the vendor is off-platform.
  // ------------------------------------------------------------------------

  // Completion handshake (Event Lifecycle Menu §6.1) — resolve the couple-facing
  // state so the Details tab can surface "confirm received" + the review prompt
  // in the shell (previously reachable only on the standalone /review page).
  // Only for connected vendors — an off-platform/manual vendor has no account to
  // mark complete and no profile to review. Flag-ON-only reads, so the flag-OFF
  // path adds zero queries. RLS session client (couple's own booking + event).
  let coupleHandshake: ReviewState | null = null;
  if (ev.marketplace_vendor_id) {
    const [{ data: complRow }, { data: evtRow }] = await Promise.all([
      supabase
        .from('event_vendors')
        .select(
          'completion_status, service_marked_complete_at, customer_confirmed_received_at',
        )
        .eq('vendor_id', ev.vendor_id)
        .eq('event_id', eventId)
        .maybeSingle(),
      supabase.from('events').select('event_date').eq('event_id', eventId).maybeSingle(),
    ]);
    const compl = complRow as {
      completion_status: string | null;
      service_marked_complete_at: string | null;
      customer_confirmed_received_at: string | null;
    } | null;
    if (compl) {
      coupleHandshake = reviewState(
        {
          status: ev.status,
          completion_status: compl.completion_status,
          service_marked_complete_at: compl.service_marked_complete_at,
          customer_confirmed_received_at: compl.customer_confirmed_received_at,
        },
        (evtRow as { event_date?: string | null } | null)?.event_date ?? null,
      );
    }
  }

  // Completion card for the Details tab. `awaiting_confirm` is the actionable
  // gap (vendor marked complete, couple hasn't confirmed); `reviewable` nudges
  // the review — but only when the marketplace-info section isn't ALSO showing a
  // review link (it only does so at legacy status 'delivered'/'complete'), so we
  // never double up. `awaiting_vendor` renders nothing (nothing to do yet).
  const reviewHref = `/dashboard/${eventId}/vendors/${ev.vendor_id}/review`;
  const coupleCompletionSection =
    coupleHandshake === 'awaiting_confirm' ? (
      <section
        aria-labelledby="completion-heading"
        className="rounded-2xl border border-success-300/50 bg-success-50/50 p-5 sm:p-6"
      >
        <h2
          id="completion-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4 text-success-600" strokeWidth={1.75} />
          Did you get everything from {displayName}?
        </h2>
        <p className="mt-1.5 text-xs text-ink/70">
          {displayName} marked their service complete. Confirm you received everything to
          unlock your review and galleries — or let us know if something is missing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={coupleConfirmReceived}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={ev.vendor_id} />
            <SubmitButton
              pendingLabel="Confirming…"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Yes, I got everything
            </SubmitButton>
          </form>
          <form action={coupleReportNonDelivery}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={ev.vendor_id} />
            <SubmitButton
              pendingLabel="Reporting…"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Something&rsquo;s missing
            </SubmitButton>
          </form>
        </div>
        <p className="mt-3 text-[11px] text-ink/55">
          If you don&rsquo;t respond, this auto-confirms after 7 days so your review can still
          go up.
        </p>
      </section>
    ) : coupleHandshake === 'disputed' ? (
      <section
        aria-labelledby="completion-heading"
        className="rounded-2xl border border-warn-300/60 bg-warn-50/60 p-5 sm:p-6"
      >
        <h2
          id="completion-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Info aria-hidden className="h-4 w-4 text-warn-700" strokeWidth={1.75} />
          You reported a problem
        </h2>
        <p className="mt-1.5 text-xs text-ink/70">
          We&rsquo;ve noted that something was missing from {displayName}. Your review is on hold
          while this is sorted out — once it&rsquo;s resolved, you can leave a review.
        </p>
      </section>
    ) : coupleHandshake === 'reviewable' &&
      ev.status !== 'delivered' &&
      ev.status !== 'complete' ? (
      <section
        aria-labelledby="completion-heading"
        className="rounded-2xl border border-success-300/50 bg-success-50/50 p-5 sm:p-6"
      >
        <h2
          id="completion-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Sparkles aria-hidden className="h-4 w-4 text-success-600" strokeWidth={1.75} />
          How was {displayName}?
        </h2>
        <p className="mt-1.5 text-xs text-ink/70">
          Your service is complete. Leave a public review to help other couples decide.
        </p>
        <Link
          href={reviewHref}
          className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          Leave a review
        </Link>
      </section>
    ) : null;

  let chatTabNode: ReactNode = null;
  let callTabNode: ReactNode = null;
  if (ev.marketplace_vendor_id && chatThread) {
    const thread = await fetchThreadById(supabase, chatThread.thread_id);
    if (thread) {
      // Mirror the couple thread page: mark read on open, resolve block state,
      // server-render the first message batch. `displayName` (the resolved
      // business_name for this booked vendor) is the counterparty label.
      //
      // Mark-read parity with the vendor side (2026-07-11): only clear the
      // unread badge when Chat is the LANDING tab (no ?tab or ?tab=chat). A
      // server round-trip that lands on another tab (e.g. the rail's ?tab=payments
      // quick link, or a deep-link) must NOT mark the thread read without the
      // couple actually viewing the chat. The chat NODE is still built either way
      // — only the WRITE is gated. Read the RAW searchParam (the shell reads it
      // client-side too). RLS session client only; never admin for chat reads.
      const rawTab = typeof search.tab === 'string' ? search.tab : undefined;
      if (!rawTab || rawTab === 'chat') {
        await markThreadRead(chatThread.thread_id);
      }
      const blockState = await getThreadBlockState(thread, user.id, 'couple');
      const initialMessages = await fetchMessages(supabase, chatThread.thread_id);
      const coupleMsgCount = initialMessages.filter(
        (m) => m.sender_role === 'couple',
      ).length;
      const canFollowUpWhilePending = coupleMsgCount <= 1;
      const declineReason = thread.decline_reason?.trim() || null;
      // Voice/video calling is a paid-vendor capability (gate-dark by default) —
      // the couple sees the call UI only when this vendor's tier unlocks it.
      const callsEnabled = await resolveThreadCallsEnabled(thread.vendor_profile_id);

      callTabNode =
        thread.inquiry_status === 'accepted' ? (
          <ThreadCallLauncherLazy
            threadId={thread.thread_id}
            currentUserId={user.id}
            counterpartyLabel={displayName}
            callsEnabled={callsEnabled}
            viewerRole="couple"
          />
        ) : (
          <p className="text-xs text-ink/55">
            Voice and video calls open once {displayName} accepts your inquiry.
          </p>
        );

      chatTabNode = (
        <section className="flex min-h-[24rem] max-h-[calc(100dvh-14rem)] flex-col gap-4">
          {/* Menu carries the real block/unblock/report/archive affordances the
              blocked-state copy refers to — mirror the messages thread page so
              the Chat tab isn't an unblock dead-end. returnTo keeps the couple on
              this workspace Chat tab after acting. */}
          <div className="flex items-center justify-end">
            <ChatThreadMenu
              threadId={thread.thread_id}
              returnTo={`/dashboard/${eventId}/vendors/${vendorId}/workspace?tab=chat`}
              blockedByMe={blockState.blockedByMe}
            />
          </div>
          <ChatSafetyBanner />
          <ThreadInterestChips supabase={supabase} threadId={thread.thread_id} />
          <ChatMessageStream
            threadId={thread.thread_id}
            initialMessages={initialMessages}
            currentUserId={user.id}
            viewerRole="couple"
            counterpartyLabel={displayName}
          />
          {blockState.blockedByMe || blockState.blockedByThem ? (
            <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4 text-sm text-ink/70">
              {blockState.blockedByMe
                ? 'You blocked this person. Unblock from the conversation menu to message again.'
                : 'You can no longer message in this conversation.'}
            </div>
          ) : thread.inquiry_status === 'accepted' ||
            (thread.inquiry_status === 'pending' && canFollowUpWhilePending) ? (
            <div className="space-y-2">
              {thread.inquiry_status === 'pending' && coupleMsgCount > 0 ? (
                <p className="text-xs text-ink/55">
                  You can send one follow-up while you wait for {displayName} to
                  accept.
                </p>
              ) : null}
              <ChatSendForm threadId={thread.thread_id} sendAction={sendChatMessage} />
            </div>
          ) : thread.inquiry_status === 'pending' ? (
            <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
              <p className="text-sm text-ink">
                <span className="font-semibold">Follow-up sent.</span> Waiting for{' '}
                {displayName} to accept before your chat opens.
              </p>
              <form action={withdrawInquiry}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="thread_id" value={thread.thread_id} />
                <SubmitButton
                  pendingLabel="Withdrawing…"
                  className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 underline-offset-2 hover:text-terracotta hover:underline"
                >
                  Withdraw inquiry
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
              <p className="text-sm text-ink">
                {declineReason ? (
                  <>
                    {displayName} declined this inquiry.{' '}
                    <span className="font-semibold">Why:</span> &ldquo;{declineReason}
                    &rdquo;
                  </>
                ) : (
                  <>{displayName} isn&rsquo;t available for your date.</>
                )}
              </p>
              <Link
                href={`/dashboard/${eventId}/vendors`}
                className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
              >
                See similar vendors
              </Link>
            </div>
          )}
        </section>
      );
    }
  }
  if (!chatTabNode) {
    // No thread yet / off-platform vendor → reuse the existing conversation
    // link block (it already carries the "open full chat" / "go to Messages"
    // affordances and the off-platform explanation).
    chatTabNode = conversationSection;
  }

  const tabIconClass = 'h-3.5 w-3.5';
  const tabs: RelationshipTab[] = [
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageCircle aria-hidden className={tabIconClass} strokeWidth={1.75} />,
      node: chatTabNode,
    },
    {
      id: 'quote',
      label: 'Quote',
      icon: <Receipt aria-hidden className={tabIconClass} strokeWidth={1.75} />,
      node: proposalsCard,
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: <PiggyBank aria-hidden className={tabIconClass} strokeWidth={1.75} />,
      node: (
        <div className="space-y-6">
          {statusSection}
          {paymentModeSection}
        </div>
      ),
    },
    {
      id: 'files',
      label: 'Files',
      icon: <FileText aria-hidden className={tabIconClass} strokeWidth={1.75} />,
      node: documentsSection,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: <CalendarPlus aria-hidden className={tabIconClass} strokeWidth={1.75} />,
      node: (
        <div className="space-y-6">
          {schedulesSection}
          {appointmentsSection}
        </div>
      ),
    },
    {
      id: 'call',
      label: 'Call',
      icon: <Phone aria-hidden className={tabIconClass} strokeWidth={1.75} />,
      // callTabNode is only set once a thread resolves. A marketplace vendor
      // with no conversation started yet → give a helpful empty state rather
      // than a blank panel (mirrors the Chat tab's no-thread fallback).
      node: callTabNode ?? (
        <p className="text-xs text-ink/55">
          Voice and video calls open once you start a conversation with {displayName}.
        </p>
      ),
      hidden: !ev.marketplace_vendor_id,
    },
    {
      id: 'details',
      label: 'Details',
      icon: <Info aria-hidden className={tabIconClass} strokeWidth={1.75} />,
      node: (
        <div className="space-y-6">
          {coupleCompletionSection}
          {includedSection}
          {choicesSection}
          {addOnsSection}
          {marketplaceInfoSection}
          {notesSection}
          {workingFolderSection}
          {claimSection}
        </div>
      ),
    },
  ];

  // ------------------------------------------------------------------------
  // Desktop context rail (3-pane · lg+ only). A compact, always-visible summary
  // of the relationship's NEXT ACTION + quick links to the Chat / Payments tabs.
  // Reuses the hero/status data already computed above (no new queries). The
  // shell hides this under lg, and the mobile header already carries the hero +
  // status, so this is purely additive on desktop.
  // ------------------------------------------------------------------------
  //
  // The leading `if (isSetnayanService)` arm (three Setnayan-order payment
  // states, read off `activeSetnayanOrder`) was removed 2026-07-26 with the
  // first-party buy path. The stage-derived chain below already covers every
  // state a third-party booking can be in, and it always ends in an `else`.
  let railTitle: string;
  let railBody: string;
  if (awaitingSupplier) {
    // FIRST in the chain, above every money state. A row that is merely asked
    // cannot be delivered or paid, so ordering costs nothing — and putting it
    // last would mean the `else` ("your booking is locked, log your
    // downpayment") caught it, asking the couple to pay for a booking that does
    // not exist yet.
    railTitle = 'Waiting on them';
    railBody = `${displayName} has been asked and hasn't answered yet. Nothing is owed until they say yes — and you can take the request back any time before they do.`;
  } else if (stage === 'delivered') {
    railTitle = 'Delivered';
    railBody = `${displayName} marked this delivered. Settle any balance and leave a review.`;
  } else if (stage === 'downpayment_paid') {
    railTitle = 'Keep payments on track';
    railBody = `Your downpayment is in. Log each payment to ${displayName} as money moves.`;
  } else {
    railTitle = 'Record your payment';
    railBody = `Your booking with ${displayName} is locked. Log your downpayment to hold the date.`;
  }

  const quickLinkClass =
    'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-3 py-2 text-xs font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

  const contextRail = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink/10 bg-cream/70 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Next step
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {awaitingSupplier ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-warn-900">
              <Hourglass aria-hidden className="h-3 w-3" strokeWidth={2} />
              Asked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-success-800">
              <BookmarkCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
              Locked
            </span>
          )}
          {stage ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
              {STAGE_LABEL[stage]}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 text-sm font-semibold text-ink">{railTitle}</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink/65">{railBody}</p>
        {paidSoFarFormatted ? (
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
            Paid so far <span className="text-ink/80">· {paidSoFarFormatted}</span>
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`/dashboard/${eventId}/vendors/${vendorId}/workspace?tab=chat`}
          className={quickLinkClass}
        >
          <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Chat
        </a>
        <a
          href={`/dashboard/${eventId}/vendors/${vendorId}/workspace?tab=payments`}
          className={quickLinkClass}
        >
          <PiggyBank aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Payments
        </a>
      </div>
    </div>
  );

  return (
    <RelationshipTabShell
      tabs={tabs}
      initialTabId="chat"
      contextRail={contextRail}
      header={
        <div className="space-y-4">
          {backNav}
          {heroSection}
        </div>
      }
    />
  );
}
