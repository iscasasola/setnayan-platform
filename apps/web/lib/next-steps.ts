/**
 * Next 15 steps — parallelizability-aware planning queue.
 *
 * Owner directive 2026-05-22 (senior PH wedding planner intelligence
 * encoded as data — Wave 2 of the home-surface evolution that started
 * with PR #337 `TodaysOneThing` and PR #338 paperwork pipeline).
 *
 * The Today's One Thing hero (PR #337) surfaces ONE most-urgent task
 * the host should focus on today. The 12-card PlanningGroups grid
 * shows every category at equal weight. Between them, hosts asked
 * for a SCANNABLE list — "what are the next 15 things I should do,
 * and which of them can I work on in parallel?"
 *
 * This module is the resolver. It merges four kinds of pre-wedding
 * work into one ranked list and tags each with a parallelizability
 * indicator so the host can decide what to do now vs later vs in
 * parallel:
 *
 *   1. Vendor categories — every unlocked PlanGroupId from
 *      `wedding-plan-groups.ts`. Already covered by Today's One Thing's
 *      resolver but surfaced here at list scope so the host sees the
 *      full ladder of upcoming locks.
 *
 *   2. Paperwork documents — every PaperworkDocumentType from
 *      DOCUMENTS_BY_CEREMONY_TYPE that hasn't been received yet (or
 *      hasn't even been seeded — host gets a "start it" CTA). The
 *      paperwork pipeline is structurally independent of vendor
 *      bookings (PSA processing happens regardless of venue lock)
 *      and so most paperwork items get `parallel_ok` status.
 *
 *   3. Sponsor tiers — Principal · Cord · Veil · Coin · Candle.
 *      Surfaces when the host has no `accepted` sponsor rows for that
 *      tier. Sponsor outreach happens independently of vendor
 *      bookings and most paperwork — also `parallel_ok`.
 *
 *   4. In-app tools — Mood board lock, Seat plan (gated on guest
 *      list > 0), Save-the-date launch, Invitation launch. Each tool
 *      maps to an existing route under `/dashboard/[eventId]/...` so
 *      no new entry points are introduced (orphan-prevention rule
 *      [[feedback_setnayan_orphan_prevention]]).
 *
 * Sort: bucket-first (overdue → due_this_week → due_this_month →
 * next_up → not_started), then within bucket by phase order
 * (Reception > Ceremony > Photo/Video > Catering > Coordinator > ...).
 * Slice to top 15.
 *
 * Parallelizability:
 *   - foundation   — venue locks (reception, ceremony). Nothing waits
 *                    on these but everything downstream benefits.
 *   - parallel_ok  — work on this anytime, no upstream dependency.
 *   - best_after   — strongly recommended to do after a specific
 *                    upstream category (e.g. caterer after reception
 *                    venue). The work can still proceed in parallel,
 *                    but the recommendation is to wait.
 *   - blocked      — reserved for hard prerequisites (e.g. marriage
 *                    license blocks if there's no marriage license
 *                    deadline math yet). V1 has no rows that emit
 *                    `blocked`; we keep the state for V1.x
 *                    forward-compat.
 *
 * Pure function — passes already-fetched data in as args so the
 * resolver doesn't make any extra DB roundtrips beyond what the
 * page already does for Today's One Thing + PlanningGroups +
 * paperwork + sponsors.
 */

import {
  PLAN_GROUPS,
  bucketVendorsByGroup,
  buildPlanGroupSearchHref,
  computeTargetDate,
  type EventVendorRowInput,
  type PlanCardPick,
  type PlanGroup,
  type PlanGroupId,
} from '@/lib/wedding-plan-groups';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';
import {
  DOCUMENT_META,
  DOCUMENTS_BY_CEREMONY_TYPE,
  completeByDate,
  resolveCeremonyType,
  type PaperworkDocumentType,
  type PaperworkRow,
} from '@/lib/paperwork';
import {
  SECONDARY_TIERS,
  SPONSOR_TIER_LABEL,
  type SponsorTier,
} from '@/lib/event-sponsors';

const CONFIRMED_SET = new Set<string>(
  CONFIRMED_VENDOR_STATUSES as readonly string[],
);

/**
 * Four lifecycle buckets per the owner directive: status-pill driving
 * color + grouping above the cut-line in the rendered list.
 *
 * Aliases against the Today's One Thing resolver's `TodaysTaskStatus`
 * with one addition — `due_this_month`. The hero card collapses
 * "next_up" (8-30 days) into one bucket because there's only one card;
 * the 15-step list shows the granularity because hosts want to know
 * "due in 2 weeks" vs "due in 6 weeks" before they decide to act.
 */
export type NextStepStatus =
  | 'overdue'
  | 'due_this_week'
  | 'due_this_month'
  | 'next_up'
  | 'not_started';

/**
 * Four parallelizability states per owner directive.
 */
export type Parallelizability =
  | 'foundation' // venue locks — nothing waits, but downstream benefits
  | 'parallel_ok' // work anytime, no dependency
  | 'best_after' // recommended to follow an upstream category
  | 'blocked'; // hard prerequisite blocks this work (V1.x forward-compat)

/**
 * Effort hint — surfaces under the title so the host can gauge how to
 * fit this into their week. Five buckets keep the picker simple.
 */
