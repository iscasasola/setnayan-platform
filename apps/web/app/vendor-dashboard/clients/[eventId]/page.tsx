import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Church,
  Clock3,
  LayoutGrid,
  Martini,
  MessageSquarePlus,
  Palette,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { blockRelevance, deriveCallTime } from '@/lib/vendor-timeline';
import { SubmitButton } from '@/app/_components/submit-button';
import { suggestScheduleChange, vendorMarkServiceComplete } from './actions';

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

type LiveBlock = {
  block_id: string;
  label: string;
  block_type: string;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
};

type SuggestionRow = {
  suggestion_id: string;
  block_id: string | null;
  kind: 'adjust' | 'new';
  note: string;
  status: 'open' | 'accepted' | 'declined';
  created_at: string;
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ suggest?: string; lens?: string }>;
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

  // Completion handshake state (Event Lifecycle Menu §6.1) — admin read; the
  // vendor is already booked-gated by the RPC above.
  const { data: completionRow } = await createAdminClient()
    .from('event_vendors')
    .select('completion_status, service_marked_complete_at, customer_confirmed_received_at')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', profile.vendor_profile_id)
    .maybeSingle();
  const completion = (completionRow ?? null) as {
    completion_status: string | null;
    service_marked_complete_at: string | null;
    customer_confirmed_received_at: string | null;
  } | null;
  const isCompleteConfirmed =
    completion?.completion_status === 'confirmed' ||
    completion?.completion_status === 'auto_confirmed' ||
    Boolean(completion?.customer_confirmed_received_at);
  const isDisputed = completion?.completion_status === 'disputed';
  const isVendorMarked = Boolean(completion?.service_marked_complete_at) && !isCompleteConfirmed && !isDisputed;

  // Cocktail-area editability probe: the RPC raises unless this vendor is booked
  // in an eligible category AND the couple has enabled the room + left vendor
  // editing on. A clean result means we can show the "arrange it" entry point.
  const { data: cocktailEdit } = await supabase.rpc('get_vendor_cocktail_editor', {
    p_event_id: eventId,
  });
  const canEditCocktail = !!cocktailEdit;

  // Phase 3: live timeline rows (RLS booked-vendor read, locked D2 full
  // visibility) — block ids drive the Suggest forms — plus this org's own
  // suggestion history.
  const [{ data: liveBlocks }, { data: mySuggestions }] = await Promise.all([
    supabase
      .from('event_schedule_blocks')
      .select('block_id, label, block_type, start_at, end_at, location')
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
  ]);
  const allBlocks = (liveBlocks ?? []) as LiveBlock[];
  const suggestions = (mySuggestions ?? []) as SuggestionRow[];
  const blockLabel = new Map(allBlocks.map((b) => [b.block_id, b.label]));

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
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
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

      {/* Completion handshake (Event Lifecycle Menu §6.1) — the vendor marks the
          service complete → the couple confirms receipt (unlocks their review). */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        {isCompleteConfirmed ? (
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
            <span className="text-ink/75">
              <span className="font-medium text-ink">Service complete.</span> The couple confirmed they
              received everything.
            </span>
          </div>
        ) : isDisputed ? (
          <div className="flex items-center gap-3 text-sm">
            <Clock3 aria-hidden className="h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />
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
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
                <button
                  type="submit"
                  className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream"
                >
                  Request this call time
                </button>
              </form>
            </div>
          ) : null}

          {search.suggest === 'sent' ? (
            <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Request sent — the couple (or their coordinator) will review it.
            </p>
          ) : null}
          {search.suggest === 'error' ? (
            <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
                      <button type="submit" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                        Send request
                      </button>
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
              <button type="submit" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
                Send suggestion
              </button>
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
                          ? 'bg-emerald-100 text-emerald-900'
                          : s.status === 'declined'
                            ? 'bg-ink/5 text-ink/50'
                            : 'bg-amber-100 text-amber-900'
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
                  ? 'bg-emerald-100 text-emerald-900'
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
