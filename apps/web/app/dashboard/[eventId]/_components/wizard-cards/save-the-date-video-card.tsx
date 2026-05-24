/**
 * Card 17 Save-the-Date Video · Programming tier (T-6m).
 *
 * EXTERNAL_PROCESS card · the host's prenup photos (Card 06) are the
 * source material for a 30-second video that drops six months before the
 * wedding. The render pipeline runs externally (Remotion + the SDE-style
 * compositor referenced in iteration 0024 Save-the-Date) so this card
 * surfaces as a two-CTA paperwork shape:
 *
 *   [Submitted · rendering]  → markTaskInFlight · wizard advances past
 *                               the card · row appears in IN-FLIGHT TRAY
 *                               so the host can mark done when the
 *                               render lands.
 *   [Mark done · I have my video] → markTaskDone · permanent advance.
 *
 * No photo-upload UI in V1: the prenup photos already flow through the
 * photographer's deliverables (Card 05 + Card 06), and the Save-the-Date
 * Video product (iteration 0024 · ₱199/render) reads from those
 * deliverables when the host triggers a render via the existing
 * `/dashboard/[eventId]/add-ons/save-the-date` surface. This card's job
 * is the wizard touchpoint that lets the wizard advance while the
 * render runs · NOT to duplicate the upload affordance.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]]: the
 * intro copy frames the wait as part of the natural flow ("rendering
 * usually takes a few hours") rather than an engineering placeholder.
 *
 * Cross-references:
 *   - Iteration 0024 Save-the-Date · ₱199/render product
 *   - Card 06 Prenup · the photo source this video draws from
 *   - PaperworkCard primitive · same shape as Cards 25-28 + 35-37
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function SaveTheDateVideoCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="save_the_date_video"
      intro={
        <>
          <p>
            Your save-the-date video draws from your prenup photos and lands as
            a 30-second clip your guests can save straight to their calendars.
            Trigger the render anytime from the Save-the-Date add-on once your
            prenup deliverables are in — ₱199 per render so you can iterate
            until the framing feels right.
          </p>
          <p className="mt-2 text-ink/65">
            Tap <em>Submitted · rendering</em> once the render is in flight —
            we&apos;ll keep this card in your in-flight tray so you can mark
            it done when the video lands in your library.
          </p>
        </>
      }
      metaFields={[
        {
          name: 'render_reference',
          label: 'Render reference (optional)',
          placeholder: 'e.g. STD-RENDER-2026-08-12',
          maxLength: 64,
        },
      ]}
      inFlightLabel="Submitted · rendering"
      doneLabel="I have my video"
    />
  );
}
