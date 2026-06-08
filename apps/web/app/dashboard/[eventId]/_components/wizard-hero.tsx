/**
 * Concierge Active Wizard · WizardHero · top-level Setnayan AI surface.
 *
 * Iteration 0016 · Phase 1 PR consumes the Phase 0 framework: reads
 * events.wizard_state · resolves the active task via resolveWizardFocus ·
 * renders <WizardCard> with the matching card-variant body as children.
 *
 * Replaces the legacy <TodaysOneThing> component on /dashboard/[eventId]
 * page. The legacy component code stays in apps/web/app/dashboard/
 * [eventId]/_components/todays-one-thing.tsx as a temporary fallback we
 * can flip back to if the new wizard surface needs a quick revert; this
 * file is the active consumer going forward.
 *
 * Phase 1 implements ONE card variant (Card 01 Set Wedding Date). The
 * other 37 cards fall back to <PlaceholderCardBody> until their Phase 2-5
 * PRs land. The placeholder reads as deliberate brand copy, not an
 * engineering "coming soon" — per [[feedback_setnayan_no_dev_text_post_launch]].
 *
 * The wizard NEVER blocks. PlanningGroups (the 22-card grid below this
 * hero) stays · a host who wants to skip ahead can still go directly to
 * any category via the grid. The wizard is a guided experience, not a
 * gate.
 */

