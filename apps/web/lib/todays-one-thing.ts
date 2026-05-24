/**
 * Today's one thing — single-focus priority resolver.
 *
 * Owner directive 2026-05-22 (Headspace-pattern · decision paralysis reduction):
 * the dashboard home should show ONE most-urgent task in a hero card,
 * not a 5-card carousel or 12-card grid. The carousel was correctly
 * priority-sorted but the host saw 5 simultaneous CTAs and froze. The
 * hero card answers the question every host actually asks when they
 * open Setnayan: "what should I do TODAY?"
 *
 * The 12-card PlanningGroups grid stays — it collapses behind a
 * "Show all N more tasks" disclosure beneath the hero so a host who
 * IS ready to ladder through multiple categories can still see them.
 *
 * Resolver algorithm (priority order — first non-skipped match wins):
 *
 *   1. OVERDUE — `targetDateStatus` tone === 'overdue'. Sort by
 *      daysOverdue DESC (most-overdue first). These are tasks whose
 *      hard-floor lock date has already passed and the host has zero
 *      locked vendors in that category. Tie-break by group `monthsBefore`
 *      ASC (earlier-locking categories outrank later ones — e.g. a
 *      venue overdue by 30 days outranks a cake overdue by 30 days
 *      because the venue is structurally upstream).
 *
 *   2. DUE THIS WEEK — `targetDateStatus` tone === 'soon' AND
 *      daysOut <= 7. Sort by daysOut ASC. These are tasks whose
 *      hard-floor is within a week and no lock exists.
 *
 *   3. NEXT UP — `targetDateStatus` tone === 'soon' AND
 *      daysOut > 7 AND <= 30. Sort by group `monthsBefore` ASC. These
 *      are tasks approaching their floor; not urgent yet but on deck.
 *
 *   4. NOT STARTED — every other unlocked category. Sort by
 *      `monthsBefore` ASC. These fall through to the hero only when
 *      buckets 1-3 are empty. Returned as 'not_started' status so the
 *      hero card can soften copy ("Worth thinking about · plenty of time").
 *
 * Skip rules — a category is removed from consideration if:
 *   - It has ≥1 vendor in `CONFIRMED_VENDOR_STATUSES` (contracted /
 *     deposit_paid / delivered / complete). Already locked; nothing to
 *     surface as the host's "one thing" today.
 *
 * Returns null when:
 *   - The host has no wedding_date set yet (resolver can't compute
 *     floors without an anchor — the hero card switches to a date-
 *     prompt variant rendered by the consumer).
 *   - Every one of the 12 categories has ≥1 locked vendor (the host
 *     has nothing left to lock — the hero collapses to a "you've
 *     locked everything" celebratory variant).
 */

import {
  PLAN_GROUPS,
  bucketVendorsByGroup,
  buildPlanGroupSearchHref,
  targetDateStatus,
  type EventVendorRowInput,
  type PlanCardPick,
  type PlanGroup,
  type PlanGroupId,
} from '@/lib/wedding-plan-groups';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { WEDDING_FOLDER_SLUG } from '@/lib/taxonomy';

const CONFIRMED_SET = new Set<string>(
  CONFIRMED_VENDOR_STATUSES as readonly string[],
);

/** Status the hero card's `<StatusPill>` reads to choose its color + label. */
export type TodaysTaskStatus =
  | 'overdue'
  | 'due_this_week'
  | 'next_up'
  | 'not_started';

/**
 * Shape returned to the hero card. Resolved server-side; passed as a
 * plain prop so the card can stay a pure server component.
 */
export type ResolvedTask = {
  /** Stable identifier — the PlanGroupId, useful for click telemetry. */
  id: PlanGroupId;
  /** Group label (e.g. "Reception venue", "Photography & Video"). */
  category: string;
  /** Drives the colored pill + icon at the top of the hero card. */
  status: TodaysTaskStatus;
  /** Short, action-shaped title rendered as the card's H3. */
  title: string;
  /** One-sentence "why this matters" line in the brand voice. */
  whyItMatters: string;
  /** Button label — verb-first, polite voice. */
  ctaLabel: string;
  /** Deep-link to wherever the host takes action on this task. */
  ctaHref: string;
  /** Days past floor for overdue / days until floor otherwise; null when
   *  the status is 'not_started' (no floor yet reached). */
  daysContextual: number | null;
};

/**
 * Why-it-matters copy table — one polite sentence per planning group.
 * Used verbatim by the hero card. Brand voice rule per
 * `[[feedback_setnayan_no_dev_text_post_launch]]`: concrete, Filipino-
 * aware, planner-tone, no jargon, no marketing fluff.
 */
