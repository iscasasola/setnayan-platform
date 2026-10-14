import { Badge } from '@/app/_components/badge';
import { BookingFeeBills } from '@/app/_components/booking-fee-notice';
import type { FeeDisclosure } from '@/lib/booking-fee-disclosure';
import type { SupplierTodayView } from '@/lib/supplier-today-view';
import type { WhatsNewCard } from '@/lib/vendor-overview';
import { formatPesoCompact } from '@/lib/vendors-plan-budget';
import { LockRequestBody, WhatsNewFeed } from './overview-sections';
import { SupplierTodayFirstScreen, TodayNoteRow, type TodayOutcome } from './supplier-today-first-screen';

type Act = (formData: FormData) => void | Promise<void>;

/**
 * The SHIPPED answers, handed in by whoever mounts the screen (the Today page; the dev lab, where with no session
 * every one refuses). Taken as props — never imported here — so "which page mounts this answer" stays a question
 * about pages (`today-is-rows.test.ts` test 2), and a test can draw the screen without a server.
 */
export type TodayActions = {
  acceptInquiry: Act;
  declineInquiry: Act;
  /** `vendorAcknowledgeDeposit` */
  confirmLock: Act;
  /** `vendorRejectDeposit` */
  rejectLock: Act;
  /** `vendorAgreeToLock` — the booking ask's yes (the fee mint door, F4). */
  agreeLock: Act;
  /** `vendorDeclineLock` */
  declineLock: Act;
  agreeDeletion: Act;
  declineDeletion: Act;
  /** `vendorAnswerDateChange` — Move · Unlock my service. */
  answerDateChange: Act;
  postReviewReply: Act;
  respondMeeting: Act;
  markServiceComplete: Act;
};

/**
 * 📱 THE SIMPLER TODAY, DRAWN — the one place the assembled view (`assembleSupplierToday`) meets the shipped answer
 * forms. The Today page renders it with its reads; `/dev/supplier-lab?easy=…` renders it with fixtures — so the lab
 * shows exactly what ships (the same components, the same server actions; with no session every one refuses).
 *
 * Every answer here is the SHIPPED one (handed in as `actions`): `vendorAgreeToLock` / `vendorDeclineLock` (the booking ask, answered ON the
 * Next card with the fee named above Agree), Move · Unlock (`vendorAnswerDateChange`), Agree to remove it in the
 * delete look / Keep it for now, I delivered this service, Post reply, and each unpaid booking fee with its Pay.
 */
export function SupplierTodayScreen({
  view,
  outcome,
  feeForecasts,
  cards,
  askStatus,
  deskIncomplete,
  actions,
}: {
  view: SupplierTodayView;
  outcome: TodayOutcome | null;
  /** What agreeing to each booking ask will cost, keyed by `eventVendorId` — named BEFORE Agree. */
  feeForecasts: Record<string, FeeDisclosure | null>;
  /** Every desk card (the asks and the closed lines) — the rows' answers are drawn from these. */
  cards: WhatsNewCard[];
  askStatus: string;
  deskIncomplete: boolean;
  actions: TodayActions;
}) {
  return (
      <SupplierTodayFirstScreen
        next={view.next}
        look={view.look}
        second={view.second}
        counter={view.counter}
        meta={view.meta}
        who={view.who}
        eyebrow={view.eyebrow}
        nextNote={view.nextNote}
        dateChange={view.dateChangeOnCard ? { card: view.dateChangeOnCard, answer: actions.answerDateChange } : null}
        answerOnCard={
          view.askOnCard ? (
            /* ✅ The couple's ask, answered ON the card: the fee BEFORE Agree, Agree, Turn it down — the shipped
               answer (`vendorAgreeToLock` / `vendorDeclineLock`), the one the row below would have opened. */
            <>
              {view.askNotes.map((n) => (
                <TodayNoteRow
                  key={n.id}
                  marker={n.id}
                  label={n.label}
                  line={n.line}
                  rowIcon={n.icon}
                  pill={<Badge tone={n.pill.tone} data="today-ask-note">{n.pill.word}</Badge>}
                />
              ))}
              <LockRequestBody
                onCard
                card={view.askOnCard}
                agreeLock={actions.agreeLock}
                declineLock={actions.declineLock}
                payoutReadiness="unreadable"
                feeForecast={feeForecasts[view.askOnCard.eventVendorId] ?? null}
              />
            </>
          ) : null
        }
        outcome={outcome}
        numbers={{
          ...view.numbers,
          // ₱48K, not ₱48,000 — three numbers share one phone row. `null` when
          // payday was not read: the number then says "couldn't load", never ₱0.
          toComeIn: view.numbers.toComeInPhp === null ? null : formatPesoCompact(view.numbers.toComeInPhp * 100),
        }}
        alsoToday={view.alsoToday}
        comingUp={view.comingUp}
        alsoWaitingHeaded={view.alsoWaitingHeaded}
        doors={view.doors}
        shop={view.shop}
        business={view.business}
        alsoWaiting={
          /* The asks and the closed lines, each opening its answer in place — the booking fee is still read BEFORE
             Agree, the receipt before Confirm. The payout nudge is a door row of its own, so not repeated here. */
          <WhatsNewFeed
            cards={cards}
            asks={view.askRows}
            statusLine={askStatus}
            incomplete={deskIncomplete}
            {...actions}
            payoutReadiness="unreadable"
            feeForecasts={feeForecasts}
          />
        }
        // WHAT YOU OWE SETNAYAN — every unpaid booking fee, each with its own
        // Pay (owner 2026-09-20: "i never saw the payment screen to pay us").
        // The Next card shows ONE bill, and only when nothing busier wins; this
        // shows the rest, always, last under Also waiting — and the lock, said
        // once under them. Renders nothing when there is no unpaid fee, and
        // nothing when the read failed — an unread bill list is not "you owe
        // nothing".
        hasBills={view.bills.length > 0}
        bills={
          <>
            <BookingFeeBills today bills={view.bills} copyFor={view.billCopy} />
            {view.lockLine ? (
              <p data-fee-lock-line="" className="pb-2 pl-[46px] text-[12.5px] leading-snug text-ink/60">
                {view.lockLine}
              </p>
            ) : null}
          </>
        }
      />
  );
}
