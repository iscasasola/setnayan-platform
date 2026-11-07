import { createAdminClient } from '@/lib/supabase/admin';
import { readClientDayAnswers } from '@/lib/client-day-answers.server';
import { vendorAgreeToDeletion, vendorAnswerDateChange, vendorDeclineDeletion } from '../clients/[eventId]/actions';
import { DateChangeBody, DeleteRequestBody } from './overview-sections';
import { UndoableAnswers } from './undoable-answers';

/**
 * 🗓 THE CLIENT'S OWN ANSWERS — DATE CHANGE · DELETE REQUEST (THE ONE BUILD A8, 8 Nov 2026).
 *
 * Today's rows JUMP now (owner v112 HOLD answer: *"Jump"*), so the two answers that used to be given ONLY on Today
 * (`ANSWERED_ONLY_ON_TODAY`, emptied) need a page: they land on the picked client's **Details**. This is that page's
 * mount — the SHIPPED bodies (`DateChangeBody`: Move · Unlock with the refund sentence BEFORE the press;
 * `DeleteRequestBody`: Agree to remove · Keep it for now), the SHIPPED actions (`vendorAnswerDateChange`,
 * `vendorAgreeToDeletion`, `vendorDeclineDeletion`), inside the SHIPPED `UndoableAnswers` holder (the undo window,
 * never lost). Nothing redrawn.
 *
 * ✋ L2 owns the client page: it mounts `<ClientDayAnswers eventId vendorProfileId coupleName eventDate />` in Details
 * (spec §9 #2 — "leaves mount points for the A8 bodies"). With nothing open it draws nothing. A refused read says so.
 *
 * 🔒 app/vendor-dashboard/_components/today-rows-jump.test.ts
 */
export async function ClientDayAnswers({
  eventId,
  vendorProfileId,
  coupleName = null,
  eventDate = null,
}: {
  eventId: string;
  vendorProfileId: string;
  /** `events.display_name` — the card names who is asking ("A couple" when the event has none). */
  coupleName?: string | null;
  eventDate?: string | null;
}) {
  const read = await readClientDayAnswers(createAdminClient(), vendorProfileId, eventId, { coupleName, eventDate });
  if (read.cards.length === 0 && read.complete) return null;
  return (
    <section data-client-day-answers={eventId} aria-label="Waiting on your answer" className="space-y-4">
      {!read.complete ? (
        <p role="status" className="text-[13.5px] text-[rgb(var(--color-danger))]" data-client-day-answers-unread="">
          Some of this couple’s requests couldn’t load. Refresh to try again — nothing is lost.
        </p>
      ) : null}
      <UndoableAnswers>
        {read.cards.map((card) => (
          // `data-today-row-item`: the row the Undo holder hides at the press (`undoable-answers.tsx`), then shows again on Undo.
          <div key={card.id} data-client-day-answer={card.kind} data-today-row-item="" className="py-2">
            {card.kind === 'date_change' ? (
              <DateChangeBody card={card} answerDateChange={vendorAnswerDateChange} />
            ) : (
              <DeleteRequestBody card={card} agreeDeletion={vendorAgreeToDeletion} declineDeletion={vendorDeclineDeletion} />
            )}
          </div>
        ))}
      </UndoableAnswers>
    </section>
  );
}
