/**
 * Concierge Active Wizard · canonical 38-task sequence + resolver.
 *
 * Iteration 0016. Locked in CLAUDE.md Sixth 2026-05-23 row (V1 SCOPE
 * EXPANSION · Concierge active-wizard pulled forward from V1.5+ to V1
 * build). Replaces the prior TodaysOneThing link-card pattern with inline-
 * completion cards that let the host actually DO the task in-place rather
 * than navigating away.
 *
 * The host sees ONE card at a time as Setnayan AI. WizardSequenceResolver
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
  // DIY Foundation cards · added 2026-05-30 (CLAUDE.md owner directive
  // DIY/Paid bifurcation lock). These IDs only surface in the DIY 9-card
  // sequence (events.concierge_status='diy' OR 'expired') — paid Today's
  // Focus continues to render the full canonical 65-task sequence
  // WIZARD_TASKS_PAID exposes. See WIZARD_TASKS_DIY array + getCarouselTasks
  // branch below for the dispatch.
  | 'set_estimated_pax'
  | 'set_estimated_budget'
  | 'add_a_category'
  // Dynamic vendor-pick IDs spawned by Add A Category multi-pick. Format:
  // `custom_<canonical_service>` (e.g., `custom_florals`, `custom_bridal_car`).
  // The template-literal union keeps TypeScript happy when getCarouselTasks
  // appends these to the DIY sequence at render time.
  | `custom_${string}`
  // Phase 1 · Foundation (T-12m to T-9m)
  | 'reception_venue'
  | 'ceremony_venue'
  | 'officiant'
  | 'coordinator'
  | 'draft_guest_list'
  | 'photography'
  | 'engagement_prenup_shoot'
  | 'catering'
  | 'customize_food'
  | 'food_tasting'
  // Phase 2 · Style + Identity (T-9m to T-6m)
  | 'stylist'
  | 'rendered_mood_board'
  | 'mood_board'
  | 'lights_sound'
  | 'led_background'
  | 'monogram'
  | 'music_entertainment'
  // 2026-05-25 owner directive ("finding after party band/dj is gone"):
  // dedicated card for the after-party DJ that runs the late-night dance
  // floor block. Different vibe + different DJ + different playlist from
  // the primary band/DJ booked via music_entertainment. Soft prereq:
  // music_entertainment locked first so the host has the main act before
  // they think about the after-block. Canonical filter mirrors v11
  // taxonomy entry for `dj` (the post-reception block is overwhelmingly
  // DJ-driven · live bands rarely cover both reception + after-party).
  | 'after_party_music'
  | 'host_mc'
  | 'photobooths_booths'
  | 'pakanta'
  | 'dance_instructor'
  // Phase 3 · Programming (T-6m to T-3m)
  | 'create_schedule'
  | 'song_list'
  | 'create_website'
  | 'website_upgrade'
  | 'save_the_date_video'
  | 'papic'
  | 'panood'
  | 'patiktok'
  | 'same_day_edit'
  | 'attire'
  | 'hair_makeup'
  | 'principal_sponsors'
  | 'finalize_entourage'
  | 'gift_registry'
  | 'invitations_stationery'
  | 'deploy_invitation'
  | 'complete_guest_list'
  | 'gap_fill_guest_list'
  | 'second_batch_invitation'
  // Phase 4 · Late additions (T-3m to T-2m)
  | 'cake'
  | 'rings'
  | 'accommodation'
  | 'bridal_car'
  // Phase 5 · Legal paperwork (T-6m start, T-4m active) · REORDERED so
  // Cenomar + Church paperwork come BEFORE Marriage License which has a
  // 120-day validity window and must be issued last
  | 'cenomar_bride'
  | 'cenomar_groom'
  | 'church_paperwork'
  | 'pre_cana'
  | 'marriage_license'
  // Phase 6 · Final month (T-30d to T-1d)
  | 'finalize_rsvp'
  | 'finalize_seatplan'
  | 'honeymoon_planning'
  | 'paprint'
  | 'all_set_readiness'
  | 'wedding_rehearsal'
  | 'event'
  // Phase 7 · Post-event (T+1d to T+30d)
  | 'send_thank_yous'
  | 'create_reviews'
  | 'download_photos'
  | 'ai_highlights'
  | 'keepsake_bundle'
  | 'create_editorial'
  | 'claim_next_event_reward';

/** Card completion patterns. Drives which inline UI the card renders. */
export type WizardCardKind =
  /** Host fills a form inline in the card (date picker, palette, etc.). */
  | 'data_input'
  /** Top 5 vendor recommendations + inline Lock + custom add + VIEW MORE. */
  | 'vendor_pick'
  /** Multi-step external process · checklist · upload · render. */
  | 'external_process'
  /**
   * Host-triggered action that spawns downstream tasks (e.g., Add A
   * Category lets the host multi-pick canonical_services and each pick
   * spawns its own vendor_pick task). Added 2026-05-30 for the DIY
   * Foundation 9-card sequence's add_a_category surface.
   */
  | 'host_action';

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
  /** Hard prerequisites — other wizard tasks that MUST be settled
   *  (completed or in_flight) before this one can be acted on. Empty
   *  array means the host can start this card any time.
   *
   *  Owner-locked 2026-05-24 carousel UX: cards with unmet prereqs
   *  render DARKENED with `Locked until {prereq title}` copy in the
   *  carousel surface. The active focus is always the first unsettled
   *  task whose prereqs are all met.
   *
   *  Hard prereqs only — soft / recommended dependencies are NOT here
   *  (e.g., Card 18 Attire benefits from a finalized mood board but
   *  isn't blocked by it). Locking too aggressively traps hosts who
   *  legitimately want to do things out of order.
   */
  prerequisites: ReadonlyArray<WizardTaskId>;
};

