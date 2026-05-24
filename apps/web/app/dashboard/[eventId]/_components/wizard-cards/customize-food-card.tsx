/**
 * Card 7b · Customize Food · Phase 1 · Foundation tier.
 *
 * Owner directive 2026-05-24 (flow diagram) · sub-step that fires AFTER
 * the caterer locks (Card 07). Captures the menu direction · dietary
 * restrictions · service style · tasting schedule. PaperworkCard
 * primitive · external_process kind · settles via markTaskDone when
 * the host confirms the menu is finalized with the caterer.
 *
 * Decouples menu-locking from caterer-vendor-locking so couples don't
 * feel pressured to settle the menu the same day they sign the
 * catering contract — typical PH cadence is contract first, menu
 * tasting 3-4 months later.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function CustomizeFoodCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="customize_food"
      intro={
        <>
          <p>
            With your caterer locked, the menu shape is the next call.
            Service style (buffet · plated · stations · family-style),
            dietary accommodations (halal · vegetarian · allergen-aware),
            and your tasting date.
          </p>
          <p className="mt-2 text-ink/65">
            Most PH caterers run a tasting 3–4 months before the wedding.
            Lock the menu shape now · jot the date your tasting is
            booked · come back to mark done once the menu is finalized.
          </p>
        </>
      }
      metaFields={[
        {
          name: 'service_style',
          label: 'Service style (buffet · plated · stations · family)',
          placeholder: 'e.g. plated 3-course + dessert station',
          maxLength: 128,
        },
        {
          name: 'tasting_date',
          label: 'Menu tasting date (optional)',
          placeholder: 'e.g. 2026-08-15',
          maxLength: 32,
        },
      ]}
      inFlightLabel="Tasting scheduled"
      doneLabel="Menu is finalized"
    />
  );
}