export type EstimatedEffort = '15min' | '1hr' | '1day' | '1wk' | 'ongoing';

/**
 * Kinds of work the resolver merges into the 15-step queue.
 */
export type NextStepKind =
  | 'vendor_category'
  | 'document'
  | 'sponsor_tier'
  | 'in_app_tool';

/**
 * Resolved step. Plain prop — caller is a pure server component, so
 * everything serializes cleanly. `bestAfter` + `blockedOn` are
 * human-readable category labels (e.g. "Reception venue") not
 * machine keys; the consumer just renders them as chip text.
 */
export type NextStep = {
  /** Stable identifier — `${kind}:${category}` so the consumer can key
   *  React lists without collisions across kinds (e.g. a `catering`
   *  vendor row + a `psa_birth_cert_partner_1` document never share). */
  id: string;
  kind: NextStepKind;
  /** PlanGroupId | PaperworkDocumentType | SponsorTier | ToolKey —
   *  stored as string so the union doesn't leak into the consumer. */
  category: string;
  /** Action-shaped title rendered as the row's primary line. */
  title: string;
  /** One-sentence brand-voice "why this matters" line. */
  whyItMatters: string;
  status: NextStepStatus;
  /** Negative = overdue, 0 = due today, positive = upcoming. Null when
   *  the resolver has no floor anchor (e.g. wedding_date missing). */
  daysFromFloor: number;
  estimatedEffort: EstimatedEffort;
  parallelizability: Parallelizability;
  /** Categories that hard-block this step. V1 emits empty always. */
  blockedOn?: string[];
  /** Categories ideally locked first — surfaces as a chip in the row. */
  bestAfter?: string[];
  /** Verb-first CTA label (e.g. "Browse venues", "Request CENOMAR"). */
  ctaLabel: string;
  /** Deep-link to the existing surface where the host acts. */
  ctaHref: string;
};

/** Effort hints per vendor category (calendar-realistic for PH). */
const VENDOR_CATEGORY_EFFORT: Record<PlanGroupId, EstimatedEffort> = {
  reception_venue: '1wk',
  ceremony_venue: '1wk',
  coordinator: '1wk',
  officiant: '1wk',
  catering: '1wk',
  photography: '1wk',
  attire: '1wk',
  hair_makeup: '1day',
  florals_decor: '1day',
  live_band: '1wk',
  music_entertainment: '1day',
  host_mc: '1day',
  lights_sound: '1day',
  led_background: '1day',
  cocktail_booths: '1day',
  photobooth: '1day',
  cake: '1day',
  bridal_car: '1day',
  guest_shuttle: '1day',
  rings: '1wk',
  accommodation: '1wk',
  invitations_stationery: '1day',
  logistics: '1day',
};

/**
 * Categories that benefit from a Reception venue lock first. Owner
 * intelligence: caterer, photographer, videographer, florist, live
 * band, DJ, lights & sound, LED, photobooth, cocktail booths all key
 * off venue logistics (capacity, layout, access, AC, parking).
 * Locking those before venue creates rework risk.
 *
 * 22-card grid expansion (2026-05-22): adds live_band + host_mc +
 * lights_sound + led_background + cocktail_booths + photobooth to the
 * dependency set. Coordinator is in FOUNDATION_GROUPS, not here.
 */
const RECOMMENDED_DEPENDS_ON_VENUE: ReadonlySet<PlanGroupId> = new Set([
  'catering',
  'photography',
  'florals_decor',
  'live_band',
  'music_entertainment',
  'host_mc',
  'lights_sound',
  'led_background',
  'cocktail_booths',
  'photobooth',
  'cake',
]);

/**
 * Foundation categories — never blocked. Venue locks pull everything
 * downstream into focus.
 *
 * 22-card grid expansion (2026-05-22): coordinator joins the venues as
 * Foundation tier per CLAUDE.md decision log + the new tier-based
 * grouping. Per owner directive a top-tier coordinator unblocks every
 * other vendor's planning timeline.
 */
const FOUNDATION_GROUPS: ReadonlySet<PlanGroupId> = new Set([
  'reception_venue',
  'ceremony_venue',
  'coordinator',
]);

/**
 * Phase-order ranking for the within-bucket sort. Lower = earlier on
 * the wedding timeline. Mirrors `PLAN_GROUPS` order from
 * wedding-plan-groups.ts (locked 2026-05-20) so the resolver agrees
 * with the grid.
 */
const PHASE_ORDER: Record<PlanGroupId, number> = {
  // Foundation tier (0-2)
  reception_venue: 0,
  ceremony_venue: 1,
  coordinator: 2,
  // Big bookings tier (3-7)
  officiant: 3,
  catering: 4,
  photography: 5,
  attire: 6,
  hair_makeup: 7,
  // Style + program tier (8-13)
  florals_decor: 8,
  live_band: 9,
  music_entertainment: 10,
  host_mc: 11,
  lights_sound: 12,
  led_background: 13,
  // Extras tier (14-20) — accommodation added 2026-05-22 as the 23rd card
  cocktail_booths: 14,
  photobooth: 15,
  cake: 16,
  bridal_car: 17,
  guest_shuttle: 18,
  rings: 19,
  accommodation: 20,
  // Paper tier (21-22) — shifted +1 to accommodate the 23rd card
  invitations_stationery: 21,
  logistics: 22,
};