/**
 * Canonical 48-task sequence — reconciled 2026-05-24 against the shipped
 * code (45 was the drifted count caught by owner via "Setnayan AI has
 * 38 while actual task is 41" report) + extended with 3 cards to align
 * Setnayan AI + Parallel Work Map + Your Plan grid surfaces per owner
 * directive "make sure Setnayan AI, your parallel work map and 23
 * things to lock in all give out the same output and control on
 * preparing a wedding."
 *
 * The 3 alignment cards (coordinator · led_background ·
 * invitations_stationery) fill PLAN_GROUPS cells that previously had no
 * Setnayan AI entry point — couples could see them on the Plan grid
 * but had no guided path through the wizard. Canonical lock now 48 tasks
 * matching the Plan grid's 23 vendor-pick categories (the wizard's
 * remaining 25 tasks are planning + legal + finalization + post-event
 * tasks that don't have plan-group cells by design).
 *
 * Original canonical 38-task sequence locked in CLAUDE.md Sixth
 * 2026-05-23 row.
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
// 2026-05-24 CRITICAL FIX (owner-reported "guest list is still 6th card"):
// the array was authored in source order (tasks added over time landed at
// the bottom), and getCarouselTasks() iterated this array in declaration
// order — so the `order` field was IGNORED at runtime. Reorders done via
// PR #525 (draft_guest_list 4.5 → 1.5, music 12 → 5.5, attire 18 → 7.6,
// rings 22.5 → 9.5) had zero effect because the array index is what the
// carousel walks, not the order field.
//
// Fix: declare the raw literal as a private constant, then export
// WIZARD_TASKS as a stable-sorted copy keyed on `order`. Now the `order`
// field is truly authoritative + adding a new task anywhere in source
// (e.g., at the bottom for readability) automatically slots it into the
// right sequence position based on its `order` value. Future devs don't
// have to think about source vs canonical order being separate.
const _WIZARD_TASKS_RAW: ReadonlyArray<WizardTask> = [
  {
    id: 'set_wedding_date',
    order: 1,
    phase: 'setup',
    kind: 'data_input',
    title: 'Set your wedding date',
    whyItMatters:
      "The date anchors everything else — your countdown, your vendor lock-by reminders, your timeline. Even a tentative month works for now; you can sharpen it later.",
    pillLabel: 'First things first',
    prerequisites: [],
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
    prerequisites: ['set_wedding_date'],
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
    prerequisites: ['set_wedding_date'],
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
    prerequisites: ['set_wedding_date'],
  },
  {
    // Added 2026-05-24 to align with PLAN_GROUPS.coordinator. Owner directive:
    // "make sure Setnayan AI, your parallel work map and 23 things to lock
    // in all give out the same output and control on preparing a wedding."
    // The Plan grid was already surfacing a Coordinator cell tied to
    // category='planner_coordinator' but the wizard had no card pointing at
    // it — the entry point couples reach via Setnayan AI carousel was
    // missing. Coordinator sits in the foundation tier because they ratify
    // the timeline + vendor lock order + interleave their site visits per
    // CLAUDE.md 2026-05-24 row 1's coordinator-scheduled-meetings primitive.
    id: 'coordinator',
    order: 4.2,
    phase: 'foundation',
    kind: 'vendor_pick',
    title: 'Lock your wedding coordinator',
    whyItMatters:
      "The conductor of your day. Coordinators book 9-12 months ahead and they're the one who keeps every vendor on time on the wedding day. Lock yours early — they'll help you finalize the rest.",
    pillLabel: 'Foundation',
    prerequisites: ['set_wedding_date'],
  },
  {
    // 2026-05-24 senior-planner reorder: was order 4.5 (position 6 ·
    // after officiant + coordinator). Moved to 1.5 (position 2 · right
    // after set_wedding_date) because guest count drives reception
    // venue size + catering quote. Picking reception venue without a
    // rough headcount = re-quote later when the number lands. Filipino
    // weddings routinely grow from 80 to 200 between engagement and
    // RSVP — anchoring the rough count first prevents downstream churn.
    // 2026-05-24 owner directive (3-stage guest list split): this is
    // STAGE 1 of three guest-list cards. Stage 1 = bride + groom +
    // parents + principal sponsors + secondary sponsors + entourage —
    // the VIP scaffold that the seat plan + invitation design + name-
    // cards keys off. Filipino weddings finalize this list 9-12 months
    // out because principal sponsors + entourage names ride the
    // invitation design. Stages 2 + 3 (complete_guest_list at order
    // 20.4 + gap_fill_guest_list at order 21.3) handle the broader
    // list pre-invitation and the gap-fill post-first-invitation.
    id: 'draft_guest_list',
    order: 1.5,
    phase: 'foundation',
    kind: 'external_process',
    title: 'Add VIPs to your guest list',
    whyItMatters:
      "Bride + groom + parents + principal sponsors + secondary sponsors + your entourage. These names ride the invitation design and seal the family-head tables in the seat plan. Don't worry about the full guest list yet — that's two more cards down the line.",
    pillLabel: 'Foundation',
    prerequisites: ['set_wedding_date'],
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
    prerequisites: ['set_wedding_date'],
  },
  {
    // 2026-05-24 owner directive: track 3 milestones, not just the
    // shoot date. Filipino prenup pipeline: shoot T-6mo → teaser
    // (15-30s) T-5mo (used for Save-the-Date video) → full prenup
    // video (2-4min) T-3mo (used for website hero + reception roll-in).
    // V1: external_process kind · host marks each milestone as
    // received. V1.x: photographer-side upload triggers auto-receipt.
    id: 'engagement_prenup_shoot',
    order: 6,
    phase: 'foundation',
    kind: 'external_process',
    title: 'Schedule your prenup shoot',
    whyItMatters:
      "Three milestones — the shoot itself at T-6mo, the teaser (15-30s) at T-5mo which feeds your save-the-date video, and the full prenup video (2-4 min) at T-3mo which lands on your website hero + reception roll-in. Lock the shoot date here; mark teaser + full video as received when your photographer delivers.",
    pillLabel: 'Foundation',
    prerequisites: ['photography'],
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
    prerequisites: ['reception_venue'],
  },
  {
    // 2026-05-24 owner directive ("shouldn't there be a food tasting
    // first before we customize our food?"). Order swapped from 7.5 to
    // 7.55 so the tasting card (now 7.5) lands FIRST. Logic: caterer
    // presents an initial menu pre-tasting → host tastes at T-3mo →
    // customize based on what landed best. Customize is the LAST mile
    // before the catering lock-in.
    id: 'customize_food',
    order: 7.55,
    phase: 'foundation',
    kind: 'external_process',
    title: 'Customize your food',
    whyItMatters:
      "Now that you've tasted the caterer's spread, tweak the final menu — swap dishes that didn't land, lock dietary accommodations, adjust portion sizing per the tasting feedback. Your caterer wraps this into the locked contract menu after.",
    pillLabel: 'Foundation',
    prerequisites: ['food_tasting'],
  },
  {
    // 2026-05-24 owner directive: tasting comes BEFORE customize. The
    // tasting card now sits at order 7.5 (was 7.55) and lands at
    // position 12 in the sorted sequence · customize_food shifted to
    // 7.55 (was 7.5) so they swap. Filipino caterers run a kitchen
    // tasting session at T-3 months where the couple visits the
    // commissary + tastes the initial menu the caterer prepared. The
    // tasting INFORMS the customization → it's the entry-point to the
    // menu-shape conversation, not a confirmation step at the end.
    id: 'food_tasting',
    order: 7.5,
    phase: 'foundation',
    kind: 'external_process',
    title: 'Schedule your food tasting',
    whyItMatters:
      "T-3 months you visit your caterer's kitchen for the tasting. The caterer prepares their initial menu pitch and you taste each dish before locking the final shape on the next card. Filipino couples skip this at their peril.",
    pillLabel: 'Foundation',
    prerequisites: ['catering'],
  },
  {
    // 2026-05-24 owner directive: mood_board MUST come before stylist.
    // Per the moodboard-finalize-then-broadcast architecture (CLAUDE.md
    // 2026-05-24 row), the locked mood board IS the palette source-of-
    // truth that feeds 13 downstream vendors including stylist. Picking
    // a stylist first inverts that contract — the stylist sets the
    // palette unilaterally instead of executing on the host's locked
    // vision. order swapped 8 → 9 (now lands at position 15).
    id: 'stylist',
    order: 9,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your stylist',
    whyItMatters:
      "Your stylist executes on the palette you locked in mood board. They shape florals, decor, signage, and table styling — but the color story comes from you first.",
    pillLabel: 'Style & Identity',
    prerequisites: ['reception_venue', 'mood_board'],
  },
  {
    // Added 2026-05-24 (owner directive · "we will have another for the
    // rendered mood board by stylist"). Two-mood-board model: the
    // INSPIRATION mood board (card 'mood_board' at order 8) is what
    // the host curates with reference photos · palette · location feel
    // BEFORE hiring a stylist. The RENDERED mood board (this card) is
    // what the locked stylist sends back with their curated render of
    // the wedding's actual styling — host reviews + approves it here so
    // it becomes the final reference all downstream vendors read.
    // External-process kind · placeholder body until inline approval
    // UI ships V1.x.
    id: 'rendered_mood_board',
    order: 9.1,
    phase: 'style_identity',
    kind: 'external_process',
    title: 'Approve the rendered mood board',
    whyItMatters:
      "Your stylist takes the inspiration mood board and renders the real version — palette they'll source florals to, table styling photos, signage mockups, decor refs. Approve it here and it becomes the locked reference your florist, lighting team, cake-maker, and stationer all read from.",
    pillLabel: 'Style & Identity',
    prerequisites: ['stylist'],
  },
  {
    // 2026-05-24 owner directive (see stylist comment above): mood_board
    // promoted ahead of stylist · order swapped 9 → 8 (now lands at
    // position 14). Also adds set_wedding_date prereq so the card
    // doesn't fire before basic event data is in place.
    id: 'mood_board',
    order: 8,
    phase: 'style_identity',
    kind: 'data_input',
    title: 'Set your inspiration mood board',
    whyItMatters:
      "Six colors plus reference photos that anchor every visual choice downstream — your florist, stationer, lighting designer, even the cake. This is your inspiration — your stylist takes it from here and sends back the rendered version for you to approve.",
    pillLabel: 'Style & Identity',
    prerequisites: ['set_wedding_date'],
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
    prerequisites: ['reception_venue'],
  },
  {
    // Added 2026-05-24 to align with PLAN_GROUPS.led_background. Owner
    // directive: same as coordinator entry above — the Plan grid had a cell
    // for LED background (category='led_screens') but no Setnayan AI card
    // pointed at it. Iteration 0005 LED Background Maker is the offline
    // template flow; this card is the vendor-pick precursor for couples
    // sourcing an LED-screen rental vendor.
    id: 'led_background',
    order: 10.5,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your LED background',
    whyItMatters:
      "The LED wall behind your stage shapes every photo from the reception. 8K rentals book 3-4 months out and the template upload happens via the offline USB pipeline a week before — lock the vendor first so they can quote the setup.",
    pillLabel: 'Style & Identity',
    prerequisites: ['reception_venue'],
  },
  {
    id: 'monogram',
    // 2026-05-24 owner directive (flow diagram) · shifted earlier from
    // order 11 to 4.7 so monogram lands in Foundation tier alongside
    // draft_guest_list. Reasoning: bespoke monogram has 4-6 week design
    // lead-time, and it's a hard input to Save-the-Date Video (Card 17),
    // Website (Card 16), Deploy Invitation (Card 21), and LED Background
    // (post-event). Phase label kept as 'style_identity' for tier grouping
    // continuity even though the surface ordering reads Foundation-early.
    //
    // 2026-05-24 prereq fix: added `set_wedding_date` so the card doesn't
    // fire before the event's basic data is in place.
    order: 4.7,
    phase: 'style_identity',
    kind: 'data_input',
    title: 'Design your monogram',
    whyItMatters:
      "Your initials become the visual signature carried across save-the-date, invitations, signage, and the LED background. Two letters · one mark · everywhere — and bespoke monograms need 4-6 weeks of design lead-time.",
    pillLabel: 'Style & Identity',
    prerequisites: ['set_wedding_date'],
  },
  {
    // 2026-05-24 senior-planner reorder: was order 12 (position 16).
    // Moved to 5.5 (position 9 · alongside photography in the
    // Foundation tier) because top PH wedding bands + DJs (Side A,
    // Brass Pas Pas, Tilt, top DJs) book 8-10 months ahead for peak
    // season (Dec/Apr/May). Same high-demand vendor reality as
    // photography — booking late = no first-choice options available.
    // Phase tag stays 'style_identity' for plan-grid grouping continuity
    // but the order value puts it in the Foundation-priority booking tier.
    id: 'music_entertainment',
    order: 5.5,
    phase: 'style_identity',
    kind: 'vendor_pick',
    // 2026-05-24 owner directive: card title broadened to "Band / DJ /
    // Performer" so couples don't read it as DJ-only · the canonical
    // taxonomy already surfaces live_band + dj_emcee_host +
    // choir_quartet + acoustic_performer behind the same vendor-pick
    // grid; the title now matches.
    title: 'Band / DJ / Performer',
    whyItMatters:
      'Live band, DJ, string quartet, choir, acoustic duo — whichever performer carries your program. The best ones run a wedding every weekend in peak season; book early or choose from what is left.',
    pillLabel: 'Style & Identity',
    prerequisites: ['reception_venue'],
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
    // 2026-05-24 prereq fix: host needs venue style + program shape.
    prerequisites: ['reception_venue'],
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
    prerequisites: ['reception_venue'],
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
    prerequisites: ['reception_venue', 'ceremony_venue'],
  },
  {
    // Added 2026-05-24 (owner directive · "where do we add the songlist").
    // The playlist add-on surface at /dashboard/[eventId]/add-ons/playlist
    // shipped earlier but had no wizard card pointing at it. Card sits
    // between create_schedule (sets ceremony 3pm · cocktails 5pm ·
    // reception 7pm) and create_website. Couples build the playlist
    // SEGMENT-BY-SEGMENT (processional · first dance · parents' dance ·
    // cocktail tracks · banned songs) so the DJ runs the night off it.
    // Typical lock window T-4-6 weeks.
    id: 'song_list',
    order: 15.5,
    phase: 'programming',
    kind: 'data_input',
    title: 'Build your DJ song list',
    whyItMatters:
      "Processional · first dance · parents' dance · cocktail hour · banned tracks. Your DJ runs the night off what you build here. Most couples lock the list 4-6 weeks before the wedding so the DJ has time to source and cue every entry.",
    pillLabel: 'Programming',
    prerequisites: ['create_schedule', 'music_entertainment'],
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
    prerequisites: ['set_wedding_date', 'reception_venue', 'ceremony_venue'],
  },
  {
    // Added 2026-05-24 (owner directive · "upgrade website/landing
    // page?"). Two paid Pro widgets per iteration 0004: Monogram Hero
    // ₱1,999 (animated SVG-trace monogram + custom video/photo
    // background) + Live Schedule ₱999 ("Happening now" highlight +
    // auto-scroll on the day). External-process kind · placeholder
    // body until the inline upgrade picker lands V1.x · the picker
    // already exists at /dashboard/[eventId]/website so this card
    // surfaces it in the Setnayan AI carousel.
    id: 'website_upgrade',
    order: 16.5,
    phase: 'programming',
    kind: 'external_process',
    title: 'Upgrade your website',
    whyItMatters:
      "Two paid upgrades transform your wedding website. Monogram Hero (₱1,999) gives you the animated SVG-trace monogram + custom video or photo background. Live Schedule (₱999) lights up the 'Happening now' card on the day, auto-scrolling through ceremony → cocktails → reception. Optional · the free version still ships beautifully.",
    pillLabel: 'Programming',
    prerequisites: ['create_website'],
  },
  {
    // 2026-05-24 owner directive: card body should let host upload
    // prenup photos + video → pick template → render → share + auto-
    // add to wedding website. V1: external_process placeholder · the
    // /add-ons/save-the-date route at /dashboard/[eventId]/add-ons
    // surfaces the actual upload/render UI. V1.x: inline-completion
    // body wires the upload + render + share flow directly into the
    // card. The auto-add-to-website hook fires on render success ·
    // updates the create_website hero block.
    id: 'save_the_date_video',
    order: 17,
    phase: 'programming',
    kind: 'external_process',
    title: 'Release your save-the-date',
    whyItMatters:
      "Upload your prenup teaser + photos · pick a template · render at ₱199. The result auto-publishes to your wedding website hero AND gives you a shareable MP4 for IG / FB / Viber. Iterate the framing until it feels right · each render is its own purchase.",
    pillLabel: 'Programming',
    prerequisites: ['engagement_prenup_shoot'],
  },
  {
    // Added 2026-05-24 (owner directive · "offer all setnayan in app
    // services also on the Setnayan AI"). Papic = guest-paparazzi
    // photo mesh (iteration 0012 · CLAUDE.md row 2026-05-16). Couples
    // book the add-on, designate guest paparazzi via QR enrollment, the
    // native app captures + auto-tags during the event. T-3mo entry,
    // T-14d floor (final paparazzi seat assignment). Card surfaces the
    // intake + tier picker; the add-on surface at /add-ons/papic
    // handles the actual setup. External-process kind · placeholder
    // body until inline activation UI ships V1.x.
    id: 'papic',
    // 2026-05-24 owner directive ("activate papic, panood and patiktok,
    // before we release save the date"): orders moved from 17.3/17.5/17.7
    // (after save_the_date_video order 17) to 16.6/16.7/16.8 (BEFORE
    // save_the_date_video). Rationale: the STD video copy can reference
    // these services (e.g., "we'll be livestreaming · QR your photo
    // contribution") AND it nudges couples to spend on Setnayan
    // services earlier in the funnel. Same-Day Edit at order 17.8
    // stays AFTER save_the_date_video — owner only specified the 3
    // and SDE is a different purchase moment (₱9,999+ flagship).
    order: 16.6,
    phase: 'programming',
    kind: 'external_process',
    title: 'Activate Papic',
    whyItMatters:
      "Your guests with phones become paparazzi — Papic auto-tags every photo by face + table QR + scans, and the curated gallery lands T+24hr. Lock the pack at T-3 months so guest enrollment can start with the invitation rollout.",
    pillLabel: 'Programming',
    prerequisites: ['reception_venue'],
  },
  {
    // Added 2026-05-24 (owner directive · same row as Papic). Panood =
    // BYO-YouTube multi-cam livestream (iteration 0011 · CLAUDE.md row
    // 2026-05-16). Couples buy daily SKU (₱2,499/day Setnayan-multicam)
    // or annual (₱19,999/year vendor-tier). OAuth handshake into the
    // couple's own YouTube channel · Setnayan provides broadcaster web
    // UI + multi-cam switching. T-2mo entry, T-14d floor.
    id: 'panood',
    // 2026-05-24 owner directive (see papic comment above): moved from
    // 17.5 to 16.7 · before save_the_date_video.
    order: 16.7,
    phase: 'programming',
    kind: 'external_process',
    title: 'Activate Panood',
    whyItMatters:
      "Live-stream the ceremony + reception to your overseas family on YOUR own YouTube channel — no Setnayan brand on the broadcast. Setnayan handles multi-cam switching; you keep the recordings forever. T-2 months gives the broadcaster setup time + your YouTube OAuth gate.",
    pillLabel: 'Programming',
    prerequisites: ['reception_venue'],
  },
  {
    // Added 2026-05-24 (owner directive · same row as Papic + Panood).
    // Patiktok = physical TikTok booth at the venue (iteration 0017 ·
    // CLAUDE.md row 2026-05-16). Dual-tier per-day pricing: Setnayan
    // master TikTok ₱999/day · couple's own TikTok ₱1,999/day via OAuth.
    // 40-video soft cap per booth per day + ₱49/+10 overage. T-3mo entry,
    // T-14d floor.
    id: 'patiktok',
    // 2026-05-24 owner directive (see papic comment above): moved from
    // 17.7 to 16.8 · before save_the_date_video.
    order: 16.8,
    phase: 'programming',
    kind: 'external_process',
    title: 'Activate Patiktok',
    whyItMatters:
      "TikTok booth at the venue — guests step up, pick a trending sound from the printed QR menu, perform the dance, the booth auto-compiles + posts. Pick which TikTok handle owns the content (Setnayan or yours). T-3 months gives time for sound curation + booth slot reservation.",
    pillLabel: 'Programming',
    prerequisites: ['reception_venue'],
  },
  {
    // Added 2026-05-24 (owner directive · "what other services by our
    // app that needs to be purchased as well"). Same-Day Edit (SDE) is
    // the flagship cinematic edit — 3-5 minute story-arc reel edited
    // DURING the reception by the SDE crew + AI vision, then projected
    // at the reception's end as the reveal moment. Premium tier from
    // ₱9,999 (positioned to underbid traditional PH SDE videographers
    // who charge ₱50-150K). Activation is pre-event (T-2mo) so the SDE
    // crew can plan their coverage alongside Photography + Panood.
    id: 'same_day_edit',
    order: 17.8,
    phase: 'programming',
    kind: 'external_process',
    title: 'Activate Same-Day Edit (SDE)',
    whyItMatters:
      "Cinematic 3-5 minute reveal of your day, edited DURING the reception and projected before the send-off. Setnayan's SDE crew uses vision AI to surface the best moments + cut them into a story arc — from ₱9,999, dramatically under the ₱50-150K traditional PH SDE rate. T-2 months gives the crew time to plan coverage alongside your photo + Panood team.",
    pillLabel: 'Programming',
    prerequisites: ['reception_venue', 'photography'],
  },
  {
    // 2026-05-24 senior-planner reorder: was order 18 (position 22 ·
    // after deploy_invitation at T-2mo · too late for custom gowns).
    // Moved to 7.6 (position 13 · alongside catering tier in Foundation)
    // because premium PH bridal designers (Vania Romoff, Mark Bumgarner,
    // Mak Tumang, Patricia Santos) need 4-8 months for custom gowns from
    // first fitting through delivery. Rentals book 6-8 weeks ahead, so
    // even the rental track needs to start at T-3mo not T-2mo. Phase
    // tag stays 'programming' for plan-grid grouping continuity but the
    // order value puts it in the Foundation booking tier.
    // 2026-05-24 owner directive: card body shows multiple sub-items
    // the host can lock — bridal gown · bridal shoes · groom suit ·
    // groom shoes · entourage attire · parents attire. UI conditional
    // on the host's role (bride sees gown picker first · groom sees
    // suit picker first · planner role sees both). V1: single vendor-
    // pick card linking to /vendors filtered to gown_designer +
    // suit_designer. V1.x: inline 6-item sub-picker per the locked
    // 2026-05-21 spec.
    id: 'attire',
    order: 7.6,
    phase: 'programming',
    kind: 'vendor_pick',
    title: 'Lock your attire',
    whyItMatters:
      "Six items live here — bridal gown · bridal shoes · groom suit · groom shoes · entourage attire · parents attire. Custom gowns + barongs need 3-4 months from first fitting; rentals book 6-8 weeks ahead. Either way, the clock is friendlier than you think — start the conversation now.",
    pillLabel: 'Programming',
    prerequisites: ['set_wedding_date'],
  },
  {
    // 2026-05-24 owner directive: copy clarifies the bride + entourage
    // distinction. PH HMUA often runs two parallel tracks — a premium
    // artist for the bride (trial · day-of) + a team for the entourage
    // (mom · MOH · bridesmaids · flower girls). Sometimes one artist
    // covers both with assistants; sometimes two separate vendor
    // bookings. Card body lets host lock 1 or 2 vendors here as
    // appropriate. V1: single vendor-pick card. V1.x: optional 2-slot
    // sub-picker.
    id: 'hair_makeup',
    order: 19,
    phase: 'programming',
    kind: 'vendor_pick',
    title: 'Lock your hair & makeup team',
    whyItMatters:
      'Two looks here — the bride (premium artist · trial + day-of) and the entourage (mom · MOH · bridesmaids · flower girls). Sometimes one artist covers both with a team; sometimes you book separately. Trials happen 1-2 months before the day; lock the artist(s) first so the trial date makes sense.',
    pillLabel: 'Programming',
    prerequisites: ['set_wedding_date'],
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
    // 2026-05-24 prereq fix: shouldn't fire before the wedding date is set.
    prerequisites: ['set_wedding_date'],
  },
  {
    id: 'finalize_entourage',
    order: 20.5,
    phase: 'programming',
    kind: 'external_process',
    title: 'Finalize your entourage',
    whyItMatters:
      "Your maids of honor · best men · bridesmaids · groomsmen · bearers · flower girls. Their attire is sized from this list, their seats are reserved at family-head tables, and their names appear on every print card you order.",
    pillLabel: 'Programming',
    prerequisites: ['principal_sponsors'],
  },
  {
    // Added 2026-05-24 (owner directive · 3-stage guest list split ·
    // STAGE 2). After the VIP scaffold (draft_guest_list) + sponsors +
    // entourage are locked, the host fills in the broader guest list —
    // extended family, work circle, school friends, plus-ones, kids.
    // Sits before invitations_stationery + deploy_invitation so the
    // print run + RSVP link rollout reads the complete list. Filipino
    // weddings finalize this list T-3 to T-2 months out so the catering
    // + paprint headcount lock against the same number.
    id: 'complete_guest_list',
    order: 20.55,
    phase: 'programming',
    kind: 'external_process',
    title: 'Complete your guest list',
    whyItMatters:
      "Pre-invitation finalization. Fill in extended family, work circle, school friends, plus-ones, kids. Your invitations rollout reads from this list and your caterer + paprint headcount lock against the same number. Don't worry about gaps yet — there's one more pass after the first invite goes out.",
    pillLabel: 'Programming',
    prerequisites: ['draft_guest_list', 'principal_sponsors', 'finalize_entourage'],
  },
  {
    // Added 2026-05-24 (owner directive · ❓ missing cards audit · "the
    // rest, yes"). Filipino couples increasingly share gift registries
    // (Rustans · SM · Wedding Wishlist app · cash-only Bills Manila). Card
    // sits before invitations_stationery so the registry link can land
    // on the printed and digital invitations. External-process kind ·
    // host records the registry name + URL.
    id: 'gift_registry',
    order: 20.6,
    phase: 'programming',
    kind: 'external_process',
    title: 'Set up your gift registry',
    whyItMatters:
      "Rustans · SM Home · cash-only Bills Manila · or a curated wishlist on a registry app. Pick one (or none — entirely optional) and capture the link here. We'll surface it on your wedding website and inside your invitation cards.",
    pillLabel: 'Programming',
    prerequisites: ['set_wedding_date'],
  },
  {
    // Added 2026-05-24 to align with PLAN_GROUPS.invitations_stationery.
    // Owner directive: surface a vendor-pick card for the stationery
    // designer/printer SEPARATE from deploy_invitation (which is the
    // action of sending invitations, not the vendor lock). Stationery
    // vendors design + print the physical or digital cards; some couples
    // hire one vendor for both, others split. Lock vendor before deploy
    // so they have time to design + proof + print.
    id: 'invitations_stationery',
    order: 20.7,
    phase: 'programming',
    kind: 'vendor_pick',
    title: 'Lock your invitations & stationery',
    whyItMatters:
      "Your save-the-date · main invitation · entourage cards · place cards · menus · thank-you notes — all designed and printed by one vendor (or sourced separately). Lock yours after sponsors + entourage finalize so the design lands their names correctly.",
    pillLabel: 'Programming',
    prerequisites: ['finalize_entourage'],
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
    prerequisites: ['set_wedding_date', 'reception_venue', 'ceremony_venue', 'create_website', 'principal_sponsors'],
  },
  {
    // Added 2026-05-24 (owner directive · 3-stage guest list split ·
    // STAGE 3). After the first invitation wave goes out, the host
    // adds late additions (forgotten relatives, plus-ones that came up,
    // colleagues the couple decided to include after seeing the
    // RSVP-no count) + clears stale entries. The second_batch_invitation
    // card at order 21.5 reads the updated list. Sits between deploy
    // and second-batch so the gap-fill happens BEFORE the second wave.
    id: 'gap_fill_guest_list',
    order: 21.3,
    phase: 'programming',
    kind: 'external_process',
    title: 'Fill the guest list gaps',
    whyItMatters:
      "Post-first-invitation review. Add late-additions you forgot · plus-ones that came up · colleagues you decided to include after seeing initial RSVPs. The second-batch invitation reads from this updated list — get it right here so the second wave hits everyone clean.",
    pillLabel: 'Programming',
    prerequisites: ['deploy_invitation'],
  },
  {
    id: 'second_batch_invitation',
    order: 21.5,
    phase: 'programming',
    kind: 'external_process',
    title: 'Send the second-batch invitation',
    whyItMatters:
      "About 3 weeks after the first wave, send a second invitation to anyone who hasn't responded — plus any late-additions you missed. Filipino guests often wait for the second nudge before locking their RSVP.",
    pillLabel: 'Programming',
    prerequisites: ['deploy_invitation'],
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
    prerequisites: ['reception_venue'],
  },
  {
    // 2026-05-24 senior-planner reorder: was order 22.5 (position 30 ·
    // T-2mo zone · breaks for any couple wanting custom engraving).
    // Moved to 9.5 (position 16 · alongside mood_board in Style & Identity)
    // because premium PH jewelers (Suarez, Yu Eng Tai, Janina Dizon,
    // Tiffany Manila) need 6-8 weeks for custom designs + engraving.
    // T-2mo zone misses the engraving queue for peak-season weddings.
    // The 4-6 week lead time in `whyItMatters` is the FAST track;
    // the early position protects couples picking heritage settings or
    // multi-tone designs that need full 8-week crafting. Phase tag
    // changed late_additions → style_identity (where rings actually
    // belong — they're identity, not late-additions polish).
    id: 'rings',
    order: 9.5,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your ring jeweler',
    whyItMatters:
      "Wedding bands + matching engagement-ring touch-ups need 4-6 weeks of crafting + sizing. Premium designs with engraving or heritage settings need 6-8 weeks. Most PH jewelers ship nationwide — pick by portfolio + reviews, not proximity.",
    pillLabel: 'Style & Identity',
    prerequisites: ['set_wedding_date'],
  },
  {
    // Added 2026-05-24 (owner directive · ❓ missing cards audit · "the
    // rest, yes"). Pakanta = custom wedding song service powered by
    // Suno Premier per iteration 0036. 3 tiers: Basic ₱1,999 / 24-hr ·
    // Premium ₱3,999 / 2-5 days · Wedding Suite ₱9,999 / 5-7 days.
    // Card surfaces the intake form + tier picker; production happens
    // through the Pakanta workflow. Lands at position 17 (between rings
    // and lights_sound). Lead time matches Premium tier · Wedding Suite
    // benefits from earlier lock to allow the lyric-approval gate cycle.
    id: 'pakanta',
    order: 9.7,
    phase: 'style_identity',
    kind: 'external_process',
    title: 'Order your wedding song (Pakanta)',
    whyItMatters:
      "Custom wedding song by Setnayan AI music. Pick a tier — Basic ₱1,999 / 24 hr, Premium ₱3,999 / 2-5 days with lyric approval, or the Wedding Suite ₱9,999 / 5-7 days for 3 matching songs. The song saves to your event so every Setnayan-rendered video uses it.",
    pillLabel: 'Style & Identity',
    prerequisites: ['set_wedding_date'],
  },
  {
    // Added 2026-05-24 (owner directive · "also add Dance Instructor").
    // Filipino weddings routinely hire a dance instructor for the
    // couple's first dance + the parents-and-couple dance + the
    // entourage choreography. Lessons run T-2 to T-3 months. Card
    // sits after Pakanta (so the locked wedding song is available as
    // reference music) but doesn't HARD-require it · couples using a
    // pre-existing song still benefit. Prereq: set_wedding_date.
    // Canonical service: choreographer.
    id: 'dance_instructor',
    order: 9.8,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your dance instructor',
    whyItMatters:
      "First dance · parents-and-couple dance · entourage choreography. Lessons typically run 2-3 months pre-wedding, so locking the instructor at T-4 months means you have time to learn (and to stop sweating it). Most PH choreographers come to your venue or studio.",
    pillLabel: 'Style & Identity',
    prerequisites: ['set_wedding_date'],
  },
  {
    // Added 2026-05-25 (owner directive · "finding after party band/dj
    // is gone"). PH weddings increasingly run a late-night after-party
    // block once the formal reception ends · couples often want a
    // separate DJ to carry that vibe (high-energy dance floor music)
    // distinct from the dinner-program performer (live band · acoustic
    // act · cultural ensemble). Soft prereq on music_entertainment so
    // hosts lock the primary act first. Canonical filter narrows to
    // `dj` only — the after-party block is overwhelmingly DJ-driven,
    // live bands rarely cover both the formal reception + the late-night
    // block, and reusing the primary canonical set would surface the
    // exact same vendor list as Card 12. Hard floor T-1m: most DJs hold
    // a date with 2-4 weeks notice for an after-party slot if their
    // calendar is clear.
    id: 'after_party_music',
    order: 12.5,
    phase: 'style_identity',
    kind: 'vendor_pick',
    title: 'Lock your after-party DJ',
    whyItMatters:
      'The formal reception ends · the after-party begins. A different vibe · different DJ · different playlist for the late-night dance floor. Most couples lock 4-6 weeks before the wedding once the reception program is set.',
    pillLabel: 'Style & Identity',
    prerequisites: ['music_entertainment'],
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
    prerequisites: ['reception_venue'],
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
    prerequisites: ['reception_venue', 'ceremony_venue'],
  },
  {
    // 2026-05-24 owner directive: "Cenomar, update for groom and bride.
    // not just 1 cenomar." PH marriage license application requires
    // CENOMAR (Certificate of No Marriage) from BOTH partners — each
    // partner files their own with PSA. Split into two cards so each
    // partner can track their own request + delivery status. Both
    // become prereqs for the marriage_license card.
    id: 'cenomar_bride',
    order: 25,
    phase: 'legal_paperwork',
    kind: 'external_process',
    title: "Request the bride's Cenomar",
    whyItMatters:
      "Certificate of No Marriage from PSA for the bride. Apply at any PSA outlet (or via psahelpline.ph). Processing takes 2-3 weeks. You cannot get your marriage license until this is in hand.",
    pillLabel: 'Legal paperwork',
    prerequisites: ['set_wedding_date'],
  },
  {
    // 2026-05-24 paired with cenomar_bride above. Same flow, same lead
    // time, separate request because each partner files their own.
    id: 'cenomar_groom',
    order: 25.1,
    phase: 'legal_paperwork',
    kind: 'external_process',
    title: "Request the groom's Cenomar",
    whyItMatters:
      "Certificate of No Marriage from PSA for the groom. Apply at any PSA outlet (or via psahelpline.ph). Processing takes 2-3 weeks. The license office will ask for both Cenomars before issuing the marriage license.",
    pillLabel: 'Legal paperwork',
    prerequisites: ['set_wedding_date'],
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
    prerequisites: ['ceremony_venue', 'officiant'],
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
    prerequisites: ['ceremony_venue'],
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
    // 2026-05-24 updated for cenomar split — license requires BOTH
    // partners' Cenomars in hand.
    prerequisites: ['cenomar_bride', 'cenomar_groom'],
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
    prerequisites: ['deploy_invitation'],
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
    prerequisites: ['finalize_rsvp'],
  },
  // 2026-05-24 owner directive: removed `finalize_catering_count`
  // card. "No need to lock catering count. once seat plan is
  // finalized, the guest list is finalized, all PAX dependent
  // vendors will be notified and they must confirm of the PAX
  // update." Auto-notification system on finalize_seatplan handles
  // catering + cake + booth headcount confirmation downstream. No
  // separate host action needed. The auto-notification flow is
  // tracked separately in the vendor dashboard (per iteration 0006
  // vendor pax-dependent flag · auto-confirm prompts).
  {
    id: 'honeymoon_planning',
    order: 32,
    phase: 'final_month',
    kind: 'data_input',
    title: 'Lock your honeymoon plan',
    whyItMatters:
      "Flights, hotels, day-after activities. You will not want to plan this in the week after; lock destinations and bookings now.",
    pillLabel: 'Final month',
    prerequisites: ['set_wedding_date'],
  },
  {
    // 2026-05-24 owner directive: enumerate print items so the host
    // sees the full scope of what Paprint covers · iteration 0050
    // print fulfillment surface lists every item type · couples
    // pick line-by-line. V1.x: card body shows the menu inline with
    // QR-preview thumbnails per item.
    id: 'paprint',
    order: 33,
    phase: 'final_month',
    kind: 'external_process',
    title: 'Order your print pack',
    whyItMatters:
      "Setnayan QR-encoded items, shipped 7-10 days before your wedding — guest wristbands · entrance badges · table assignment cards · escort cards · place cards · hand fans · favor tags · seating chart sign · day-of guide. Pick the items you want · we print + deliver.",
    pillLabel: 'Final month',
    prerequisites: ['finalize_seatplan'],
  },
  {
    id: 'all_set_readiness',
    order: 33.5,
    phase: 'final_month',
    kind: 'external_process',
    title: "Confirm you're all set",
    whyItMatters:
      "Final readiness checkpoint before day-of mode activates. Walk through every section · fix any last-minute gap · graduate to live with confidence.",
    pillLabel: 'Final month',
    // 2026-05-24: finalize_catering_count removed from prereqs · the
    // pax auto-notification system fires off finalize_seatplan and
    // doesn't require a separate host-action card.
    prerequisites: ['finalize_rsvp', 'finalize_seatplan', 'paprint'],
  },
  {
    // Added 2026-05-24 (owner directive · ❓ missing cards audit · "the
    // rest, yes"). Filipino Catholic weddings run a rehearsal at T-1
    // to T-2 days · the parish priest + officiant walks the wedding
    // party (sponsors · bearers · flower girls) through entrance order
    // + ceremony beats. Civil weddings often skip; cultural / interfaith
    // run their own version. Card surfaces date/time picker; the
    // coordinator schedules vendor presence (typically just the
    // photographer + coordinator on site).
    id: 'wedding_rehearsal',
    order: 33.8,
    phase: 'final_month',
    kind: 'external_process',
    title: 'Wedding rehearsal',
    whyItMatters:
      "T-1 or T-2 days · sponsors, bearers, and the entourage walk through entrance order with your officiant. Catholic + Christian + INC ceremonies all benefit; civil weddings can skip. Most parishes assume a rehearsal even if it isn't officially scheduled — confirm with yours.",
    pillLabel: 'Final month',
    prerequisites: ['all_set_readiness'],
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
    prerequisites: [],
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
    prerequisites: ['event'],
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
    prerequisites: ['event'],
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
    prerequisites: ['event'],
  },
  {
    // Added 2026-05-24 (owner directive · "what other services by our
    // app that needs to be purchased as well"). AI Highlights — two
    // tier picker: AI Video Highlight 60s ₱999 (social-share teaser
    // tier · T+24hr delivery) · AI Edited Highlight 3-min ₱2,999 (full
    // story-arc reel · T+1 week delivery). Vision AI reads the photo +
    // video archive after the wedding · cuts a cinematic highlight ·
    // host picks tier within the card.
    id: 'ai_highlights',
    order: 37.3,
    phase: 'post_event',
    kind: 'external_process',
    title: 'Order your AI highlight reel',
    whyItMatters:
      "Setnayan vision AI reads your full archive after the wedding and cuts it into a cinematic highlight. Pick the 60-second teaser (₱999, T+24hr) for socials · or the 3-minute story-arc reel (₱2,999, T+1 week) for the full ride. Both share the same source material; many couples get both.",
    pillLabel: 'Post-event',
    prerequisites: ['download_photos'],
  },
  {
    // Added 2026-05-24 (owner directive · "what other services by our
    // app that needs to be purchased as well"). Couple Keepsake Bundle
    // ₱2,499 — single post-event SKU bundling print-ready PDF album +
    // photo download + Panood broadcast reel + final playlist artifact.
    // Most-requested post-event memento per the iteration 0046 Keepsake
    // spec lock. Card sits after AI Highlights so the host has the
    // complete archive when they buy.
    id: 'keepsake_bundle',
    order: 37.5,
    phase: 'post_event',
    kind: 'external_process',
    title: 'Get your Couple Keepsake Bundle',
    whyItMatters:
      "₱2,499 · the post-event memento bundle. Print-ready PDF album + photo download + Panood broadcast reel + your final playlist as a shareable artifact. One purchase · everything that made your day comes home with you.",
    pillLabel: 'Post-event',
    prerequisites: ['download_photos'],
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
    prerequisites: ['event'],
  },
  {
    id: 'claim_next_event_reward',
    order: 38.5,
    phase: 'post_event',
    kind: 'external_process',
    title: 'Claim your next-event reward',
    whyItMatters:
      "Setnayan is built for every life event, not just weddings. As a thank-you for shipping a full wedding with us, your next event starts with a head-start credit. Anniversaries · christenings · birthdays · debuts — all yours.",
    pillLabel: 'Post-event',
    prerequisites: ['create_editorial'],
  },
];

/**
 * Public export · `_WIZARD_TASKS_RAW` sorted by the `order` field. This
 * is the canonical PAID Setnayan AI sequence — events with
 * concierge_status='trial' or 'active' (per CLAUDE.md 2026-05-24 8th-row
 * Setnayan AI SKU lock · production column stayed concierge_status
 * even after the rename was specced) get this full 65-task ladder.
 *
 * Sort is stable per Array.prototype.sort spec (ECMA-262 since 2019) so
 * tasks sharing the same `order` value (none today but possible if a
 * future spec lock adds tied positions) preserve their source order.
 *
 * Renamed from `WIZARD_TASKS` → `WIZARD_TASKS_PAID` on 2026-05-30 owner
 * directive (DIY/Paid sequence bifurcation). `WIZARD_TASKS` retained as a
 * backwards-compat re-export below so existing consumers (wizard-actions
 * validator + in-flight tray + wizard-carousel step count + wizard-card
 * step-of-N rendering) keep working with zero churn.
 */
