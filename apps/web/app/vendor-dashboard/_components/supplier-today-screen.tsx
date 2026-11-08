import type { ReactNode } from 'react';
import { TodaySettings } from './today-settings';
import { InfoTip } from '@/app/_components/info-tip';
import { BookingFeeBills } from '@/app/_components/booking-fee-notice';
import type { SupplierTodayView } from '@/lib/supplier-today-view';
import type { EventYouRun } from '@/lib/events-you-run';
import { SupplierTodayFirstScreen, type TodayOutcome } from './supplier-today-first-screen';
import { TodayCover } from './today-cover';
import { TodayStats } from './today-stats';

type Act = (formData: FormData) => void | Promise<void>;

/**
 * The shipped answers — no longer mounted by Today (THE ONE BUILD, rows jump), still the shape the supplier labs hand
 * their own answer rows (`coord-lab.tsx`). Kept as a type so those labs compile unchanged.
 */
export type TodayActions = {
  acceptInquiry: Act;
  declineInquiry: Act;
  confirmLock: Act;
  rejectLock: Act;
  agreeLock: Act;
  declineLock: Act;
  agreeDeletion: Act;
  declineDeletion: Act;
  answerDateChange: Act;
  postReviewReply: Act;
  respondMeeting: Act;
  markServiceComplete: Act;
};

/**
 * 📱 TODAY, DRAWN — THE ONE BUILD (v113): the one place the assembled view (`assembleSupplierToday`) meets the page's
 * parts. The Today page renders it with its reads; `/dev/supplier-lab?easy=…` renders it with fixtures — so the lab
 * shows exactly what ships.
 *
 * Nothing is ANSWERED here any more (owner v112 *"Jump"*): every Needs-you row is one link to the page its answer is
 * given on, so this screen takes no server actions. The two answers that lived only here (a date change, a delete
 * request) are on the client's Details (`ClientDayAnswers`, A8).
 */
export function SupplierTodayScreen({
  view,
  outcome,
  shopName,
  todayIso,
  now,
  nextEvents = null,
  thumb = null,
  library = false,
  eventsYouRun = [],
  setup = null,
}: {
  view: SupplierTodayView;
  outcome: TodayOutcome | null;
  /** `vendor_profiles.business_name` — the cover greets the SHOP (owner v112). */
  shopName: string | null;
  todayIso: string;
  now: number;
  /**
   * 📸 Next events (`<TodayNextEvents next={assembleNextEvents(…)} />`) and 🔍 the thumb row (`<TodayThumbRow />`),
   * drawn by the page and the lab: both carry the shared carousel's and thumb row's CSS modules, so they are handed in
   * and this screen stays renderable on its own (the Today guards render it).
   */
  nextEvents?: ReactNode;
  thumb?: ReactNode;
  /** 🌱🖼 Draw "Add to the inspiration library" under the Shop row (the shop's trades supply a part). */
  library?: boolean;
  /** 🗂 The events this person runs as the hosts' coordinator, live — empty for everyone else. */
  eventsYouRun?: readonly EventYouRun[];
  /** 🧰 A new shop's six steps, done in place (`SupplierSetupScreen`) — drawn by the page while the shop is not live. */
  setup?: ReactNode;
}) {
  return (
    <SupplierTodayFirstScreen
      cover={<TodayCover shopName={shopName} tasks={view.needsCount} todayIso={todayIso} now={now} gear={<TodaySettings cover />} />}
      nextEvents={nextEvents}
      stats={<TodayStats stats={view.stats} />}
      needs={view.needs}
      needsCount={view.needsCount}
      outcome={outcome}
      alsoToday={view.alsoToday}
      comingUp={view.comingUp}
      eventsYouRun={eventsYouRun}
      shop={view.shop}
      business={view.business}
      library={library}
      setup={setup}
      thumb={thumb}
      // WHAT YOU OWE SETNAYAN — every unpaid booking fee, each with its own Pay (owner 2026-09-20: "i never saw the
      // payment screen to pay us"), as rows of Needs you today, and the lock said once under them. Renders nothing
      // when there is no unpaid fee, and nothing when the read failed — an unread bill list is not "you owe nothing".
      hasBills={view.bills.length > 0}
      bills={
        <>
          <BookingFeeBills today bills={view.bills} copyFor={view.billCopy} />
          {view.lockLine ? (
            /* Said once, for every bill — one short line visible, the whole sentence in its ⓘ. */
            <p data-fee-lock-line="" className="pb-2 pl-[46px] text-[12.5px] leading-snug text-ink/60">
              <InfoTip label={view.lockWord} align="start">
                {view.lockLine}
              </InfoTip>
            </p>
          ) : null}
        </>
      }
    />
  );
}