/** Reception venue label — reused in best-after chips. */
const RECEPTION_VENUE_LABEL = 'Reception venue';
const GUEST_LIST_LABEL = 'Guest list';

/** In-app tool keys the resolver handles. */
type ToolKey =
  | 'mood_board'
  | 'seat_plan'
  | 'save_the_date'
  | 'invitation_launch';

/**
 * In-app tool metadata. Each tool maps to an existing route
 * under /dashboard/[eventId] — no new entry points introduced.
 */
type ToolMeta = {
  /** PlanGroupId-style label shown as `category` text on the row. */
  category: string;
  /** Title (action-shaped). */
  title: string;
  whyItMatters: string;
  ctaLabel: string;
  hrefForEvent: (eventId: string) => string;
  /** Months before wedding to anchor lock-by. */
  monthsBefore: number;
  effort: EstimatedEffort;
  /** Categories the tool benefits from arriving after. */
  bestAfter?: string[];
};

const TOOL_META: Record<ToolKey, ToolMeta> = {
  mood_board: {
    category: 'Mood board',
    title: 'Lock your mood board palette',
    whyItMatters:
      'Your palette anchors florals, stationery, attire color stories, and cake. Locking it early gives every downstream vendor a real color to work against — not abstract ideas.',
    ctaLabel: 'Open mood board',
    hrefForEvent: (eventId) => `/dashboard/${eventId}/add-ons/mood-board`,
    monthsBefore: 8,
    effort: '1day',
  },
  seat_plan: {
    category: 'Seat plan',
    title: 'Draft your seating chart',
    whyItMatters:
      'Your seating chart prints the table cards, drives the day-of QR check-in, and tells the caterer which tables get which meals. Start when your guest list firms up.',
    ctaLabel: 'Open seating',
    hrefForEvent: (eventId) => `/dashboard/${eventId}/seating`,
    monthsBefore: 2,
    effort: '1day',
    bestAfter: [GUEST_LIST_LABEL],
  },
  save_the_date: {
    category: 'Save-the-date',
    title: 'Send save-the-dates',
    whyItMatters:
      'Six months out gives guests time to take leave, book flights, and clear the date. Filipino weddings often have OFW guests — early notice matters most for them.',
    ctaLabel: 'Open save-the-date',
    hrefForEvent: (eventId) => `/dashboard/${eventId}/add-ons/save-the-date`,
    monthsBefore: 6,
    effort: '1hr',
    bestAfter: [GUEST_LIST_LABEL],
  },
  invitation_launch: {
    category: 'Invitations',
    title: 'Launch your invitation site',
    whyItMatters:
      'Your invitation site collects RSVPs, surfaces logistics for guests, and carries the QR codes that drive day-of check-in. Locks in 3 months before the wedding.',
    ctaLabel: 'Open invitation',
    hrefForEvent: (eventId) => `/dashboard/${eventId}/invitation`,
    monthsBefore: 3,
    effort: '1day',
    bestAfter: [GUEST_LIST_LABEL],
  },
};

/**
 * Vendor-category action title (mirrors todays-one-thing.ts so the
 * hero + the 15-step list use identical phrasing).
 */
const ACTION_TITLE: Record<PlanGroupId, string> = {
  reception_venue: 'Lock your reception venue',
  ceremony_venue: 'Lock your ceremony venue',
  coordinator: 'Lock your coordinator',
  officiant: 'Lock your officiant',
  catering: 'Lock your caterer',
  photography: 'Lock your photo & video team',
  attire: 'Lock your attire',
  hair_makeup: 'Lock your hair & makeup team',
  florals_decor: 'Lock your florals and decor',
  live_band: 'Lock your live band',
  music_entertainment: 'Lock your DJ + music',
  host_mc: 'Lock your host / emcee',
  lights_sound: 'Lock your lights & sound',
  led_background: 'Lock your LED background',
  cocktail_booths: 'Lock your cocktail booths',
  photobooth: 'Lock your photobooth',
  cake: 'Lock your cake maker',
  bridal_car: 'Lock your bridal car',
  guest_shuttle: 'Lock your guest shuttle',
  rings: 'Lock your rings',
  accommodation: 'Lock your accommodation',
  invitations_stationery: 'Lock your stationery partner',
  logistics: 'Lock your day-of logistics',
};

/**
 * Vendor-category CTA label (deep-links to the marketplace via
 * `/vendors?folder=...#...` — same pattern as Today's One Thing).
 */
const CTA_LABEL: Record<PlanGroupId, string> = {
  reception_venue: 'Browse reception venues',
  ceremony_venue: 'Browse ceremony venues',
  coordinator: 'Browse coordinators',
  officiant: 'Find an officiant',
  catering: 'Browse caterers',
  photography: 'Browse photo & video',
  attire: 'Browse attire',
  hair_makeup: 'Browse hair & makeup',
  florals_decor: 'Browse florals & decor',
  live_band: 'Browse live bands',
  music_entertainment: 'Browse DJs & music',
  host_mc: 'Browse hosts & emcees',
  lights_sound: 'Browse lights & sound',
  led_background: 'Browse LED suppliers',
  cocktail_booths: 'Browse cocktail booths',
  photobooth: 'Browse photobooths',
  cake: 'Browse cake makers',
  bridal_car: 'Browse bridal cars',
  guest_shuttle: 'Browse guest shuttles',
  rings: 'Browse rings',
  accommodation: 'Browse hotels',
  invitations_stationery: 'Browse stationery',
  logistics: 'Browse logistics',
};

