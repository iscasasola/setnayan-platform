/**
 * Concierge Active Wizard · WizardHero · top-level Today's Focus surface.
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
import { PhotographyCard } from './wizard-cards/photography-card';
import { PrenupCard } from './wizard-cards/prenup-card';
import { CateringCard } from './wizard-cards/catering-card';
// Phase 3 batch — 9 standard vendor-pick cards.
import { StylistCard } from './wizard-cards/stylist-card';
import { LightsSoundCard } from './wizard-cards/lights-sound-card';
import { MusicEntertainmentCard } from './wizard-cards/music-entertainment-card';
import { HostMcCard } from './wizard-cards/host-mc-card';
import { AttireCard } from './wizard-cards/attire-card';
import { HairMakeupCard } from './wizard-cards/hair-makeup-card';
import { CakeCard } from './wizard-cards/cake-card';
import { AccommodationCard } from './wizard-cards/accommodation-card';
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
import { FinalizeCateringCountCard } from './wizard-cards/finalize-catering-count-card';
import { FinalizeRsvpCard } from './wizard-cards/finalize-rsvp-card';
import { PaprintCard } from './wizard-cards/paprint-card';
import { PlaceholderCardBody } from './wizard-cards/placeholder-card-body';

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
};

export function WizardHero({
  eventId,
  wizardState,
  eventDate,
  ceremonyType,
  venueSetting,
  meaningfulDates,
  excludeMarketplaceVendorIds,
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
  const carouselTasks = getCarouselTasks(state, 4);
  const activeTask = carouselTasks[0];
  if (!activeTask) return null;

  const ctx = {
    eventId,
    ceremonyType,
    venueSetting,
    eventDate,
    meaningfulDates,
    excludeMarketplaceVendorIds,
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
    case 'cenomar':
      return <CenomarCard eventId={ctx.eventId} />;
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
    case 'deploy_invitation':
      return (
        <DeployInvitationCard
          eventId={ctx.eventId}
          publicUrl={null}
          monogramText="M&J"
          monogramColor="#C97B4B"
        />
      );
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
    case 'finalize_catering_count':
      return (
        <FinalizeCateringCountCard
          eventId={ctx.eventId}
          rsvpAttendingCount={0}
          rsvpTotalCount={0}
        />
      );
    case 'finalize_rsvp':
      return <FinalizeRsvpCard eventId={ctx.eventId} />;
    case 'paprint':
      return <PaprintCard eventId={ctx.eventId} />;
    default:
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
