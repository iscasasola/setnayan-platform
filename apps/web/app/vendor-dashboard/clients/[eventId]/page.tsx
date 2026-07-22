import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Church,
  Clock3,
  FilePlus2,
  FileText,
  FolderOpen,
  History,
  Info,
  LayoutGrid,
  Link2,
  Lock,
  Martini,
  MessageSquare,
  MessageSquarePlus,
  PackageCheck,
  Palette,
  Phone,
  Sparkles,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ServerTimer } from '@/lib/server-timing';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { getEditorialEligibility } from '@/lib/editorial-vendor-media';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { BoothPosterCard } from './_components/booth-poster-card';
import { VendorChallengeSection } from './_components/vendor-challenge-section';
import { Vendor3dPlanUnlockSection } from './_components/vendor-3d-plan-unlock-section';
import { blockRelevance, deriveCallTime } from '@/lib/vendor-timeline';
import { fetchBlockRosMeta, isBlockTaggedToVendor } from '@/lib/schedule-ros';
import {
  fetchVendorThreads,
  fetchReturningClientFlags,
  fetchThreadById,
  fetchMessages,
  type ReturningClientFlag,
} from '@/lib/chat';
import {
  fetchPlanProgressForVendor,
  fetchPendingVendorPayments,
} from '@/lib/vendor-service-payment-schedules.server';
import { computePlanRollup } from '@/lib/vendor-service-payment-schedules';
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  formatCentavos,
  type ProposalStatus,
} from '@/lib/vendor-proposals';
import { SubmitButton } from '@/app/_components/submit-button';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import {
  CardTabs,
  PipelineStrip,
  normalizeTab,
  type CustomerCardTab,
} from './_components/customer-card-nav';
import { ActivityFeed, type ActivityEvent } from './_components/customer-card-activity';
import type { ClientNote } from './_components/customer-card-notes';
import {
  suggestScheduleChange,
  vendorMarkServiceComplete,
  vendorAcknowledgeDeposit,
  vendorRejectDeposit,
  vendorPostHandover,
  vendorRaiseChangeOrder,
  vendorRespondChangeOrder,
  vendorWithdrawChangeOrder,
} from './actions';
import { AppointmentsSection } from '@/app/_components/appointments-section';
import {
  appointmentCategoriesFor,
  resolveAppointmentLabel,
  type AppointmentKind,
  type AppointmentTypePreset,
  type AppointmentView,
} from '@/lib/appointments';
// Relationship Workspace shell (flag-gated · 2026-07-11). When
// NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED is set, the SAME tab components are
// re-grouped into the unified chat-first shell (Chat · Quote · Payments · Files ·
// Schedule · Call · Details) — a true two-sided mirror of the couple's Vendor
// Workspace. Otherwise the current tabbed page renders byte-for-byte unchanged.
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';
import {
  RelationshipTabShell,
  type RelationshipTab,
} from '@/app/_components/relationship-tab-shell';
// Chat-tab embed — mirror the VENDOR thread page (Chat tab = the live thread with
// the vendor accept/decline gate preserved). RLS-scoped session client ONLY for
// these reads — never admin/service-role for chat content.
import { getThreadBlockState } from '@/lib/chat-block';
import {
  sendChatMessage,
  acceptInquiry,
  declineInquiry,
  markThreadRead,
} from '@/lib/chat-actions';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
// Call launcher is code-split (WebRTC · ssr:false) so the Call tab's bundle
// stays out of the initial page JS until that tab mounts — see the lazy loader.
import { ThreadCallLauncherLazy } from '@/app/_components/thread-call-launcher-lazy';
import { resolveThreadCallsEnabled } from '@/lib/thread-calls-gate';
import { ChatThreadMenu } from '@/app/_components/chat-thread-menu';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';
import { ThreadInterestChips } from '@/app/_components/thread-interest-chips';
// Payments tab — reuse the vendor thread's LIVE payment-confirm surface
// (couple-logged payments awaiting confirmation + plan progress / "mark cleared").
// Reused as-is; no payment logic is reimplemented here.
import { VendorPaymentLive } from '../../messages/[threadId]/_components/vendor-payment-live';

export const metadata = { title: 'Customer Card · Vendor' };

/**
 * Vendor Customer Card — the client detail view, respined (PR-2 of the Customer
 * Card program; design source 03_Strategy/Customer_Card_Prototype_2026-07-03.html
 * View 2). One card: a sticky header (avatar · names · event meta · stage pill ·
 * source badge · booked-category chips · action row), a 5-step pipeline strip
 * (Inquiry → Quoted → Booked → Delivered → Reviewed), and five tabs — Overview /
 * Quote & Payments / Files / Schedule / Activity — behind a `?tab=` search param.
 *
 * Stage-aware: the backing RPC (get_vendor_event_brief) now returns stage
 * 'booked' | 'inquiry'. An ACCEPTED-inquiry vendor sees a limited, quote-relevant
 * card (city-grain location, pax totals, style; no exact venue / timeline / seat
 * plan / dietary — the disclosure ladder). Redirects on any RPC error exactly as
 * before (not booked, no accepted inquiry, or the event doesn't exist).
 *
 * Aggregates only: the RPC never returns guest rows; guest names never render.
 * Free for every vendor tier — tiers sell reach, not features.
 */

type Brief = {
  stage: 'booked' | 'inquiry';
  event: {
    display_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    region?: string | null;
    ceremony_type: string | null;
  };
  booked_categories: string[];
  pax: { invited: number; attending: number; maybe: number; pending: number; declined: number };
  dietary: { meal_counts: Record<string, number>; restriction_notes: number } | null;
  // Couple opt-in budget RANGE for this vendor's category (Customer Card respine
  // PR-5). NULL unless the couple opted in AND allocated to the vendor's
  // category(ies). Range-only — the exact figure is never recoverable.
  budget_band: { lo_centavos: number; hi_centavos: number } | null;
  palette: Record<string, string[]>;
  attire_guide: Record<string, unknown>;
  monogram: {
    text: string | null;
    color: string | null;
    font_key: string | null;
    frame_key: string | null;
    custom_svg: string | null;
  };
  timeline: {
    label: string;
    block_type: string;
    start_at: string | null;
    end_at: string | null;
    location: string | null;
  }[];
  seat_plan: {
    published: boolean;
    published_at: string | null;
    table_count: number;
    assigned_guests: number;
  };
};

const PALETTE_LABELS: Record<string, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  bride: 'Bride',
  groom: 'Groom',
  guest: 'Guest dress code',
  wedding_party: 'Wedding party',
  vip_family: 'VIP family',
  principal_sponsors: 'Principal sponsors',
  secondary_sponsors: 'Secondary sponsors',
  bearers_flower_girl: 'Bearers & flower girl',
  officiants: 'Officiants',
};

const MEAL_LABELS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids meal',
  no_preference: 'No preference',
};

const CATEGORY_LABELS: Record<string, string> = {
  venue: 'Venue',
  catering: 'Catering',
  photographer: 'Photographer',
  videographer: 'Videographer',
  florist: 'Florist',
  cake_maker: 'Cake',
  host_emcee: 'Host / Emcee',
  band_dj: 'Band / DJ',
  string_quartet: 'String quartet',
  choir: 'Choir',
  officiant: 'Officiant',
  planner_coordinator: 'Planner / Coordinator',
  makeup_artist: 'Makeup',
  hair_stylist: 'Hair',
  gown_designer: 'Gown',
  suit_designer: 'Suit',
  rings: 'Rings',
  invitations_stationery: 'Stationery',
  transportation: 'Transportation',
  lights_and_sound: 'Lights & sound',
  led_screens: 'LED screens',
  photobooth: 'Photo booth',
  mobile_bar: 'Mobile bar',
  church_fees: 'Church',
  reception_decor: 'Reception décor',
  security: 'Security',
  gifts_and_giveaways: 'Gifts & giveaways',
  misc: 'Other',
};

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set yet';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function fmtCODate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function fmtDelta(raw: number | string | null): string {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `−${abs}` : `+${abs}`;
}

