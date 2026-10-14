/**
 * /dev/supplier-chat-lab — the supplier's conversation, simpler-dashboard step 4, on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL pieces the thread page mounts — the frame (`ChatBox`), the answer line, the quick replies, the ＋
 * Tools sheet on the real composer, the tray of tool panels with the customer card's booking-ask panel and the
 * one-screen quote (`ProposalMaker`, fed a `labSeed` so it opens filled without a server call). The message bubbles
 * and the "New inquiry" bar are stand-ins: the stream needs a live session (Realtime), and the bar is the page's own.
 *
 *   ?m=inquiry   a new inquiry — the answer line, "Talk to them"
 *   ?m=tools     an accepted conversation, the couple spoke last — quick replies, ＋ beside the field (tap it)
 *   ?m=ask       the couple asked to book — "They asked to book" on the answer line, the panel open: fee BEFORE Agree
 *   ?m=agreed    …pressed Agree, the fee held the couple's news back — the live sentence and its Pay door
 *   ?m=quote     Send a quote — the one-screen quote, open
 *   ?m=full      the couple's date is full — no "Yes po, that day is free"
 *   &booked=1    the couple already booked you — every tool open
 *
 * The forms post the REAL actions; pressing them here needs a supplier's session (the lab draws, it does not book).
 * Names are samples: nobody real.
 */
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ThreadToolPanel } from '@/app/_components/chat/thread-tool-panel';
import { ThreadToolHashReveal } from '@/app/_components/chat/reveal-thread-tool';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { ChatPrivacyNotice } from '@/app/_components/chat-privacy-notice';
import { ProposalMaker } from '@/app/_components/proposal-maker';
import { VendorOfferService } from '@/app/vendor-dashboard/messages/[threadId]/_components/vendor-offer-service';
import { CHAT_ATTACH_INPUT_ID, ThreadToolsSheet } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { QuickReplies, quickRepliesFor, ThreadAnswerLine } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-answer-line';
import { LockRequestAnswer } from '@/app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel';
import { vendorAgreeToLock, vendorDeclineLock } from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { sendChatMessage } from '@/lib/chat-actions';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { bookingFeeForecast, type BookingFeeStanding } from '@/lib/booking-fee-disclosure';
import { lockAgreeNotice } from '@/lib/lock-answer-notice';
import { VENDOR_THREAD_PANELS } from '@/lib/vendor-thread-tools';
import type { ThreadDayAnswer } from '@/lib/thread-day-answer';

const LAB_THREAD = '00000000-0000-4000-8000-0000000000aa';
const LAB_EVENT = '00000000-0000-4000-8000-000000000000';
const LAB_EVENT_VENDOR = '00000000-0000-4000-8000-0000000000bb';
const TODAY = '2026-10-14';
const DAY = '2026-12-12';
const NOW = new Date('2026-10-14T04:00:00Z');

const BUBBLES: Array<['couple' | 'me', string, string]> = [
  ['couple', 'Hi po! Are you free on Dec 12? We are about 150 guests, garden reception in Tagaytay.', '9:12'],
  ['me', 'Hello po! Let me check our schedule.', '9:20'],
  ['couple', 'Thank you! Could you send your price for the buffet?', '9:31'],
];

const CARDS = [
  { id: 'card-buffet', label: 'Garden buffet', fromPhp: 650, addons: [{ id: 1, label: 'Lechon station', fromPhp: 12000 }, { id: 2, label: 'Coffee bar', fromPhp: 6500 }], comesWith: [], giftOn: true },
  { id: 'card-cocktail', label: 'Cocktail hour', fromPhp: 18000, addons: [], comesWith: [], giftOn: false },
];