import { Sparkles, CheckCircle2 } from 'lucide-react';
import {
  parseWizardState,
  resolveWizardFocus,
  countRemainingTasks,
  listInFlightTaskIds,
  getCarouselTasks,
  TEMP_WIZARD_PREVIEW_ALL_CARDS,
  type WizardTaskId,
} from '@/lib/wizard';
import type { CeremonyType, MeaningfulDate } from '@/lib/auspicious-date';
import { WizardCarousel } from './wizard-carousel';
import { InFlightTray } from './in-flight-tray';
import { SetWeddingDateCard } from './wizard-cards/set-wedding-date-card';
import { ReceptionVenueCard } from './wizard-cards/reception-venue-card';
import { CeremonyVenueCard } from './wizard-cards/ceremony-venue-card';
import { OfficiantCard } from './wizard-cards/officiant-card';
import { CoordinatorCard } from './wizard-cards/coordinator-card';
import { LedBackgroundCard } from './wizard-cards/led-background-card';
import { InvitationsStationeryCard } from './wizard-cards/invitations-stationery-card';
import { PhotographyCard } from './wizard-cards/photography-card';
import { PrenupCard } from './wizard-cards/prenup-card';
import { CateringCard } from './wizard-cards/catering-card';
// Phase 3 batch — 9 standard vendor-pick cards.
import { StylistCard } from './wizard-cards/stylist-card';
import { LightsSoundCard } from './wizard-cards/lights-sound-card';
import { MusicEntertainmentCard } from './wizard-cards/music-entertainment-card';
// 2026-05-25 dispatcher case for `dance_instructor` wizard task (added 2026-05-24
// per CLAUDE.md row · was falling through to PlaceholderCardBody until this PR).
import { DanceInstructorCard } from './wizard-cards/dance-instructor-card';
// 2026-05-25 dispatcher case for `after_party_music` wizard task (owner
// directive "finding after party band/dj is gone" · dedicated card for
// the late-night DJ that runs after the formal reception program).
import { AfterPartyMusicCard } from './wizard-cards/after-party-music-card';
import { HostMcCard } from './wizard-cards/host-mc-card';
import { AttireCard } from './wizard-cards/attire-card';
import { HairMakeupCard } from './wizard-cards/hair-makeup-card';
import { CakeCard } from './wizard-cards/cake-card';
import { RingsCard } from './wizard-cards/rings-card';
import { AccommodationCard } from './wizard-cards/accommodation-card';
// 2026-05-24 7 wizard sequence gaps · 6 new external_process cards
import { DraftGuestListCard } from './wizard-cards/draft-guest-list-card';
import { CustomizeFoodCard } from './wizard-cards/customize-food-card';
import { FinalizeEntourageCard } from './wizard-cards/finalize-entourage-card';
import { SecondBatchInvitationCard } from './wizard-cards/second-batch-invitation-card';
import { AllSetReadinessCard } from './wizard-cards/all-set-readiness-card';
import { ClaimNextEventRewardCard } from './wizard-cards/claim-next-event-reward-card';
import { BridalCarCard } from './wizard-cards/bridal-car-card';
// Phase 5 batch — 7 paperwork external_process cards.
import { CenomarCard } from './wizard-cards/cenomar-card';
import { ChurchPaperworkCard } from './wizard-cards/church-paperwork-card';
import { PreCanaCard } from './wizard-cards/pre-cana-card';
import { MarriageLicenseCard } from './wizard-cards/marriage-license-card';
import { SendThankYousCard } from './wizard-cards/send-thank-yous-card';
import { CreateReviewsCard } from './wizard-cards/create-reviews-card';
import { DownloadPhotosCard } from './wizard-cards/download-photos-card';
// WAVE 1 PR C — Cards 34 Event + 38 Editorial transitions.
import { EventCard } from './wizard-cards/event-card';
import { CreateEditorialCard } from './wizard-cards/create-editorial-card';
// WAVE 2 · 13 hard inline-editor cards (recovered from 4 parallel
// agent branches + Cards 15 / 29 written from scratch).
import { MoodBoardCard } from './wizard-cards/mood-board-card';
import { MonogramCard } from './wizard-cards/monogram-card';
import { PhotoboothsBoothsCard } from './wizard-cards/photobooths-booths-card';
import { CreateScheduleCard } from './wizard-cards/create-schedule-card';
import { CreateWebsiteCard } from './wizard-cards/create-website-card';
import { SaveTheDateVideoCard } from './wizard-cards/save-the-date-video-card';
import { PrincipalSponsorsCard } from './wizard-cards/principal-sponsors-card';
import { DeployInvitationCard } from './wizard-cards/deploy-invitation-card';
import { HoneymoonPlanningCard } from './wizard-cards/honeymoon-planning-card';
import { FinalizeSeatplanCard } from './wizard-cards/finalize-seatplan-card';
import { FinalizeRsvpCard } from './wizard-cards/finalize-rsvp-card';
import { PaprintCard } from './wizard-cards/paprint-card';
// 2026-05-25 owner directive · Card 17 Pakanta inline 8-question intake +
// auto-play sample audio · saves to pakanta_intake_drafts on Skip OR
// Purchase, Purchase additionally redirects to /orders/new for ₱1,999 Basic.
import { PakantaCard } from './wizard-cards/pakanta-card';
import { PlaceholderCardBody } from './wizard-cards/placeholder-card-body';
// DIY (Free) tier · 3 Foundation cards added 2026-05-30. These three only
// render on the DIY 9-card sequence · the PAID 65-card sequence doesn't
// reference them. Adding them to the renderCardBody dispatcher means the
// switch handles the DIY case cleanly without falling back to the
// PlaceholderCardBody (which the host would see as "Crafting this card"
// brand-voice copy · wrong for DIY couples who expect inline completion).
import { SetEstimatedPaxCard } from './wizard-cards/set-estimated-pax-card';
import { SetEstimatedBudgetCard } from './wizard-cards/set-estimated-budget-card';
import { AddACategoryCard } from './wizard-cards/add-a-category-card';
// Dynamic `custom_<canonical>` tasks spawned from Add A Category picks
// route through this lightweight per-pick card · routes the host to the
// marketplace + a [Mark done] CTA. V1.x can swap to the full
// VendorPickGridCard inline-pick experience.
import { CustomCategoryPickCard } from './wizard-cards/custom-category-pick-card';

type Props = {
  eventId: string;
  /** events.wizard_state JSONB · drives task resolution. */
  wizardState: unknown;
  /** events.event_date · pre-populates Card 01 when host re-edits. */
  eventDate: string | null;
  /** events.ceremony_type · drives ceremony-specific auspicious overlays
   *  AND per-vendor compatibility filtering on Phase 2 vendor-pick cards. */
  ceremonyType: CeremonyType | null;
  /** events.venue_setting · filters reception_venue recs to vendors who
   *  serve that setting. NULL = no filter (show all settings). */
  venueSetting: string | null;
  /** event_meaningful_dates rows · fed into auspicious-reason library. */
  meaningfulDates: MeaningfulDate[];
  /** marketplace_vendor_id values already locked on this event ·
   *  excluded from Phase 2 recommendations so the host doesn't see a
   *  vendor they already locked in another category. */
  excludeMarketplaceVendorIds: ReadonlyArray<string>;
  /** events.concierge_status · drives the DIY/Paid wizard sequence
   *  bifurcation lock from CLAUDE.md 2026-05-30. When 'active' OR 'trial'
   *  the carousel walks WIZARD_TASKS_PAID (full 65-card sequence); for
   *  all other values (diy · expired · null) the carousel walks
   *  WIZARD_TASKS_DIY (9-card Foundation + dynamic custom_* picks).
   *  When omitted, defaults to PAID for back-compat (matches the
   *  lib/wizard.ts getBaseSequenceForTier behavior). */
  conciergeStatus?: 'diy' | 'trial' | 'active' | 'expired' | null;
  /** events.estimated_pax · pre-populates SetEstimatedPaxCard when the
   *  host re-edits. Optional — undefined treats it as "not set yet". */
  estimatedPax?: number | null;
  /** events.estimated_budget_centavos · pre-populates
   *  SetEstimatedBudgetCard. PHP centavos · the card converts to pesos
   *  at the input boundary. */
  estimatedBudgetCentavos?: number | null;
};