export const WIZARD_TASKS_PAID: ReadonlyArray<WizardTask> = [..._WIZARD_TASKS_RAW]
  .sort((a, b) => a.order - b.order);

/**
 * Backwards-compat alias for `WIZARD_TASKS_PAID`.
 *
 * Every consumer (apps/web/app/dashboard/[eventId]/wizard-actions.ts
 * validator · _components/in-flight-tray.tsx taskMap · _components/
 * wizard-carousel.tsx step counts · _components/wizard-card.tsx
 * findIndex-based step labels) reads this. They semantically mean "the
 * canonical sorted task universe for step-of-N rendering + ID
 * validation" which IS the paid 65-task ladder · DIY hosts see a
 * subset (9 tasks) and their step labels naturally show "Step N of 9"
 * because the consumers iterate getCarouselTasks output, not
 * WIZARD_TASKS directly.
 *
 * Keeping the export shape stable avoids touching every consumer for a
 * rename · per [[feedback_setnayan_orphan_prevention]] minimizes blast
 * radius and per the button-preservation discipline keeps existing
 * surfaces wired the way they shipped.
 */
export const WIZARD_TASKS: ReadonlyArray<WizardTask> = WIZARD_TASKS_PAID;

/**
 * DIY Foundation 9-card sequence · owner-locked 2026-05-30 (CLAUDE.md
 * DIY/Paid bifurcation row). Free / DIY couples (events.concierge_status
 * IN ('diy', 'expired') · default for free tier per V2 publisher posture)
 * see this 9-card Foundation instead of the full 65-card paid sequence.
 *
 * The order:
 *   01 Set your wedding date (existing)
 *   02 Set Estimated Pax (NEW · data_input · drives downstream sizing)
 *   03 Set Estimated Budget (NEW · data_input · drives downstream filtering)
 *   04 Lock your reception venue (existing · reordered from #2 → #4)
 *   05 Lock your ceremony venue (existing · reordered from #3 → #5)
 *   06 Lock your caterer (existing · reordered from #7 → #6)
 *   07 Lock your attire (existing · promoted from #18 → #7)
 *   08 Lock your ring jeweler (existing · promoted from #22.5 → #8)
 *   09 Add A Category (NEW · host_action · multi-pick from 192 canonicals)
 *
 * Add A Category spawns dynamic `custom_<canonical_service>` vendor_pick
 * tasks per host pick. The dynamic tasks slot into getCarouselTasks
 * output after the 9 baseline tasks. Agent B (sibling PR) builds the
 * Add A Category card component + multi-pick UI + dispatcher wiring.
 *
 * Cherry-picks are stable references into WIZARD_TASKS_PAID rather than
 * literal duplicates · changing copy on the source PAID definition
 * automatically flows into the DIY view. Each cherry-pick uses a strict
 * `find(t => t.id === '...')!` because every ID below exists in
 * _WIZARD_TASKS_RAW (verified at code-review time · TS catches typos via
 * the WizardTaskId union).
 */
