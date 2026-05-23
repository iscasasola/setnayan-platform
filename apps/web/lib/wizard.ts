/**
 * Concierge Active Wizard · canonical 38-task sequence + resolver.
 *
 * Iteration 0016. Locked in CLAUDE.md Sixth 2026-05-23 row (V1 SCOPE
 * EXPANSION · Concierge active-wizard pulled forward from V1.5+ to V1
 * build). Replaces the prior TodaysOneThing link-card pattern with inline-
 * completion cards that let the host actually DO the task in-place rather
 * than navigating away.
 *
 * The host sees ONE card at a time as Today's Focus. WizardSequenceResolver
 * walks the canonical 38-task order, skips any task whose completion is
 * recorded in events.wizard_state, and returns the first incomplete task
 * as the active focus. Two interleaved behaviors override the canonical
 * order when active: coordinator-scheduled meetings happening today/tomorrow
 * (Phase 6) + wedding-expo prep cards within 14 days of a regional fair
 * (Phase 7). Both inject ABOVE the canonical task ladder.
 *
 * Card-completion types (three patterns):
 *
 *   - Pure data input (12 cards) · host fills a form inline in the card ·
 *     date · palette · monogram · schedule · website · sponsors · RSVP ·
 *     seatplan · count · honeymoon (cards 01, 09, 11, 15, 16, 20, 29, 30,
 *     31, 32).
 *
 *   - Vendor pick (15 cards) · top 5 recommendations + inline [Lock] +
 *     inline [Add custom vendor] + [VIEW MORE] expansion (cards 02, 03,
 *     04, 05, 07, 08, 10, 12, 13, 14, 18, 19, 22, 23, 24).
 *
 *   - External process tracking (11 cards) · paperwork checklists ·
 *     prenup shoot upload · STD video render · invitation deploy · paprint
 *     order · thank-yous · reviews · photo download · editorial opt-in
 *     (cards 06, 17, 21, 25, 26, 27, 28, 33, 35, 36, 37, 38).
 *
 * Phase 0 ships the framework only · individual cards land in Phases 1-5.
 * The resolver returns null when no card is implemented yet so the
 * WizardHero falls through gracefully to the existing TodaysOneThing
 * during the rollout window.
 *
 * Hard architectural constraint per owner directive: NO LINKS. Every card
 * completes inline · [VIEW MORE] expands inline · no navigation to /vendors
 * or other pages from within a focus card.
 *
 * UX locks per [[feedback_setnayan_concierge_wizard_ux]]:
 *   - Card 01 uses react-mobile-picker wheel-spinner D/M/Y picker
 *   - Vendor cards (02-24) show top 5 recommendations + [VIEW MORE]
 *   - Pilot timing: ships for June 1, 2026 cohort (Phase 0-2 land in 8d)
 */

export type WizardTaskId =
  // Phase 0 · Setup
  | 'set_wedding_date'
  // Phase 1 · Foundation (T-12m to T-9m)
  | 'reception_venue'
  | 'ceremony_venue'
  | 'officiant'
  | 'photography'
  | 'engagement_prenup_shoot'
  | 'catering'
  // Phase 2 · Style + Identity (T-9m to T-6m)
  | 'stylist'
  | 'mood_board'
  | 'lights_sound'
  | 'monogram'
  | 'music_entertainment'
  | 'host_mc'
  | 'photobooths_booths'
  // Phase 3 · Programming (T-6m to T-3m)
  | 'create_schedule'
  | 'create_website'
  | 'save_the_date_video'
  | 'attire'
  | 'hair_makeup'
  | 'principal_sponsors'
  | 'deploy_invitation'
  // Phase 4 · Late additions (T-3m to T-2m)
  | 'cake'
  | 'accommodation'
  | 'bridal_car'
  // Phase 5 · Legal paperwork (T-6m start, T-4m active) · REORDERED so
  // Cenomar + Church paperwork come BEFORE Marriage License which has a
  // 120-day validity window and must be issued last
  | 'cenomar'
  | 'church_paperwork'
  | 'pre_cana'
  | 'marriage_license'
  // Phase 6 · Final month (T-30d to T-1d)
  | 'finalize_rsvp'
  | 'finalize_seatplan'
  | 'finalize_catering_count'
  | 'honeymoon_planning'
  | 'paprint'
  | 'event'
  // Phase 7 · Post-event (T+1d to T+30d)
  | 'send_thank_yous'
  | 'create_reviews'
  | 'download_photos'
  | 'create_editorial';