export function WizardHero({
  eventId,
  wizardState,
  eventDate,
  ceremonyType,
  venueSetting,
  meaningfulDates,
  excludeMarketplaceVendorIds,
  conciergeStatus,
  estimatedPax,
  estimatedBudgetCentavos,
}: Props) {
  const state = parseWizardState(wizardState);
  const result = resolveWizardFocus(state);
  const remaining = countRemainingTasks(state);
  const inFlightIds = listInFlightTaskIds(state);

  // All 38 cards complete · show the celebratory variant (matches the
  // structure of the legacy AllLockedVariant from TodaysOneThing).
  if (result.kind === 'null' && result.reason === 'all_complete') {
    return <AllCompleteCelebration />;
  }

  if (result.kind === 'null') return null;

  // Owner-locked 2026-05-24: carousel surface. getCarouselTasks returns
  // the active focus + 3 peek cards · WizardCarousel renders them in a
  // horizontal scroll-snap track · locked peek cards render darkened
  // with "Locked until {prereq.title}" copy.
  // DIY/Paid wizard sequence bifurcation per CLAUDE.md 2026-05-30. When
  // the caller passes a conciergeStatus prop, thread the event input into
  // getCarouselTasks so the resolver picks the right base sequence (PAID
  // 65-card for 'active'|'trial' · DIY 9-card for everything else). When
  // conciergeStatus is omitted, the helper falls back to PAID (back-compat
  // with old callsites that haven't been updated · see
  // lib/wizard.ts getBaseSequenceForTier doc for the full posture).
  const carouselTasks = getCarouselTasks(
    state,
    4,
    conciergeStatus !== undefined
      ? { concierge_status: conciergeStatus ?? null, wizard_state: wizardState }
      : undefined,
  );
  const activeTask = carouselTasks[0];
  if (!activeTask) return null;

  // Pull initial Add A Category picks out of wizard_state for the
  // AddACategoryCard surface. The picks array is TEXT[] per
  // lib/wizard.ts spawning logic · defensive narrowing here matches the
  // identical pattern in lib/wizard.ts getBaseSequenceForTier.
  const addACategoryEntry = state.add_a_category;
  const addACategoryPicksRaw =
    addACategoryEntry &&
    typeof addACategoryEntry === 'object' &&
    'picks' in addACategoryEntry
      ? (addACategoryEntry as { picks?: unknown }).picks
      : null;
  const addACategoryPicks: ReadonlyArray<string> = Array.isArray(
    addACategoryPicksRaw,
  )
    ? addACategoryPicksRaw.filter((p): p is string => typeof p === 'string')
    : [];

  const ctx = {
    eventId,
    ceremonyType,
    venueSetting,
    eventDate,
    meaningfulDates,
    excludeMarketplaceVendorIds,
    // DIY (Free) tier · Cards 02 + 03 + 09 consume these.
    estimatedPax: estimatedPax ?? null,
    estimatedBudgetCentavos: estimatedBudgetCentavos ?? null,
    addACategoryPicks,
  };

  const activeBody = renderCardBody(activeTask.id, ctx);

  // Temp preview-all-cards mode (CLAUDE.md 2026-05-24): when the flag is
  // on, getCarouselTasks returns all 38 tasks AND we render the full
  // active-card body for EVERY task in the carousel · NOT just the peek
  // preview. The host can swipe through every card's actual UI to review
  // it before we re-enable the canonical 4-card lookahead. Heavy on the
  // first paint (~38 server-component renders + DB queries) but acceptable
  // for the preview window since the flag is intentionally temporary.
  const taskBodies = TEMP_WIZARD_PREVIEW_ALL_CARDS
    ? new Map<WizardTaskId, React.ReactNode>(
        carouselTasks.slice(1).map((task) => [task.id, renderCardBody(task.id, ctx)]),
      )
    : undefined;

  return (
    <>
      <WizardCarousel
        tasks={carouselTasks}
        state={state}
        activeCardBody={activeBody}
        taskBodies={taskBodies}
      />
      {/* Remaining-count subtitle · matches legacy hero's "N more tasks
          below" copy so the page reads continuous through the swap. */}
      {remaining > 1 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {remaining - 1} more task{remaining - 1 === 1 ? '' : 's'} ahead
        </p>
      ) : null}
      {/* IN-FLIGHT TRAY · surfaces below carousel whenever 1+ tasks are
       *  marked in_flight. Slow paperwork (Cenomar · Pre-Cana · STD render
       *  · etc.) stays visible + actionable here without blocking the
       *  forward walk. Per CLAUDE.md 2026-05-23 Sixth row + owner
       *  decision 2026-05-24 option 2A. */}
      <InFlightTray eventId={eventId} taskIds={inFlightIds} />
    </>
  );
}

