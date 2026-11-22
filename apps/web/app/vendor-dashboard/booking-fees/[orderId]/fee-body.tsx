import { Check, Clock, Flag, Info, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { namesPhrase, openAccounts } from '@/lib/payment-channels';
import { PaymentChannelName } from '@/app/_components/payment/payment-channel-name';
import { payPath } from '@/lib/pay-path';
import { ActionButton } from '@/components/action-button';
import { actionButtonClass } from '@/components/action-button-class';
import { CopyButton } from '@/app/_components/copy-button';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, formatPhp, type OrderRow, type PaymentRow, type PaymentStatus } from '@/lib/orders';
import type { PlatformSettingsRow } from '@/lib/platform-settings';
import { feeOrderDescriptionNow, bookingFeeErrorCopy } from '@/lib/vendor-booking-fees';
import { disputeStateLine, type asDisputeStatus } from '@/lib/booking-fee-dispute';
import { SubmitButton } from '@/app/_components/submit-button';
import { DisputeNoteField } from '@/app/_components/dispute-note-field';
import { bookingFeeDispute } from '@/app/_actions/booking-fee-dispute-actions';
import { TOP_UP_WORDS, topUpPayLabel, type TopUpStage } from '@/lib/booking-fee-top-up';
import { formatDueDate } from '@/lib/booking-fee-disclosure';
import { manilaToday } from '@/lib/std-views';
import { ShopPill } from '../../_components/kit';
import { PartCard, PartFoot, PartList, PartNote, PartPage, PartPin, PartRef, PartRow, PartSec, PartText, PartTop, setTwo } from '../../_components/set-two/parts';
import { MONEY_NOT_OWED, ReadFailedBody } from '../../_components/set-two/read-failed';
import { feeStatusTone } from '../booking-fees-body';

const ROUTE = '/vendor-dashboard/booking-fees/[orderId]';
const COLUMN = 'mx-auto w-full tab:max-w-3xl';

/** The fee could not be read (Honest state · new): the shell and the title stay, and say so. */
export function BookingFeeReadFailed({ orderId }: { orderId: string }) {
  return (
    <PartPage column={COLUMN} mark="booking-fee">
      <PartPin route={ROUTE} params={{ orderId }} title="Booking fee" />
      <ReadFailedBody mark="booking-fee">
        We couldn&rsquo;t load this fee right now. {MONEY_NOT_OWED}
      </ReadFailedBody>
    </PartPage>
  );
}

/**
 * One booking fee to pay, on the November look (owner-approved 21 Nov 2026, supplier pages set two, page 1): the bill's
 * facts in the top block with the amount large; Copy amount and Copy reference; Send your payment → the one payment
 * page, the main button in the thumb zone; the dispute's button inside its own box; the payment log. Drawn from the
 * page's reads (the lab draws it from fixtures). READ-ONLY on the fee.
 */
