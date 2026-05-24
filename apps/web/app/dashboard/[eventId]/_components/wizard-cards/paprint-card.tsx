/**
 * Card 33 Paprint · Final-month tier.
 *
 * Paprint is the physical print run that lands ~7-10 days before the
 * wedding — QR-encoded table cards, place cards, schedule signage,
 * day-of guide cards, paparazzi seat-finder QRs. Iteration 0050 is the
 * canonical home for the Paprint engineering surface (order intake +
 * fulfillment partner + delivery tracking), but it hasn't been built
 * yet. This wizard card captures the host's intent (which QR types,
 * roughly how many) so the V1 owner-side ops team can reach out to
 * arrange the print run · admin reads the wizard_state metadata and
 * picks the conversation up from there.
 *
 * UX shape uses the PaperworkCard primitive:
 *   - Multi-select for QR types (Table · Invitation · Day-of · Patiktok)
 *   - Number input for rough quantity
 *   - [Submitted to admin] → markTaskInFlight (admin queue picks it up)
 *   - [Mark done · prints received] → markTaskDone (host has the prints
 *     in hand · wizard advances permanently)
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]]: the intro copy
 * frames the V1 hand-off ("once your seating + headcount are locked,
 * we'll work with you on print quantities") as polite editorial Filipino
 * rather than an engineering "Iteration 0050 not built yet" disclaimer.
 *
 * Cross-references:
 *   - Iteration 0050 Paprint (canonical V1.x engineering surface)
 *   - Iteration 0002 unified QR lifecycle (CLAUDE.md 2026-05-22 eleventh
 *     row) · the QR types this card captures all live in that taxonomy
 *   - Card 30 Finalize Seatplan + Card 31 Finalize Catering Count
 *     (upstream cards · prints can only happen once seating + headcount
 *     are locked)
 *   - PaperworkCard primitive (paperwork-card.tsx) · same two-CTA shape
 *     as Cards 25-28 + 35-37
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function PaprintCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="paprint"
      intro={
        <>
          <p>
            Your print run pulls together every QR-encoded card your
            wedding needs — table assignments, the day-of guide, your
            paparazzi seat-finder, and your invitation QR if you&apos;d
            like reprints. Once your seating and headcount are locked,
            we&apos;ll work with you on quantities and ship to your
            venue seven to ten days before the wedding.
          </p>
          <p className="mt-2 text-ink/65">
            Pick the QR types you need and a rough quantity below — we&apos;ll
            confirm the final count, paper finish, and delivery once you
            submit. The card stays in your in-flight tray so you can mark
            it done when the prints arrive.
          </p>
        </>
      }
      metaFields={[
        {
          name: 'qr_types',
          label: 'QR cards to print',
          type: 'multi_select',
          required: true,
          options: [
            { value: 'table_qrs', label: 'Table QRs · one per reception table' },
            { value: 'invitation_qrs', label: 'Invitation QRs · for guest reprints' },
            { value: 'day_of_qrs', label: 'Day-of guest portal QRs · schedule + map' },
            { value: 'patiktok_qrs', label: 'Patiktok download QRs · post-event share' },
          ],
        },
        {
          name: 'quantities',
          label: 'Rough total quantity',
          type: 'number',
          placeholder: 'e.g. 120',
          required: true,
          maxLength: 5000,
        },
        {
          name: 'notes',
          label: 'Notes for the print team (optional)',
          placeholder: 'Preferred paper finish, special instructions, etc.',
          maxLength: 240,
        },
      ]}
      inFlightLabel="Submitted to admin"
      doneLabel="Prints received"
    />
  );
}