/** Card completion patterns. Drives which inline UI the card renders. */
export type WizardCardKind =
  /** Host fills a form inline in the card (date picker, palette, etc.). */
  | 'data_input'
  /** Top 5 vendor recommendations + inline Lock + custom add + VIEW MORE. */
  | 'vendor_pick'
  /** Multi-step external process · checklist · upload · render. */
  | 'external_process';

/** Phases group cards by relative timing to the wedding date. */
export type WizardPhase =
  | 'setup'
  | 'foundation'
  | 'style_identity'
  | 'programming'
  | 'late_additions'
  | 'legal_paperwork'
  | 'final_month'
  | 'post_event';

export type WizardTask = {
  /** Stable identifier · key in events.wizard_state JSONB. */
  id: WizardTaskId;
  /** Display order in the canonical sequence (1-38). */
  order: number;
  /** Which phase this card belongs to. */
  phase: WizardPhase;
  /** Drives the inline UI pattern. */
  kind: WizardCardKind;
  /** Short, action-shaped title rendered as the card H3. */
  title: string;
  /** One-sentence brand-voice copy under the title. */
  whyItMatters: string;
  /** Pill label above the title (e.g. "FIRST THINGS FIRST", "FOUNDATION"). */
  pillLabel: string;
};

/**
 * Canonical 38-task sequence locked in CLAUDE.md Sixth 2026-05-23 row.
 *
 * Foundation tier (Reception → Ceremony → Officiant → Photographer →
 * Prenup → Caterer) is the load-bearing PH-wedding-planning order · venue
 * locks the date narrative, photographer needs 9-12 months, caterer needs
 * 4-6 months for tastings.
 *
 * Prenup shoot specifically lives between Photographer (#5) and Caterer
 * (#7) because owner directive locks "prenup shoot must be 1 month before
 * release of save the date" · STD Video lives at #17 (T-6m) so prenup
 * shoot must be at T-7m which falls between Photographer and Caterer.
 *
 * Legal paperwork (#25-#28) reorders the user's original list so Marriage
 * License is LAST · its 120-day validity window means it must be issued
 * after Cenomar + Church paperwork are in hand · Pre-Cana runs in
 * parallel · Marriage License is downstream of all three.
 */
