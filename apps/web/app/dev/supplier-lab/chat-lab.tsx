/**
 * 💬 `?s=chat-ask` — the supplier chat on a FIRST message from a couple, with THEIR ASK at its top (supplier dashboard
 * v13, APPROVED 2026-10-29: "the inquiry card at the top of a first chat"). The REAL frame (`ChatBox`), the REAL card
 * (`EventLinesBody` + `InquiryAnswers`, the shipped `acceptInquiry` / `declineInquiry` — with no session both refuse),
 * on the prototype's own people. The rest of the thread page needs a signed-in shop; this draws only what the card adds.
 * DEV-ONLY (`/dev/supplier-lab` 404s in production).
 */
import { ChatBox } from '@/app/_components/chat/chat-box';
import { InfoTip } from '@/app/_components/info-tip';
import { EventLinesBody, InquiryAnswers } from '@/app/vendor-dashboard/_components/event-lines';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import { LAB_EVENT_LINES } from './today-easy-lab';

export function ChatAskLab() {
  const lines = LAB_EVENT_LINES.am!;
  return (
    <div className="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8" data-supplier-lab="chat-ask">
      <ChatBox
        header={<p className="px-2 text-[15px] font-semibold text-ink">Ana&rsquo;s Wedding (Dec 12)</p>}
        pinned={
          <div className="max-h-[40dvh] space-y-2 overflow-y-auto border-b border-ink/10 px-3 py-2 sm:px-4">
            <section data-chat-inquiry-card="" aria-label="Their ask" className="pb-2">
              <p className="home-k2 pt-1">
                <InfoTip label="Their ask" align="start">
                  What they asked, read from their event before you answer. Accept says yes and starts a quote; Ask a
                  question says yes and opens the chat to type; Decline tells them kindly. Nothing is booked until they ask
                  to book.
                </InfoTip>
              </p>
              <EventLinesBody lines={lines} />
              <InquiryAnswers
                threadId="t-am"
                returnTo="/dev/supplier-lab?s=chat-ask"
                pinned
                acceptTo="/dev/supplier-lab?s=chat-ask"
                acceptInquiry={acceptInquiry}
                declineInquiry={declineInquiry}
              />
            </section>
          </div>
        }
        composer={
          <p className="px-2 py-2 text-sm text-ink">
            <span className="font-semibold">New inquiry.</span> Say yes to talk — nothing is booked yet.
          </p>
        }
      >
        <div className="flex min-h-[14rem] flex-col justify-end gap-2 py-3">
          <p className="max-w-[75%] rounded-2xl bg-ink/[0.06] px-3 py-2 text-[15px] leading-snug text-ink">
            Hi! Are you free on Dec 12? We love your Tagaytay wedding. About 150 guests.
          </p>
        </div>
      </ChatBox>
    </div>
  );
}