export const WIZARD_TASKS_DIY: ReadonlyArray<WizardTask> = [
  // #1 · existing
  WIZARD_TASKS_PAID.find((t) => t.id === 'set_wedding_date')!,
  // #2 · NEW · estimated pax · order 1.6 slots after wedding_date (1) +
  // ahead of draft_guest_list (1.5) so the rough count is captured before
  // any guest-list scaffolding. Order field doesn't drive the DIY sequence
  // (declaration order does · same stable-sort guarantee as Array.sort) but
  // we set realistic numbers so any caller that re-sorts gets the right
  // shape.
  {
    id: 'set_estimated_pax',
    order: 1.6,
    phase: 'foundation',
    kind: 'data_input',
    title: 'Set your estimated guest count',
    whyItMatters:
      "About how many guests are you expecting? A rough number now drives the venue size your reception needs, the catering quote, and the invitation print run — Filipino weddings routinely grow from 80 to 200 between engagement and RSVP, so anchoring the headline number up-front prevents downstream churn.",
    pillLabel: 'Foundation',
    prerequisites: ['set_wedding_date'],
  },
  // #3 · NEW · estimated budget · order 1.7 keeps it after pax. Persists
  // to existing events.wedding_budget_centavos column (no new schema for
  // budget · added 2026-05-24 per the ShortlistBudgetCard surface).
  {
    id: 'set_estimated_budget',
    order: 1.7,
    phase: 'foundation',
    kind: 'data_input',
    title: 'Set your working budget',
    whyItMatters:
      "A working budget shapes your shortlist — once it's set, your vendor recommendations + Plan grid math respect the ceiling. Pick a comfortable range; you can adjust as quotes land.",
    pillLabel: 'Foundation',
    prerequisites: ['set_wedding_date'],
  },
  // #4 · existing · reordered from PAID position 2 → DIY position 4
  WIZARD_TASKS_PAID.find((t) => t.id === 'reception_venue')!,
  // #5 · existing · keep task ID `ceremony_venue` for schema stability ·
  // owner directive: card component renders 'Ceremonial Venue' as label
  // (Agent B handles the rename inside the card component dispatcher).
  WIZARD_TASKS_PAID.find((t) => t.id === 'ceremony_venue')!,
  // #6 · existing · reordered from PAID position 7 → DIY position 6
  WIZARD_TASKS_PAID.find((t) => t.id === 'catering')!,
  // #7 · existing · promoted from PAID position 7.6 → DIY position 7. The
  // 6-subtab attire sub-picker from PR #546 (bridal gown · bridal shoes ·
  // groom suit · groom shoes · entourage attire · parents attire) is
  // already shipped on the existing attire card · do NOT touch the card
  // component.
  WIZARD_TASKS_PAID.find((t) => t.id === 'attire')!,
  // #8 · existing · promoted from PAID position 9.5 → DIY position 8.
  // Task ID is `rings` (the underlying canonical service is `wedding_rings`
  // per Vendor_Taxonomy_V1_Master.md · the wizard task identifier is the
  // shorter `rings` slug for backwards-compat with shipped wizard-state
  // entries).
  WIZARD_TASKS_PAID.find((t) => t.id === 'rings')!,
  // #9 · NEW · add a category · host_action · always available · no
  // prereqs other than set_wedding_date so the host can add categories
  // any time. Multi-pick body built by Agent B reads from the 192-row
  // canonical_service_schemas table; each pick writes back into
  // events.wizard_state.add_a_category.picks (TEXT[]) which
  // getCarouselTasks reads to spawn dynamic `custom_<canonical>` tasks.
  {
    id: 'add_a_category',
    order: 9,
    phase: 'foundation',
    kind: 'host_action',
    title: 'Add a category',
    whyItMatters:
      "Anything else on your mind — florals · band · DJ · cake · invitations · honeymoon · paprint? Pick from our catalog and each addition spawns its own card you can lock at your own pace. Add as many as you want.",
    pillLabel: 'Foundation',
    prerequisites: ['set_wedding_date'],
  },
];