export const WIZARD_TASKS: ReadonlyArray<WizardTask> = [
  {
    id: 'set_wedding_date',
    order: 1,
    phase: 'setup',
    kind: 'data_input',
    title: 'Set your wedding date',
    whyItMatters:
      "The date anchors everything else — your countdown, your vendor lock-by reminders, your timeline. Even a tentative month works for now; you can sharpen it later.",
    pillLabel: 'First things first',
  },
  {
    id: 'reception_venue',
    order: 2,
    phase: 'foundation',
    kind: 'vendor_pick',
    title: 'Lock your reception venue',
    whyItMatters:
      'The first domino — everything downstream waits on this. Your coordinator, caterer, and photographer all key off where your reception lives.',
    pillLabel: 'Foundation',
  },
  {
    id: 'ceremony_venue',
    order: 3,
    phase: 'foundation',
    kind: 'vendor_pick',
    title: 'Lock your ceremony venue',
    whyItMatters:
      'Locks the date and starts the paperwork clock. Parish documents take 4-6 weeks to gather; the marriage license has a 120-day countdown.',
    pillLabel: 'Foundation',
  },
  {
    id: 'officiant',
    order: 4,
    phase: 'foundation',
    kind: 'vendor_pick',
    title: 'Lock your officiant',
    whyItMatters:
      'The voice of your ceremony. Priests, ministers, and judges book months ahead; locking yours early is what makes the paperwork chain start moving.',
    pillLabel: 'Foundation',
  },
  {
    id: 'photography',
    order: 5,
    phase: 'foundation',
    kind: 'vendor_pick',
    title: 'Lock your photo & video team',
    whyItMatters:
      'The best PH photo and video teams book 9-12 months ahead. Locking yours early means your favorite is still available — and they start shaping the visual story now.',
    pillLabel: 'Foundation',
  },
  {
    id: 'engagement_prenup_shoot',
    order: 6,
    phase: 'foundation',
    kind: 'external_process',
    title: 'Schedule your prenup shoot',
    whyItMatters:
      "A month before your save-the-date drops. Your photographer guides location and styling; the photos feed the save-the-date video, your website hero, and the editorial down the line.",
    pillLabel: 'Foundation',
  },
  {
    id: 'catering',
    order: 7,
    phase: 'foundation',
    kind: 'vendor_pick',
    title: 'Lock your caterer',
    whyItMatters:
      'Filipino weddings live or die on the food. Tastings happen 4-6 months out, and the best teams book the same season they were booked the year before.',
    pillLabel: 'Foundation',
  },
  {
    id: 'stylist',
    order: 8,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your stylist',
    whyItMatters:
      "Your stylist sets the visual language — palette, florals, decor, signage. They shape the mood board with you, so locking the stylist first means every choice downstream lines up.",
    pillLabel: 'Style & Identity',
  },
  {
    id: 'mood_board',
    order: 9,
    phase: 'style_identity',
    kind: 'data_input',
    title: 'Set your mood board',
    whyItMatters:
      "Six colors anchor every visual choice — your florist, stationer, lighting designer, even the cake all read from this palette. Pick the feeling first; the colors follow.",
    pillLabel: 'Style & Identity',
  },
  {
    id: 'lights_sound',
    order: 10,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your lights & sound',
    whyItMatters:
      'Reception lighting and sound shape the whole atmosphere. PA + lights setup is technical — book 4-6 months out and confirm the venue power supply.',
    pillLabel: 'Style & Identity',
  },
  {
    id: 'monogram',
    order: 11,
    phase: 'style_identity',
    kind: 'data_input',
    title: 'Design your monogram',
    whyItMatters:
      "Your initials become the visual signature carried across save-the-date, invitations, signage, and the LED background. Two letters · one mark · everywhere.",
    pillLabel: 'Style & Identity',
  },
  {
    id: 'music_entertainment',
    order: 12,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your DJ + music',
    whyItMatters:
      'DJ, string quartet, choir — the music team that carries your program. The best ones run a wedding every weekend in peak season; book early or choose from what is left.',
    pillLabel: 'Style & Identity',
  },
  {
    id: 'host_mc',
    order: 13,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your host / emcee',
    whyItMatters:
      'Your emcee carries the program from cocktail hour through send-off. A great host makes the night feel effortless; book 4-6 months out.',
    pillLabel: 'Style & Identity',
  },
  {
    id: 'photobooths_booths',
    order: 14,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your booths',
    whyItMatters:
      "Photobooth, mobile bar, coffee station, perfume bar — the social glue of cocktail hour. Pick the types that fit your vibe; you can lock multiple at once.",
    pillLabel: 'Style & Identity',
  },
  {
    id: 'create_schedule',
    order: 15,
    phase: 'programming',
    kind: 'data_input',
    title: 'Build your day-of schedule',
    whyItMatters:
      "Ceremony · cocktails · reception · send-off. Once the major vendors are locked, the timeline writes itself — your coordinator can finalize call times for everyone.",
    pillLabel: 'Programming',
  },
  {
    id: 'create_website',
    order: 16,
    phase: 'programming',
    kind: 'data_input',
    title: 'Create your wedding website',
    whyItMatters:
      "Your landing page lives at setnayan.com/{your-slug}. Guests scan a QR to land here for the schedule, RSVP, gifts, and dress code. Setting it up takes minutes.",
    pillLabel: 'Programming',
  },
  {
    id: 'save_the_date_video',
    order: 17,
    phase: 'programming',
    kind: 'external_process',
    title: 'Release your save-the-date',
    whyItMatters:
      "Six months out · your prenup photos · a 30-second video your guests can save to their calendars. ₱199 per render so you can iterate the framing until it feels right.",
    pillLabel: 'Programming',
  },
  {
    id: 'attire',
    order: 18,
    phase: 'programming',
    kind: 'vendor_pick',
    title: 'Lock your attire',
    whyItMatters:
      "Custom gowns and barongs need 3-4 months from first fitting; rentals book 6-8 weeks ahead. Either way, the clock is friendlier than you think — start the conversation now.",
    pillLabel: 'Programming',
  },
  {
    id: 'hair_makeup',
    order: 19,
    phase: 'programming',
    kind: 'vendor_pick',
    title: 'Lock your hair & makeup team',
    whyItMatters:
      'Your bridal glam team carries the whole entourage on the morning of. Trials happen 1-2 months before the day; lock the artist first so the trial date even makes sense.',
    pillLabel: 'Programming',
  },
  {
    id: 'principal_sponsors',
    order: 20,
    phase: 'programming',
    kind: 'data_input',
    title: 'Lock your principal sponsors',
    whyItMatters:
      "Your ninong and ninang stand witness — invitations and seating depend on the final list. Your coordinator schedules a meeting with each sponsor pair at their location.",
    pillLabel: 'Programming',
  },
  {
    id: 'deploy_invitation',
    order: 21,
    phase: 'programming',
    kind: 'external_process',
    title: 'Send your invitations',
    whyItMatters:
      "Your monogram, your palette, your QR-encoded landing page — invitations carry it all. Each guest receives a personalized link that drives them to RSVP and discover the day.",
    pillLabel: 'Programming',
  },
  {
    id: 'cake',
    order: 22,
    phase: 'late_additions',
    kind: 'vendor_pick',
    title: 'Lock your cake maker',
    whyItMatters:
      'Tastings happen 3-4 months before the wedding. Pin a palette and a flavor direction first so the cake maker can pull samples that fit your day.',
    pillLabel: 'Late additions',
  },
  {
    id: 'accommodation',
    order: 23,
    phase: 'late_additions',
    kind: 'vendor_pick',
    title: 'Lock your accommodation',
    whyItMatters:
      "Where you and your wedding party rest the night before — sometimes bundled into your reception hotel package. Venue-affiliated room blocks fill fast; lock 1-2 months out.",
    pillLabel: 'Late additions',
  },
  {
    id: 'bridal_car',
    order: 24,
    phase: 'late_additions',
    kind: 'vendor_pick',
    title: 'Lock your bridal car',
    whyItMatters:
      'Your wedding-day arrival vehicle. Vintage, luxury, classic — book about 2 months out and confirm pickup time and decoration scope.',
    pillLabel: 'Late additions',
  },
  {
    id: 'cenomar',
    order: 25,
    phase: 'legal_paperwork',
    kind: 'external_process',
    title: 'Request your Cenomar',
    whyItMatters:
      "Certificate of No Marriage from PSA. Start here — processing takes 2-3 weeks, and you cannot get your marriage license until this is in hand.",
    pillLabel: 'Legal paperwork',
  },
  {
    id: 'church_paperwork',
    order: 26,
    phase: 'legal_paperwork',
    kind: 'external_process',
    title: 'Gather church paperwork',
    whyItMatters:
      "Baptismal certificate, confirmation certificate, canonical interview. Each comes from your origin parish — start now so they arrive in time for Pre-Cana.",
    pillLabel: 'Legal paperwork',
  },
  {
    id: 'pre_cana',
    order: 27,
    phase: 'legal_paperwork',
    kind: 'external_process',
    title: 'Complete Pre-Cana',
    whyItMatters:
      "Parish-required marriage prep · usually a one-day seminar OR a series across 2-3 weeks. Schedule 60-90 days before the ceremony.",
    pillLabel: 'Legal paperwork',
  },
  {
    id: 'marriage_license',
    order: 28,
    phase: 'legal_paperwork',
    kind: 'external_process',
    title: 'Apply for your marriage license',
    whyItMatters:
      "Last in the legal chain · 120-day validity window means you cannot apply too early. Once Cenomar and Pre-Cana are done, you apply at the city hall where either of you resides.",
    pillLabel: 'Legal paperwork',
  },
  {
    id: 'finalize_rsvp',
    order: 29,
    phase: 'final_month',
    kind: 'data_input',
    title: 'Finalize your RSVP list',
    whyItMatters:
      "Your headcount drives catering, seating, transportation, and printables. One last nudge to non-responders, then lock the final list.",
    pillLabel: 'Final month',
  },
  {
    id: 'finalize_seatplan',
    order: 30,
    phase: 'final_month',
    kind: 'data_input',
    title: 'Finalize your seat plan',
    whyItMatters:
      "Tables, chairs, head table, entourage seats. Your stylist and coordinator carry the final plan to set-up day; lock it once RSVPs are in.",
    pillLabel: 'Final month',
  },
  {
    id: 'finalize_catering_count',
    order: 31,
    phase: 'final_month',
    kind: 'data_input',
    title: 'Lock your catering count',
    whyItMatters:
      "Caterers buy ingredients 14 days out. Confirm your final headcount with the kitchen team so the food matches the room.",
    pillLabel: 'Final month',
  },
  {
    id: 'honeymoon_planning',
    order: 32,
    phase: 'final_month',
    kind: 'data_input',
    title: 'Lock your honeymoon plan',
    whyItMatters:
      "Flights, hotels, day-after activities. You will not want to plan this in the week after; lock destinations and bookings now.",
    pillLabel: 'Final month',
  },
  {
    id: 'paprint',
    order: 33,
    phase: 'final_month',
    kind: 'external_process',
    title: 'Order your print pack',
    whyItMatters:
      "QR-encoded table cards, place cards, schedule signs, day-of guide. Once seating and headcount are locked, the prints can ship 7-10 days before your wedding.",
    pillLabel: 'Final month',
  },
  {
    id: 'event',
    order: 34,
    phase: 'final_month',
    kind: 'external_process',
    title: 'Your wedding day',
    whyItMatters:
      "Day-of mode activates one hour before the ceremony and stays live through the reception. Your dashboard becomes the live operations surface for the whole team.",
    pillLabel: 'The day',
  },
  {
    id: 'send_thank_yous',
    order: 35,
    phase: 'post_event',
    kind: 'external_process',
    title: 'Send your thank-yous',
    whyItMatters:
      "Vendors deliver final files in the week after; thank-yous go out within two weeks. A short note per vendor keeps the relationship warm for future referrals.",
    pillLabel: 'Post-event',
  },
  {
    id: 'create_reviews',
    order: 36,
    phase: 'post_event',
    kind: 'external_process',
    title: 'Leave vendor reviews',
    whyItMatters:
      "Your reviews carry vendor reputations forward — couples planning right now read every one. Take 30 seconds each to share what worked.",
    pillLabel: 'Post-event',
  },
  {
    id: 'download_photos',
    order: 37,
    phase: 'post_event',
    kind: 'external_process',
    title: 'Download your photos',
    whyItMatters:
      "Papic delivers candid captures to your gallery within a week. The full archive — photographer + Papic + guest contributions — lands at T+30.",
    pillLabel: 'Post-event',
  },
  {
    id: 'create_editorial',
    order: 38,
    phase: 'post_event',
    kind: 'external_process',
    title: 'Publish your editorial',
    whyItMatters:
      "Thirty days after the wedding, your event becomes a magazine-style story shared on setnayan.com. Opt in to inspire other couples, or keep it private — your call.",
    pillLabel: 'Post-event',
  },
] as const;