function fmtPeso(php: number | null): string {
  if (php == null || !Number.isFinite(php)) return '—';
  return `₱${php.toLocaleString('en-PH', {
    minimumFractionDigits: php % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Whole-peso label from a centavos amount (bands are always ₱5,000-quantized). */
function fmtPesoCentavos(centavos: number | null): string {
  if (centavos == null || !Number.isFinite(centavos)) return '—';
  return `₱${Math.round(centavos / 100).toLocaleString('en-PH')}`;
}

/** Initials for the avatar — from the event display name (never a guest name). */
function initials(name: string | null): string {
  if (!name) return '—';
  const words = name
    .replace(/[–—&]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '');
  return letters.join('') || name.slice(0, 2).toUpperCase();
}

const CO_STATUS: Record<VendorChangeOrderRow['status'], { label: string; cls: string }> = {
  proposed: { label: 'Awaiting response', cls: 'border-warn-300 bg-warn-50 text-warn-900' },
  accepted: { label: 'Accepted', cls: 'border-success-400 bg-success-50 text-success-700' },
  declined: { label: 'Declined', cls: 'border-ink/15 bg-ink/5 text-ink/60' },
  withdrawn: { label: 'Withdrawn', cls: 'border-ink/15 bg-ink/5 text-ink/60' },
};

type LiveBlock = {
  block_id: string;
  label: string;
  block_type: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  run_state?: 'upcoming' | 'live' | 'done' | null;
  actual_start_at?: string | null;
};

type HandoverRow = {
  handover_id: string;
  kind: 'gallery_link' | 'file' | 'note' | 'signoff';
  label: string | null;
  payload: string | null;
  status: 'delivered' | 'acknowledged' | 'disputed';
  delivered_at: string;
  couple_acknowledged_at: string | null;
};

type SuggestionRow = {
  suggestion_id: string;
  block_id: string | null;
  kind: 'adjust' | 'new';
  note: string;
  status: 'open' | 'accepted' | 'declined';
  created_at: string;
};

type VendorChangeOrderRow = {
  change_order_id: string;
  raised_by: 'couple' | 'vendor';
  title: string | null;
  description: string | null;
  delta_amount_php: number | string | null;
  proposed_due_date: string | null;
  status: 'proposed' | 'accepted' | 'declined' | 'withdrawn';
  acknowledged_at: string | null;
  decline_reason: string | null;
  created_at: string;
};

type ProposalRow = {
  proposal_id: string;
  public_id: string;
  title: string | null;
  status: ProposalStatus;
  total_centavos: number;
  valid_until: string | null;
  sent_at: string | null;
  created_at: string;
};

type ContractRow = {
  contract_id: string;
  title: string | null;
  file_name: string | null;
  file_url: string | null;
  status: string;
  created_at: string;
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    tab?: string;
    suggest?: string;
    lens?: string;
    deposit_ack?: string;
    deposit_reject?: string;
    change_order?: string;
    change_order_resp?: string;
    handover?: string;
  }>;
};

const HANDOVER_KIND_LABEL: Record<'gallery_link' | 'file' | 'note' | 'signoff', string> = {
  gallery_link: 'Gallery link',
  file: 'Sample / proof',
  note: 'Note',
  signoff: 'All delivered',
};

export default async function VendorCustomerCardPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const tab: CustomerCardTab = normalizeTab(search.tab);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Stage gate + aggregation live inside the SECURITY DEFINER RPC. An error
  // means the vendor is neither booked nor holds an accepted inquiry on this
  // event (or it doesn't exist); bounce to Clients — UNCHANGED from before.
  const { data, error } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  if (error || !data) redirect('/vendor-dashboard/clients');
  const brief = data as Brief;
  const isInquiry = brief.stage === 'inquiry';
  const isBooked = brief.stage === 'booked';

  const admin = createAdminClient();
  const clientTimer = new ServerTimer('vendor-dashboard/customer-card');

  // One parallel round-trip for everything the card needs beyond the brief.
  //   • source row (event_vendors.source → In-house vs Imported) + completion
  //     handshake state + deposit state. Admin-read (already booked/inquiry-gated
  //     above); the source discriminator drives the header badge.
  //   • this org's proposals for the event (vendor-org RLS).
  //   • this org's contracts for the event (vendor owns vendor_contracts).
  //   • this org's threads (resolve the thread_id for this event → chat / log-pay).
  //   • editorial-media eligibility, cocktail-editability probe, live timeline
  //     rows, this org's suggestion history — all as before.
  const [
    { data: evRow },
    { data: proposalRows },
    { data: contractRows },
    threads,
    editorialEligibility,
    { data: cocktailEdit },
    { data: posterRow },
    { data: liveBlocks },
    { data: mySuggestions },
    returningFlags,
  ] = await clientTimer.track('customer-card', () =>
    Promise.all([
      admin
        .from('event_vendors')
        .select(
          'vendor_id, source, completion_status, service_marked_complete_at, customer_confirmed_received_at, deposit_recorded_at, deposit_acknowledged_at, deposit_proof_url',
        )
        .eq('event_id', eventId)
        .eq('marketplace_vendor_id', profile.vendor_profile_id)
        .maybeSingle(),
      supabase
        .from('vendor_proposals')
        .select('proposal_id, public_id, title, status, total_centavos, valid_until, sent_at, created_at')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase
        .from('vendor_contracts')
        .select('contract_id, title, file_name, file_url, status, created_at')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .eq('event_id', eventId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      fetchVendorThreads(supabase, profile.vendor_profile_id),
      getEditorialEligibility(admin, eventId, profile.vendor_profile_id),
      supabase.rpc('get_vendor_cocktail_editor', { p_event_id: eventId }),
      // This org's booth poster for this event (its own table — one artwork per
      // vendor per event, not per booked service row). Admin-read: the page is
      // already booked/inquiry-gated above, and the row is scoped by
      // marketplace_vendor_id below.
      admin
        .from('event_vendor_booth_posters')
        .select('poster_ref')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle(),
      supabase
        .from('event_schedule_blocks')
        .select('block_id, label, block_type, start_at, end_at, location, run_state, actual_start_at')
        .eq('event_id', eventId)
        .order('start_at', { ascending: true })
        .order('sort_order', { ascending: true }),
      supabase
        .from('event_schedule_suggestions')
        .select('suggestion_id, block_id, kind, note, status, created_at')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Returning-client signal (Relationship Workspace · Details tab, PR 5).
      // SAME source as the vendor inbox pending badge — the SECURITY DEFINER
      // RPC that can see the couple's OTHER-event bookings (vendor RLS can't).
      // Graceful-degrades to an empty Map pre-migration, so the marker simply
      // doesn't render until 20261201000000 lands.
      fetchReturningClientFlags(supabase, profile.vendor_profile_id, [eventId]),
    ]),
  );

  const completion = (evRow ?? null) as {
    vendor_id: string | null;
    source: string | null;
    completion_status: string | null;
    service_marked_complete_at: string | null;
    customer_confirmed_received_at: string | null;
    deposit_recorded_at: string | null;
    deposit_acknowledged_at: string | null;
    deposit_proof_url: string | null;
  } | null;

  // Source badge: event_vendors.source = 'vendor_invite' → Imported (they came in
  // through the vendor's own invite QR); anything else (host_manual, cascade,
  // legacy NULL) → In-house.
  const isImported = completion?.source === 'vendor_invite';

  const depositRecorded = Boolean(completion?.deposit_recorded_at);
  const depositAcked = Boolean(completion?.deposit_acknowledged_at);
  const eventVendorId = completion?.vendor_id ?? null;
  const isCompleteConfirmed =
    completion?.completion_status === 'confirmed' ||
    completion?.completion_status === 'auto_confirmed' ||
    Boolean(completion?.customer_confirmed_received_at);
  const isDisputed = completion?.completion_status === 'disputed';
  const isVendorMarked =
    Boolean(completion?.service_marked_complete_at) && !isCompleteConfirmed && !isDisputed;

  const proposals = (proposalRows ?? []) as ProposalRow[];
  const contracts = (contractRows ?? []) as ContractRow[];
  const hasContract = contracts.length > 0;

  // Thread for THIS event → drives [Open chat] + [Log payment] (the pay-confirm
  // flow lives inside the thread) in the header action row.
  const thread = threads.find((t) => t.event_id === eventId) ?? null;
  const threadId = thread?.thread_id ?? null;

  // Returning-client marker (Details/Overview tab). A row exists ONLY when this
  // couple previously CONFIRMED-booked THIS vendor on a DIFFERENT event — i.e.
  // they're a returning client (N≥1). The RPC returns the most-recent such prior
  // event's name/date (DISTINCT ON per event) — no exact count and no prior
  // event_id, so we surface that one named past event, not a linked list.
  const returningFlag: ReturningClientFlag | null = returningFlags.get(eventId) ?? null;

  // Reviewed pipeline step — vendor_reviews is publicly readable (USING TRUE),
  // so a cheap existence check on (vendor, event) is safe. Only worth a read once
  // the booking could plausibly have a review (booked + delivered).
  let hasReview = false;
  if (isBooked && isCompleteConfirmed) {
    const { data: reviewRow } = await supabase
      .from('vendor_reviews')
      .select('review_id, created_at')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('event_id', eventId)
      .limit(1)
      .maybeSingle();
    hasReview = Boolean(reviewRow);
  }

  // Payments (booked only): the couple's payment tables are couple-RLS, so we
  // read them through the SAME admin-gated fetchers the chat thread uses
  // (ownership proven inside via event_vendors.marketplace_vendor_id === us).
  // NO RLS weakening, NO new SECURITY DEFINER — reuse only.
  let planSteps: ReturnType<typeof computePlanRollup> | null = null;
  let planStepRows: Awaited<ReturnType<typeof fetchPlanProgressForVendor>>[number] | null = null;
  let pendingPayments: Awaited<ReturnType<typeof fetchPendingVendorPayments>> = [];
  // Full per-booking plan list — retained (beyond the single matched row) so the
  // flag-ON Payments tab can feed the live VendorPaymentLive surface exactly as
  // the thread page does. Unused on the flag-OFF path, so its render is unchanged.
  let planRowsAll: Awaited<ReturnType<typeof fetchPlanProgressForVendor>> = [];
  if (isBooked) {
    const [plans, pending] = await Promise.all([
      fetchPlanProgressForVendor({
        adminClient: admin,
        eventId,
        vendorProfileId: profile.vendor_profile_id,
      }),
      fetchPendingVendorPayments({
        adminClient: admin,
        eventId,
        vendorProfileId: profile.vendor_profile_id,
      }),
    ]);
    planRowsAll = plans;
    // One booking per event_vendors row for this org+event; take the one whose
    // eventVendorId matches the completion row (there is normally exactly one).
    planStepRows =
      plans.find((p) => p.eventVendorId === eventVendorId) ?? plans[0] ?? null;
    if (planStepRows?.steps) planSteps = computePlanRollup(planStepRows.steps);
    pendingPayments = pending;
  }

  // Change-Order Trail — depends on the event_vendor id resolved above.
  const { data: changeOrderRows } = eventVendorId
    ? await supabase
        .from('vendor_change_orders')
        .select(
          'change_order_id, raised_by, title, description, delta_amount_php, proposed_due_date, status, acknowledged_at, decline_reason, created_at',
        )
        .eq('event_vendor_id', eventVendorId)
        .order('created_at', { ascending: false })
    : { data: null };
  const changeOrders = (changeOrderRows ?? []) as VendorChangeOrderRow[];

  // Delivery handovers (booked). event_vendor scoped — safe to read for the
  // vendor's own booking via their RLS.
  const { data: handoverRows } = isBooked
    ? await supabase
        .from('booking_handovers')
        .select('handover_id, kind, label, payload, status, delivered_at, couple_acknowledged_at')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: null };
  const handovers = (handoverRows ?? []) as HandoverRow[];

  // Private CRM notes (vendor-org-only RLS). Author display resolved best-effort
  // via the admin client (RLS on users would otherwise hide teammates).
  const { data: noteRows } = await supabase
    .from('vendor_client_notes')
    .select('note_id, body, remind_at, done_at, author_user_id, created_at')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  const rawNotes = (noteRows ?? []) as Omit<ClientNote, 'author_label'>[];
  const authorIds = Array.from(new Set(rawNotes.map((n) => n.author_user_id)));
  const authorLabels = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: authors } = await admin
      .from('users')
      .select('user_id, full_name')
      .in('user_id', authorIds);
    for (const a of (authors ?? []) as Array<{ user_id: string; full_name: string | null }>) {
      if (a.full_name) authorLabels.set(a.user_id, a.full_name);
    }
  }
  const notes: ClientNote[] = rawNotes.map((n) => ({
    ...n,
    author_label: n.author_user_id === user.id ? 'You' : authorLabels.get(n.author_user_id) ?? null,
  }));

  const allBlocks = (liveBlocks ?? []) as LiveBlock[];
  const suggestions = (mySuggestions ?? []) as SuggestionRow[];
  const canEditCocktail = !!cocktailEdit;

  // Booth poster: the stored ref is raw (r2://bucket/key), so resolve it to a
  // display URL for the preview — the same ref → URL step the 3D scenes do.
  const posterRef = (posterRow as { poster_ref?: string | null } | null)?.poster_ref ?? null;
  const posterDisplayUrl = posterRef ? await displayUrlForStoredAsset(posterRef) : null;

  const blockLabel = new Map(allBlocks.map((b) => [b.block_id, b.label]));

  const runOfShowBlocks: RunOfShowBlock[] = allBlocks
    .filter((b) => b.start_at)
    .map((b) => ({
      block_id: b.block_id,
      label: b.label,
      start_at: b.start_at as string,
      end_at: b.end_at,
      location: b.location,
      run_state: (b.run_state ?? 'upcoming') as RunOfShowBlock['run_state'],
      actual_start_at: b.actual_start_at ?? null,
    }));

  const relevance = new Map(
    allBlocks.map((b) => [b.block_id, blockRelevance(b, brief.booked_categories)]),
  );
  // Coordinator P2 — explicit responsible-party tags override the category
  // heuristic: a row the couple tagged to THIS vendor is always 'primary'
  // ("Your slot" + included in "My slots only"). Best-effort fetch — before
  // migration 20270825042743 (or with zero tags) the map is empty and the
  // lens behaves exactly as today. Full-timeline read stays per locked D2.
  if (eventVendorId && allBlocks.length > 0) {
    const rosMeta = await fetchBlockRosMeta(supabase, eventId);
    if (rosMeta.size > 0) {
      for (const b of allBlocks) {
        if (isBlockTaggedToVendor(rosMeta, b.block_id, eventVendorId)) {
          relevance.set(b.block_id, 'primary');
        }
      }
    }
  }
  const mineOnly = search.lens === 'mine';
  const mineCount = allBlocks.filter((b) => relevance.get(b.block_id) !== 'context').length;
  const blocks = mineOnly
    ? allBlocks.filter((b) => relevance.get(b.block_id) !== 'context')
    : allBlocks;
  const callTime = deriveCallTime(allBlocks, brief.booked_categories);
  const callTimeAlreadyRequested = suggestions.some(
    (s) => s.kind === 'new' && s.note.startsWith('Suggested call time'),
  );

  const paletteEntries = Object.entries(PALETTE_LABELS)
    .map(([key, label]) => ({ key, label, colors: brief.palette?.[key] ?? [] }))
    .filter((p) => p.colors.length > 0);
  const mealEntries = Object.entries(brief.dietary?.meal_counts ?? {}).sort((a, b) => b[1] - a[1]);
  const monogramSvg =
    brief.monogram.custom_svg && brief.monogram.custom_svg.trimStart().startsWith('<svg')
      ? brief.monogram.custom_svg
      : null;

  // ---- Pipeline derivation (server-side, from data already loaded) ----
  //   Quoted    = any proposal row with status ≠ draft.
  //   Booked    = the RPC returned stage 'booked'.
  //   Delivered = completion handshake confirmed / auto_confirmed.
  //   Reviewed  = a vendor_reviews row exists (public-read; checked above).
  const isQuoted = proposals.some((p) => p.status !== 'draft');
  const isDelivered = isBooked && isCompleteConfirmed;
  // `reached` = furthest reached index; `current` = highlighted stage.
  let reached = 0; // Inquiry
  if (isQuoted) reached = Math.max(reached, 1);
  if (isBooked) reached = Math.max(reached, 2);
  if (isDelivered) reached = Math.max(reached, 3);
  if (hasReview) reached = Math.max(reached, 4);
  const current = hasReview ? 4 : isDelivered ? 3 : isBooked ? 2 : isQuoted ? 1 : 0;
  // Reviewed is only cheaply knowable post-delivery; before that, cap the strip
  // at Delivered so we never imply a review-state we didn't read.
  const capAt = isDelivered ? 4 : 3;

  const stagePill = isBooked
    ? { label: 'Booked', cls: 'bg-success-100 text-success-900' }
    : isQuoted
      ? { label: 'Quote sent', cls: 'bg-warn-100 text-warn-900' }
      : { label: 'In conversation', cls: 'bg-terracotta/10 text-terracotta' };

  const eventName = brief.event.display_name ?? 'This couple';
  const metaBits = [
    fmtShortDate(brief.event.event_date) || null,
    isBooked ? brief.event.venue_name ?? null : brief.event.region ?? null,
  ].filter(Boolean);

  // ---- Activity feed events (merged, newest-first done in the component) ----
  const activityEvents: ActivityEvent[] = [];
  for (const p of proposals) {
    if (p.status === 'draft') continue;
    const at = p.sent_at ?? p.created_at;
    activityEvents.push({
      id: `prop-${p.proposal_id}`,
      kind: 'proposal',
      title: `Quote ${PROPOSAL_STATUS_LABEL[p.status].toLowerCase()}`,
      detail: `${formatCentavos(p.total_centavos)}${
        p.valid_until ? ` · valid until ${fmtShortDate(p.valid_until)}` : ''
      }`,
      at,
      sortAt: at ? Date.parse(at) : 0,
    });
  }
  for (const s of suggestions) {
    activityEvents.push({
      id: `sug-${s.suggestion_id}`,
      kind: 'schedule',
      title: s.kind === 'new' ? 'Suggested a new timeline entry' : 'Requested a schedule change',
      detail: `${s.note.slice(0, 90)}${s.note.length > 90 ? '…' : ''} · ${s.status}`,
      at: s.created_at,
      sortAt: Date.parse(s.created_at),
    });
  }
  if (completion?.deposit_recorded_at) {
    activityEvents.push({
      id: 'deposit-recorded',
      kind: 'deposit',
      title: depositAcked ? 'Deposit confirmed' : 'Deposit recorded',
      detail: depositAcked
        ? 'You confirmed the couple’s deposit — their date is locked in.'
        : 'The couple recorded a deposit — confirm receipt to lock the date.',
      at: completion.deposit_acknowledged_at ?? completion.deposit_recorded_at,
      sortAt: Date.parse(completion.deposit_acknowledged_at ?? completion.deposit_recorded_at),
    });
  }
  if (completion?.service_marked_complete_at) {
    activityEvents.push({
      id: 'marked-complete',
      kind: 'handshake',
      title: isCompleteConfirmed ? 'Delivery confirmed' : 'Marked service complete',
      detail: isCompleteConfirmed
        ? 'The couple confirmed they received everything.'
        : 'Waiting on the couple to confirm receipt (auto-confirms after 7 days).',
      at: completion.customer_confirmed_received_at ?? completion.service_marked_complete_at,
      sortAt: Date.parse(
        completion.customer_confirmed_received_at ?? completion.service_marked_complete_at,
      ),
    });
  }
  for (const pp of pendingPayments) {
    activityEvents.push({
      id: `pay-${pp.paymentId}`,
      kind: 'payment',
      title: 'Payment logged by the couple',
      detail: `${fmtPeso(pp.amountPhp)}${pp.installmentLabel ? ` · ${pp.installmentLabel}` : ''} · awaiting your confirmation`,
      at: pp.paidAt,
      sortAt: Date.parse(pp.paidAt),
    });
  }

  // Appointments (Relationship Workspace + Appointments, PR 12). Booked-only —
  // the vendor-insert RLS requires a booked (vendor, event) relationship, so the
  // scheduler is meaningless at the inquiry stage. One cheap reference read of
  // the category → meeting-type catalog + this org's appointment rows on the
  // event, both under the vendor's own RLS.
  let appointmentPresets: AppointmentTypePreset[] = [];
  let appointmentViews: AppointmentView[] = [];
  if (isBooked) {
    const apptCats = appointmentCategoriesFor(brief.booked_categories);
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
        .eq('vendor_profile_id', profile.vendor_profile_id)
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

  clientTimer.flush();

  const relationshipShellEnabled = isRelationshipWorkspaceEnabled();
  const bodyPad = 'px-4 py-6 sm:px-6';

  // ------------------------------------------------------------------------
  // Header pieces + tab-body nodes — extracted so BOTH the flag-OFF tabbed page
  // and the flag-ON RelationshipTabShell render the SAME JSX. Nothing INSIDE any
  // tab component changed; the flag-OFF branch reproduces the original markup
  // byte-for-byte (same wrappers, same order, same CardTabs `?tab=` URL behavior).
  // ------------------------------------------------------------------------
  const backLink = (
    <Link
      href="/vendor-dashboard/clients"
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink/55 hover:text-ink"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" /> Clients
    </Link>
  );

  const identityBlock = (
    <div className="flex items-start gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-white text-lg font-semibold text-ink/70">
        {initials(brief.event.display_name)}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
          {eventName}
        </h1>
        {metaBits.length > 0 ? (
          <p className="mt-0.5 truncate text-sm text-ink/55">{metaBits.join(' · ')}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stagePill.cls}`}
          >
            {stagePill.label}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isImported
                ? 'bg-ink/5 text-ink/60'
                : 'bg-terracotta/10 text-terracotta'
            }`}
          >
            {isImported ? (
              <>
                <UserRound aria-hidden className="h-3 w-3" /> Imported
              </>
            ) : (
              <>
                <Sparkles aria-hidden className="h-3 w-3" /> In-house
              </>
            )}
          </span>
          {brief.booked_categories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-ink/70"
            >
              {isBooked ? 'Booked · ' : ''}
              {CATEGORY_LABELS[c] ?? c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const actionRow = (
    <div className="mt-3 flex flex-wrap gap-2">
      {threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-cream"
        >
          <MessageSquare aria-hidden className="h-3.5 w-3.5" /> Open chat
        </Link>
      ) : null}
      <Link
        href="/vendor-dashboard/proposals"
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <FileText aria-hidden className="h-3.5 w-3.5" /> New quote
      </Link>
      <Link
        href={
          hasContract
            ? '/vendor-dashboard/contracts'
            : `/vendor-dashboard/contracts/new?event=${eventId}`
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <FilePlus2 aria-hidden className="h-3.5 w-3.5" /> {hasContract ? 'Contract' : 'Contract'}
      </Link>
      <Link
        href={`/vendor-dashboard/clients/${eventId}?tab=files`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <FolderOpen aria-hidden className="h-3.5 w-3.5" /> Files
      </Link>
      <Link
        href={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
      >
        <CalendarDays aria-hidden className="h-3.5 w-3.5" /> Schedule
      </Link>
      {threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}#pending-payments`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
        >
          <Wallet aria-hidden className="h-3.5 w-3.5" /> Log payment
        </Link>
      ) : null}
    </div>
  );

  const pipelineBlock = (
    <div className="mt-3">
      <PipelineStrip reached={reached} current={current} capAt={capAt} />
    </div>
  );

  const overviewNode = (
    <OverviewTab
      eventId={eventId}
      brief={brief}
      threadId={threadId}
      returningFlag={returningFlag}
      isBooked={isBooked}
      isInquiry={isInquiry}
      paletteEntries={paletteEntries}
      mealEntries={mealEntries}
      monogramSvg={monogramSvg}
      isImported={isImported}
      editorialEligibility={editorialEligibility}
      canEditCocktail={canEditCocktail}
      vendorProfileId={profile.vendor_profile_id}
      posterRef={posterRef}
      posterDisplayUrl={posterDisplayUrl}
      completion={completion}
      eventVendorId={eventVendorId}
      depositRecorded={depositRecorded}
      depositAcked={depositAcked}
      isCompleteConfirmed={isCompleteConfirmed}
      isDisputed={isDisputed}
      isVendorMarked={isVendorMarked}
      hideCompletion={relationshipShellEnabled}
      search={search}
    />
  );

  const quoteNode = (
    <QuoteTab
      proposals={proposals}
      isBooked={isBooked}
      planRollup={planSteps}
      planStepRows={planStepRows}
      pendingPayments={pendingPayments}
      threadId={threadId}
    />
  );

  const filesNode = (
    <FilesTab contracts={contracts} threadId={threadId} handovers={handovers} isBooked={isBooked} />
  );

  const scheduleNode = (
    <>
      <ScheduleTab
        eventId={eventId}
        isInquiry={isInquiry}
        brief={brief}
        allBlocks={allBlocks}
        blocks={blocks}
        relevance={relevance}
        mineOnly={mineOnly}
        mineCount={mineCount}
        runOfShowBlocks={runOfShowBlocks}
        callTime={callTime}
        callTimeAlreadyRequested={callTimeAlreadyRequested}
        suggestions={suggestions}
        blockLabel={blockLabel}
        handovers={handovers}
        eventVendorId={eventVendorId}
        changeOrders={changeOrders}
        search={search}
      />
      {isBooked ? (
        <div className="mt-4">
          <AppointmentsSection
            role="vendor"
            eventId={eventId}
            vendorProfileId={profile.vendor_profile_id}
            returnPath={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
            threadId={threadId}
            currentUserId={user.id}
            counterpartyName={eventName}
            presets={appointmentPresets}
            appointments={appointmentViews}
          />
        </div>
      ) : null}
    </>
  );

  const activityNode = (
    <ActivityFeed eventId={eventId} events={activityEvents} notes={notes} />
  );

  // ---- Flag OFF: the current tabbed Customer Card, byte-identical ----
  if (!relationshipShellEnabled) {
    return (
      <section className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden sn-tile">
          {/* ============================ HEADER ============================ */}
          <header className="sticky top-0 z-10 border-b border-ink/10 bg-cream/95 px-4 pt-4 backdrop-blur sm:px-6">
            {backLink}
            {identityBlock}
            {actionRow}
            {pipelineBlock}

            {/* Tab rail */}
            <div className="mt-2">
              <CardTabs eventId={eventId} active={tab} />
            </div>
          </header>

          {/* ============================ BODY ============================ */}
          <div className={bodyPad}>
            {tab === 'overview' ? overviewNode : null}
            {tab === 'quote' ? quoteNode : null}
            {tab === 'files' ? filesNode : null}
            {tab === 'schedule' ? scheduleNode : null}
            {tab === 'activity' ? activityNode : null}
          </div>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------------
  // Flag ON — the unified RelationshipTabShell (a true two-sided mirror of the
  // couple's Vendor Workspace). Everything below runs ONLY on this branch, so
  // the flag-OFF path adds zero queries and stays untouched.
  //
  // Chat tab: mirror the VENDOR thread page — privacy notice + interest chips +
  // ChatMessageStream(viewerRole="vendor") + the vendor accept/decline GATE (a
  // vendor must accept an inquiry before the composer opens). Falls back to a
  // Messages link when there's no thread for this event.
  // ------------------------------------------------------------------------
  let chatTabNode: React.ReactNode = null;
  let callTabNode: React.ReactNode = null;
  // Captured for the desktop context rail's next-action line — a pending inquiry
  // means the vendor's next move is to accept/decline (in the Chat tab).
  let inquiryStatus: string | null = null;
  if (threadId) {
    const fullThread = await fetchThreadById(supabase, threadId);
    if (fullThread) {
      inquiryStatus = fullThread.inquiry_status ?? null;
      // Mark read only when Chat is the LANDING tab (no ?tab or ?tab=chat), so a
      // server round-trip that lands on another tab (e.g. the header's ?tab=files
      // quick-action, or a deep-link) doesn't clear the unread badge without the
      // vendor actually viewing the chat. Read the RAW searchParam (the shell
      // reads it client-side too — the server's normalizeTab only knows the old
      // CardTabs set). RLS session client only; never admin for chat reads.
      const rawTab = typeof search.tab === 'string' ? search.tab : undefined;
      if (!rawTab || rawTab === 'chat') {
        await markThreadRead(threadId).catch(() => undefined);
      }
      const blockState = await getThreadBlockState(fullThread, user.id, 'vendor');
      const initialMessages = await fetchMessages(supabase, threadId);
      const declineReason = fullThread.decline_reason?.trim() || null;
      // Voice/video calling is a paid-vendor capability (gate-dark by default) —
      // locked here shows the vendor an upgrade nudge instead of the call button.
      const callsEnabled = await resolveThreadCallsEnabled(profile.vendor_profile_id);

      callTabNode =
        fullThread.inquiry_status === 'accepted' ? (
          <ThreadCallLauncherLazy
            threadId={threadId}
            currentUserId={user.id}
            counterpartyLabel={eventName}
            callsEnabled={callsEnabled}
            viewerRole="vendor"
            upgradeHref="/vendor-dashboard/subscription"
          />
        ) : (
          <p className="text-xs text-ink/55">
            Voice and video calls open once you accept {eventName}&rsquo;s inquiry.
          </p>
        );

      chatTabNode = (
        <section className="flex min-h-[24rem] max-h-[calc(100dvh-14rem)] flex-col gap-4">
          <div className="flex items-center justify-end">
            <ChatThreadMenu
              threadId={threadId}
              returnTo={`/vendor-dashboard/clients/${eventId}?tab=chat`}
              blockedByMe={blockState.blockedByMe}
            />
          </div>
          <ChatPrivacyNotice />
          <ThreadInterestChips supabase={supabase} threadId={threadId} />
          <ChatMessageStream
            threadId={threadId}
            initialMessages={initialMessages}
            currentUserId={user.id}
            viewerRole="vendor"
            counterpartyLabel={eventName}
          />
          {/* Vendor accept-gate — replicate the thread page's exact branches: a
              vendor cannot reply until they ACCEPT the inquiry. Do not loosen. */}
          {blockState.blockedByMe || blockState.blockedByThem ? (
            <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4 text-sm text-ink/70">
              {blockState.blockedByMe
                ? 'You blocked this person. Unblock from the ⋯ menu to message again.'
                : 'You can no longer message in this conversation.'}
            </div>
          ) : fullThread.inquiry_status === 'accepted' ? (
            <ChatSendForm threadId={threadId} sendAction={sendChatMessage} />
          ) : fullThread.inquiry_status === 'pending' ? (
            <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
              <p className="text-sm text-ink">
                <span className="font-semibold">New inquiry.</span> Accept to open the
                chat and reply, or decline if you&rsquo;re not available for this date.
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={acceptInquiry}>
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input
                    type="hidden"
                    name="return_to"
                    value={`/vendor-dashboard/clients/${eventId}?tab=chat`}
                  />
                  <SubmitButton
                    pendingLabel="Accepting…"
                    className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
                  >
                    Accept inquiry
                  </SubmitButton>
                </form>
                <form action={declineInquiry}>
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input
                    type="hidden"
                    name="return_to"
                    value={`/vendor-dashboard/clients/${eventId}?tab=chat`}
                  />
                  <SubmitButton
                    pendingLabel="Declining…"
                    className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink hover:bg-ink/5"
                  >
                    Decline
                  </SubmitButton>
                </form>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4 text-sm text-ink/70">
              <p>
                You declined this inquiry. The couple has been notified and pointed to
                other vendors.
                {declineReason ? (
                  <>
                    {' '}
                    <span className="font-semibold text-ink">Your reason:</span> &ldquo;
                    {declineReason}&rdquo;
                  </>
                ) : null}
              </p>
            </div>
          )}
        </section>
      );
    }
  }
  if (!chatTabNode) {
    // No thread for this event → a small empty state (not a blank panel).
    chatTabNode = (
      <div className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
        <p className="text-sm text-ink/70">
          No conversation with {eventName} yet. When they message you (or you invite
          them), the thread opens here.
        </p>
        <Link
          href="/vendor-dashboard/messages"
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
        >
          <MessageSquare aria-hidden className="h-3.5 w-3.5" /> Go to Messages
        </Link>
      </div>
    );
  }

  // Payments tab — the vendor's LIVE payment-confirm surface (couple-logged
  // payments awaiting confirmation + per-booking plan progress / "mark cleared").
  // Reuses VendorPaymentLive exactly as the thread page does — no payment logic is
  // reimplemented. A genuine empty state stands in when there's nothing to confirm
  // or the booking isn't live.
  const paymentsTabNode =
    isBooked && threadId ? (
      pendingPayments.length === 0 && planRowsAll.length === 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Payments
          </p>
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
            <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> No payments to
            confirm yet. When {eventName} logs a payment, confirm it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Payments
          </p>
          <VendorPaymentLive
            threadId={threadId}
            eventId={eventId}
            initialPending={pendingPayments}
            initialPlans={planRowsAll}
          />
        </div>
      )
    ) : (
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Payments
        </p>
        <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
          <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> A payment
          schedule and couple-logged payments appear here once they book you
          {threadId ? '' : ' and you start a conversation'}.
        </p>
      </div>
    );

  const tabIconClass = 'h-3.5 w-3.5';
  const tabs: RelationshipTab[] = [
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare aria-hidden className={tabIconClass} />,
      node: chatTabNode,
    },
    {
      id: 'quote',
      label: 'Quote',
      icon: <FileText aria-hidden className={tabIconClass} />,
      node: quoteNode,
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: <Wallet aria-hidden className={tabIconClass} />,
      node: paymentsTabNode,
    },
    {
      id: 'files',
      label: 'Files',
      icon: <FolderOpen aria-hidden className={tabIconClass} />,
      node: filesNode,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: <CalendarDays aria-hidden className={tabIconClass} />,
      node: scheduleNode,
    },
    {
      id: 'call',
      label: 'Call',
      icon: <Phone aria-hidden className={tabIconClass} />,
      // callTabNode is only set once a thread resolves. No thread → hide the tab
      // (there's no marketplace/thread relationship to call through).
      node: callTabNode ?? (
        <p className="text-xs text-ink/55">
          Voice and video calls open once you start a conversation with {eventName}.
        </p>
      ),
      hidden: !threadId,
    },
    {
      id: 'details',
      label: 'Details',
      icon: <Info aria-hidden className={tabIconClass} />,
      // The this-event profile hub — the completion handshake (surfaced here as
      // a first-class node, mirroring the couple's Details tab), then the full
      // brief (with the returning-client marker + action bar, both already inside
      // OverviewTab) plus the activity log & private CRM notes.
      node: (
        <div className="space-y-6">
          {isBooked ? (
            <VendorCompletionCard
              eventId={eventId}
              isCompleteConfirmed={isCompleteConfirmed}
              isDisputed={isDisputed}
              isVendorMarked={isVendorMarked}
            />
          ) : null}
          {overviewNode}
          {activityNode}
        </div>
      ),
    },
  ];

  // ------------------------------------------------------------------------
  // Desktop context rail (3-pane · lg+ only). A compact, always-visible summary
  // of the client's stage + the VENDOR's next action (respond to inquiry / send
  // quote / confirm payment / deliver), plus quick links to the Chat / Payments
  // tabs. Reuses the pipeline + payment signals already computed above (no new
  // queries). The shell hides this under lg, and the mobile header already
  // carries the pipeline strip, so this is purely additive on desktop.
  // ------------------------------------------------------------------------
  let vRailTitle: string;
  let vRailBody: string;
  if (inquiryStatus === 'pending') {
    vRailTitle = 'Respond to the inquiry';
    vRailBody = `${eventName} reached out. Accept to open the chat, or decline if you’re not available.`;
  } else if (pendingPayments.length > 0) {
    const n = pendingPayments.length;
    vRailTitle = `Confirm ${n} payment${n === 1 ? '' : 's'}`;
    vRailBody = `${eventName} logged ${n === 1 ? 'a payment' : 'payments'} — confirm receipt to keep the plan on track.`;
  } else if (isDelivered) {
    vRailTitle = hasReview ? 'All wrapped up' : 'Awaiting confirmation';
    vRailBody = hasReview
      ? `${eventName} confirmed delivery and left a review.`
      : `You marked this delivered. ${eventName} confirms receipt (auto-confirms after 7 days).`;
  } else if (isBooked) {
    vRailTitle = 'You’re booked';
    vRailBody = `Coordinate the run-of-show and post deliverables as the day nears.`;
  } else if (isQuoted) {
    vRailTitle = 'Quote sent';
    vRailBody = `Your quote is with ${eventName}. Follow up in chat while you wait.`;
  } else {
    vRailTitle = 'Send a quote';
    vRailBody = `${eventName} is waiting. Reply in chat, then send a quote.`;
  }

  const vQuickLinkClass =
    'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/70 transition-colors hover:border-terracotta/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

  const contextRail = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink/10 bg-white p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
          Your next move
        </p>
        <div className="mt-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stagePill.cls}`}
          >
            {stagePill.label}
          </span>
        </div>
        <h3 className="mt-2 text-sm font-semibold text-ink">{vRailTitle}</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">{vRailBody}</p>
        {pendingPayments.length > 0 ? (
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-warn-900">
            {pendingPayments.length} awaiting confirmation
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={`/vendor-dashboard/clients/${eventId}?tab=chat`} className={vQuickLinkClass}>
          <MessageSquare aria-hidden className="h-3.5 w-3.5" /> Chat
        </a>
        <a href={`/vendor-dashboard/clients/${eventId}?tab=payments`} className={vQuickLinkClass}>
          <Wallet aria-hidden className="h-3.5 w-3.5" /> Payments
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
        <div>
          {backLink}
          {identityBlock}
          {actionRow}
          {pipelineBlock}
        </div>
      }
    />
  );
}