/**
 * Returns a human-readable display name for a canonical_service key used
 * in dynamic vendor_pick tasks spawned by Add A Category. V1 uses a
 * simple title-case + underscore-strip; V1.x can swap to reading the
 * canonical_service_schemas.display_name column for localized labels.
 *
 * Examples:
 *   florals → 'Florals'
 *   bridal_car → 'Bridal Car'
 *   wedding_coordination → 'Wedding Coordination'
 */
function displayCanonical(canonical: string): string {
  return canonical
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Shape of events.wizard_state JSONB column.
 *
 * A wizard task entry has three possible states represented by which
 * fields are populated:
 *   - empty / missing  →  pending. Resolver picks this as the active focus.
 *   - in_flight_since  →  actively progressing externally (paperwork waiting
 *                          on PSA · Pre-Cana running · STD video rendering).
 *                          Resolver SKIPS to the next task so the host can
 *                          keep working in parallel. The card stays visible
 *                          in the wizard surface as "in flight" + can be
 *                          marked done when ready.
 *   - completed_at     →  permanently done. Resolver skips.
 *
 * Per the V1 SCOPE EXPANSION lock (CLAUDE.md 2026-05-23 Sixth row · owner
 * decision 2026-05-24 picking option 2A for "in_flight" semantics): slow
 * paperwork cards like Cenomar PSA (~2 weeks processing) can't block the
 * wizard. The host moves the next card forward while the paperwork runs.
 */
export type WizardState = Partial<
  Record<
    WizardTaskId,
    {
      completed_at?: string; // ISO8601 · empty / missing means not done
      in_flight_since?: string; // ISO8601 · set when host marks the task
                                // as in-progress (e.g., "PSA submitted ·
                                // waiting for release"). Optional.
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
 * TEMPORARY PREVIEW MODE flag — owner directive 2026-05-24.
 *
 * When `true`:
 *   - isTaskUnlocked() always returns TRUE (no prereq gating)
 *   - getCarouselTasks() returns all UNSETTLED tasks (no lookahead cap,
 *     but completed + in-flight still filter out per owner directive
 *     2026-05-24: "when the focus card is complete, card hides")
 *
 * Owner asked to disable the prereq lock + the card-count limit
 * temporarily so they can preview every card in the carousel before
 * reactivating the canonical flow. To turn it back on, flip this
 * constant to `false`.
 *
 * Keep this constant prominent + named so it's impossible to forget
 * to flip back. Do NOT remove the prereq / limit logic — just
 * short-circuit it.
 */
export const TEMP_WIZARD_PREVIEW_ALL_CARDS = true;

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
 * Returns TRUE when the given task is currently "in flight" — host marked
 * it as actively progressing externally (paperwork submitted · render
 * queued · etc.) but not yet done. The resolver SKIPS these so the host
 * can move forward; the card stays accessible via the in-flight tray
 * surface so the host can mark it done when ready.
 */
export function isTaskInFlight(
  state: WizardState,
  taskId: WizardTaskId,
): boolean {
  const entry = state[taskId];
  if (!entry) return false;
  if (typeof entry !== 'object') return false;
  if (isTaskComplete(state, taskId)) return false;
  return (
    typeof entry.in_flight_since === 'string' && entry.in_flight_since.length > 0
  );
}

/**
 * Returns TRUE when the resolver should treat the given task as "settled" —
 * either complete OR in-flight. Used in the active-focus walk to skip both.
 */
export function isTaskSettled(
  state: WizardState,
  taskId: WizardTaskId,
): boolean {
  return isTaskComplete(state, taskId) || isTaskInFlight(state, taskId);
}

/**
 * Owner-locked 2026-05-24 carousel UX support.
 *
 * Returns TRUE when ALL prerequisites of the given task are settled
 * (completed or in-flight). False when at least one prereq is still
 * pending. Tasks with no prereqs always return TRUE.
 *
 * Used by:
 *   - resolveWizardFocus to skip tasks whose prereqs aren't met
 *   - WizardCarousel to render locked-state styling on cards whose
 *     prereqs aren't met
 */
export function isTaskUnlocked(
  state: WizardState,
  task: WizardTask,
): boolean {
  // Owner-temp 2026-05-24 preview mode: all cards report unlocked so
  // the host can see every wizard step before reactivating the prereq
  // gate. Flip TEMP_WIZARD_PREVIEW_ALL_CARDS back to false to restore
  // canonical prereq enforcement.
  if (TEMP_WIZARD_PREVIEW_ALL_CARDS) return true;
  for (const prereqId of task.prerequisites) {
    if (!isTaskSettled(state, prereqId)) return false;
  }
  return true;
}

/**
 * Returns the FIRST unmet prerequisite task for the given task, or null
 * when all prereqs are met. Used by the carousel surface to render
 * `Locked until {firstPrereq.title}` copy on darkened cards.
 *
 * Order of evaluation matches the order declared in task.prerequisites,
 * which we curate from most-blocking-to-least so the surfaced message
 * names the heaviest dependency first.
 */
export function getFirstUnmetPrereq(
  state: WizardState,
  task: WizardTask,
): WizardTask | null {
  const taskMap = new Map<WizardTaskId, WizardTask>();
  for (const t of WIZARD_TASKS) taskMap.set(t.id, t);

  for (const prereqId of task.prerequisites) {
    if (!isTaskSettled(state, prereqId)) {
      const prereqTask = taskMap.get(prereqId);
      if (prereqTask) return prereqTask;
    }
  }
  return null;
}

/**
 * Optional event shape consumed by `getCarouselTasks` for DIY/Paid
 * sequence routing. Only the two columns the branch actually reads are
 * required — the full `EventRow` from `lib/events.ts` is a superset and
 * fits without coercion.
 *
 * Added 2026-05-30 for the DIY/Paid wizard surface bifurcation. Kept
 * structural (not nominal) so consumers can pass any object exposing
 * the right two fields without importing the full EventRow type and
 * tightly coupling lib/wizard.ts to lib/events.ts.
 */
type WizardCarouselEventInput = {
  concierge_status: 'diy' | 'trial' | 'active' | 'expired' | null;
  wizard_state?: unknown;
};

/**
 * Returns the canonical task sequence the caller should walk for the
 * carousel. Branches on events.concierge_status per the owner-locked
 * 2026-05-30 DIY/Paid bifurcation:
 *
 *   - 'active' OR 'trial' → WIZARD_TASKS_PAID (full 65-card sequence)
 *   - 'diy' | 'expired' | null | undefined → WIZARD_TASKS_DIY (9-card
 *     Foundation) + dynamic custom_<canonical> picks from add_a_category.
 *
 * When `event` is undefined (back-compat callsites that didn't get
 * updated yet · e.g., wizard-hero.tsx), defaults to WIZARD_TASKS_PAID
 * so existing surfaces don't regress. The /today route is the canonical
 * entry point that branches on concierge_status itself · this helper
 * mirrors the same logic for callsites that want one source of truth.
 *
 * Append-after-base policy: dynamic custom_ tasks slot AFTER the base
 * sequence so the host walks through the 9 baseline cards before
 * landing on their custom picks. The custom tasks all carry the same
 * `set_wedding_date` prereq so they're unlocked once the host fills in
 * the first card.
 */
function getBaseSequenceForTier(
  state: WizardState,
  event?: WizardCarouselEventInput,
): ReadonlyArray<WizardTask> {
  const status = event?.concierge_status ?? null;
  const isPaidActive = status === 'active' || status === 'trial';
  const baseTasks = isPaidActive || event === undefined
    ? WIZARD_TASKS_PAID
    : WIZARD_TASKS_DIY;

  // Append dynamic vendor_pick tasks from Add A Category picks. Only
  // surfaces on the DIY tier — the PAID 65-card sequence already covers
  // every canonical service via its named cards. Reading from
  // state.add_a_category.picks (TEXT[]) which Agent B's card component
  // writes when the host picks canonicals.
  if (baseTasks === WIZARD_TASKS_PAID) return baseTasks;

  const addCategoryEntry = state.add_a_category;
  const customPicksRaw =
    addCategoryEntry &&
    typeof addCategoryEntry === 'object' &&
    'picks' in addCategoryEntry
      ? (addCategoryEntry as { picks?: unknown }).picks
      : null;
  const customPicks = Array.isArray(customPicksRaw)
    ? customPicksRaw.filter((p): p is string => typeof p === 'string')
    : [];

  if (customPicks.length === 0) return baseTasks;

  const customTasks: WizardTask[] = customPicks.map((canonical, index) => ({
    // Type assertion against `custom_${string}` template literal member of
    // the WizardTaskId union — safe because canonical comes from the
    // 192-row canonical_service_schemas catalog and is always a string.
    id: `custom_${canonical}` as WizardTaskId,
    // Order 9.5+ so they slot after add_a_category (order 9) · plus the
    // index nudge keeps stable-sort ordering across picks.
    order: 9.5 + index * 0.01,
    phase: 'foundation',
    kind: 'vendor_pick',
    title: `Lock your ${displayCanonical(canonical)}`,
    whyItMatters: `You added ${displayCanonical(canonical)} to your plan from Add A Category. Lock a vendor when you're ready — we'll surface recommendations matching your event.`,
    pillLabel: 'Your additions',
    prerequisites: ['set_wedding_date'],
  }));

  return [...baseTasks, ...customTasks];
}

/**
 * Returns the next N upcoming tasks for the carousel surface. The active
 * focus comes FIRST. The remaining N-1 are the tasks AFTER the active in
 * canonical order — regardless of lock state (the carousel renders locked
 * ones darkened in-place).
 *
 * `lookahead` defaults to 4 so the carousel shows 1 active + 3 peeks.
 *
 * Optional `event` parameter (added 2026-05-30 for DIY/Paid bifurcation
 * lock) drives base-sequence selection · see `getBaseSequenceForTier`
 * doc for details. When omitted, defaults to PAID 65-card sequence so
 * back-compat callsites don't regress.
 */
export function getCarouselTasks(
  state: WizardState,
  lookahead = 4,
  event?: WizardCarouselEventInput,
): WizardTask[] {
  const sequence = getBaseSequenceForTier(state, event);

  // Owner-temp 2026-05-24 preview mode: return UNSETTLED tasks in
  // canonical order so the host can swipe through every upcoming card.
  // Skips the lookahead cap, but the settled-filter is preserved per
  // owner directive 2026-05-24 ("when the focus card is complete, card
  // hides") — completed tasks must filter out so the active focus
  // advances on completion (otherwise the carousel loops on the same
  // card with the saved value pre-populated). In-flight tasks also
  // filter out and surface in the IN-FLIGHT TRAY below, matching the
  // canonical non-preview behavior.
  if (TEMP_WIZARD_PREVIEW_ALL_CARDS) {
    return sequence.filter((task) => !isTaskSettled(state, task.id));
  }
  // Find the active focus first — same logic as resolveWizardFocus.
  let activeIndex = -1;
  for (let i = 0; i < sequence.length; i++) {
    const task = sequence[i]!;
    if (!isTaskSettled(state, task.id) && isTaskUnlocked(state, task)) {
      activeIndex = i;
      break;
    }
  }

  // No active focus (all settled, or all blocked) — return the first
  // unsettled tasks as peek slots so the carousel has SOMETHING to show.
  if (activeIndex === -1) {
    const peeks: WizardTask[] = [];
    for (const t of sequence) {
      if (!isTaskSettled(state, t.id)) peeks.push(t);
      if (peeks.length >= lookahead) break;
    }
    return peeks;
  }

  // Active + lookahead-1 cards that follow it (skipping settled ones —
  // already-done cards don't need to pollute the carousel).
  const result: WizardTask[] = [sequence[activeIndex]!];
  for (let i = activeIndex + 1; i < sequence.length && result.length < lookahead; i++) {
    const task = sequence[i]!;
    if (!isTaskSettled(state, task.id)) result.push(task);
  }
  return result;
}

/**
 * Result of WizardSequenceResolver. Either a single active task to render
 * as Setnayan AI, or null when (a) no task is implemented yet at the
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
    // Settled = complete OR in-flight. In-flight tasks are skipped so a
    // slow paperwork item (Cenomar · Pre-Cana · STD video render)
    // doesn't block the wizard for weeks. The host can still revisit
    // the in-flight card via the IN-FLIGHT TRAY surface that the
    // WizardHero renders below the focus card.
    if (isTaskSettled(state, task.id)) continue;
    // Locked = prerequisites not yet settled. Owner-locked 2026-05-24
    // carousel UX: locked cards render darkened in the carousel BUT
    // resolver doesn't pick them as the active focus — the active
    // focus is always the first unsettled task with all prereqs met.
    // A wedding-date-less event sees set_wedding_date as active first;
    // a host who's locked the date sees Reception Venue active next;
    // an in-flight Cenomar doesn't block its own Marriage License
    // dependency from being reachable because in_flight counts as
    // settled for prereq purposes.
    if (!isTaskUnlocked(state, task)) continue;
    return { kind: 'active', task };
  }
  return { kind: 'null', reason: 'all_complete' };
}

/**
 * Returns the task IDs currently marked in_flight (host has signaled
 * progress externally but hasn't marked done yet). Used by the IN-FLIGHT
 * TRAY surface to give the host one-click access to each card so they
 * can mark it done when their PSA / paperwork / render arrives.
 */
export function listInFlightTaskIds(state: WizardState): WizardTaskId[] {
  const result: WizardTaskId[] = [];
  for (const task of WIZARD_TASKS) {
    if (isTaskInFlight(state, task.id)) result.push(task.id);
  }
  return result;
}

/**
 * Number of remaining tasks. Used by the WizardHero subtitle ("32 more
 * to go") and by the AllLocked celebratory variant. Counts in-flight
 * tasks as STILL REMAINING because they haven't been marked done — the
 * tally reflects what the host still needs to act on.
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
