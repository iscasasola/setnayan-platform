/**
 * `/dev/clients-lab?v=pick&stage=asking` — the picked client for a NEW REQUEST (owner 11 Nov, live as SetnaProd: *"Why
 * do i see it this way? The chatbox is not yet done?"* · *"Accepted it and still did not show the chatbox"*). An asking
 * Clients row now opens THIS shell (`PickedClientShell`, the menu an unbooked client has — no Payment, no Hub), on its
 * Chat page, where the request's facts + Decline · Ask a question · Accept are the chat's top band; Accept lands on the
 * same Chat page with the band gone (`&accepted=1`).
 *
 * The REAL parts — the shell, the strip (`PipelineStrip`, step 1 Inquiry), the numbers row, the hosts, the chat frame
 * (`ChatBox`), the request card (`EventLinesBody` + `InquiryAnswers`) — on fixture data. The answers post to a lab
 * stand-in that writes nothing and lands where the shipped `acceptInquiry` lands (`return_to`). DEV-ONLY: the lab page
 * 404s in production before it reaches here.
 */
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChatBox } from '@/app/_components/chat/chat-box';
import { InfoTip } from '@/app/_components/info-tip';
import { EventLinesBody, InquiryAnswers } from '@/app/vendor-dashboard/_components/event-lines';
import { PickedClientShell } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell';
import { pickedMenuFor, type PickedClientPage } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';
import { PipelineStrip } from '@/app/vendor-dashboard/clients/[eventId]/_components/customer-card-nav';
import { DetailsNumbersRow } from '@/app/vendor-dashboard/clients/[eventId]/_components/details-numbers-row';
import { detailsNumbers } from '@/app/vendor-dashboard/clients/[eventId]/_components/details-numbers';
import { HostsList } from '@/app/vendor-dashboard/clients/[eventId]/_components/hosts-list';
import { hostRows } from '@/app/vendor-dashboard/clients/[eventId]/_components/hosts-rows';
import type { EventLines } from '@/lib/supplier-event-lines';

const LAB_TODAY = '2026-11-11';
const BASE = '/dev/clients-lab?v=pick&stage=asking';
const CHAT = `${BASE}&page=chat&accepted=1`;

/** The owner's own walk: "TEST SetnaProd walk · Birthday", asking for Mobile bar + Photo Booth, asked today. */
const LINES: EventLines = {
  eventId: 'ev-walk',
  threadId: 't-walk',
  stage: 'asking',
  read: true,
  type: 'Birthday',
  celebrant: 'Ice Casasola',
  location: null,
  date: null,
  pax: null,
  hosts: [{ name: 'Ice Casasola', askedYou: true }],
  requested: [{ name: 'Mobile bar' }, { name: 'Photo Booth' }],
  alsoOffer: [],
  alsoBooked: [],
  forYou: [
    { key: 'sheet', label: 'Production sheet', line: 'Opens once they book you', href: BASE },
    { key: 'card', label: 'Their event card', line: 'Notes, files, quote and payments', href: `${BASE}&page=details` },
  ],
  firstEvent: null,
};

/** The lab's answer: writes nothing, lands where the shipped action lands — its `return_to`. */
async function labAnswer(formData: FormData): Promise<void> {
  'use server';
  if (process.env.NODE_ENV === 'production') throw new Error('clients-lab: not in production');
  const to = formData.get('return_to');
  redirect(typeof to === 'string' && to.startsWith('/dev/clients-lab') ? to : BASE);
}

function LabChat({ accepted }: { accepted: boolean }) {
  return (
    <div data-picked-client-page="chat" className="flex min-h-0 flex-1 flex-col">
      <ChatBox
        header={null}
        pinned={
          accepted ? null : (
            <div className="max-h-[40dvh] space-y-2 overflow-y-auto border-b border-ink/10 px-3 py-2 sm:px-4">
              <section data-chat-inquiry-card="" aria-label="Their ask" className="pb-2">
                <p className="home-k2 pt-1">
                  <InfoTip label="Their ask" align="start">
                    What they asked, read from their event before you answer. Accept says yes and starts a quote; Ask a
                    question says yes and opens the chat to type; Decline tells them kindly. Nothing is booked until they
                    ask to book.
                  </InfoTip>
                </p>
                <EventLinesBody lines={LINES} />
                <InquiryAnswers
                  threadId="t-walk"
                  returnTo={BASE}
                  pinned
                  chatHref={CHAT}
                  acceptInquiry={labAnswer}
                  declineInquiry={labAnswer}
                />
              </section>
            </div>
          )
        }
        composer={
          accepted ? (
            <p className="px-2 py-2 text-sm text-ink/60">Write a message…</p>
          ) : (
            <p className="px-2 py-2 text-sm text-ink">
              <span className="font-semibold">New inquiry.</span> Say yes to talk — nothing is booked yet.
            </p>
          )
        }
      >
        <div className="flex min-h-[10rem] flex-col justify-end gap-2 py-3">
          <p className="max-w-[75%] rounded-2xl bg-ink/[0.06] px-3 py-2 text-[15px] leading-snug text-ink">
            Hi! Are you free for a birthday? We&rsquo;d love a mobile bar and a photo booth.
          </p>
          {accepted ? (
            <p className="ml-auto max-w-[75%] rounded-2xl bg-sn-accent/10 px-3 py-2 text-[15px] leading-snug text-ink" data-lab-accepted="">
              You accepted · the chat is open both ways. Send them a quote when you&rsquo;re ready.
            </p>
          ) : null}
        </div>
      </ChatBox>
    </div>
  );
}

export function LabAskingPick({ page, accepted }: { page: PickedClientPage; accepted: boolean }) {
  const later = (what: string) => <p className="py-6 text-[14px] text-ink/60">{what} — not part of this lab.</p>;
  const bodies: Record<PickedClientPage, ReactNode> = {
    details: (
      <div className="space-y-4" data-details-shipped="">
        {/* Step 1 · Inquiry — the shipped strip, nothing quoted or booked yet. */}
        <div className="mt-3">
          <PipelineStrip reached={0} current={0} capAt={3} currentLabel={null} />
        </div>
        <DetailsNumbersRow
          cells={detailsNumbers({ isBooked: false, todayIso: LAB_TODAY, eventDate: null, ledger: { receivedPhp: 0, expectedPhp: 0 }, onPlan: false, sentQuotePhp: undefined, peso: (n: number) => `₱${n.toLocaleString('en-PH')}` })}
        />
        <HostsList hosts={hostRows([{ user_id: 'u1', first_name: 'Ice', name: 'Ice Casasola', role: null, label: 'Host' }])} />
        <section className="space-y-1" data-lab-stand-in="brief">
          <p className="home-k2 pb-1">Details</p>
          <p className="text-[14px] text-ink">Birthday · date not set · place not set</p>
          <p className="text-[12px] text-ink/55">(the brief — a lab stand-in for the shipped overview)</p>
        </section>
      </div>
    ),
    chat: <LabChat accepted={accepted} />,
    schedule: later('Schedule'),
    quote: later('Quotation'),
    payments: later('Payment'),
    forms: later('Forms'),
    files: later('Files'),
    hub: later('Hub'),
    report: later('Report'),
  };
  return (
    <div className="min-h-screen bg-cream" data-clients-lab="pick-asking">
      <PickedClientShell
        eventId="ev-walk"
        eventName="TEST SetnaProd walk · Birthday"
        menu={pickedMenuFor(false)}
        initialPage={page}
        bodies={bodies}
        settingsLine={{ line: 'This client only', tip: 'Lab.' }}
        settings={null}
      />
    </div>
  );
}
