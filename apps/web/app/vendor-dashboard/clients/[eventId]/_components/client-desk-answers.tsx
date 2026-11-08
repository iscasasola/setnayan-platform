/**
 * 🗓 THE TWO TODAY-ONLY ANSWERS, ON THIS CLIENT'S DETAILS (THE ONE BUILD, 8 Nov 2026 · A2 A8 · spec §3.2).
 *
 * A couple asking to MOVE their date, and a couple asking to REMOVE an event this shop was paid for, could only be
 * answered on Today. They now also land on the client they are about, at the top of Details, drawn by the SAME
 * bodies Today draws (`DateChangeBody` · `DeleteRequestBody`, exported from `overview-sections.tsx`) and sent
 * through the SAME shipped actions (`vendorAnswerDateChange` · `vendorAgreeToDeletion` · `vendorDeclineDeletion`)
 * inside the SAME `UndoableAnswers` holder — no second drawing, no second way to write an answer.
 *
 * READS ARE HONEST: the two desk reads are the ones Today runs (`readDateChangeAsks` · `readDeletionRequests`),
 * filtered to this event. A refused read says so in one line — it never reads as "nothing to answer".
 *
 * ⏳ The actions still return to Today with their outcome flag (`?date_answer=` · `?deletion=`) — noted for C1, who
 * owns where an answer lands (`ANSWERED_ONLY_ON_TODAY`, the row targets).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readDateChangeAsks, readDeletionRequests } from '@/lib/vendor-overview-desk-reads';
import type { WhatsNewCard } from '@/lib/vendor-overview';
import { DateChangeBody, DeleteRequestBody } from '../../../_components/overview-sections';
import { UndoableAnswers } from '../../../_components/undoable-answers';
import {
  vendorAgreeToDeletion,
  vendorAnswerDateChange,
  vendorDeclineDeletion,
} from '../actions';

type DateChangeCard = Extract<WhatsNewCard, { kind: 'date_change' }>;
type DeleteCard = Extract<WhatsNewCard, { kind: 'delete_request' }>;

export type ClientDeskAnswers = {
  dateChanges: DateChangeCard[];
  deletes: DeleteCard[];
  /** Either read was refused — said, never drawn as "nothing to answer". */
  failed: boolean;
};

const precisionOf = (p: string | null): 'day' | 'month' | 'year' => (p === 'month' || p === 'year' ? p : 'day');

/** The two desk reads Today runs, narrowed to ONE event. Built exactly as `lib/vendor-overview.ts` builds them. */
export async function readClientDeskAnswers(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
  facts: { coupleName: string; eventDate: string | null },
): Promise<ClientDeskAnswers> {
  const [dates, deletes] = await Promise.all([
    readDateChangeAsks(admin, vendorProfileId),
    readDeletionRequests(admin, vendorProfileId),
  ]);
  return {
    failed: Boolean(dates.error) || Boolean(deletes.error),
    dateChanges: dates.rows
      .filter((dc) => dc.event_id === eventId)
      .map((dc) => ({
        kind: 'date_change' as const,
        id: `datechange-${dc.request_id}`,
        eventId: dc.event_id,
        eventVendorId: dc.event_vendor_id,
        coupleName: facts.coupleName,
        fromDate: dc.from_date,
        fromPrecision: precisionOf(dc.from_precision),
        proposedDate: dc.proposed_date,
        proposedPrecision: precisionOf(dc.proposed_precision),
        askedAt: dc.asked_at,
        dueAt: dc.due_at,
      })),
    deletes: deletes.rows
      .filter((dr) => dr.event_id === eventId)
      .map((dr) => ({
        kind: 'delete_request' as const,
        id: `delreq-${dr.vendor_id}`,
        eventId: dr.event_id,
        eventVendorId: dr.vendor_id,
        eventDate: facts.eventDate,
        requestedAt: dr.delete_requested_at,
        coupleName: facts.coupleName,
      })),
  };
}

/** Nothing to answer → nothing drawn. A refused read → one honest line (beside whatever the other read found). */
export function ClientDeskAnswersBlock({ answers }: { answers: ClientDeskAnswers }) {
  const { dateChanges, deletes, failed } = answers;
  const refused = failed ? (
    <p className="text-xs text-ink/55" data-client-desk-answers-failed="">
      Couldn&rsquo;t check for a date change or a removal request &mdash; open Today to see them.
    </p>
  ) : null;
  if (dateChanges.length === 0 && deletes.length === 0) return refused;
  return (
    <UndoableAnswers>
      <div className="space-y-3" data-client-desk-answers="">
        {refused}
        {deletes.map((card) => (
          <div key={card.id} data-today-ask="" className="sn-tile p-4">
            <DeleteRequestBody
              card={card}
              agreeDeletion={vendorAgreeToDeletion}
              declineDeletion={vendorDeclineDeletion}
            />
          </div>
        ))}
        {dateChanges.map((card) => (
          <div key={card.id} data-today-ask="" className="sn-tile p-4">
            <DateChangeBody card={card} answerDateChange={vendorAnswerDateChange} />
          </div>
        ))}
      </div>
    </UndoableAnswers>
  );
}