// ===========================================================================
// Disclosure-ladder locked row (inquiry stage).
// ===========================================================================
function LockRow({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-warn-300/60 bg-warn-50 px-3 py-2.5">
      <Lock aria-hidden className="h-4 w-4 shrink-0 text-warn-900" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-warn-900">{title}</p>
        <p className="text-xs text-warn-900/80">{sub}</p>
      </div>
    </div>
  );
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-ink/10 bg-white p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

// ===========================================================================
// Completion handshake card (booked) — the vendor's "Mark service complete"
// affordance + the four post-mark states. Extracted verbatim from OverviewTab
// so BOTH the inline flag-OFF render and the flag-ON relationship-shell
// Details-tab node share one source of truth (reuses vendorMarkServiceComplete —
// no handshake logic reimplemented).
// ===========================================================================
function VendorCompletionCard({
  eventId,
  isCompleteConfirmed,
  isDisputed,
  isVendorMarked,
}: {
  eventId: string;
  isCompleteConfirmed: boolean;
  isDisputed: boolean;
  isVendorMarked: boolean;
}) {
  return (
    <Card>
      {isCompleteConfirmed ? (
        <div className="flex items-center gap-3 text-sm">
          <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-success-600" strokeWidth={1.75} />
          <span className="text-ink/75">
            <span className="font-medium text-ink">Service complete.</span> The couple confirmed
            they received everything.
          </span>
        </div>
      ) : isDisputed ? (
        <div className="flex items-center gap-3 text-sm">
          <Clock3 aria-hidden className="h-5 w-5 shrink-0 text-warn-600" strokeWidth={1.75} />
          <span className="text-ink/75">
            <span className="font-medium text-ink">The couple reported a problem</span> with the
            delivery. Reach out via your thread to sort it out.
          </span>
        </div>
      ) : isVendorMarked ? (
        <div className="flex items-center gap-3 text-sm">
          <Clock3 aria-hidden className="h-5 w-5 shrink-0 text-ink/40" strokeWidth={1.75} />
          <span className="text-ink/75">
            <span className="font-medium text-ink">Marked complete.</span> Waiting on the couple to
            confirm they received everything (auto-confirms after 7 days).
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink/70">
            <span className="font-medium text-ink">Wrapped up this wedding?</span> Mark your
            service complete — the couple confirms they got everything, then their review opens.
          </div>
          <form action={vendorMarkServiceComplete}>
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton className="button-primary shrink-0" pendingLabel="Marking…">
              Mark service complete
            </SubmitButton>
          </form>
        </div>
      )}
    </Card>
  );
}

// ===========================================================================
// Returning-client marker + quick-action bar (Details/Overview tab, PR 5).
//
// Marker: rendered ONLY when `returningFlag` is present — i.e. this couple has a
// prior CONFIRMED booking with this vendor on a DIFFERENT event (answering an
// inquiry is now free — the returning-client signal is informational only). The reuse RPC returns the
// most-recent prior event's name/date (DISTINCT ON) — not an exact count and not
// its event_id — so we name that one past event rather than link a list.
//
// Action bar: shortcut links only (no new call/quote logic). Chat + Call both
// open the thread (the P2P call surface lands there per the Workspace spec);
// Quote deep-links the thread's #send-proposal composer; Files jumps to this
// card's Files tab; Details is the current view (inert).
// ===========================================================================
function ReturningMarkerAndActions({
  eventId,
  threadId,
  returningFlag,
}: {
  eventId: string;
  threadId: string | null;
  returningFlag: ReturningClientFlag | null;
}) {
  const actionBase =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors';

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
      {returningFlag ? (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry">
            <History aria-hidden className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-mulberry">
              Returning client · you&rsquo;ve worked together before
            </p>
            <p className="mt-0.5 text-xs text-ink/65">
              {returningFlag.prior_event_display_name ? (
                <>
                  Previously booked you for{' '}
                  <span className="font-medium text-ink/80">
                    {returningFlag.prior_event_display_name}
                  </span>
                  {returningFlag.prior_event_date
                    ? ` · ${fmtShortDate(returningFlag.prior_event_date)}`
                    : ''}
                  .
                </>
              ) : (
                'This couple has booked you on a previous event.'
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {threadId ? (
          <Link
            href={`/vendor-dashboard/messages/${threadId}`}
            className={`${actionBase} border-ink/15 bg-white text-ink/70 hover:border-terracotta/40`}
          >
            <MessageSquare aria-hidden className="h-3.5 w-3.5" /> Chat
          </Link>
        ) : null}
        {threadId ? (
          <Link
            href={`/vendor-dashboard/messages/${threadId}#thread-call`}
            className={`${actionBase} border-ink/15 bg-white text-ink/70 hover:border-terracotta/40`}
          >
            <Phone aria-hidden className="h-3.5 w-3.5" /> Call
          </Link>
        ) : null}
        <Link
          href={
            threadId
              ? `/vendor-dashboard/messages/${threadId}#send-proposal`
              : '/vendor-dashboard/proposals'
          }
          className={`${actionBase} border-mulberry bg-mulberry text-cream hover:bg-mulberry-600`}
        >
          <FileText aria-hidden className="h-3.5 w-3.5" /> Quote
        </Link>
        <Link
          href={`/vendor-dashboard/clients/${eventId}?tab=files`}
          className={`${actionBase} border-ink/15 bg-white text-ink/70 hover:border-terracotta/40`}
        >
          <FolderOpen aria-hidden className="h-3.5 w-3.5" /> Files
        </Link>
        <span
          aria-current="page"
          className={`${actionBase} cursor-default border-ink/15 bg-ink/5 text-ink/55`}
        >
          <Info aria-hidden className="h-3.5 w-3.5" /> Details
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// OVERVIEW TAB
// ===========================================================================
function OverviewTab(props: {
  eventId: string;
  brief: Brief;
  threadId: string | null;
  returningFlag: ReturningClientFlag | null;
  isBooked: boolean;
  isInquiry: boolean;
  paletteEntries: { key: string; label: string; colors: string[] }[];
  mealEntries: [string, number][];
  monogramSvg: string | null;
  isImported: boolean;
  editorialEligibility: Awaited<ReturnType<typeof getEditorialEligibility>>;
  canEditCocktail: boolean;
  vendorProfileId: string;
  /** Raw stored ref for this vendor's per-event booth poster, or null. */
  posterRef: string | null;
  /** Resolved display URL for the poster preview, or null. */
  posterDisplayUrl: string | null;
  completion: {
    deposit_proof_url: string | null;
  } | null;
  eventVendorId: string | null;
  depositRecorded: boolean;
  depositAcked: boolean;
  isCompleteConfirmed: boolean;
  isDisputed: boolean;
  isVendorMarked: boolean;
  /** Flag ON: the relationship shell renders the completion card as its own
   *  Details-tab node, so suppress the inline copy here to avoid doubling up.
   *  Flag OFF: false → the card renders inline exactly as before. */
  hideCompletion: boolean;
  search: { deposit_ack?: string; deposit_reject?: string };
}) {
  const {
    eventId,
    brief,
    threadId,
    returningFlag,
    isBooked,
    isInquiry,
    paletteEntries,
    mealEntries,
    monogramSvg,
    isImported,
    editorialEligibility,
    canEditCocktail,
    vendorProfileId,
    posterRef,
    posterDisplayUrl,
    completion,
    eventVendorId,
    depositRecorded,
    depositAcked,
    isCompleteConfirmed,
    isDisputed,
    isVendorMarked,
    hideCompletion,
    search,
  } = props;

  return (
    <div className="space-y-4">
      {/* Returning-client marker + quick-action bar (Relationship Workspace ·
          Details tab, PR 5). Additive — sits at the top of the Overview. */}
      <ReturningMarkerAndActions
        eventId={eventId}
        threadId={threadId}
        returningFlag={returningFlag}
      />

      {/* Imported hint (invite the couple to Setnayan). */}
      {isImported ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.05] p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Invite them to Setnayan — free</p>
            <p className="mt-0.5 text-sm text-ink/65">
              This couple lives in your own book. Invite them and their planning syncs here
              automatically.
            </p>
          </div>
          <Link
            href="/vendor-dashboard/clients"
            className="shrink-0 text-sm font-semibold text-terracotta hover:underline"
          >
            Invite →
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Event snapshot */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <CalendarDays aria-hidden className="h-4 w-4 text-terracotta" /> Event snapshot
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink/55">Date</dt>
              <dd className="text-right font-medium">{fmtDate(brief.event.event_date)}</dd>
            </div>
            {isBooked ? (
              <>
                {brief.event.venue_name ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink/55">Venue</dt>
                    <dd className="text-right font-medium">{brief.event.venue_name}</dd>
                  </div>
                ) : null}
                {brief.event.venue_address ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-ink/55">Address</dt>
                    <dd className="text-right font-medium">{brief.event.venue_address}</dd>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink/55">Area</dt>
                <dd className="text-right font-medium">
                  {brief.event.region ?? 'Not shared yet'}
                </dd>
              </div>
            )}
          </dl>
          {brief.event.ceremony_type ? (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white/70 px-2.5 py-1 text-xs font-medium text-ink/70">
              <Church aria-hidden className="h-3.5 w-3.5" />
              {brief.event.ceremony_type.replace(/_/g, ' ')}
            </span>
          ) : null}
          {isInquiry ? (
            <LockRow
              title="Exact venue address"
              sub="Unlocks when they book you — you see the area for now."
            />
          ) : null}
        </Card>

        {/* Headcount */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Users aria-hidden className="h-4 w-4 text-terracotta" /> Headcount
          </h2>
          {brief.pax.invited > 0 ? (
            <>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {brief.pax.attending}
                <span className="ml-2 text-sm font-normal text-ink/55">
                  attending of {brief.pax.invited} invited
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
                <span>{brief.pax.pending} pending</span>
                <span>{brief.pax.maybe} maybe</span>
                <span>{brief.pax.declined} declined</span>
              </div>
              <p className="mt-2 text-xs text-ink/45">
                RSVPs are still moving — numbers firm up closer to the day.
              </p>
            </>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2.5 text-sm text-ink/55">
              <Info aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> No guest list yet — this
              fills in once they start their RSVPs.
            </p>
          )}
        </Card>

        {/* Dietary (food-relevant categories + coordinator only) — booked only. */}
        {isBooked && brief.dietary ? (
          <Card>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
              <UtensilsCrossed aria-hidden className="h-4 w-4 text-terracotta" /> Meals
              <span className="text-xs font-normal text-ink/50">(attending guests)</span>
            </h2>
            {mealEntries.length === 0 ? (
              <p className="mt-2 text-sm text-ink/55">No meal preferences recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {mealEntries.map(([pref, n]) => (
                  <li key={pref} className="flex items-center justify-between text-sm">
                    <span>{MEAL_LABELS[pref] ?? pref}</span>
                    <span className="font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            {brief.dietary.restriction_notes > 0 ? (
              <p className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
                {brief.dietary.restriction_notes}{' '}
                {brief.dietary.restriction_notes === 1 ? 'guest has' : 'guests have'} dietary
                restriction notes — ask the couple for the details that matter to your menu.
              </p>
            ) : null}
            <Link
              href={`/vendor-dashboard/clients/${eventId}/production-sheet`}
              className="mt-3 inline-block text-sm font-medium text-terracotta underline"
            >
              Open the production sheet
            </Link>
          </Card>
        ) : isInquiry ? (
          <Card>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
              <UtensilsCrossed aria-hidden className="h-4 w-4 text-terracotta" /> Meals
            </h2>
            <LockRow
              title="Meal counts & dietary"
              sub="Unlocks when they book you — quote from the headcount for now."
            />
          </Card>
        ) : null}

        {/* Style — palette + monogram merged (per prototype). */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Palette aria-hidden className="h-4 w-4 text-terracotta" /> Style
          </h2>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-terracotta/20 bg-terracotta/[0.06] [&_svg]:h-full [&_svg]:w-full">
              {monogramSvg ? (
                // First-party asset from the couple's own monogram studio.
                <span dangerouslySetInnerHTML={{ __html: monogramSvg }} />
              ) : brief.monogram.text ? (
                <span
                  className="text-lg font-semibold tracking-wide"
                  style={{ color: brief.monogram.color ?? undefined }}
                >
                  {brief.monogram.text}
                </span>
              ) : (
                <Palette aria-hidden className="h-6 w-6 text-terracotta/50" />
              )}
            </div>
            <p className="text-xs text-ink/55">
              Their monogram &amp; palettes, pulled from the mood board.
            </p>
          </div>
          {paletteEntries.length === 0 ? (
            <p className="mt-3 text-sm text-ink/55">The couple hasn&rsquo;t set their palettes yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {paletteEntries.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink/70">{p.label}</span>
                  <span className="flex gap-1.5">
                    {p.colors.map((hex, i) => (
                      <span
                        key={`${hex}-${i}`}
                        title={hex}
                        className="h-5 w-5 rounded-full border border-ink/15"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/vendor-dashboard/clients/${eventId}/mood-board`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
          >
            Open mood board →
          </Link>
        </Card>

        {/* Budget — couple opt-in range for THIS vendor's category (PR-5).
         *  Rendered at both stages; it's a quote input, most useful at inquiry.
         *  Present → a rounded range; absent → the couple hasn't opted in (or has
         *  no allocation for this category). Never an exact figure. */}
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Wallet aria-hidden className="h-4 w-4 text-terracotta" /> Budget
          </h2>
          {brief.budget_band ? (
            <>
              <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                {fmtPesoCentavos(brief.budget_band.lo_centavos)}
                <span className="mx-1.5 text-ink/40">–</span>
                {fmtPesoCentavos(brief.budget_band.hi_centavos)}
              </p>
              <p className="mt-2 text-xs text-ink/55">
                Shared by the couple · for your category. A range to quote against —
                never their exact number.
              </p>
            </>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2.5 text-sm text-ink/55">
              <Info aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> Not shared —
              the couple hasn&rsquo;t opted into budget sharing.
            </p>
          )}
        </Card>
      </div>

      {/* Seat plan (booked) / locked (inquiry). */}
      {isBooked ? (
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <LayoutGrid aria-hidden className="h-4 w-4 text-terracotta" /> Seat plan
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                brief.seat_plan.published
                  ? 'bg-success-100 text-success-900'
                  : 'bg-ink/5 text-ink/60'
              }`}
            >
              {brief.seat_plan.published ? 'Published' : 'Not published yet'}
            </span>
            <span className="text-sm text-ink/65">
              {brief.seat_plan.table_count} tables · {brief.seat_plan.assigned_guests} guests seated
            </span>
          </div>
          {brief.seat_plan.published ? (
            <Link
              href={`/vendor-dashboard/clients/${eventId}/seat-plan`}
              className="mt-2 inline-block text-sm font-medium text-terracotta underline"
            >
              View the floor plan
            </Link>
          ) : (
            <p className="mt-2 text-xs text-ink/45">
              Once the couple publishes their floor plan, you&rsquo;ll be able to view it here.
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <LayoutGrid aria-hidden className="h-4 w-4 text-terracotta" /> Seat plan
          </h2>
          <LockRow
            title="Seat plan & tables"
            sub="Unlocks when they book you."
          />
        </Card>
      )}

      {/* "From your vendors" editorial media (booked, recommended pick only). */}
      {editorialEligibility.eligible ? (
        <Link
          href={`/vendor-dashboard/clients/${eventId}/editorial-media`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.05] p-4 transition hover:bg-terracotta/[0.08] sm:p-5"
        >
          <span>
            <span className="block text-sm font-semibold">Add to their editorial ✨</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              You&rsquo;re the couple&rsquo;s recommended pick — add up to 3 photos and 3 short clips of
              your work, credited to you on their front-page story.
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-terracotta">Open →</span>
        </Link>
      ) : editorialEligibility.isRecommendedPick ? (
        <div className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
          <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/30" strokeWidth={1.75} />
          <span>
            <span className="block text-sm font-semibold">Add to their editorial ✨</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              {editorialEligibility.isDisputed
                ? `${brief.event.display_name ?? 'The couple'} reported a problem with the delivery. Once that’s sorted out, you can add a photo or a 5-second clip to their story.`
                : `Once ${brief.event.display_name ?? 'the couple'} marks your service complete, you can add a photo or a 5-second clip to their story — credited to you on their front-page editorial.`}
            </span>
          </span>
        </div>
      ) : null}

      {/* Deposit acknowledge (booked). */}
      {/* Reject outcome — shown outside the deposit card because a successful
          reject clears the recorded markers (depositRecorded flips false). */}
      {search.deposit_reject === 'ok' ? (
        <Card>
          <p className="text-sm text-ink/75">
            <span className="font-medium text-ink">Marked as not received.</span> The couple was
            asked to re-submit their downpayment proof — you&rsquo;ll be prompted again when they do.
          </p>
        </Card>
      ) : search.deposit_reject === 'error' ? (
        <Card>
          <p role="alert" className="text-xs text-warn-900">That didn&rsquo;t go through — try again.</p>
        </Card>
      ) : null}

      {depositRecorded && eventVendorId ? (
        <Card>
          {search.deposit_ack === 'error' ? (
            <p role="alert" className="mb-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
              That didn&rsquo;t go through — try again.
            </p>
          ) : null}
          {depositAcked ? (
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-success-600" strokeWidth={1.75} />
              <span className="text-ink/75">
                <span className="font-medium text-ink">Deposit confirmed.</span> You&rsquo;ve confirmed
                you received the couple&rsquo;s deposit — their date is locked in.
                {completion?.deposit_proof_url ? (
                  <>
                    {' '}
                    <a
                      href={completion.deposit_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-terracotta underline-offset-2 hover:underline"
                    >
                      <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> View proof
                    </a>
                  </>
                ) : null}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-ink/70">
                <span className="font-medium text-ink">A couple recorded a deposit.</span> The date is
                held for you. Confirm you received it to lock it in.
                {completion?.deposit_proof_url ? (
                  <>
                    {' '}
                    <a
                      href={completion.deposit_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-terracotta underline-offset-2 hover:underline"
                    >
                      <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> View proof
                    </a>
                  </>
                ) : null}
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <form action={vendorAcknowledgeDeposit}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="vendor_id" value={eventVendorId} />
                  <SubmitButton className="button-primary w-full shrink-0 sm:w-auto" pendingLabel="Confirming…">
                    Confirm deposit received
                  </SubmitButton>
                </form>
                {/* Reject path — the vendor never received this payment. Clears
                    the couple's recorded deposit so they must re-submit (does NOT
                    un-lock the booking). Optional reason reaches the couple. */}
                <details className="text-right">
                  <summary className="cursor-pointer list-none text-[11px] font-medium text-ink/50 underline-offset-2 hover:text-ink/75 hover:underline">
                    Didn&rsquo;t receive it?
                  </summary>
                  <form action={vendorRejectDeposit} className="mt-2 flex flex-col gap-2 text-left">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="vendor_id" value={eventVendorId} />
                    <input
                      type="text"
                      name="reason"
                      maxLength={200}
                      placeholder="Reason (optional) — e.g. no payment received"
                      className="w-full rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-danger-400 focus:outline-none focus:ring-1 focus:ring-danger-400 sm:w-64"
                    />
                    <SubmitButton
                      className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-danger-300 bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-100"
                      pendingLabel="Sending…"
                    >
                      Didn&rsquo;t receive this payment
                    </SubmitButton>
                  </form>
                </details>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {/* Completion handshake (booked). Rendered inline on flag OFF; on flag ON
          the relationship shell surfaces it as its own Details-tab node instead
          (hideCompletion), so it isn't shown twice. */}
      {isBooked && !hideCompletion ? (
        <VendorCompletionCard
          eventId={eventId}
          isCompleteConfirmed={isCompleteConfirmed}
          isDisputed={isDisputed}
          isVendorMarked={isVendorMarked}
        />
      ) : null}

      {/* Cocktail area (booked, eligible). */}
      {canEditCocktail ? (
        <div className="rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <Martini aria-hidden className="h-4 w-4 text-terracotta" /> Cocktail area
          </h2>
          <p className="mt-2 text-sm text-ink/65">
            The couple opened up their cocktail / waiting area for you to arrange — place and move
            booths (and the room itself, if you&rsquo;re the stylist) right on their blueprint.
          </p>
          <Link
            href={`/vendor-dashboard/clients/${eventId}/cocktail`}
            className="mt-3 inline-block text-sm font-medium text-terracotta underline"
          >
            Arrange the cocktail area
          </Link>
        </div>
      ) : null}

      {/* Booth poster (booked). Deliberately NOT gated on canEditCocktail: the
          poster belongs to the vendor's presence at the event, not to the
          cocktail room, so a vendor whose booth sits in the reception must be
          able to dress it — matching vendor_set_booth_poster's wider gate. */}
      {isBooked ? (
        <BoothPosterCard
          eventId={eventId}
          vendorProfileId={vendorProfileId}
          initialRef={posterRef}
          initialDisplayUrl={posterDisplayUrl}
        />
      ) : null}

      {/* Papic Games — custom Photo Challenge authoring (booked-only). Self-gates
          on the flag + the vendor's Pro tier; renders nothing when off. */}
      {isBooked ? (
        <VendorChallengeSection eventId={eventId} vendorProfileId={vendorProfileId} />
      ) : null}

      {/* 3D Plan unlock (booked-only). A vendor with an ACTIVE 3D Booth add-on
          unlocks the discounted ₱1,000 SEATING_3D for this couple; self-gates on
          the add-on window (shows the honest "add the 3D Booth add-on" state when
          inactive). */}
      {isBooked ? (
        <Vendor3dPlanUnlockSection eventId={eventId} vendorProfileId={vendorProfileId} />
      ) : null}
    </div>
  );
}

// ===========================================================================
// QUOTE & PAYMENTS TAB
// ===========================================================================
function QuoteTab(props: {
  proposals: ProposalRow[];
  isBooked: boolean;
  planRollup: ReturnType<typeof computePlanRollup> | null;
  planStepRows: Awaited<ReturnType<typeof fetchPlanProgressForVendor>>[number] | null;
  pendingPayments: Awaited<ReturnType<typeof fetchPendingVendorPayments>>;
  threadId: string | null;
}) {
  const { proposals, isBooked, planRollup, planStepRows, pendingPayments, threadId } = props;
  const steps = planStepRows?.steps ?? null;

  return (
    <div className="space-y-6">
      {/* Quotation */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Quotation
        </p>
        {proposals.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
            <FileText aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> No quotes sent yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li
                key={p.proposal_id}
                className="flex items-center gap-3 rounded-xl border border-ink/10 border-l-[3px] border-l-terracotta bg-white px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{formatCentavos(p.total_centavos)}</p>
                  <p className="truncate text-xs text-ink/55">
                    {p.title ? `${p.title} · ` : ''}
                    {p.sent_at ? `Sent ${fmtShortDate(p.sent_at)}` : `Created ${fmtShortDate(p.created_at)}`}
                    {p.valid_until ? ` · valid until ${fmtShortDate(p.valid_until)}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${PROPOSAL_STATUS_TONE[p.status]}`}
                >
                  {PROPOSAL_STATUS_LABEL[p.status]}
                </span>
                <Link
                  href={`/proposals/${p.public_id}`}
                  className="shrink-0 text-xs font-medium text-terracotta hover:underline"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/vendor-dashboard/proposals"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-terracotta/40"
        >
          <FileText aria-hidden className="h-3.5 w-3.5" /> New quote
        </Link>
      </div>

      {/* Payments */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Payments
        </p>
        {!isBooked ? (
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
            <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> A payment schedule
            appears once they book you and pay a downpayment.
          </p>
        ) : steps && steps.length > 0 && planRollup ? (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-ink/55">
              <span>
                <span className="font-semibold text-ink">{fmtPeso(planRollup.received)}</span>{' '}
                received of {fmtPeso(planRollup.total)}
              </span>
              <span>{planRollup.percentReceived}%</span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-success-600"
                style={{ width: `${Math.min(100, planRollup.percentReceived)}%` }}
              />
            </div>
            <ul className="space-y-2">
              {steps.map((s) => (
                <li
                  key={s.seq}
                  className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      s.state === 'paid'
                        ? 'border-success-600 bg-success-600 text-white'
                        : 'border-ink/20 bg-white'
                    }`}
                  >
                    {s.state === 'paid' ? <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {s.label} · {fmtPeso(s.amount_php)}
                    </p>
                    {s.due_date ? (
                      <p className="text-xs text-ink/55">Due {fmtShortDate(s.due_date)}</p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      s.state === 'paid'
                        ? 'bg-success-100 text-success-900'
                        : s.state === 'pending'
                          ? 'bg-warn-100 text-warn-900'
                          : 'bg-ink/5 text-ink/60'
                    }`}
                  >
                    {s.state === 'paid' ? 'Paid' : s.state === 'pending' ? 'Pending' : 'Open'}
                  </span>
                </li>
              ))}
            </ul>
            {planRollup.next ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-terracotta/25 bg-terracotta/[0.06] px-3 py-2.5 text-sm text-ink/70">
                <Wallet aria-hidden className="h-4 w-4 shrink-0 text-terracotta" />
                <span>
                  Next expected: <span className="font-semibold text-ink">{planRollup.next.label}</span>{' '}
                  · {fmtPeso(planRollup.next.amountPhp)}
                  {planRollup.next.dueDate ? ` · due ${fmtShortDate(planRollup.next.dueDate)}` : ''}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-success-700">All installments settled.</p>
            )}
            {planStepRows?.reservationAcknowledgedAt ? (
              <p className="mt-2 text-xs text-ink/45">
                Protected by your reservation policy · acknowledged{' '}
                {fmtShortDate(planStepRows.reservationAcknowledgedAt)}.
              </p>
            ) : null}
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
            <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> No formal payment schedule
            on this booking yet.
          </p>
        )}

        {/* Pending couple-logged payments awaiting confirmation. */}
        {pendingPayments.length > 0 ? (
          <div className="mt-3 rounded-xl border border-warn-300/50 bg-warn-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-warn-900">
              {pendingPayments.length} payment{pendingPayments.length === 1 ? '' : 's'} awaiting your
              confirmation
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-warn-900/85">
              {pendingPayments.map((pp) => (
                <li key={pp.paymentId}>
                  {fmtPeso(pp.amountPhp)}
                  {pp.installmentLabel ? ` · ${pp.installmentLabel}` : ''} · logged{' '}
                  {fmtShortDate(pp.paidAt)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {threadId ? (
          <Link
            href={`/vendor-dashboard/messages/${threadId}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-cream"
          >
            <Wallet aria-hidden className="h-3.5 w-3.5" /> Log &amp; confirm payments in chat
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ===========================================================================
// FILES TAB
// ===========================================================================
function FilesTab(props: {
  contracts: ContractRow[];
  threadId: string | null;
  handovers: HandoverRow[];
  isBooked: boolean;
}) {
  const { contracts, threadId, handovers, isBooked } = props;
  // Handover deliverables that carry a file/link the vendor sent (a light
  // "files shared" view alongside contracts, since 0019 thread attachments are
  // deferred in V1 — there is no thread-attachments table to read).
  const handoverFiles = handovers.filter(
    (h) => (h.kind === 'file' || h.kind === 'gallery_link') && h.payload,
  );
  const hasAny = contracts.length > 0 || handoverFiles.length > 0;

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Shared files</p>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-ink/15 bg-white px-4 py-6 text-center">
          <FolderOpen aria-hidden className="mx-auto h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-ink/55">
            No files here yet. Contracts you upload for this couple show up here; share other files
            in your chat.
          </p>
          {threadId ? (
            <Link
              href={`/vendor-dashboard/messages/${threadId}`}
              className="mt-2 inline-block text-sm font-medium text-terracotta hover:underline"
            >
              Share files in chat →
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {contracts.map((c) => (
            <li
              key={c.contract_id}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-white/70 text-ink/60">
                <FileText aria-hidden className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.file_name ?? c.title ?? 'Contract.pdf'}
                </p>
                <p className="text-xs text-ink/55">
                  Contract · {c.status.replace(/_/g, ' ')} · {fmtShortDate(c.created_at)}
                </p>
              </div>
              {c.file_url ? (
                <a
                  href={c.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-terracotta hover:underline"
                >
                  Open →
                </a>
              ) : null}
            </li>
          ))}
          {handoverFiles.map((h) => (
            <li
              key={h.handover_id}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-white/70 text-ink/60">
                {h.kind === 'gallery_link' ? (
                  <Link2 aria-hidden className="h-4 w-4" />
                ) : (
                  <PackageCheck aria-hidden className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {h.label ?? HANDOVER_KIND_LABEL[h.kind]}
                </p>
                <p className="text-xs text-ink/55">
                  You shared · {fmtShortDate(h.delivered_at)}
                </p>
              </div>
              {h.payload ? (
                <a
                  href={h.payload}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-terracotta hover:underline"
                >
                  Open →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {hasAny && threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}`}
          className="inline-block text-sm font-medium text-terracotta hover:underline"
        >
          Share more files in chat →
        </Link>
      ) : null}

      {isBooked ? (
        <p className="text-xs text-ink/45">
          Deliver galleries and proofs from the Schedule tab&rsquo;s handover panel — the couple
          confirms receipt there.
        </p>
      ) : null}
    </div>
  );
}

// ===========================================================================
// SCHEDULE TAB — the entire existing timeline block + seat-plan behavior.
// ===========================================================================
function ScheduleTab(props: {
  eventId: string;
  isInquiry: boolean;
  brief: Brief;
  allBlocks: LiveBlock[];
  blocks: LiveBlock[];
  relevance: Map<string, ReturnType<typeof blockRelevance>>;
  mineOnly: boolean;
  mineCount: number;
  runOfShowBlocks: RunOfShowBlock[];
  callTime: ReturnType<typeof deriveCallTime>;
  callTimeAlreadyRequested: boolean;
  suggestions: SuggestionRow[];
  blockLabel: Map<string, string>;
  handovers: HandoverRow[];
  eventVendorId: string | null;
  changeOrders: VendorChangeOrderRow[];
  search: { suggest?: string; handover?: string; change_order?: string; change_order_resp?: string };
}) {
  const {
    eventId,
    isInquiry,
    allBlocks,
    blocks,
    relevance,
    mineOnly,
    mineCount,
    runOfShowBlocks,
    callTime,
    callTimeAlreadyRequested,
    suggestions,
    blockLabel,
    handovers,
    eventVendorId,
    changeOrders,
    search,
  } = props;

  // Inquiry stage — locked timeline, no suggest forms (disclosure ladder).
  if (isInquiry) {
    return (
      <div className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Day-of timeline</p>
        <LockRow
          title="Full day-of timeline"
          sub="Unlocks when they book you. You can propose a call time once you're booked."
        />
        <p className="text-sm text-ink/55">
          Seat plan, run-of-show, and the change-request tools open the moment this couple books you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            <CalendarDays aria-hidden className="h-4 w-4 text-terracotta" /> Day-of timeline
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {allBlocks.length > 0 && mineCount > 0 && mineCount < allBlocks.length ? (
              <span className="inline-flex overflow-hidden rounded-full border border-ink/15 text-xs font-medium">
                <Link
                  href={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
                  className={`px-3 py-1 ${!mineOnly ? 'bg-ink text-cream' : 'bg-white text-ink/60 hover:text-ink'}`}
                >
                  Full timeline
                </Link>
                <Link
                  href={`/vendor-dashboard/clients/${eventId}?tab=schedule&lens=mine`}
                  className={`px-3 py-1 ${mineOnly ? 'bg-ink text-cream' : 'bg-white text-ink/60 hover:text-ink'}`}
                >
                  My slots only
                </Link>
              </span>
            ) : null}
            {allBlocks.length > 0 ? (
              <a
                href={`/vendor-dashboard/clients/${eventId}/calendar.ics${mineOnly ? '?mine=1' : ''}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-terracotta underline"
              >
                <CalendarPlus aria-hidden className="h-4 w-4" /> Add to calendar
              </a>
            ) : null}
          </div>
        </div>

        {runOfShowBlocks.length > 0 ? (
          <div className="mt-3">
            <RunOfShowHeader eventId={eventId} initial={runOfShowBlocks} canAdvance compact />
          </div>
        ) : null}

        {callTime && !callTimeAlreadyRequested ? (
          <div className="mt-3 rounded-xl border border-terracotta/30 bg-terracotta/5 px-3 py-2.5">
            <p className="text-sm">
              <span className="font-semibold">Suggested call time · {fmtTime(callTime.call_time)}</span>{' '}
              <span className="text-ink/65">
                — {callTime.lead_minutes / 60} hr setup before {callTime.anchor_label} (
                {fmtTime(callTime.anchor_start_at)}). A rule-of-thumb, not a booking — confirm with
                your couple.
              </span>
            </p>
            <form action={suggestScheduleChange} className="mt-2">
              <input type="hidden" name="event_id" value={eventId} />
              <input
                type="hidden"
                name="proposed_label"
                value={`${CATEGORY_LABELS[callTime.category] ?? callTime.category} setup / call time`}
              />
              <input type="hidden" name="proposed_start_at" value={callTime.call_time} />
              <input type="hidden" name="proposed_end_at" value={callTime.anchor_start_at} />
              <input
                type="hidden"
                name="note"
                value={`Suggested call time ${fmtTime(callTime.call_time)} — ${
                  callTime.lead_minutes / 60
                } hr setup ahead of ${callTime.anchor_label}.`}
              />
              <SubmitButton
                pendingLabel="Requesting…"
                className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream"
              >
                Request this call time
              </SubmitButton>
            </form>
          </div>
        ) : null}

        {search.suggest === 'sent' ? (
          <p role="status" className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-900">
            Request sent — the couple (or their coordinator) will review it.
          </p>
        ) : null}
        {search.suggest === 'error' ? (
          <p role="alert" className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
            That didn&rsquo;t send — try again.
          </p>
        ) : null}

        {allBlocks.length === 0 ? (
          <p className="mt-2 text-sm text-ink/55">
            The couple hasn&rsquo;t built their event-day timeline yet.
          </p>
        ) : blocks.length === 0 ? (
          <p className="mt-2 text-sm text-ink/55">
            No blocks match your booked categories yet —{' '}
            <Link
              href={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
              className="text-terracotta underline"
            >
              see the full timeline
            </Link>
            .
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-ink/10">
            {blocks.map((b) => (
              <li
                key={b.block_id}
                className={`py-2.5 pl-3 ${
                  relevance.get(b.block_id) === 'primary'
                    ? 'border-l-2 border-terracotta'
                    : relevance.get(b.block_id) === 'supporting'
                      ? 'border-l-2 border-ink/20'
                      : 'border-l-2 border-transparent opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="w-36 shrink-0 text-sm font-medium tabular-nums text-ink/70">
                    {fmtTime(b.start_at) ?? 'Time TBD'}
                    {fmtTime(b.end_at) ? ` – ${fmtTime(b.end_at)}` : ''}
                  </span>
                  <span className="text-sm font-medium">{b.label}</span>
                  {relevance.get(b.block_id) === 'primary' ? (
                    <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-terracotta">
                      Your slot
                    </span>
                  ) : null}
                  {b.location ? <span className="text-xs text-ink/55">{b.location}</span> : null}
                </div>
                <details className="mt-1 pl-0 sm:pl-40">
                  <summary className="inline-flex cursor-pointer items-center gap-1 text-xs text-ink/55 hover:text-ink">
                    <MessageSquarePlus aria-hidden className="h-3.5 w-3.5" /> Request a change
                  </summary>
                  <form action={suggestScheduleChange} className="mt-2 grid max-w-md gap-2">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="block_id" value={b.block_id} />
                    <textarea
                      name="note"
                      required
                      maxLength={1000}
                      rows={2}
                      placeholder={`e.g. "We need ingress 2 hours before ${b.label}."`}
                      className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="datetime-local" name="proposed_start_at" className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-xs" />
                      <span className="text-xs text-ink/45">to</span>
                      <input type="datetime-local" name="proposed_end_at" className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-xs" />
                      <span className="text-xs text-ink/45">(optional new time)</span>
                    </div>
                    <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                      Send request
                    </SubmitButton>
                  </form>
                </details>
              </li>
            ))}
          </ol>
        )}

        <details className="mt-4 rounded-xl border border-ink/10 bg-white/50 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Suggest a new timeline entry</summary>
          <form action={suggestScheduleChange} className="mt-3 grid max-w-md gap-2">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="text" name="proposed_label" required maxLength={120} placeholder="e.g. Booth setup / ingress" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
            <textarea name="note" required maxLength={1000} rows={2} placeholder="Why this slot matters" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              <input type="datetime-local" name="proposed_start_at" className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-xs" />
              <span className="text-xs text-ink/45">to</span>
              <input type="datetime-local" name="proposed_end_at" className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-xs" />
            </div>
            <input type="text" name="proposed_location" maxLength={200} placeholder="Location (optional)" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
            <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
              Send suggestion
            </SubmitButton>
          </form>
        </details>

        {suggestions.length > 0 ? (
          <div className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Your requests</p>
            <ul className="mt-1.5 space-y-1">
              {suggestions.map((s) => (
                <li key={s.suggestion_id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      s.status === 'accepted'
                        ? 'bg-success-100 text-success-900'
                        : s.status === 'declined'
                          ? 'bg-ink/5 text-ink/50'
                          : 'bg-warn-100 text-warn-900'
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="text-ink/70">
                    {s.kind === 'adjust'
                      ? `${blockLabel.get(s.block_id ?? '') ?? 'a block'} — `
                      : 'New entry — '}
                    {s.note.slice(0, 80)}
                    {s.note.length > 80 ? '…' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Delivery handover (Wave 4). */}
        <div className="mt-5 border-t border-ink/10 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <PackageCheck aria-hidden className="h-4 w-4 text-terracotta" /> Deliver the handover
          </h3>
          <p className="mt-1 text-xs text-ink/55">
            Send the couple their finished work — a gallery link, a sample/proof image, or a closing
            note. They confirm receipt, which marks your booking delivered.
          </p>

          {search.handover === 'sent' ? (
            <p role="status" className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-900">
              Handover sent — the couple will confirm receipt.
            </p>
          ) : null}
          {search.handover && search.handover !== 'sent' ? (
            <p role="alert" className="mt-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
              {search.handover === 'badurl'
                ? 'That gallery link needs to start with http(s)://.'
                : search.handover === 'nofile'
                  ? 'Choose an image to upload.'
                  : search.handover === 'empty'
                    ? 'Add a note before sending.'
                    : search.handover === 'upload'
                      ? 'That image couldn’t upload — try a PNG/JPEG under 6 MB.'
                      : 'That didn’t send — try again.'}
            </p>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <Link2 aria-hidden className="h-3.5 w-3.5 text-ink/55" /> Share a gallery link
              </summary>
              <form action={vendorPostHandover} className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="gallery_link" />
                <input type="text" name="label" maxLength={200} placeholder="e.g. Full wedding gallery" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                <input type="url" name="payload" required placeholder="https://…" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                <p className="text-[11px] text-ink/45">Big galleries stay on your link (Drive, Pixieset, etc.) — we don’t re-host them.</p>
                <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Send link
                </SubmitButton>
              </form>
            </details>

            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <FileText aria-hidden className="h-3.5 w-3.5 text-ink/55" /> Upload a sample/proof
              </summary>
              <form action={vendorPostHandover} className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="file" />
                <input type="text" name="label" maxLength={200} placeholder="e.g. Edited preview" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic" required className="text-xs" />
                <p className="text-[11px] text-ink/45">A single image, max 6 MB. For full sets, share a gallery link instead.</p>
                <SubmitButton pendingLabel="Uploading…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Upload
                </SubmitButton>
              </form>
            </details>

            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <MessageSquarePlus aria-hidden className="h-3.5 w-3.5 text-ink/55" /> Leave a note
              </summary>
              <form action={vendorPostHandover} className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="note" />
                <input type="text" name="label" maxLength={200} placeholder="Subject (optional)" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                <textarea name="payload" required maxLength={4000} rows={2} placeholder="e.g. Drive folder shared to your email — download within 30 days." className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Send note
                </SubmitButton>
              </form>
            </details>

            <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
                <PackageCheck aria-hidden className="h-3.5 w-3.5 text-ink/55" /> All delivered (sign-off)
              </summary>
              <form action={vendorPostHandover} className="mt-2 grid gap-2">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="kind" value="signoff" />
                <textarea name="payload" maxLength={4000} rows={2} placeholder="Closing note (optional) — e.g. Everything’s been delivered. Thank you!" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
                <SubmitButton pendingLabel="Sending…" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                  Mark all delivered
                </SubmitButton>
              </form>
            </details>
          </div>

          {handovers.length > 0 ? (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Your handovers</p>
              <ul className="mt-1.5 space-y-1.5">
                {handovers.map((h) => (
                  <li key={h.handover_id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        h.status === 'acknowledged'
                          ? 'bg-success-100 text-success-900'
                          : h.status === 'disputed'
                            ? 'bg-warn-100 text-warn-900'
                            : 'bg-ink/5 text-ink/60'
                      }`}
                    >
                      {h.status === 'acknowledged' ? 'received' : h.status}
                    </span>
                    <span className="text-ink/70">
                      {HANDOVER_KIND_LABEL[h.kind]}
                      {h.label ? ` — ${h.label}` : ''}
                    </span>
                    {h.kind === 'gallery_link' && h.payload ? (
                      <a href={h.payload} target="_blank" rel="noreferrer" className="text-terracotta underline">
                        open link
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* Change-Order Trail (Wave 3). */}
      {eventVendorId ? (
        <div className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <FilePlus2 aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-ink">Change orders</h2>
          </div>

          {search.change_order === 'sent' || search.change_order_resp === 'ok' ? (
            <p className="mb-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700">
              Done — the couple has been notified.
            </p>
          ) : null}
          {search.change_order === 'error' || search.change_order_resp === 'error' ? (
            <p role="alert" className="mb-3 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn-900">
              That didn&rsquo;t go through — try again.
            </p>
          ) : null}

          <p className="mb-3 text-sm text-ink/65">
            Added or dropped something after booking? Log a change order — the couple accepts or
            declines, and an accepted change updates their budget. Setnayan never holds the money.
          </p>

          <details className="mb-4 sn-row p-3">
            <summary className="cursor-pointer text-sm font-medium text-terracotta">
              Propose a change
            </summary>
            <form action={vendorRaiseChangeOrder} className="mt-3 space-y-3">
              <input type="hidden" name="event_id" value={eventId} />
              <div className="flex flex-wrap items-center gap-4 text-xs text-ink/70">
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="change_kind" value="add-on" defaultChecked />
                  Add-on (adds cost)
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="change_kind" value="removal" />
                  Removal (credit back)
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-ink/70">
                  What&rsquo;s changing
                  <input
                    type="text"
                    name="title"
                    required
                    maxLength={120}
                    placeholder="e.g. Extra hour of coverage"
                    className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                  />
                </label>
                <label className="block text-xs font-medium text-ink/70">
                  Amount (₱)
                  <input
                    type="number"
                    name="amount_php"
                    min="1"
                    step="0.01"
                    required
                    inputMode="decimal"
                    placeholder="e.g. 5000"
                    className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-ink/70">
                Due date <span className="text-ink/40">(optional)</span>
                <input
                  type="date"
                  name="proposed_due_date"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta sm:w-56"
                />
              </label>
              <label className="block text-xs font-medium text-ink/70">
                Details <span className="text-ink/40">(optional)</span>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={2000}
                  placeholder="Anything the couple should know"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                />
              </label>
              <SubmitButton className="button-primary" pendingLabel="Sending…">
                Send to couple
              </SubmitButton>
            </form>
          </details>

          {changeOrders.length === 0 ? (
            <p className="text-xs italic text-ink/45">No change orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {changeOrders.map((co) => {
                const chip = CO_STATUS[co.status];
                const isCoupleRaised = co.raised_by === 'couple';
                const isProposed = co.status === 'proposed';
                const deltaNum =
                  typeof co.delta_amount_php === 'string'
                    ? Number(co.delta_amount_php)
                    : co.delta_amount_php ?? 0;
                return (
                  <li key={co.change_order_id} className="rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                          {co.title ?? 'Change order'}
                          <span className="font-normal text-ink/40">·</span>
                          <span className={`font-mono ${deltaNum < 0 ? 'text-success-700' : 'text-ink/75'}`}>
                            {fmtDelta(co.delta_amount_php)}
                          </span>
                        </p>
                        <p className="text-[11px] text-ink/50">
                          {isCoupleRaised ? 'Couple proposed' : 'You proposed'} · {fmtCODate(co.created_at)}
                          {co.proposed_due_date ? ` · due ${fmtCODate(co.proposed_due_date)}` : ''}
                        </p>
                        {co.description ? <p className="mt-1 text-xs text-ink/60">{co.description}</p> : null}
                        {co.status === 'declined' && co.decline_reason ? (
                          <p className="mt-1 text-xs text-ink/55">Reason: {co.decline_reason}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip.cls}`}
                      >
                        {chip.label}
                      </span>
                    </div>

                    {isProposed && isCoupleRaised ? (
                      <div className="mt-2 flex items-center gap-2">
                        <form action={vendorRespondChangeOrder}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="change_order_id" value={co.change_order_id} />
                          <input type="hidden" name="decision" value="accept" />
                          <SubmitButton className="button-primary text-[11px]" pendingLabel="Accepting…">
                            Accept
                          </SubmitButton>
                        </form>
                        <form action={vendorRespondChangeOrder}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="change_order_id" value={co.change_order_id} />
                          <input type="hidden" name="decision" value="decline" />
                          <SubmitButton
                            className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-cream"
                            pendingLabel="Declining…"
                          >
                            Decline
                          </SubmitButton>
                        </form>
                      </div>
                    ) : null}

                    {isProposed && !isCoupleRaised ? (
                      <form action={vendorWithdrawChangeOrder} className="mt-2">
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="change_order_id" value={co.change_order_id} />
                        <SubmitButton
                          className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-cream"
                          pendingLabel="Withdrawing…"
                        >
                          Withdraw
                        </SubmitButton>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