export function BookingFeeBody({
  orderId,
  order,
  headlineTotal,
  payable,
  foundLine,
  topUp,
  pointer,
  settings,
  disputeStatus,
  disputeViewCount,
  decisionNote,
  canDispute,
  loggedPayments,
  screenshots,
  search,
}: {
  orderId: string;
  order: OrderRow;
  headlineTotal: number;
  payable: boolean;
  foundLine: string | null;
  topUp: { stage: TopUpStage; dueOn: string | null } | null;
  /** The resolver's own sentence about what the payment page's code carries (`qrWords(...).pointer`). */
  pointer: ReactNode;
  settings: PlatformSettingsRow;
  disputeStatus: ReturnType<typeof asDisputeStatus> | null;
  disputeViewCount: number | null;
  decisionNote: string | null;
  canDispute: boolean;
  loggedPayments: readonly PaymentRow[];
  screenshots: Readonly<Record<string, string>>;
  search: { logged?: string; error?: string; dispute?: string };
}) {
  const totals = { headlineTotal };
  const feeWords = { pointer };
  const dispute = { decision_note: decisionNote };
  const paymentScreenshotMap = screenshots;
  const sendLabel = topUp ? topUpPayLabel(topUp.dueOn, manilaToday()) : 'Send your payment';

  return (
    <PartPage column={COLUMN} mark="booking-fee">
      <PartPin
        route={ROUTE}
        params={{ orderId }}
        title={<>Reference {order.reference_code}</>}
        end={<ShopPill tone={feeStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</ShopPill>}
      />

      {search.logged === '1' ? (
        <PartNote tone="ok" icon={Check} role="status">
          Payment logged. Our team reconciles within 24 hours and your fee moves to paid — no action needed on your end.
        </PartNote>
      ) : null}
      {/* 🚨 WAS `decodeURIComponent(search.error)` RENDERED DIRECTLY. A fixed code lookup is the difference between
          showing our own sentence and showing whatever a stranger put in a link, on the screen where a supplier sends
          us money. An unknown code renders nothing at all. */}
      {bookingFeeErrorCopy(search.error) ? (
        <PartNote tone="warn" icon={Info} role="alert">
          {bookingFeeErrorCopy(search.error)}
        </PartNote>
      ) : null}

      <div className={setTwo.twoCol}>
        <div className={setTwo.col}>
          <PartTop kicker={<>Order {order.public_id}</>}>
            <p className="mt-1 whitespace-pre-wrap">{feeOrderDescriptionNow(order.description, order.status)}</p>
            {foundLine ? (
              <p data-found-you="" className="mt-1.5 font-bold !text-sn-accent">
                ★ {foundLine}
              </p>
            ) : null}
            <div className="mt-3">
              <span className={setTwo.kicker}>Amount to send</span>
              <div className={setTwo.big}>{formatPhp(totals.headlineTotal)}</div>
            </div>
            {payable ? (
              <p className="mt-1.5">
                Up for verification — once you pay and we confirm it (within 24 hours), this fee moves to paid
                automatically.
              </p>
            ) : null}
          </PartTop>
          {/* 💸 A top-up may be settled EARLY — before the event day the note and the main button both say so. */}
          {topUp ? (
            <PartNote tone={topUp.stage === 'overdue' ? 'danger' : 'warn'} icon={Clock} role="status">
              <span data-top-up-stage={topUp.stage}>
                <strong>
                  {TOP_UP_WORDS.badge[topUp.stage]}
                  {topUp.dueOn ? ` · the event day, ${formatDueDate(topUp.dueOn)}` : ''}
                </strong>
                <br />
                {topUp.stage === 'held'
                  ? 'Your quote rose, so your booking fee grows by this top-up. Nothing closes before the event day — you may settle it early.'
                  : topUp.stage === 'due_today'
                    ? 'Due today. Nothing closes today; settle it before tomorrow to keep the event open.'
                    : 'Overdue. The event stays closed until it is settled — your chat with the couple stays open.'}
              </span>
            </PartNote>
          ) : null}
          {order.admin_notes ? (
            <PartCard>
              <h3>Note from Setnayan</h3>
              <p className="!mb-0 whitespace-pre-wrap">{order.admin_notes}</p>
            </PartCard>
          ) : null}

          {payable ? (
            <section>
              <PartSec>Payment instructions</PartSec>
              <PartList>
                {/* ⚖ THE COPY VALUE KEEPS ITS CENTAVOS AND IS NEVER ROUNDED. GCash and BDO both accept a centavo
                    amount; rounding either way leaves an admin reconciling a transfer against a number nobody
                    recorded. `.toFixed(2)` is the same two decimals the /pay QR carries in EMV tag 54
                    (lib/pay-amount.ts), so what a supplier PASTES and what their wallet PRE-FILLS are the same. */}
                <PartRow
                  title={<span className="text-[17px] tabular-nums">{formatPhp(totals.headlineTotal)}</span>}
                  sub="Amount to send"
                  end={<CopyButton value={totals.headlineTotal.toFixed(2)} label="Copy" />}
                />
                <PartRow
                  title={<span className="text-[17px]">{order.reference_code}</span>}
                  sub="Reference code"
                  end={<CopyButton value={order.reference_code} label="Copy" />}
                />
              </PartList>
              {/* 🔁 THE SECOND PAYMENT SURFACE THAT SAT HERE IS GONE (2026-09-20) — it printed STATIC QR codes that
                  carry no amount (the ₱0 scan the owner hit on this lane). The facts of the bill stay; sending the
                  money happens on /pay, which mints the code with the figure inside — see "Paying this fee". */}
              <PartText>
                Include the <strong>reference code</strong> in your transfer note so we can match it to this fee.
              </PartText>
            </section>
          ) : null}
        </div>

        <div className={setTwo.col}>
          {/* ── SENDING THE MONEY LIVES ON THE ONE PAYMENT PAGE (owner 2026-08-21). ⚖ The owner's 2026-08-06 rule — a
              reference is REQUIRED on this lane — travels with it: `requiresReference` makes it mandatory there. */}
          {payable ? (
            <section>
              <PartSec>Paying this fee</PartSec>
              <PartText>
                {feeWords.pointer} Have your {namesPhrase(openAccounts(settings).map((a) => a.label), 'bank or e-wallet')}{' '}
                confirmation to hand — we need its reference number to match your payment.
              </PartText>
              <PartFoot mark="booking-fee-pay" label="Pay this fee">
                <ActionButton
                  href={payPath(order.reference_code)}
                  tone="brand"
                  main
                  icon={<Send aria-hidden />}
                  label={sendLabel}
                  className="w-full tab:w-auto"
                />
              </PartFoot>
            </section>
          ) : null}

          {disputeStatus ? (
            <section data-fee-dispute={disputeStatus}>
              <PartSec>Your dispute</PartSec>
              <PartText>{disputeStateLine(disputeStatus, disputeViewCount, dispute.decision_note)}</PartText>
            </section>
          ) : search.dispute === 'error' || search.dispute === 'not_disputable' ? (
            <PartNote tone="warn" icon={Info} role="alert">
              {search.dispute === 'not_disputable'
                ? 'This fee can no longer be disputed here — it is not an open bill.'
                : 'We could not send your dispute just now. Nothing has changed. Please try again.'}
            </PartNote>
          ) : null}

          {canDispute ? (
            <section data-fee-dispute-form="">
              <PartSec>Think this fee is wrong?</PartSec>
              <PartCard>
                <p>If this couple did not find you through Setnayan, tell us and we will look at it.</p>
                <form action={bookingFeeDispute} className="space-y-3">
                  <input type="hidden" name="op" value="open" />
                  <input type="hidden" name="order_id" value={order.order_id} />
                  <DisputeNoteField name="What happened?" empty="Optional" fieldName="reason" />
                  <div className="flex justify-end">
                    <SubmitButton pendingLabel="Sending…" className={actionButtonClass('neutral')}>
                      <Flag aria-hidden strokeWidth={1.9} />
                      <span>Dispute this fee</span>
                    </SubmitButton>
                  </div>
                </form>
              </PartCard>
            </section>
          ) : null}

          <section>
            <PartSec>Payment log</PartSec>
            {/* 🧾 RW-37: the bill's own placeholder row is not a payment — it used to read "PAID <today> · PENDING REVIEW". */}
            {loggedPayments.length === 0 ? (
              <PartText>Nothing logged yet.</PartText>
            ) : (
              <PartList>
                {loggedPayments.map((p) => (
                  <PartRow
                    key={p.payment_id}
                    wrap
                    title={
                      <>
                        {formatPhp(p.amount_php)}
                        <PartRef>
                          · <PaymentChannelName settings={settings} channel={p.channel} />
                          {p.reference_number ? ` · ref ${p.reference_number}` : ''}
                        </PartRef>
                      </>
                    }
                    sub={
                      <>
                        Paid {p.paid_at}
                        {p.reviewed_at ? ` · reviewed ${p.reviewed_at.slice(0, 10)}` : ''}
                        {p.screenshot_url && paymentScreenshotMap[p.payment_id] ? (
                          <>
                            {' · '}
                            <a href={paymentScreenshotMap[p.payment_id]} target="_blank" rel="noreferrer" className="text-[rgb(var(--color-link))] underline">
                              Screenshot
                            </a>
                          </>
                        ) : null}
                      </>
                    }
                    end={<ShopPill tone={paymentStatusTone(p.status)}>{PAYMENT_STATUS_LABEL[p.status]}</ShopPill>}
                  />
                ))}
              </PartList>
            )}
          </section>
        </div>
      </div>
    </PartPage>
  );
}

/** A logged payment's status as a pill word in the supplier tokens. */
function paymentStatusTone(status: PaymentStatus): 'warn' | 'success' | 'danger' {
  if (status === 'matched') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warn'; // pending · resubmit_requested — both wait on somebody
}
