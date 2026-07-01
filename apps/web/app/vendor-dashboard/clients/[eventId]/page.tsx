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
  LayoutGrid,
  Link2,
  Martini,
  MessageSquarePlus,
  PackageCheck,
  Palette,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { getEditorialEligibility } from '@/lib/editorial-vendor-media';
import { blockRelevance, deriveCallTime } from '@/lib/vendor-timeline';
import { SubmitButton } from '@/app/_components/submit-button';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import {
  suggestScheduleChange,
  vendorMarkServiceComplete,
  vendorAcknowledgeDeposit,
  vendorPostHandover,
  vendorRaiseChangeOrder,
  vendorRespondChangeOrder,
  vendorWithdrawChangeOrder,
} from './actions';

export const metadata = { title: 'Event Brief · Vendor' };

/**
 * Vendor Event Brief — Phase 1 of the feature-access-by-category program
 * (corpus 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 2,
 * owner-locked 2026-06-12).
 *
 * Everything a booked vendor needs at a glance — pax + RSVP trend, palette,
 * monogram, the full day-of timeline (locked D2), seat-plan status — composed
 * entirely from data the couple already maintains. Aggregates only: the
 * backing RPC (get_vendor_event_brief) never returns guest rows, and dietary
 * counts only surface to food-relevant categories + the coordinator.
 *
 * Free for ALL booked vendors — tiers sell reach, not features.
 */