/** Shape of events.wizard_state JSONB column. */
export type WizardState = Partial<
  Record<
    WizardTaskId,
    {
      completed_at: string; // ISO8601
      // Card-specific metadata — added by Phase 1-7 individual cards as needed
      [key: string]: unknown;
    } | null
  >
>;

/**
 * Read events.wizard_state safely. Coerces malformed JSON or null to empty
 * object so the resolver can iterate without runtime checks downstream.
 */
export function parseWizardState(raw: unknown): WizardState {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object') return {};
  return raw as WizardState;
}

/**
 * Returns TRUE when the given task is recorded as completed in the wizard
 * state. A task counts as "complete" when its key exists in wizard_state
 * AND the value is an object with a `completed_at` string field. The
 * card-specific metadata fields are optional.
 */
export function isTaskComplete(
  state: WizardState,
  taskId: WizardTaskId,
): boolean {
  const entry = state[taskId];
  if (!entry) return false;
  if (typeof entry !== 'object') return false;
  return typeof entry.completed_at === 'string' && entry.completed_at.length > 0;
}

/**
 * Result of WizardSequenceResolver. Either a single active task to render
 * as Today's Focus, or null when (a) no task is implemented yet at the
 * required position OR (b) all 38 tasks are complete (celebratory state).
 *
 * `reason` lets the consumer decide what to render in the null case · the
 * legacy TodaysOneThing fallback for `not_yet_implemented` vs the AllLocked
 * celebratory render for `all_complete`.
 */
