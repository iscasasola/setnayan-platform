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
  type WizardTaskId,
} from '@/lib/wizard';
import type { CeremonyType, MeaningfulDate } from '@/lib/auspicious-date';
import { WizardCard } from './wizard-card';
import { SetWeddingDateCard } from './wizard-cards/set-wedding-date-card';
import { ReceptionVenueCard } from './wizard-cards/reception-venue-card';
import { CeremonyVenueCard } from './wizard-cards/ceremony-venue-card';
import { OfficiantCard } from './wizard-cards/officiant-card';
import { PhotographyCard } from './wizard-cards/photography-card';
import { PrenupCard } from './wizard-cards/prenup-card';
import { CateringCard } from './wizard-cards/catering-card';
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

  // All 38 cards complete · show the celebratory variant (matches the
  // structure of the legacy AllLockedVariant from TodaysOneThing).
  if (result.kind === 'null' && result.reason === 'all_complete') {
    return <AllCompleteCelebration />;
  }

  if (result.kind === 'null') return null;

  const task = result.task;
  const cardBody = renderCardBody(task.id, {
    eventId,
    ceremonyType,
    venueSetting,
    eventDate,
    meaningfulDates,
    excludeMarketplaceVendorIds,
  });

  return (
    <>
      <WizardCard task={task}>{cardBody}</WizardCard>
      {/* Remaining-count subtitle · matches legacy hero's "N more tasks
          below" copy so the page reads continuous through the swap. */}
      {remaining > 1 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {remaining - 1} more task{remaining - 1 === 1 ? '' : 's'} ahead
        </p>
      ) : null}
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
        />
      );
    case 'ceremony_venue':
      return (
        <CeremonyVenueCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
        />
      );
    case 'officiant':
      return (
        <OfficiantCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
        />
      );
    case 'photography':
      return (
        <PhotographyCard
          eventId={ctx.eventId}
          ceremonyType={ctx.ceremonyType}
          venueSetting={ctx.venueSetting}
          excludeMarketplaceIds={ctx.excludeMarketplaceVendorIds}
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
        />
      );
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