type Brief = {
  event: {
    display_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    ceremony_type: string | null;
  };
  booked_categories: string[];
  pax: { invited: number; attending: number; maybe: number; pending: number; declined: number };
  dietary: { meal_counts: Record<string, number>; restriction_notes: number } | null;
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

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

// Change-Order Trail formatters (signed delta + short date).
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

const CO_STATUS: Record<
  VendorChangeOrderRow['status'],
  { label: string; cls: string }
> = {
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

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    suggest?: string;
    lens?: string;
    deposit_ack?: string;
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

export default async function VendorEventBriefPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Booked gate + aggregation live inside the SECURITY DEFINER RPC — an error
  // means not booked on this event (or it doesn't exist); bounce to Clients.
  const { data, error } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  if (error || !data) redirect('/vendor-dashboard/clients');
  const brief = data as Brief;

  // Everything below the booked-gate is independent of the brief and of each
  // other (except the change-order trail, which needs the event_vendor id from
  // the completion row). Batch it into ONE parallel round-trip instead of the
  // former 5-step waterfall (2026-07-01 perf):
  //   • "From your vendors" editorial-media eligibility — surfaced to the
  //     couple's RECOMMENDED pick (selection_match_rank = 1). The active card
  //     opens only AFTER completion is confirmed (Stage-10 gate).
  //   • Completion handshake state (Event Lifecycle Menu §6.1) — admin read;
  //     the vendor is already booked-gated by the RPC above.
  //   • Cocktail-area editability probe — a clean result means we can show the
  //     "arrange it" entry point.
  //   • Phase 3 live timeline rows + this org's suggestion history + booking↔
  //     contract presence (2026-06-22).
  //   • Delivery Handover (Wave 4) — this org's posted handovers for the booking.
  const admin = createAdminClient();
  const [
    editorialEligibility,
    { data: completionRow },
    { data: cocktailEdit },
    [{ data: liveBlocks }, { data: mySuggestions }, contractRes],
    { data: handoverRows },
  ] = await Promise.all([
    getEditorialEligibility(admin, eventId, profile.vendor_profile_id),
    admin
      .from('event_vendors')
      .select(
        'vendor_id, completion_status, service_marked_complete_at, customer_confirmed_received_at, deposit_recorded_at, deposit_acknowledged_at, deposit_proof_url',
      )
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', profile.vendor_profile_id)
      .maybeSingle(),
    supabase.rpc('get_vendor_cocktail_editor', { p_event_id: eventId }),
    Promise.all([
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
      supabase
        .from('vendor_contracts')
        .select('contract_id')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .neq('status', 'cancelled')
        .limit(1),
    ]),
    supabase
      .from('booking_handovers')
      .select('handover_id, kind, label, payload, status, delivered_at, couple_acknowledged_at')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const completion = (completionRow ?? null) as {
    vendor_id: string | null;
    completion_status: string | null;
    service_marked_complete_at: string | null;
    customer_confirmed_received_at: string | null;
    deposit_recorded_at: string | null;
    deposit_acknowledged_at: string | null;
    deposit_proof_url: string | null;
  } | null;
  // Deposit Reservation Lock-Free — the couple recorded a deposit (date held);
  // the vendor confirms receipt here. Acknowledge is a signal, not money.
  const depositRecorded = Boolean(completion?.deposit_recorded_at);
  const depositAcked = Boolean(completion?.deposit_acknowledged_at);
  const eventVendorId = completion?.vendor_id ?? null;
  const isCompleteConfirmed =
    completion?.completion_status === 'confirmed' ||
    completion?.completion_status === 'auto_confirmed' ||
    Boolean(completion?.customer_confirmed_received_at);
  const isDisputed = completion?.completion_status === 'disputed';
  const isVendorMarked = Boolean(completion?.service_marked_complete_at) && !isCompleteConfirmed && !isDisputed;

  const canEditCocktail = !!cocktailEdit;

  const hasContract = (contractRes.data?.length ?? 0) > 0;
  const allBlocks = (liveBlocks ?? []) as LiveBlock[];
  const suggestions = (mySuggestions ?? []) as SuggestionRow[];

  // Change-Order Trail (Wave 3) — the both-acknowledged add-on/removal log for
  // this booking. Depends on the event_vendor id resolved in the completion read
  // above, so it's the one query that must follow the batch.
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
  const blockLabel = new Map(allBlocks.map((b) => [b.block_id, b.label]));

  const handovers = (handoverRows ?? []) as HandoverRow[];

  // Run-of-show header rows (now/next/±N) — derived from the live timeline's
  // run_state. Booked vendors may advance the run-state (the RPC allows it), so
  // canAdvance is true here.
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

  // ① Category-aware lens: deterministic relevance per block (rule map in
  // lib/vendor-timeline.ts). A lens, never a gate — "My slots" filters the
  // CLIENT VIEW of rows the vendor is already authorized to read (locked D2).
  const relevance = new Map(
    allBlocks.map((b) => [b.block_id, blockRelevance(b, brief.booked_categories)]),
  );
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
  const mealEntries = Object.entries(brief.dietary?.meal_counts ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const monogramSvg =
    brief.monogram.custom_svg && brief.monogram.custom_svg.trimStart().startsWith('<svg')
      ? brief.monogram.custom_svg
      : null;

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/vendor-dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Clients
      </Link>

      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Users aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {brief.event.display_name ?? 'Event brief'}
        </h1>
        <p className="text-base text-ink/65">
          {fmtDate(brief.event.event_date)}
          {brief.event.venue_name ? ` · ${brief.event.venue_name}` : ''}
        </p>
        {brief.event.venue_address ? (
          <p className="text-sm text-ink/55">{brief.event.venue_address}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {brief.event.ceremony_type ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-medium text-ink/70">
              <Church aria-hidden className="h-3.5 w-3.5" />
              {brief.event.ceremony_type.replace(/_/g, ' ')}
            </span>
          ) : null}
          {brief.booked_categories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full bg-terracotta/10 px-3 py-1 text-xs font-medium text-terracotta"
            >
              Booked · {CATEGORY_LABELS[c] ?? c}
            </span>
          ))}
        </div>
        <p className="max-w-prose text-sm text-ink/55">
          A live brief composed from the couple&rsquo;s own planning — headcounts and
          colors update as they plan. Counts only: guest names and contacts stay
          private.
        </p>
      </header>

      {/* Booking↔contract CTA (2026-06-22) — start a contract straight from the
          booking, pre-filled with this couple, instead of only from the
          contracts tab's blank event picker. */}
      <Link
        href={
          hasContract
            ? '/vendor-dashboard/contracts'
            : `/vendor-dashboard/contracts/new?event=${eventId}`
        }
        className="flex items-center justify-between gap-4 rounded-2xl border border-ink/15 bg-white p-4 transition hover:border-terracotta/40 hover:bg-terracotta/[0.04] sm:p-6"
      >
        <span className="flex items-start gap-3">
          <FileText aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span>
            <span className="block text-lg font-semibold">
              {hasContract ? 'Manage your contract' : 'Create a contract'}
            </span>
            <span className="mt-0.5 block text-sm text-ink/65">
              {hasContract
                ? 'You already have a contract for this couple. Open it to review, send, or replace it.'
                : 'Upload a PDF for this couple and keep a shared copy on file. We pre-fill the event for you.'}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-terracotta">
          {hasContract ? 'Open →' : 'Start →'}
        </span>
      </Link>

      {/* "From your vendors" — recommended pick only. The active card opens after
          completion is confirmed (Stage-10 gate); before that the recommended
          pick sees a locked "once they confirm" state. They add day-of photos +
          boomerang clips to the couple's editorial. */}
      {editorialEligibility.eligible ? (
        <Link
          href={`/vendor-dashboard/clients/${eventId}/editorial-media`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.05] p-4 transition hover:bg-terracotta/[0.08] sm:p-6"
        >
          <span>
            <span className="block text-lg font-semibold">Add to their editorial ✨</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              You&rsquo;re the couple&rsquo;s recommended pick — add up to 3 photos and 3 short clips
              of your work. They appear, credited to you, on the couple&rsquo;s front-page story.
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-terracotta">Open →</span>
        </Link>
      ) : editorialEligibility.isRecommendedPick ? (
        <div className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/30" strokeWidth={1.75} />
          <span>
            <span className="block text-lg font-semibold">Add to their editorial ✨</span>
            <span className="mt-0.5 block text-sm text-ink/65">
              {editorialEligibility.isDisputed
                ? `${brief.event.display_name ?? 'The couple'} reported a problem with the delivery. Once that’s sorted out, you can add a photo or a 5-second clip to their story.`
                : `Once ${brief.event.display_name ?? 'the couple'} marks your service complete, you can add a photo or a 5-second clip to their story — credited to you on their front-page editorial.`}
            </span>
          </span>
        </div>
      ) : null}

      {/* Deposit Reservation Lock-Free — the couple recorded a deposit off-platform
          and the date is held; the vendor confirms receipt here. Single-winner +
          idempotent via the acknowledge_vendor_deposit RPC. No money moves. */}
      {depositRecorded && eventVendorId ? (
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
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
                      <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      View proof
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
                      <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      View proof
                    </a>
                  </>
                ) : null}
              </div>
              <form action={vendorAcknowledgeDeposit}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="vendor_id" value={eventVendorId} />
                <SubmitButton className="button-primary shrink-0" pendingLabel="Confirming…">
                  Confirm deposit received
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      ) : null}

      {/* Change-Order Trail (Wave 3) — the both-acknowledged add-on/removal log,
          sitting beside the Suggest flow. The vendor proposes; the couple
          accepts/declines on their workspace. On accept the delta settles into
          the couple's budget ledger via the single-winner accept RPC. No money
          moves — 0% commission, off-platform pay. */}
      {eventVendorId ? (
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <FilePlus2 aria-hidden className="h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
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
            Added or dropped something after booking? Log a change order — the
            couple accepts or declines, and an accepted change updates their
            budget. Setnayan never holds the money.
          </p>

          {/* Propose a change (vendor-raised). */}
          <details className="mb-4 rounded-xl border border-ink/10 bg-white p-3">
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

          {/* Trail. */}
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
                  <li
                    key={co.change_order_id}
                    className="rounded-xl border border-ink/10 bg-white px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                          {co.title ?? 'Change order'}
                          <span className="font-normal text-ink/40">·</span>
                          <span
                            className={`font-mono ${deltaNum < 0 ? 'text-success-700' : 'text-ink/75'}`}
                          >
                            {fmtDelta(co.delta_amount_php)}
                          </span>
                        </p>
                        <p className="text-[11px] text-ink/50">
                          {isCoupleRaised ? 'Couple proposed' : 'You proposed'} ·{' '}
                          {fmtCODate(co.created_at)}
                          {co.proposed_due_date ? ` · due ${fmtCODate(co.proposed_due_date)}` : ''}
                        </p>
                        {co.description ? (
                          <p className="mt-1 text-xs text-ink/60">{co.description}</p>
                        ) : null}
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

                    {/* Vendor is the counterparty to a COUPLE-raised proposed order. */}
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

                    {/* Vendor withdraws their OWN proposed order. */}
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

      {/* Completion handshake (Event Lifecycle Menu §6.1) — the vendor marks the
          service complete → the couple confirms receipt (unlocks their review). */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        {isCompleteConfirmed ? (
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-success-600" strokeWidth={1.75} />
            <span className="text-ink/75">
              <span className="font-medium text-ink">Service complete.</span> The couple confirmed they
              received everything.
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
              <span className="font-medium text-ink">Wrapped up this wedding?</span> Mark your service
              complete — the couple confirms they got everything, then their review opens.
            </div>
            <form action={vendorMarkServiceComplete}>
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton className="button-primary shrink-0" pendingLabel="Marking…">
                Mark service complete
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pax */}
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users aria-hidden className="h-5 w-5 text-terracotta" /> Headcount
          </h2>
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            {brief.pax.attending}
            <span className="ml-2 text-base font-normal text-ink/55">
              attending of {brief.pax.invited} invited
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/65">
            <span>{brief.pax.pending} pending</span>
            <span>{brief.pax.maybe} maybe</span>
            <span>{brief.pax.declined} declined</span>
          </div>
          <p className="mt-2 text-xs text-ink/45">
            RSVPs are still moving — check back as the date nears.
          </p>
        </div>

        {/* Dietary (food-relevant categories + coordinator only) */}
        {brief.dietary ? (
          <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <UtensilsCrossed aria-hidden className="h-5 w-5 text-terracotta" /> Meals
              <span className="text-sm font-normal text-ink/55">(attending guests)</span>
            </h2>
            {mealEntries.length === 0 ? (
              <p className="mt-2 text-sm text-ink/55">
                No meal preferences recorded yet.
              </p>
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
            <p className="mt-3 text-sm">
              <Link
                href={`/vendor-dashboard/clients/${eventId}/production-sheet`}
                className="font-medium text-terracotta underline"
              >
                Open the production sheet
              </Link>
              <span className="ml-2 text-xs text-ink/45">
                Headcount scenarios, per-part pax, and your portion math.
              </span>
            </p>
          </div>
        ) : null}

        {/* Palette */}
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Palette aria-hidden className="h-5 w-5 text-terracotta" /> Palette
          </h2>
          {paletteEntries.length === 0 ? (
            <p className="mt-2 text-sm text-ink/55">
              The couple hasn&rsquo;t set their palettes yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {paletteEntries.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink/70">{p.label}</span>
                  <span className="flex gap-1.5">
                    {p.colors.map((hex, i) => (
                      <span
                        key={`${hex}-${i}`}
                        title={hex}
                        className="h-6 w-6 rounded-full border border-ink/15"
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
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
          >
            View full mood board — reception design &amp; inspirations →
          </Link>
        </div>

        {/* Monogram */}
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Monogram</h2>
          {monogramSvg ? (
            <div
              className="mx-auto mt-3 h-32 w-32 [&_svg]:h-full [&_svg]:w-full"
              // First-party asset from the couple's own monogram studio.
              dangerouslySetInnerHTML={{ __html: monogramSvg }}
            />
          ) : brief.monogram.text ? (
            <p
              className="mt-3 text-center text-5xl font-semibold tracking-wide"
              style={{ color: brief.monogram.color ?? undefined }}
            >
              {brief.monogram.text}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink/55">No monogram set yet.</p>
          )}
        </div>

        {/* Timeline — full day-of visibility for booked vendors (locked D2),
            with the Suggest flow: propose, never write (Phase 3). */}
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays aria-hidden className="h-5 w-5 text-terracotta" /> Day-of timeline
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {allBlocks.length > 0 && mineCount > 0 && mineCount < allBlocks.length ? (
                <span className="inline-flex overflow-hidden rounded-full border border-ink/15 text-xs font-medium">
                  <Link
                    href={`/vendor-dashboard/clients/${eventId}`}
                    className={`px-3 py-1 ${!mineOnly ? 'bg-ink text-cream' : 'bg-white text-ink/60 hover:text-ink'}`}
                  >
                    Full timeline
                  </Link>
                  <Link
                    href={`/vendor-dashboard/clients/${eventId}?lens=mine`}
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

          {/* Run-of-show header — live now/next/±N off the shared run-state.
              Booked vendors may advance it (the single-winner RPC allows it). */}
          {runOfShowBlocks.length > 0 ? (
            <div className="mt-3">
              <RunOfShowHeader eventId={eventId} initial={runOfShowBlocks} canAdvance compact />
            </div>
          ) : null}

          {/* Suggested call time — earliest key slot minus the trade's setup
              lead. Always a suggestion routed through the Suggest flow. */}
          {callTime && !callTimeAlreadyRequested ? (
            <div className="mt-3 rounded-xl border border-terracotta/30 bg-terracotta/5 px-3 py-2.5">
              <p className="text-sm">
                <span className="font-semibold">
                  Suggested call time · {fmtTime(callTime.call_time)}
                </span>{' '}
                <span className="text-ink/65">
                  — {callTime.lead_minutes / 60} hr setup before {callTime.anchor_label} (
                  {fmtTime(callTime.anchor_start_at)}). A rule-of-thumb, not a booking — confirm
                  with your couple.
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
              <Link href={`/vendor-dashboard/clients/${eventId}`} className="text-terracotta underline">
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
            <summary className="cursor-pointer text-sm font-semibold">
              Suggest a new timeline entry
            </summary>
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
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                Your requests
              </p>
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

          {/* Delivery handover (Wave 4) — post a gallery link / proof image /
              note / sign-off; the couple confirms receipt on their side. */}
          <div className="mt-5 border-t border-ink/10 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <PackageCheck aria-hidden className="h-4 w-4 text-terracotta" /> Deliver the handover
            </h3>
            <p className="mt-1 text-xs text-ink/55">
              Send the couple their finished work — a gallery link, a sample/proof
              image, or a closing note. They confirm receipt, which marks your
              booking delivered.
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
              {/* Gallery link */}
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

              {/* Proof / sample image */}
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

              {/* Note */}
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

              {/* Sign-off */}
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
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                  Your handovers
                </p>
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

        {/* Seat plan status */}
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <LayoutGrid aria-hidden className="h-5 w-5 text-terracotta" /> Seat plan
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
              {brief.seat_plan.table_count} tables · {brief.seat_plan.assigned_guests} guests
              seated
            </span>
          </div>
          {brief.seat_plan.published ? (
            <p className="mt-2 text-sm">
              <Link
                href={`/vendor-dashboard/clients/${eventId}/seat-plan`}
                className="font-medium text-terracotta underline"
              >
                View the floor plan
              </Link>
              <span className="ml-2 text-xs text-ink/45">
                Tables, stage, entrances — counts only, no guest names.
              </span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink/45">
              Once the couple publishes their floor plan, you&rsquo;ll be able to
              view it here.
            </p>
          )}
        </div>

        {/* Cocktail area — vendor-arrangeable second room (booths only). Only
            shown to booked vendors in an eligible category when the couple has
            enabled the room + left vendor editing on. */}
        {canEditCocktail ? (
          <div className="rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-4 sm:p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Martini aria-hidden className="h-5 w-5 text-terracotta" /> Cocktail area
            </h2>
            <p className="mt-2 text-sm text-ink/65">
              The couple opened up their cocktail / waiting area for you to arrange — place and
              move booths (and the room itself, if you&rsquo;re the stylist) right on their blueprint.
            </p>
            <p className="mt-3 text-sm">
              <Link
                href={`/vendor-dashboard/clients/${eventId}/cocktail`}
                className="font-medium text-terracotta underline"
              >
                Arrange the cocktail area
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