/**
 * Vendor-category why-it-matters lines (same copy table as
 * todays-one-thing.ts — keep them in lock-step so the hero card and
 * the 15-step list speak with one voice).
 */
const WHY_IT_MATTERS_VENDOR: Record<PlanGroupId, string> = {
  reception_venue:
    'The first domino — everything downstream waits on this. Your coordinator, caterer, and photographer all key off where your reception lives.',
  ceremony_venue:
    'Locks the date and starts the paperwork clock. Parish documents take 4-6 weeks to gather; the marriage license has a 120-day countdown.',
  coordinator:
    'Your day-of conductor. Best coordinators book 9-12 months out; the earlier you lock yours, the more they can shape every choice downstream.',
  officiant:
    'The voice of your ceremony. Priests, ministers, and judges book months ahead; locking yours early is what makes the paperwork chain start moving.',
  catering:
    'Filipino weddings live or die on the food. Tastings happen 4-6 months out, and the best teams book the same season they’re booked the year before.',
  photography:
    'The best PH photo and video teams book 9-12 months ahead. Locking yours early means your favorite is still available — and they start shaping the visual story now.',
  attire:
    'Custom gowns and barongs need 3-4 months from first fitting; rentals book 6-8 weeks ahead. Either way, the clock is friendlier than you think — start the conversation now.',
  hair_makeup:
    'Your bridal glam team carries the whole entourage on the morning of. Trials happen 1-2 months before the day; lock the artist first so the trial date even makes sense.',
  florals_decor:
    'Florals and styling read the palette and theme you’ve been refining. Once your colors are settled, your florist can quote real flowers in real season — not abstract ideas.',
  live_band:
    'A live band sets the energy of your reception. Top bands in PH book 6-9 months ahead; locking early means your favorite is still available.',
  music_entertainment:
    'DJ, string quartet, choir — the music team that carries your program. The best ones run a wedding every weekend in peak season; book early or choose from what’s left.',
  host_mc:
    'Your emcee carries the program from cocktail hour through send-off. A great host makes the night feel effortless; book 4-6 months out.',
  lights_sound:
    'Reception lighting + sound shapes the whole atmosphere. PA + lights setup is technical — book 4-6 months out and confirm the venue power supply.',
  led_background:
    'LED background brings your monogram + theme to the stage. Setnayan can render an 8K loop for offline playback; book about 3 months out.',
  cocktail_booths:
    'Mobile bar, coffee booth, cocktail station — the social glue of cocktail hour. PH cocktail-hour culture loves these; book 3-4 months out.',
  photobooth:
    'Guests love a good photo booth. Classic, mirror, 360, slow-mo, polaroid — pick the style that fits your vibe. 2-3 months ahead is plenty.',
  cake:
    'Tastings happen 3-4 months before the wedding. Pin a palette and a flavor direction first so the cake maker can pull samples that fit your day.',
  bridal_car:
    'Your wedding-day arrival vehicle. Vintage, luxury, classic — book about 2 months out and confirm pickup time + decoration scope.',
  guest_shuttle:
    'For venues away from the city, shuttle service keeps guests stress-free. Book 6-8 weeks out once you have an approximate headcount.',
  rings:
    'The most-photographed object of your wedding. Custom rings take 6-8 weeks; off-the-shelf 2-3 weeks. Lock the design and have backups for emergencies.',
  accommodation:
    'Where you and your wedding party rest the night before — sometimes bundled into your reception hotel package. Lock 1-2 months out · venue-affiliated room blocks fill fast.',
  invitations_stationery:
    'Save-the-dates, invitations, monograms, and table cards all share a visual story. Locking your stationery partner early means everything ships out of one consistent hand.',
  logistics:
    'Transportation, security, giveaways — the small choices that make the day actually run. Lock these as your guest list firms up.',
};

/**
 * Sponsor tier why-it-matters lines.
 */
const WHY_IT_MATTERS_SPONSOR: Record<SponsorTier, string> = {
  principal:
    'Your ninong and ninang invitations carry the deepest cultural weight. Filipino sponsors take weeks to think it over with their families — ask early so they can say yes well in advance.',
  cord:
    'Your yugal cord sponsors place the cord of unity at the ceremony. Two slots — invitations go out alongside your principal sponsors.',
  veil:
    'Your veil sponsors drape the veil at the ceremony. Two slots — typically a close cousin, friend, or aunt-and-uncle pair.',
  coin:
    'Your arrhae sponsors present the 13 coins as a promise of shared providence. Two slots — often godparents or family elders.',
  candle:
    'Your candle sponsors light the candles symbolizing the light Christ brings to your union. Two slots — round out the secondary sponsor lineup.',
};

const ACTION_TITLE_SPONSOR: Record<SponsorTier, string> = {
  principal: 'Invite your principal sponsors',
  cord: 'Invite your cord sponsors',
  veil: 'Invite your veil sponsors',
  coin: 'Invite your coin sponsors',
  candle: 'Invite your candle sponsors',
};