const WHY_IT_MATTERS: Record<PlanGroupId, string> = {
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
  stylist:
    'Your stylist executes on the mood board you locked — florals, decor, signage, tablescapes. PH stylists often book 6 months out · pick early to keep their attention on your day.',
  live_band:
    'A live band sets the energy of your reception. Top bands in PH book 6-9 months ahead; locking early means your favorite is still available.',
  music_entertainment:
    'DJ, string quartet, choir — the music team that carries your program. The best ones run a wedding every weekend in peak season; book early or choose from what’s left.',
  after_party_music:
    'The reception ends · the after-party begins. A different DJ for the late-night dance floor — different vibe, different playlist. Lock 4-6 weeks out once your program is set.',
  dance_instructor:
    'First dance · parents-and-couple dance · entourage choreography. Lessons run 2-3 months pre-wedding. Lock the choreographer early so you have time to actually learn the routine.',
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
 * CTA label table — verb-first, brand-voice. Matches the marketplace
 * folder each group lands in, so the host's mental model of "browse" /
 * "explore" / "find" maps cleanly to the deep-link destination.
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
  stylist: 'Browse stylists',
  live_band: 'Browse live bands',
  music_entertainment: 'Browse DJs & music',
  after_party_music: 'Browse after-party DJs',
  dance_instructor: 'Browse dance instructors',
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
 * Compose the action-shaped title from the group's label. The hero card
 * shows it as the H3 directly under the status pill, so it reads as
 * "Lock your reception venue" rather than just "Reception venue".
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
  stylist: 'Lock your stylist',
  live_band: 'Lock your live band',
  music_entertainment: 'Lock your band / DJ / performer',
  after_party_music: 'Lock your after-party DJ',
  dance_instructor: 'Lock your dance instructor',
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

type Candidate = {
  group: PlanGroup;
  status: TodaysTaskStatus;
  /** Days past floor for overdue / days until floor for soon. Always
   *  non-negative — sort direction handled in the resolver. */
  days: number;
  /** Months-before-wedding lock-by target — secondary sort key. */
  monthsBefore: number;
};

/**
 * Foundation tier — canonical Filipino wedding-planner ordering for
 * within-bucket tie-breaks. Owner directive 2026-05-22 after a screenshot
 * showed Today's Focus picking Ceremony Venue when Next 15 Steps below
 * (correctly) had Reception Venue at #1. Both groups have monthsBefore=12
 * + tier='foundation', so the prior monthsBefore-ascending tiebreak fell
 * back to PLAN_GROUPS array order — which lists ceremony first
 * (alphabetic-ish coincidence). That ordering is wrong for PH planning
 * canon.
 *
 * The canon: **Reception is THE foundation** — it locks the date, drives
 * downstream booking (the coordinator + caterer + photographer all key
 * off the reception location), and is what every Filipino wedding
 * planner asks about first. Ceremony venue is second (drives paperwork
 * + officiant chain). Coordinator is third (the day-of conductor, but
 * structurally downstream of the two venues since coordinators quote
 * based on where the wedding lives).
 *
 * Lower number = wins the tiebreak. Categories not in this map fall
 * through to the existing monthsBefore tiebreak.
 *
 * The Next 15 Steps ladder that historically duplicated this ordering
 * was removed 2026-05-24 (owner directive) — this map is now the sole
 * authority for foundation-card priority on the home surface.
 */
const FOUNDATION_PRIORITY: Partial<Record<PlanGroupId, number>> = {
  reception_venue: 1,
  ceremony_venue: 2,
  coordinator: 3,
};

/**
 * Within-bucket tie-breaker. Called from the sort comparator AFTER the
 * primary status bucket + days metric have been compared. Splits into
 * two phases:
 *   1. Foundation tier (reception → ceremony → coordinator) takes
 *      precedence over everything else.
 *   2. Within the foundation tier, the canonical order from
 *      FOUNDATION_PRIORITY wins (lower number first).
 *   3. Fall back to monthsBefore ASC (existing behavior) for
 *      non-foundation groups.
 *
 * Returns a negative number when a should sort before b, positive when
 * b should sort first, 0 when truly equal.
 */
function compareWithinBucket(a: Candidate, b: Candidate): number {
  const aFoundation = FOUNDATION_PRIORITY[a.group.id];
  const bFoundation = FOUNDATION_PRIORITY[b.group.id];
  if (aFoundation !== undefined && bFoundation !== undefined) {
    return aFoundation - bFoundation;
  }
  if (aFoundation !== undefined) return -1; // a wins
  if (bFoundation !== undefined) return 1; // b wins
  return a.monthsBefore - b.monthsBefore;
}

/**
 * Pick today's one thing — server-side resolver. Pass the host's
 * already-fetched `event_vendors` rows + the event's `wedding_date` +
 * the current clock; returns the highest-priority unlocked task, or
 * null when there's nothing actionable.
 *
 * Why this is a pure function (no Supabase client argument): the page
 * has already fetched `event_vendors` for the PlanningGroups +
 * FinalizedChipStrip components. Re-fetching here would be wasted IO
 * and would risk the resolver disagreeing with what the grid renders
 * below the hero (e.g. one fetch sees a vendor as locked, the other
 * sees it as considering because of mid-request status churn). Passing
 * the already-fetched array keeps both surfaces in lock-step.
 *
 * The signature accepts `ReadonlyArray<EventVendorRowInput>` which is
 * exactly what `PlanningGroups` consumes — same shape, same source,
 * same call site.
 */
export function pickTodaysOneThing(
  vendors: ReadonlyArray<EventVendorRowInput>,
  weddingDateIso: string | null,
  now: Date = new Date(),
): ResolvedTask | null {
  // No wedding date → caller's hero card shifts to the date-prompt
  // variant. Returning null signals that semantic.
  if (!weddingDateIso) return null;

  // Bucket vendors into the 12 groups using the canonical algorithm
  // already used by PlanningGroups. Pass null/null because the hero
  // doesn't surface compat-mismatch flags — those are pick-level UX
  // owned by the grid card.
  const bucketed = bucketVendorsByGroup(vendors, null, null);

  // Build candidate list — one entry per UNLOCKED group with status
  // assigned per algorithm.
  const candidates: Candidate[] = [];
  for (const group of PLAN_GROUPS) {
    // 22-card grid expansion (2026-05-22): skip entry-point cards
    // (countsTowardLockable: false). They share their underlying
    // VendorCategory with another card, so showing "Lock your live
    // band" as Today's One Thing when the parent music_entertainment
    // card already covers it would double-surface the same task.
    if (group.countsTowardLockable === false) continue;

    const picks = bucketed.get(group.id) ?? [];
    if (hasLockedPick(picks)) {
      // Already locked — skip. The host has nothing to do here today.
      continue;
    }
    const candidate = classify(group, weddingDateIso, now);
    if (candidate !== null) candidates.push(candidate);
  }

  // Every category locked → null (consumer renders celebratory variant).
  if (candidates.length === 0) return null;

  // Sort — priority by status bucket, then by within-bucket key.
  //
  // Owner directive 2026-05-22: within every bucket (overdue +
  // due_this_week + next_up + not_started), Foundation tier wins the
  // tie-break in canonical PH-planner order (reception → ceremony →
  // coordinator) BEFORE falling back to monthsBefore ASC. See
  // `compareWithinBucket` + `FOUNDATION_PRIORITY` above for the rationale.
  candidates.sort((a, b) => {
    const aOrder = STATUS_PRIORITY[a.status];
    const bOrder = STATUS_PRIORITY[b.status];
    if (aOrder !== bOrder) return aOrder - bOrder;

    if (a.status === 'overdue') {
      // Most-overdue first; foundation-tier tiebreak only when days
      // are equal (structurally upstream categories win — e.g. venue
      // beats cake when both are overdue by the same margin).
      if (a.days !== b.days) return b.days - a.days;
      return compareWithinBucket(a, b);
    }

    if (a.status === 'due_this_week') {
      // Closest to floor first (lower days = more urgent).
      if (a.days !== b.days) return a.days - b.days;
      return compareWithinBucket(a, b);
    }

    // next_up + not_started share the same secondary key: foundation
    // tier first, then earliest-monthsBefore.
    return compareWithinBucket(a, b);
  });

  const winner = candidates[0];
  if (!winner) return null;
  return resolveTask(winner);
}

/**
 * Count of UNLOCKED categories — exported so the hero card consumer
 * can render the "Show all N more tasks" disclosure label. Returns
 * the countable-card total minus locked-category count; reused by the
 * home page directly so it doesn't have to re-bucket.
 *
 * Returns the countable-card count when no vendors are locked yet,
 * 0 when every category has a lock. Mirrors the leftToLock math from
 * PlanningGroups so the two surfaces agree.
 *
 * 22-card grid expansion (2026-05-22): excludes entry-point cards
 * (countsTowardLockable: false) so the denominator matches the
 * PlanningGroups header. Entry-point cards (live_band, bridal_car,
 * guest_shuttle) share their underlying VendorCategory with another
 * card and shouldn't inflate the unlocked count.
 */
export function countUnlockedCategories(
  vendors: ReadonlyArray<EventVendorRowInput>,
): number {
  const bucketed = bucketVendorsByGroup(vendors, null, null);
  let unlocked = 0;
  for (const group of PLAN_GROUPS) {
    if (group.countsTowardLockable === false) continue;
    const picks = bucketed.get(group.id) ?? [];
    if (!hasLockedPick(picks)) unlocked += 1;
  }
  return unlocked;
}

// ---------- internals ----------

const STATUS_PRIORITY: Record<TodaysTaskStatus, number> = {
  overdue: 0,
  due_this_week: 1,
  next_up: 2,
  not_started: 3,
};

function hasLockedPick(picks: ReadonlyArray<PlanCardPick>): boolean {
  // Mirror FinalizedChipStrip's definition exactly so the two surfaces
  // agree on what "locked" means. `statusOfVendor` in
  // wedding-plan-groups.ts uses the same CONFIRMED set under the hood,
  // but checking raw_status here makes the intent explicit.
  for (const p of picks) {
    if (p.raw_status !== null && CONFIRMED_SET.has(p.raw_status)) return true;
    if (p.status === 'locked') return true;
  }
  return false;
}

function classify(
  group: PlanGroup,
  weddingDateIso: string,
  now: Date,
): Candidate | null {
  // `targetDateStatus` returns one of four tones; we re-categorize into
  // the four hero-card statuses. `hasAtLeastOneLocked` is false here by
  // construction (we already filtered locked groups above).
  const status = targetDateStatus(weddingDateIso, group.monthsBefore, false);

  // Re-derive days against the actual `now` arg so the resolver is
  // testable (targetDateStatus uses `new Date()` internally; for V1
  // pilot data the discrepancy is sub-second and harmless, but the
  // pure-function ergonomic helps unit tests later).
  const wedding = new Date(weddingDateIso);
  if (Number.isNaN(wedding.getTime())) return null;
  const target = new Date(wedding);
  target.setMonth(target.getMonth() - group.monthsBefore);
  const diffDays = Math.round(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (status.tone === 'none') {
    // No wedding date — should not reach here because the resolver
    // exits early on null weddingDateIso. Defensive return.
    return null;
  }

  if (status.tone === 'overdue' || diffDays < 0) {
    return {
      group,
      status: 'overdue',
      days: Math.abs(diffDays),
      monthsBefore: group.monthsBefore,
    };
  }

  if (diffDays <= 7) {
    return {
      group,
      status: 'due_this_week',
      days: diffDays,
      monthsBefore: group.monthsBefore,
    };
  }

  if (diffDays <= 30) {
    return {
      group,
      status: 'next_up',
      days: diffDays,
      monthsBefore: group.monthsBefore,
    };
  }

  return {
    group,
    status: 'not_started',
    days: diffDays,
    monthsBefore: group.monthsBefore,
  };
}

function resolveTask(candidate: Candidate): ResolvedTask {
  const { group, status, days } = candidate;
  const folderSlug = WEDDING_FOLDER_SLUG[group.catalogFolder];
  // Mirror PlanningGroups' search href construction so the hero CTA
  // and the planning-card CTA both land on the same scoped catalog
  // section. See Task #47 (PR #310) for the `?folder=...#...` lock.
  // 22-card grid expansion (2026-05-22): groups with a `subcategoryHint`
  // (live_band, host_emcee, mobile_bar, photo_booth, etc.) deep-link to
  // /vendors?folder=...&category=<canonical> for filtered vendor-grid
  // mode; others fall back to the catalog-scope anchor.
  const ctaHref = buildPlanGroupSearchHref(group, folderSlug);

  // Surface a sensible `daysContextual` per status: overdue → days
  // past floor; due_this_week / next_up → days until floor;
  // not_started → null (no floor proximity to communicate).
  const daysContextual = status === 'not_started' ? null : days;

  return {
    id: group.id,
    category: group.label,
    status,
    title: ACTION_TITLE[group.id],
    whyItMatters: WHY_IT_MATTERS[group.id],
    ctaLabel: CTA_LABEL[group.id],
    ctaHref,
    daysContextual,
  };
}