export default async function SupplierChatLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'tools';
  const booked = sp.booked === '1';
  const inquiry = m === 'inquiry';
  const askOpen = m === 'ask';

  const answer: ThreadDayAnswer = booked ? { kind: 'booked' } : m === 'full' ? { kind: 'full' } : askOpen || m === 'agreed' ? { kind: 'fits', more: 2 } : { kind: 'free' };
  const feeStanding: BookingFeeStanding = { kind: 'billable', ordinal: 6, ordinalIsFrozen: false, schedule: BOOKING_FEE };
  const notice = m === 'agreed' ? lockAgreeNotice('ok', { feeHeld: true }) : null;

  const toolNodes: Record<string, React.ReactNode> = {
    'build-quote': (
      <ProposalMaker
        threadId={LAB_THREAD}
        requestedPax={150}
        livePax={150}
        coupleName="Ana & Miguel"
        cards={CARDS}
        feeStanding={feeStanding}
        papicStanding={{ kind: 'silent' }}
        savedQuotes={[{ id: 'tpl-garden', name: 'Garden wedding 150' }]}
        askedCardId="card-buffet"
        todayIso={TODAY}
        labSeed={{
          lines: [
            { label: 'Garden buffet · 5 dishes', basis: 'per_pax', free: false, flatPhp: 0, ratePhp: 650, minPax: 100, basePhp: 0, inclHours: 0, extraPhp: 0 },
            { label: 'Waiters and set-up', basis: 'flat', free: false, flatPhp: 15000, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 },
            { label: 'Cake table styling', basis: 'flat', free: true, flatPhp: 0, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 },
          ],
          extras: [
            { id: 'x-dessert', label: 'Dessert table', line: { label: 'Dessert table', basis: 'flat', free: false, flatPhp: 9500, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 } },
            { id: 'x-drinks', label: 'Bottomless iced tea', line: { label: 'Bottomless iced tea', basis: 'per_pax', free: false, flatPhp: 0, ratePhp: 45, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 } },
          ],
        }}
      />
    ),
    'booking-ask': askOpen ? (
      <LockRequestAnswer
        eventVendorId={LAB_EVENT_VENDOR}
        expiresAt="2026-10-15T20:00:00Z"
        payoutReadiness="ready"
        feeForecast={bookingFeeForecast(feeStanding, 112_500)}
        returnTo={`/vendor-dashboard/messages/${LAB_THREAD}`}
        agreeLock={vendorAgreeToLock}
        declineLock={vendorDeclineLock}
        now={NOW}
      />
    ) : null,
    'offer-service': <VendorOfferService threadId={LAB_THREAD} options={[{ vendorServiceId: 'card-cocktail', label: 'Cocktail hour' }]} />,
  };

  return (
    <main className="mx-auto flex h-[calc(100dvh-2rem)] min-h-[27rem] w-full max-w-3xl px-2 py-2 sm:px-4" data-lab-supplier-chat={m}>
      <ThreadToolHashReveal />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {notice ? (
          <p role="status" className="mb-2 rounded-xl border border-mulberry/25 bg-mulberry/[0.06] px-4 py-2.5 text-sm text-ink"> {/* no-card-ok: a copy of the thread page's own answer line, for the lab picture */}
            {notice.text}{' '}
            {notice.door ? (
              <a href={notice.door.href} className="font-semibold text-sn-accent underline underline-offset-2" data-lock-answer-door="">
                {notice.door.label}
              </a>
            ) : null}
          </p>
        ) : null}
        <ChatBox
          header={
            <>
              <span className="grid h-11 w-9 shrink-0 place-items-center text-ink/60">
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">Ana &amp; Miguel</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">Catering · December 12, 2026 · Planning for ~150 guests</p>
              </div>
            </>
          }
          notice={
            <>
              <ThreadAnswerLine initials="AM" eventDay={DAY} todayIso={TODAY} answer={answer} askOpen={askOpen} />
              <ChatPrivacyNotice inBox viewer="vendor" />
            </>
          }
          composer={
            inquiry ? (
              // Stand-in for the page's own "New inquiry" bar — its words and its one button, as the page draws them.
              <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4"> {/* no-card-ok: a copy of the thread page's own New-inquiry bar, for the lab picture */}
                <p className="text-sm text-ink">
                  <span className="font-semibold">New inquiry.</span> Say yes to talk — nothing is booked yet.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream">
                    Talk to them
                  </button>
                  <button type="button" className="inline-flex h-11 items-center rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink">
                    Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <QuickReplies threadId={LAB_THREAD} replies={quickRepliesFor(answer)} sendAction={sendChatMessage} />
                <ChatSendForm
                  threadId={LAB_THREAD}
                  sendAction={sendChatMessage}
                  lead={
                    <ThreadToolsSheet
                      eventId={LAB_EVENT}
                      state={{ hasAgreement: booked, askOpen, paymentsToConfirm: booked ? 1 : 0, guestCountChanges: 0 }}
                    />
                  }
                  attachInputId={CHAT_ATTACH_INPUT_ID}
                />
              </div>
            )
          }
          tray={
            inquiry ? null : (
              <div>
                {VENDOR_THREAD_PANELS.map((t) =>
                  toolNodes[t.id] == null ? null : (
                    <ThreadToolPanel
                      key={t.id}
                      id={t.id}
                      label={t.label}
                      hint={t.hint}
                      open={(t.id === 'build-quote' && m === 'quote') || (t.id === 'booking-ask' && askOpen)}
                    >
                      {toolNodes[t.id]}
                    </ThreadToolPanel>
                  ),
                )}
              </div>
            )
          }
        >
          {/* Stand-in bubbles (the real stream needs a live session). */}
          <ul className="min-h-[14rem] space-y-2 py-2">
            {BUBBLES.map(([who, text, at]) => (
              <li key={at} className={`flex ${who === 'me' ? 'justify-end' : 'justify-start'}`}>
                <span
                  className={`max-w-[84%] rounded-2xl px-3.5 py-2 text-[15px] ${
                    who === 'me' ? 'bg-sn-accent/10 text-ink' : 'border border-ink/10 bg-white text-ink'
                  }`}
                >
                  {text}
                  <span className="mt-1 block text-[11px] text-ink/45">{at}</span>
                </span>
              </li>
            ))}
          </ul>
        </ChatBox>
      </section>
    </main>
  );
}