/**
 * Sponsor target lock-by (months before). Owner directive (PR #332):
 * principal sponsors get invited ~9-10 months out, secondaries 6-8.
 */
const SPONSOR_MONTHS_BEFORE: Record<SponsorTier, number> = {
  principal: 9,
  cord: 7,
  veil: 7,
  coin: 7,
  candle: 7,
};

const SPONSOR_EFFORT: Record<SponsorTier, EstimatedEffort> = {
  principal: '1wk',
  cord: '1hr',
  veil: '1hr',
  coin: '1hr',
  candle: '1hr',
};

/**
 * Paperwork document estimated effort. Aligns with the
 * `processingHint` text on DOCUMENT_META but compressed into the
 * 5-bucket union.
 */
const PAPERWORK_EFFORT: Record<PaperworkDocumentType, EstimatedEffort> = {
  psa_birth_cert_partner_1: '1hr',
  psa_birth_cert_partner_2: '1hr',
  cenomar_partner_1: '1hr',
  cenomar_partner_2: '1hr',
  marriage_license: '1day',
  pre_cana_certificate: '1wk',
  baptismal_cert_partner_1: '1hr',
  baptismal_cert_partner_2: '1hr',
  confirmation_cert_partner_1: '1hr',
  confirmation_cert_partner_2: '1hr',
  banns_posted: 'ongoing',
  canonical_interview_complete: '1hr',
  inc_counseling_complete: '1wk',
  sharia_counseling_complete: '1wk',
  cfo_counseling_complete: '1day',
};

/**
 * Paperwork CTA label — uses the request verb where it makes sense
 * (PSA / CENOMAR) and softer prompts for the others (Pre-Cana, banns
 * etc.). Every label is verb-first per brand-voice rule
 * [[feedback_setnayan_no_dev_text_post_launch]].
 */
const PAPERWORK_CTA: Record<PaperworkDocumentType, string> = {
  psa_birth_cert_partner_1: 'Request PSA',
  psa_birth_cert_partner_2: 'Request PSA',
  cenomar_partner_1: 'Request CENOMAR',
  cenomar_partner_2: 'Request CENOMAR',
  marriage_license: 'Apply at LGU',
  pre_cana_certificate: 'Book Pre-Cana',
  baptismal_cert_partner_1: 'Request baptismal cert',
  baptismal_cert_partner_2: 'Request baptismal cert',
  confirmation_cert_partner_1: 'Request confirmation cert',
  confirmation_cert_partner_2: 'Request confirmation cert',
  banns_posted: 'Coordinate with parish',
  canonical_interview_complete: 'Book canonical interview',
  inc_counseling_complete: 'Book INC counseling',
  sharia_counseling_complete: 'Book Sharia counseling',
  cfo_counseling_complete: 'Register with CFO',
};

/** Sponsor row shape — just enough for the resolver. */
export type SponsorRowInput = {
  sponsor_tier: SponsorTier;
  invitation_status: string | null;
};

/**
 * Resolver input — all data the page already fetches gets passed in
 * so the function is pure and free of DB-roundtrip side effects.
 */
export type NextStepsInput = {
  eventId: string;
  weddingDateIso: string | null;
  ceremonyType: string | null;
  vendors: ReadonlyArray<EventVendorRowInput>;
  paperwork: ReadonlyArray<PaperworkRow>;
  sponsors: ReadonlyArray<SponsorRowInput>;
  /** Guest count — used to gate the seat plan tool and the
   *  invitation launch tool. Both want a non-empty guest list before
   *  they're useful, so they show up as `best_after: ['Guest list']`
   *  when guest_count is 0. */
  guestCount: number;
  /**
   * Have any palette rows been finalized on this event? Drives the
   * mood-board tool inclusion: when `true`, the tool is treated as
   * "locked" and skipped from the queue. Mirrors the
   * events.palette_finalized_at column read by the page.
   */
  moodBoardLocked: boolean;
  now?: Date;
  /** Max steps returned. Defaults to 15 per owner directive. */
  limit?: number;
};

/**
 * Top-level: pick the next N steps for this event, sorted +
 * parallelizability-tagged. Pure function; no Supabase client arg —
 * the caller has already fetched everything in the home page's
 * Promise.all.
 */
export function pickNextSteps(input: NextStepsInput): NextStep[] {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 15;

  const candidates: NextStep[] = [];

  // 1) Vendor categories — every unlocked PlanGroupId.
  for (const step of resolveVendorCategorySteps(
    input.eventId,
    input.weddingDateIso,
    input.vendors,
    now,
  )) {
    candidates.push(step);
  }

  // 2) Paperwork documents — every document the host's ceremony_type
  //    requires that isn't yet received.
  for (const step of resolvePaperworkSteps(
    input.eventId,
    input.weddingDateIso,
    input.ceremonyType,
    input.paperwork,
    now,
  )) {
    candidates.push(step);
  }

  // 3) Sponsor tiers — Principal + 4 secondaries.
  for (const step of resolveSponsorSteps(
    input.eventId,
    input.weddingDateIso,
    input.sponsors,
    now,
  )) {
    candidates.push(step);
  }

  // 4) In-app tools — Mood board, Seat plan, Save-the-date, Invitation.
  for (const step of resolveToolSteps(
    input.eventId,
    input.weddingDateIso,
    input.moodBoardLocked,
    input.guestCount,
    input.vendors,
    now,
  )) {
    candidates.push(step);
  }

  // Apply parallelizability to every candidate.
  for (const step of candidates) {
    applyParallelizability(step, input.vendors);
  }

  // Sort by status bucket, then within-bucket by phase order +
  // daysFromFloor magnitude.
  candidates.sort(compareSteps);

  return candidates.slice(0, limit);
}