export type WizardResolverResult =
  | { kind: 'active'; task: WizardTask }
  | { kind: 'null'; reason: 'not_yet_implemented' | 'all_complete' };

/**
 * Active focus resolver. Walks WIZARD_TASKS in canonical order, returns
 * the first task that is NOT recorded as complete in wizard_state.
 *
 * Phase 0 framework note: this resolver returns the first incomplete
 * task regardless of whether its inline-completion UI has been built
 * yet. The consumer (WizardHero) renders a placeholder when the card UI
 * isn't ready, so the resolver doesn't need to know about implementation
 * progress. As Phases 1-5 ship card UIs one at a time, the placeholder
 * gets swapped per task without resolver changes.
 *
 * Interleave behaviors (coordinator-scheduled meetings · expo prep) ship
 * in Phase 6 and Phase 7. They will wrap this resolver and inject their
 * own task above the canonical task when active. Phase 0 resolver does
 * not include interleave logic.
 */
export function resolveWizardFocus(
  state: WizardState,
): WizardResolverResult {
  for (const task of WIZARD_TASKS) {
    if (!isTaskComplete(state, task.id)) {
      return { kind: 'active', task };
    }
  }
  return { kind: 'null', reason: 'all_complete' };
}

/**
 * Number of remaining tasks. Used by the WizardHero subtitle ("32 more
 * to go") and by the AllLocked celebratory variant.
 */
export function countRemainingTasks(state: WizardState): number {
  let count = 0;
  for (const task of WIZARD_TASKS) {
    if (!isTaskComplete(state, task.id)) count += 1;
  }
  return count;
}

/**
 * Number of completed tasks. Used by progress bars / completion stats.
 */
export function countCompletedTasks(state: WizardState): number {
  return WIZARD_TASKS.length - countRemainingTasks(state);
}