/**
 * Card-variant dispatcher · grows with each Phase PR.
 *
 * Phase 1 (PR #467): set_wedding_date.
 * Phase 2 (this PR): reception_venue.
 * Phase 2 follow-ups: ceremony_venue, officiant, photography, catering.
 * Phase 3-5: cards 08-38.
 *
 * Tasks not yet implemented render the placeholder body inside the same
 * WizardCard shell so the visual chrome stays consistent.
 */
function renderCardBody(
  taskId: WizardTaskId,
  ctx: {
    eventId: string;
    ceremonyType: CeremonyType | null;
    venueSetting: string | null;
    eventDate: string | null;
    meaningfulDates: MeaningfulDate[];
    excludeMarketplaceVendorIds: ReadonlyArray<string>;
    // DIY (Free) tier · pre-population for Cards 02 + 03 + 09 (2026-05-30).
    estimatedPax: number | null;
    estimatedBudgetCentavos: number | null;
    addACategoryPicks: ReadonlyArray<string>;
  },
): React.ReactNode {
  switch (taskId) {
    case 'set_wedding_date':
      return (
        <SetWeddingDateCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          initialDate={ctx.eventDate}
          meaningfulDates={ctx.meaningfulDates}
        />
      );
    // DIY (Free) tier · Cards 02 + 03 added 2026-05-30. These only appear
    // in the DIY 9-card sequence (per WIZARD_TASKS_DIY in lib/wizard.ts);
    // the PAID 65-card sequence skips them.
    case 'set_estimated_pax':
      return (
        <SetEstimatedPaxCard
          eventId={ctx.eventId}
          initialPax={ctx.estimatedPax}
        />
      );
    case 'set_estimated_budget':
      return (
        <SetEstimatedBudgetCard
          eventId={ctx.eventId}
          initialBudgetCentavos={ctx.estimatedBudgetCentavos}
        />
      );
    // DIY (Free) tier · Card 09 added 2026-05-30. Multi-pick from the
    // 192-row canonical taxonomy · spawns dynamic `custom_<canonical>`
    // tasks AFTER the 9 baseline cards.
    case 'add_a_category':
      return (
        <AddACategoryCard
          eventId={ctx.eventId}
          initialPicks={ctx.addACategoryPicks}
        />
      );
    case 'reception_venue':
      return (
        <ReceptionVenueCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'ceremony_venue':
      return (
        <CeremonyVenueCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    // 2026-05-24 owner directive · all 12 below now use VendorPickGridCard
    // with the visual grid + search + booked-availability shading. 11 are
    // reviews-first with NO distance filter (officiant · photography ·
    // catering · stylist · lights_sound · music · host_mc · attire ·
    // hair_makeup · cake · bridal_car); 1 uses distance from reception
    // (accommodation · initialKm=10). All consume ctx.eventDate for the
    // shared booked-vendor availability check.
    case 'officiant':
      return (
        <OfficiantCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'coordinator':
      return (
        <CoordinatorCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'photography':
      return (
        <PhotographyCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'engagement_prenup_shoot':
      return <PrenupCard eventId={ctx.eventId} eventDate={ctx.eventDate} />;
    case 'draft_guest_list':
      return <DraftGuestListCard eventId={ctx.eventId} />;
    case 'catering':
      return (
        <CateringCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'customize_food':
      return <CustomizeFoodCard eventId={ctx.eventId} />;
    case 'stylist':
      return (
        <StylistCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'lights_sound':
      return (
        <LightsSoundCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'led_background':
      return (
        <LedBackgroundCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'music_entertainment':
      return (
        <MusicEntertainmentCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'dance_instructor':
      return (
        <DanceInstructorCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'after_party_music':
      return (
        <AfterPartyMusicCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'host_mc':
      return (
        <HostMcCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'attire':
      return (
        <AttireCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'hair_makeup':
      return (
        <HairMakeupCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'cake':
      return (
        <CakeCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'rings':
      return (
        <RingsCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'accommodation':
      return (
        <AccommodationCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'bridal_car':
      return (
        <BridalCarCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    // Phase 5 batch — 7 paperwork external_process cards. Each uses the
    // <PaperworkCard> primitive + generic markTaskInFlight / markTaskDone
    // server actions from WAVE 0 (PR #472). The in_flight CTA is what
    // lets the wizard advance while slow paperwork (Cenomar · Pre-Cana ·
    // Marriage License) processes in the background.
    // 2026-05-24 owner directive (PR #534): cenomar split into bride
    // + groom · PH marriage license requires BOTH partners' Cenomars.
    // Both cases reuse the existing CenomarCard component until V1.x
    // adds per-partner upload-tracking UI; the component shows a
    // generic Cenomar status badge that works for either partner.
    case 'cenomar_bride':
      return <CenomarCard eventId={ctx.eventId} taskId="cenomar_bride" />;
    case 'cenomar_groom':
      return <CenomarCard eventId={ctx.eventId} taskId="cenomar_groom" />;
    case 'church_paperwork':
      return <ChurchPaperworkCard eventId={ctx.eventId} />;
    case 'pre_cana':
      return <PreCanaCard eventId={ctx.eventId} />;
    case 'marriage_license':
      return <MarriageLicenseCard eventId={ctx.eventId} />;
    case 'send_thank_yous':
      return <SendThankYousCard eventId={ctx.eventId} />;
    case 'create_reviews':
      return <CreateReviewsCard eventId={ctx.eventId} />;
    case 'download_photos':
      return <DownloadPhotosCard eventId={ctx.eventId} />;
    // WAVE 1 PR C · Cards 34 Event + 38 Editorial. Card 14 Photobooths
    // multi-pick deferred to WAVE 2.
    case 'event':
      return <EventCard eventId={ctx.eventId} eventDate={ctx.eventDate} />;
    case 'create_editorial':
      return <CreateEditorialCard eventId={ctx.eventId} />;
    // WAVE 2 · 13 hard inline-editor cards (Cards 09 · 11 · 14 · 15 ·
    // 16 · 17 · 20 · 21 · 29 · 30 · 31 · 32 · 33). Initial values
    // default to null/0 — cards handle empty state gracefully. A
    // follow-up enrichment PR will hydrate them from the events row +
    // related tables; for now the host picks fresh each time.
    case 'mood_board':
      return <MoodBoardCard eventId={ctx.eventId} initialPalette={null} />;
    case 'monogram':
      return (
        <MonogramCard
          eventId={ctx.eventId}
          initialText={null}
          initialColor={null}
          initialStyle={null}
        />
      );
    case 'photobooths_booths':
      return (
        <PhotoboothsBoothsCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
        />
      );
    case 'create_schedule':
      // 2026-05-24 owner directive · Card 15 restructured to 4 top-level
      // blocks + nested sub-blocks · ceremony-type-aware seed + canonical
      // event_schedule_blocks persistence. Thread eventDate + ceremonyType
      // so the first-open seed anchors to the host's wedding day +
      // dispatches the right per-faith Ceremony parts.
      return (
        <CreateScheduleCard
          eventId={ctx.eventId}
          eventDate={ctx.eventDate}
          ceremonyType={ctx.ceremonyType}
        />
      );
    case 'create_website':
      return (
        <CreateWebsiteCard
          eventId={ctx.eventId}
          initialSlug={null}
          initialVisibility="public"
        />
      );
    case 'save_the_date_video':
      return <SaveTheDateVideoCard eventId={ctx.eventId} />;
    case 'principal_sponsors':
      return <PrincipalSponsorsCard eventId={ctx.eventId} />;
    case 'finalize_entourage':
      return <FinalizeEntourageCard eventId={ctx.eventId} />;
    case 'invitations_stationery':
      return (
        <InvitationsStationeryCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
          eventDate={ctx.eventDate}
        />
      );
    case 'deploy_invitation':
      return (
        <DeployInvitationCard
          eventId={ctx.eventId}
          publicUrl={null}
          monogramText="M&J"
          monogramColor="#C97B4B"
        />
      );
    case 'second_batch_invitation':
      return <SecondBatchInvitationCard eventId={ctx.eventId} />;
    case 'honeymoon_planning':
      return (
        <HoneymoonPlanningCard
          eventId={ctx.eventId}
          eventDate={ctx.eventDate}
        />
      );
    case 'finalize_seatplan':
      return (
        <FinalizeSeatplanCard
          eventId={ctx.eventId}
          assignedCount={0}
          totalRsvpAccepted={0}
          totalGuests={0}
          tableCount={0}
        />
      );
    // 2026-05-24 owner directive (PR #534): finalize_catering_count
    // card REMOVED. Per owner: "once seat plan is finalized, the guest
    // list is finalized, all PAX dependent vendors will be notified
    // and they must confirm." Auto-notification system on
    // finalize_seatplan completion supersedes this card. The
    // FinalizeCateringCountCard component is now an orphan · safe to
    // delete in a V1.x cleanup PR.
    case 'finalize_rsvp':
      return <FinalizeRsvpCard eventId={ctx.eventId} />;
    case 'paprint':
      return <PaprintCard eventId={ctx.eventId} />;
    case 'all_set_readiness':
      return <AllSetReadinessCard eventId={ctx.eventId} />;
    case 'claim_next_event_reward':
      return <ClaimNextEventRewardCard eventId={ctx.eventId} />;
    // 2026-05-25 owner directive · inline 8-question intake form +
    // auto-play sample audio + Skip / Purchase CTAs. See pakanta-card.tsx
    // for the full spec capture.
    case 'pakanta':
      return <PakantaCard eventId={ctx.eventId} />;
    default:
      // Dynamic `custom_<canonical>` tasks spawned from AddACategoryCard
      // picks · routes through the lightweight CustomCategoryPickCard.
      // The wizard task title format is "Lock your <Title Cased Canonical>"
      // per lib/wizard.ts displayCanonical helper · we reverse the title-
      // case for display by stripping the canonical underscores.
      if (typeof taskId === 'string' && taskId.startsWith('custom_')) {
        const canonical = taskId.slice('custom_'.length);
        const displayName = canonical
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <CustomCategoryPickCard
            eventId={ctx.eventId}
            canonical={canonical}
            displayName={displayName}
          />
        );
      }
      return <PlaceholderCardBody taskId={taskId} />;
  }
}

/**
 * Celebratory variant · all 38 tasks complete. Matches the legacy
 * AllLockedVariant's emerald color treatment + Sparkles iconography
 * so the host sees the same emotional payoff at the end.
 */
function AllCompleteCelebration() {
  return (
    <section
      aria-labelledby="wizard-complete-heading"
      className="space-y-3"
    >
      <header className="flex items-baseline gap-2">
        <Sparkles
          aria-hidden
          className="h-3.5 w-3.5 text-emerald-700"
          strokeWidth={1.75}
        />
        <h2
          id="wizard-complete-heading"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-700"
        >
          Today&apos;s focus
        </h2>
      </header>

      <article className="flex flex-col gap-5 rounded-2xl border-2 border-emerald-300/50 bg-emerald-50/40 p-6 sm:p-8">
        <header className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-100/60 px-3 py-1">
            <Sparkles
              aria-hidden
              className="h-3.5 w-3.5 text-emerald-700"
              strokeWidth={2}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800">
              All locked
            </span>
          </div>
        </header>

        <div className="space-y-3">
          <h3 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
            Every step is locked in.
          </h3>
          <p className="text-sm leading-relaxed text-ink/75 sm:text-base">
            You&apos;ve walked the whole runway — from date to editorial.
            Your wedding lives on Setnayan now as a finished story; come back
            anytime to revisit your plan, your team, and your moments.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-800/80">
          <CheckCircle2
            aria-hidden
            className="h-4 w-4"
            strokeWidth={1.75}
          />
          <span>All 38 wizard tasks complete.</span>
        </div>
      </article>
    </section>
  );
}