// ---------- internals ----------

const STATUS_PRIORITY: Record<NextStepStatus, number> = {
  overdue: 0,
  due_this_week: 1,
  due_this_month: 2,
  next_up: 3,
  not_started: 4,
};

function hasLockedPick(picks: ReadonlyArray<PlanCardPick>): boolean {
  for (const p of picks) {
    if (p.raw_status !== null && CONFIRMED_SET.has(p.raw_status)) return true;
    if (p.status === 'locked') return true;
  }
  return false;
}

function classifyDaysFromFloor(diffDays: number): NextStepStatus {
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due_this_week';
  if (diffDays <= 30) return 'due_this_month';
  if (diffDays <= 90) return 'next_up';
  return 'not_started';
}

function diffDaysFromNow(target: Date, now: Date): number {
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Resolve vendor-category steps. One entry per UNLOCKED PlanGroupId.
 * Skips groups that already have at least one confirmed pick.
 */
function resolveVendorCategorySteps(
  eventId: string,
  weddingDateIso: string | null,
  vendors: ReadonlyArray<EventVendorRowInput>,
  now: Date,
): NextStep[] {
  const bucketed = bucketVendorsByGroup(vendors, null, null);
  const out: NextStep[] = [];

  for (const group of PLAN_GROUPS) {
    // 22-card grid expansion (2026-05-22): skip entry-point cards
    // (countsTowardLockable: false). They share their underlying
    // VendorCategory with another card, so showing "Lock your live
    // band" alongside "Lock your DJ + music" would surface duplicate
    // recommendations. The parent card carries the canonical step.
    if (group.countsTowardLockable === false) continue;

    const picks = bucketed.get(group.id) ?? [];
    if (hasLockedPick(picks)) continue; // already locked

    const status = computeVendorStatus(group, weddingDateIso, now);
    if (status === null) continue;

    out.push(buildVendorStep(eventId, group, status));
  }

  return out;
}

function computeVendorStatus(
  group: PlanGroup,
  weddingDateIso: string | null,
  now: Date,
): { status: NextStepStatus; daysFromFloor: number } | null {
  const target = computeTargetDate(weddingDateIso, group.monthsBefore);
  if (!target) {
    // No wedding date → resolver returns a "not_started" surface so
    // hosts who haven't set a date still see the ladder.
    return { status: 'not_started', daysFromFloor: 0 };
  }
  const diff = diffDaysFromNow(target, now);
  return {
    status: classifyDaysFromFloor(diff),
    daysFromFloor: diff,
  };
}

function buildVendorStep(
  eventId: string,
  group: PlanGroup,
  classified: { status: NextStepStatus; daysFromFloor: number },
): NextStep {
  const folderSlug = WEDDING_FOLDER_SLUG[group.catalogFolder];
  // Anchor matches the Today's One Thing hero CTA — same scoped catalog
  // section. See PR #310 for the `?folder=...#...` lock.
  // 22-card grid expansion (2026-05-22): groups with a `subcategoryHint`
  // deep-link to /vendors?folder=...&category=<canonical> for filtered
  // vendor-grid mode; others fall back to the catalog-scope anchor.
  const ctaHref = buildPlanGroupSearchHref(group, folderSlug);

  return {
    id: `vendor_category:${group.id}`,
    kind: 'vendor_category',
    category: group.label,
    title: ACTION_TITLE[group.id],
    whyItMatters: WHY_IT_MATTERS_VENDOR[group.id],
    status: classified.status,
    daysFromFloor: classified.daysFromFloor,
    estimatedEffort: VENDOR_CATEGORY_EFFORT[group.id],
    parallelizability: 'parallel_ok', // overwritten by applyParallelizability
    ctaLabel: CTA_LABEL[group.id],
    ctaHref,
  };
}

/**
 * Resolve paperwork steps. One entry per ceremony-type-required
 * document that isn't yet received. Includes documents that haven't
 * even been seeded — those land as `not_started` with the same
 * deep-link to /paperwork (the seed action runs server-side when the
 * host opens the page).
 */
function resolvePaperworkSteps(
  eventId: string,
  weddingDateIso: string | null,
  ceremonyType: string | null,
  paperwork: ReadonlyArray<PaperworkRow>,
  now: Date,
): NextStep[] {
  const ct = resolveCeremonyType(ceremonyType);
  const required = DOCUMENTS_BY_CEREMONY_TYPE[ct];

  // Map existing rows by type for status lookup.
  const statusByType = new Map<PaperworkDocumentType, string>();
  for (const row of paperwork) {
    statusByType.set(row.document_type, row.status);
  }

  const out: NextStep[] = [];
  for (const docType of required) {
    const status = statusByType.get(docType);
    // Already received — skip; nothing for the host to do.
    if (status === 'received') continue;

    const meta = DOCUMENT_META[docType];
    const completeBy = completeByDate(docType, weddingDateIso);
    let nextStatus: NextStepStatus = 'not_started';
    let daysFromFloor = 0;
    if (completeBy) {
      const target = new Date(completeBy);
      const diff = diffDaysFromNow(target, now);
      nextStatus = classifyDaysFromFloor(diff);
      daysFromFloor = diff;
    }

    out.push({
      id: `document:${docType}`,
      kind: 'document',
      category: 'Paperwork',
      title: composeDocumentTitle(meta.label, status),
      whyItMatters: meta.helper,
      status: nextStatus,
      daysFromFloor,
      estimatedEffort: PAPERWORK_EFFORT[docType],
      parallelizability: 'parallel_ok',
      ctaLabel: PAPERWORK_CTA[docType],
      ctaHref: `/dashboard/${eventId}/paperwork`,
    });
  }

  return out;
}

function composeDocumentTitle(
  label: string,
  status: string | undefined,
): string {
  // Soften the title verb based on where the host is in the
  // paperwork lifecycle. "Request X" feels right when not_started or
  // not even seeded; "Track X" reads better when the host already
  // started the process.
  if (status === 'requested' || status === 'in_processing') {
    return `Track ${label}`;
  }
  if (status === 'expired') {
    return `Re-request ${label}`;
  }
  // not_started or undefined (row hasn't been seeded yet).
  return `Request ${label}`;
}

/**
 * Resolve sponsor steps. Surfaces a row per tier that has fewer
 * accepted invitations than the minimum the tier requires.
 *
 * Principal sponsors don't have a fixed min (couples pick the count);
 * the row surfaces when zero pairs have accepted. Secondaries each
 * have 2 slots; the row surfaces when fewer than 2 are accepted.
 */
function resolveSponsorSteps(
  eventId: string,
  weddingDateIso: string | null,
  sponsors: ReadonlyArray<SponsorRowInput>,
  now: Date,
): NextStep[] {
  const acceptedByTier = new Map<SponsorTier, number>();
  for (const s of sponsors) {
    if (s.invitation_status === 'accepted') {
      acceptedByTier.set(s.sponsor_tier, (acceptedByTier.get(s.sponsor_tier) ?? 0) + 1);
    }
  }

  const out: NextStep[] = [];

  // Principal: surface if 0 accepted (i.e. the host hasn't locked
  // any ninong/ninang pair yet).
  if ((acceptedByTier.get('principal') ?? 0) === 0) {
    out.push(buildSponsorStep(eventId, 'principal', weddingDateIso, now));
  }

  // Secondary tiers: surface if fewer than 2 accepted on this tier.
  for (const tier of SECONDARY_TIERS) {
    if ((acceptedByTier.get(tier) ?? 0) < 2) {
      out.push(buildSponsorStep(eventId, tier, weddingDateIso, now));
    }
  }

  return out;
}

function buildSponsorStep(
  eventId: string,
  tier: SponsorTier,
  weddingDateIso: string | null,
  now: Date,
): NextStep {
  const monthsBefore = SPONSOR_MONTHS_BEFORE[tier];
  const target = computeTargetDate(weddingDateIso, monthsBefore);
  let status: NextStepStatus = 'not_started';
  let daysFromFloor = 0;
  if (target) {
    daysFromFloor = diffDaysFromNow(target, now);
    status = classifyDaysFromFloor(daysFromFloor);
  }
  // Anchor matches the existing sponsors surface query param.
  const ctaHref = `/dashboard/${eventId}/sponsors?tier=${tier}`;
  return {
    id: `sponsor_tier:${tier}`,
    kind: 'sponsor_tier',
    category: SPONSOR_TIER_LABEL[tier],
    title: ACTION_TITLE_SPONSOR[tier],
    whyItMatters: WHY_IT_MATTERS_SPONSOR[tier],
    status,
    daysFromFloor,
    estimatedEffort: SPONSOR_EFFORT[tier],
    parallelizability: 'parallel_ok',
    ctaLabel: 'Open sponsors',
    ctaHref,
  };
}

/**
 * Resolve in-app tool steps. Skips tools the host has already
 * completed (mood-board palette finalized, etc.).
 */
function resolveToolSteps(
  eventId: string,
  weddingDateIso: string | null,
  moodBoardLocked: boolean,
  guestCount: number,
  vendors: ReadonlyArray<EventVendorRowInput>,
  now: Date,
): NextStep[] {
  const out: NextStep[] = [];

  // Mood board — skip if already finalized.
  if (!moodBoardLocked) {
    out.push(buildToolStep(eventId, 'mood_board', weddingDateIso, now));
  }

  // Seat plan — only surfaces once the host has at least one guest
  // entered. Below that, seat planning is premature.
  if (guestCount > 0) {
    out.push(buildToolStep(eventId, 'seat_plan', weddingDateIso, now));
  }

  // Save-the-date — surfaces always; the host might want to send
  // even before the full guest list is final.
  out.push(buildToolStep(eventId, 'save_the_date', weddingDateIso, now));

  // Invitation launch — same. Reception venue is a strong best-after
  // hint (the invitation needs the venue address), wired via
  // applyParallelizability.
  out.push(buildToolStep(eventId, 'invitation_launch', weddingDateIso, now));

  // Mark vendors arg as used (it's only the parallelizability
  // helper that reads it; this keeps the noUnusedLocals lint happy
  // because tool steps may want to inspect vendors in V1.x).
  void vendors;

  return out;
}

function buildToolStep(
  eventId: string,
  key: ToolKey,
  weddingDateIso: string | null,
  now: Date,
): NextStep {
  const meta = TOOL_META[key];
  const target = computeTargetDate(weddingDateIso, meta.monthsBefore);
  let status: NextStepStatus = 'not_started';
  let daysFromFloor = 0;
  if (target) {
    daysFromFloor = diffDaysFromNow(target, now);
    status = classifyDaysFromFloor(daysFromFloor);
  }
  return {
    id: `in_app_tool:${key}`,
    kind: 'in_app_tool',
    category: meta.category,
    title: meta.title,
    whyItMatters: meta.whyItMatters,
    status,
    daysFromFloor,
    estimatedEffort: meta.effort,
    parallelizability: 'parallel_ok',
    bestAfter: meta.bestAfter,
    ctaLabel: meta.ctaLabel,
    ctaHref: meta.hrefForEvent(eventId),
  };
}

/**
 * Stamp the parallelizability state in place on a step. Mutates the
 * step (cheap, internal-only). Three rules:
 *
 *   1. Foundation: reception_venue + ceremony_venue. Never blocked.
 *   2. Best-after: vendor categories from RECOMMENDED_DEPENDS_ON_VENUE
 *      that don't yet have a confirmed Reception venue. Carries a
 *      "Reception venue" chip so the host knows the ideal order.
 *   3. Default: parallel_ok.
 */
function applyParallelizability(
  step: NextStep,
  vendors: ReadonlyArray<EventVendorRowInput>,
): void {
  if (step.kind !== 'vendor_category') {
    // For non-vendor steps (paperwork, sponsors, tools), the
    // step's `bestAfter` is set at build time; leave the
    // parallelizability default (`parallel_ok`) unless the
    // step already declares a `bestAfter` chip.
    if (step.bestAfter && step.bestAfter.length > 0) {
      step.parallelizability = 'best_after';
    } else {
      step.parallelizability = 'parallel_ok';
    }
    return;
  }

  // Vendor category — read PlanGroupId off the step.id suffix.
  const groupId = step.id.split(':')[1] as PlanGroupId;

  if (FOUNDATION_GROUPS.has(groupId)) {
    step.parallelizability = 'foundation';
    return;
  }

  if (RECOMMENDED_DEPENDS_ON_VENUE.has(groupId)) {
    const venueLocked = isReceptionVenueLocked(vendors);
    if (!venueLocked) {
      step.parallelizability = 'best_after';
      step.bestAfter = [RECEPTION_VENUE_LABEL];
      return;
    }
  }

  step.parallelizability = 'parallel_ok';
}

function isReceptionVenueLocked(
  vendors: ReadonlyArray<EventVendorRowInput>,
): boolean {
  for (const v of vendors) {
    // PlanGroup `reception_venue` consumes the `venue` category only.
    if (v.category !== 'venue') continue;
    if (v.status !== null && CONFIRMED_SET.has(v.status)) return true;
  }
  return false;
}

/**
 * Compare two steps for sort order. Bucket-first by status, then by
 * phase-order rank (vendor categories use PHASE_ORDER directly; other
 * kinds get conservative defaults that interleave naturally — paperwork
 * before sponsors before tools when at the same status), then by
 * daysFromFloor magnitude.
 */
function compareSteps(a: NextStep, b: NextStep): number {
  const aBucket = STATUS_PRIORITY[a.status];
  const bBucket = STATUS_PRIORITY[b.status];
  if (aBucket !== bBucket) return aBucket - bBucket;

  // Within bucket: overdue → most-overdue first; others → soonest first.
  if (a.status === 'overdue' && b.status === 'overdue') {
    // a.daysFromFloor is negative; more negative = more overdue.
    if (a.daysFromFloor !== b.daysFromFloor) {
      return a.daysFromFloor - b.daysFromFloor;
    }
  } else if (a.daysFromFloor !== b.daysFromFloor) {
    // Lower days = sooner = surfaced first.
    return a.daysFromFloor - b.daysFromFloor;
  }

  // Tie-break by kind + phase rank.
  const aRank = rankWithinBucket(a);
  const bRank = rankWithinBucket(b);
  return aRank - bRank;
}

function rankWithinBucket(step: NextStep): number {
  // Vendor categories — use PHASE_ORDER (0..21 after 22-card grid expansion
  // 2026-05-22).
  // Paperwork — middling priority (offset 100); document name ordering
  // is preserved by the seed map's ordering and the resolver's
  // iteration over that array.
  // Sponsors — slightly lower (offset 200) — they're parallel work but
  // not as time-critical as paperwork.
  // Tools — lowest (offset 300) — Setnayan-side work that bends to the
  // host's schedule.
  if (step.kind === 'vendor_category') {
    const groupId = step.id.split(':')[1] as PlanGroupId;
    return PHASE_ORDER[groupId] ?? 99;
  }
  if (step.kind === 'document') return 100;
  if (step.kind === 'sponsor_tier') return 200;
  return 300;
}
