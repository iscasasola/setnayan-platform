import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Wallet } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { RowIcon, TodayEyebrow, TodayNoteRow, TodayRow, nextHref } from './supplier-today-first-screen';
import {
  ContractDraftBody,
  DateChangeBody,
  DeleteRequestBody,
  DisputeBody,
  InquiryBody,
  LockBody,
  LockRequestBody,
  LockRequestLapsedBody,
  MarkCompleteBody,
  MeetingBody,
  MessageBody,
  QuoteDraftBody,
  ReviewBody,
} from './overview-sections';
import { TodayAsideButton, TodayQuickGroup, TodayQuickRow, TodayTomorrowLink } from './today-v2-client';
import { PUT_OFF_WORDS } from '@/lib/today-put-off';
import { THIS_WEEK_HREF } from '@/lib/supplier-today-v2';
import { wrapUpApplies, type WrapUpFacts } from '@/lib/today-wrap-up';
import { TodayWrapUpBody } from './today-wrap-up';
import { formatCount } from '@/lib/format-number';
import {
  BILLS_UNREAD_LINE,
  DONE_UNREAD_LINE,
  EVENTS_UNREAD_LINE,
  RECOMMENDED_TAG,
  eventRowWords,
  feeRowLine,
  type DoneTodayRow,
  type GrowStage,
  type TodayBadgeTag,
  type TodayEventDay,
  type TodayListEntry,
  type TodaySplit,
  type TodayTaskRow,
  type TodayUrgency,
  type TrendLine,
} from '@/lib/supplier-today-v2';
import { shortDay, type TodayNeed } from '@/lib/supplier-today';
import { vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';

import type { WhatsNewCard } from '@/lib/vendor-overview';
import { feeIntroducedLine, type DueFeeBill, type FeeDisclosure } from '@/lib/booking-fee-disclosure';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { postVendorReply } from '../reviews/actions';
import {
  vendorAcknowledgeDeposit,
  vendorAgreeToDeletion,
  vendorAgreeToLock,
  vendorAnswerDateChange,
  vendorDeclineDeletion,
  vendorDeclineLock,
  vendorMarkServiceComplete,
  vendorRejectDeposit,
} from '../clients/[eventId]/actions';
import { respondAppointment } from '@/app/_components/appointments-actions';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';

/**
 * 📋 TODAY v2 — "ONE TASK" (owner 18 Nov 2026: *"keep focus on one task … when i log in, ill just finish all that is
 * here and i am good for the day"*; drawing `Today, one task` v2, artifact F4vQbaCwFtu2iawYd2r6q2, "all picks").
 *
 * The parts the drawing adds under the shipped cover, each a server component fed by the page's reads:
 *   · Needs you today — QUICK rows first (answered on the row with the shipped forms, one open at a time), then the
 *     rows that OPEN A SCREEN (one focused screen that rises over Today — the shipped `SupplierOpenRow` rise — never the
 *     whole editor; ✕ returns with the task still listed). Every row names the badge it moves, or "Your page";
 *   · Done today (ticked) · "You're done for today";
 *   · Grow your business (five stages, one at a time) · Also for your badges and your page (not counted) · What's
 *     trending.
 * The answers are the SHIPPED actions — nothing here writes anything new.
 * 🔒 app/vendor-dashboard/_components/today-is-one-task.test.ts
 */

const ico = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

/** The small tag under a row: the badge it moves, or "Your page" (drawing `.bg`). */
export function TodayBadgeTagChip({ tag, aside = false }: { tag: TodayBadgeTag | null; aside?: boolean }) {
  if (!tag) return null;
  return (
    <span
      data-today-badge-tag={tag.page ? 'page' : 'badge'}
      title={`→ ${tag.word}`}
      // In a row's right-hand slot the chip is capped, so a long badge name never squeezes the task onto three lines.
      className={`${aside ? 'block max-w-[8.5rem]' : 'mt-1 inline-flex max-w-full'} items-center truncate rounded-full px-2 py-1 text-[11px] font-bold leading-none`}
      style={
        tag.page
          ? { background: 'color-mix(in srgb, rgb(var(--color-info, 45 90 146)) 12%, transparent)', color: 'rgb(var(--color-info, 45 90 146))' }
          : { background: 'color-mix(in srgb, rgb(var(--color-gild)) 18%, transparent)', color: 'rgb(var(--color-ink))' }
      }
    >
      → {tag.word}
    </span>
  );
}

function RowHead({ label, line, tag, warn }: { label: string; line: string; tag: TodayBadgeTag | null; warn?: boolean }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[15px] leading-tight text-ink">{label}</span>
      {line ? <span className={`block truncate text-[13px] ${warn ? 'text-[rgb(var(--color-warn))]' : 'text-[color:var(--m-slate-2)]'}`}>{line}</span> : null}
      <TodayBadgeTagChip tag={tag} />
    </span>
  );
}

export type TodayV2Answers = {
  payoutReadiness: PayoutReadiness;
  /** What agreeing to each booking ask costs, keyed by `event_vendors.vendor_id` (`forecastForBooking`), read before Agree. */
  feeForecasts: Record<string, FeeDisclosure | null>;
  /** ✓ v3 part 3 — each finished event's wrap-up facts, keyed by its desk card id; null/absent = unread → v2's quick row. */
  wrapUps?: Record<string, WrapUpFacts | null>;
};

/** The shipped form for a QUICK kind — the same one the desk's row opened to before 8 Nov. */
function QuickBody({ card, a }: { card: WhatsNewCard; a: TodayV2Answers }) {
  switch (card.kind) {
    case 'review':
      return <ReviewBody card={card} postReviewReply={postVendorReply} />;
    case 'lock':
      return <LockBody card={card} confirmLock={vendorAcknowledgeDeposit} rejectLock={vendorRejectDeposit} />;
    case 'date_change':
      return <DateChangeBody card={card} answerDateChange={vendorAnswerDateChange} />;
    case 'mark_complete': {
      // ✓ The wrap-up card when the event has photos or reviews to check; otherwise v2's quick "I delivered" row.
      const w = a.wrapUps?.[card.id] ?? null;
      return w && wrapUpApplies(w) ? <TodayWrapUpBody facts={w} /> : <MarkCompleteBody card={card} markServiceComplete={vendorMarkServiceComplete} />;
    }
    case 'meeting':
      return <MeetingBody card={card} respondMeeting={respondAppointment} />;
    default:
      return null;
  }
}

/** The ONE focused screen for a bigger kind — the shipped body, alone, risen over Today. */
function ScreenBody({ card, a, todayIso, onDesk }: { card: WhatsNewCard; a: TodayV2Answers; todayIso: string; onDesk: readonly string[] }) {
  switch (card.kind) {
    case 'inquiry':
      return <InquiryBody card={card} acceptInquiry={acceptInquiry} declineInquiry={declineInquiry} />;
    case 'message':
      return <MessageBody card={card} />;
    case 'lock_request':
      return (
        <LockRequestBody
          card={card}
          agreeLock={vendorAgreeToLock}
          declineLock={vendorDeclineLock}
          payoutReadiness={a.payoutReadiness}
          feeForecast={a.feeForecasts[card.eventVendorId] ?? null}
        />
      );
    case 'delete_request':
      return <DeleteRequestBody card={card} agreeDeletion={vendorAgreeToDeletion} declineDeletion={vendorDeclineDeletion} />;
    case 'quote_draft':
      return <QuoteDraftBody card={card} />;
    case 'contract_draft':
      return <ContractDraftBody card={card} />;
    case 'lock_request_lapsed':
      return (
        <>
          <LockRequestLapsedBody card={card} />
          <div className="mt-3">
            <TodayAsideButton rowKey={card.id} how="gotIt" label="Got it" onDesk={onDesk} todayIso={todayIso} />
          </div>
        </>
      );
    case 'dispute':
      return <DisputeBody card={card} />;
    default:
      return null;
  }
}

/**
 * The open card's small links (drawing V3 · 0): "Open in page ›" — the same place as a drag right — and, beside it,
 * "Do it tomorrow" — the same as a drag left — except on a red card (ruled 19 Nov: the links stay, for people who do
 * not swipe).
 */
function CardFoot({ href, rowKey, level }: { href: string; rowKey: string; level: 'red' | 'amber' | null }) {
  return (
    <>
      <a href={href} data-today-open-in-page="" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent">
        Open in page ›
      </a>
      <TodayTomorrowLink rowKey={rowKey} level={level} />
    </>
  );
}

/**
 * 📋 ONE LIST (Today v3 part 1, owner 19 Nov "all recommended"): every task is the SAME row — a tap opens it in place as
 * a card and it is answered there with the shipped form (`QuickBody` for the short kinds, `ScreenBody` for the rest —
 * no row rises as a second screen any more). A row with no desk card behind it stays a link to its page.
 */
function TaskRow({ r, a, todayIso, onDesk }: { r: TodayTaskRow; a: TodayV2Answers; todayIso: string; onDesk: readonly string[] }) {
  return r.card ? (
    <TodayQuickRow
      rowKey={r.key}
      title={r.label}
      line={r.urgency ? `${r.urgency.word} · ${r.line}` : r.line}
      lead={<RowIcon name={r.icon} />}
      urgency={r.urgency?.level ?? null}
      href={nextHref(r.target)}
      foot={<CardFoot href={nextHref(r.target)} rowKey={r.key} level={r.urgency?.level ?? null} />}
      aside={r.pill ? <Badge tone={r.pill.tone} data="today-need">{r.pill.word}</Badge> : null}
      below={r.tag ? <TodayBadgeTagChip tag={r.tag} /> : null}
    >
      <div data-today-task-kind={r.card.kind}>
        {r.mode === 'quick' ? <QuickBody card={r.card} a={a} /> : <ScreenBody card={r.card} a={a} todayIso={todayIso} onDesk={onDesk} />}
      </div>
    </TodayQuickRow>
  ) : (
    <div className="border-t border-ink/10 first:border-t-0">
      <TodayRow href={nextHref(r.target)} label={r.label} line={r.line} rowIcon={r.icon} marker={r.key} />
    </div>
  );
}

/**
 * 💸 ONE FEE BILL, ITS OWN ROW (drawing V3 · 3 "₱ Booking fee · Cruz · Overdue · since Sat 14 Nov"): its own level —
 * tint, edge and word — and its own place in the list. Tapped, it opens as a card holding the amount and how to pay,
 * with Pay (the bill's page, where the proof is sent) and "Open in page ›" (drawing V3 · 2 "Booking fee bill").
 * Still a `data-fee-bill-today` row inside `data-today-need-bills`, so Today's search finds it as a payment.
 */
function BillRow({ bill, urgency, copy, todayIso, lockLine }: { bill: DueFeeBill; urgency: TodayUrgency; copy: FeeDisclosure; todayIso: string; lockLine: string | null }) {
  const introduced = feeIntroducedLine(bill);
  const pay = vendorBookingFeePayPath(bill.orderId);
  return (
    <div data-today-need-bills="" data-today-need-kind="payments" className="contents">
      <TodayQuickRow
        rowKey={`fee-${bill.orderId}`}
        title={copy.headline}
        line={`${urgency.word} · ${feeRowLine(bill, todayIso, copy.detail)}`}
        lead={<RowIcon name="peso" />}
        urgency={urgency.level}
        attrs={{ 'data-fee-bill-today': '', 'data-testid': 'booking-fee-bill' }}
        href={pay}
      foot={<CardFoot href={pay} rowKey={`fee-${bill.orderId}`} level={urgency.level} />}
        aside={null}
      >
        <div data-today-task-kind="fee">
          <b className="block text-[15px] font-bold text-ink">{copy.detail}</b>
          {introduced ? <span className="block text-[13px] text-[color:var(--m-slate-2)]" data-fee-introduced="">{introduced}</span> : null}
          {lockLine ? <span className="mt-1 block text-[13px] text-[color:var(--m-slate-2)]">{lockLine}</span> : null}
          <div className="mt-2">
            <ActionButton tone="brand" icon={<Wallet {...ico} />} label={copy.payLabel ?? 'Pay'} name={`${copy.payLabel ?? 'Pay'} — ${copy.headline}`} href={pay} className="min-h-11" />
          </div>
        </div>
      </TodayQuickRow>
    </div>
  );
}

/** 📄 The business permit, when it wears a level (drawing V3 · 2 "What is due · Upload" → your documents). */
function PermitRow({ need, urgency }: { need: TodayNeed; urgency: TodayUrgency }) {
  const href = nextHref(need.target);
  return (
    <TodayQuickRow
      rowKey={need.key}
      title={need.label}
      line={`${urgency.word} · ${need.line}`}
      lead={<RowIcon name={need.icon} />}
      urgency={urgency.level}
      attrs={{ 'data-today-permit': '' }}
      href={href}
      foot={<CardFoot href={href} rowKey={need.key} level={urgency.level} />}
      aside={null}
      below={<TodayBadgeTagChip tag={RECOMMENDED_TAG.renewal ?? null} />}
    >
      <div data-today-task-kind="permit">
        <span className="block text-[14px] text-ink">{need.line}</span>
        <div className="mt-2">
          <ActionButton tone="brand" icon={<ChevronRight {...ico} />} label="Upload" href={href} className="min-h-11" />
        </div>
      </div>
    </TodayQuickRow>
  );
}

/** 📅 A booked event today or tomorrow (drawing V3 · 2 "The day’s line — nothing to answer"; its link is its one action). */
function EventRow({ event, urgency }: { event: TodayEventDay; urgency: TodayUrgency }) {
  const w = eventRowWords(event);
  return (
    <TodayQuickRow
      rowKey={`event-${event.id}`}
      title={w.label}
      line={`${urgency.word} · ${w.line}`}
      lead={<RowIcon name="calendar" />}
      urgency={urgency.level}
      attrs={{ 'data-today-event-day': event.id }}
      href={event.href}
      foot={<CardFoot href={event.href} rowKey={`event-${event.id}`} level={urgency.level} />}
      aside={null}
    >
      <div data-today-task-kind="event">
        <span className="block text-[14px] text-ink">{[shortDay(event.date), event.place].filter(Boolean).join(' · ')}</span>
      </div>
    </TodayQuickRow>
  );
}

/**
 * 📋 NEEDS YOU TODAY, v3 — the rows only (the pinned heading and its count stay the shipped first screen's).
 */
export function TodayV2Needs({
  split,
  list,
  tomorrowMore = [],
  thisWeek = null,
  billCopy,
  lockLine = null,
  answers,
  todayIso,
  onDesk,
  billsUnread = false,
  eventsUnread = false,
  doneUnread = false,
  done,
  allDone,
}: {
  /** 📅 "This week: N events" — one line that opens the calendar (`thisWeekLine`); null = none or not set. */
  thisWeek?: { label: string; count: number } | null;
  /** ⏭ v3 part 2 — the bills, permit and events put off with "Do it tomorrow" (`holdOffEntries`). */
  tomorrowMore?: ReadonlyArray<{ key: string; label: string; icon: Parameters<typeof RowIcon>[0]['name'] }>;
  split: TodaySplit;
  /** v3: the ONE list, already in its order (`todayOneList`) — tasks, each fee bill, the permit, today's events. */
  list: ReadonlyArray<TodayListEntry<DueFeeBill>>;
  /** Each bill's words (`feeRowCopy`). */
  billCopy: (b: DueFeeBill) => FeeDisclosure;
  /** The gate's own sentence (`feeLockLine`), said inside each open bill card. */
  lockLine?: string | null;
  answers: TodayV2Answers;
  todayIso: string;
  /** Every desk row key (for the "Got it" cookie to forget rows that left the desk). */
  onDesk: readonly string[];
  /** The fee bills could not be read: said on the list, and Today is never "done". */
  billsUnread?: boolean;
  /** The booked events could not be read: said on the list (an event today may be missing), and Today is never "done". */
  eventsUnread?: boolean;
  /** Today's finished count could not be read: said, never drawn as nothing done. */
  doneUnread?: boolean;
  done: readonly DoneTodayRow[];
  allDone: boolean;
}) {
  return (
    <>
      {/* ONE LIST, MOST URGENT FIRST — red, then amber, then the rest (`todayOneList`); no Quick / Longer groups, one
          count (the pinned heading's). Each fee bill, the permit and today's events are rows of their own, each at its
          own level. */}
      {list.length > 0 ? (
        <div data-today-one-list="" id="today-quick">
          <TodayQuickGroup rows={list.map((e) => ({ key: e.key, kind: e.type === 'task' ? (e.row.card?.kind ?? 'other') : e.type }))}>
            {list.map((e) =>
              e.type === 'task' ? (
                <TaskRow key={e.key} r={e.row} a={answers} todayIso={todayIso} onDesk={onDesk} />
              ) : e.type === 'bill' ? (
                <BillRow key={e.key} bill={e.bill} urgency={e.urgency} copy={billCopy(e.bill)} todayIso={todayIso} lockLine={lockLine} />
              ) : e.type === 'permit' ? (
                <PermitRow key={e.key} need={e.need} urgency={e.urgency} />
              ) : (
                <EventRow key={e.key} event={e.event} urgency={e.urgency} />
              ),
            )}
          </TodayQuickGroup>
        </div>
      ) : null}
      {/* 📅 THIS WEEK (DECISION_LOG 2026-11-20 item 3): the events beyond tomorrow, one line, opens the calendar. */}
      {thisWeek ? (
        <div data-today-this-week={thisWeek.count} className="border-t border-ink/10">
          <TodayRow href={THIS_WEEK_HREF} label={thisWeek.label} line="Open your calendar" rowIcon="calendar" marker="this-week" />
        </div>
      ) : null}
      {/* ⏭ TOMORROW (v3 part 2, drawing V3 · 2 frame D): what was put off — not counted today, back by itself tomorrow. */}
      {split.tomorrow.length + tomorrowMore.length > 0 ? (
        <div data-today-tomorrow="">
          <TodayEyebrow>
            {PUT_OFF_WORDS.heading} {formatCount(split.tomorrow.length + tomorrowMore.length)}
          </TodayEyebrow>
          {[...split.tomorrow, ...tomorrowMore].map((r) => (
            <TodayNoteRow key={r.key} label={r.label} line={PUT_OFF_WORDS.back} rowIcon={r.icon} marker={`tomorrow-${r.key}`} />
          ))}
        </div>
      ) : null}
      {split.unread ? (
        <TodayRow href={nextHref(split.unread.target)} label={split.unread.label} line={split.unread.line} lineTone="danger" rowIcon={split.unread.icon} marker="unread" />
      ) : null}
      {eventsUnread ? <TodayNoteRow label={EVENTS_UNREAD_LINE} line="Nothing was lost · try again in a moment" rowIcon="help" marker="events-unread" /> : null}
      {billsUnread ? <TodayNoteRow label={BILLS_UNREAD_LINE} line="Nothing was lost · try again in a moment" rowIcon="help" marker="bills-unread" /> : null}
      {allDone ? (
        <div data-today-all-done="" role="status" className="py-6 text-center">
          <span aria-hidden className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full text-[30px] font-extrabold" style={{ background: 'color-mix(in srgb, rgb(var(--color-ok)) 14%, transparent)', color: 'rgb(var(--color-ok))' }}>
            ✓
          </span>
          {/* Said once (final check B5-27): the cover's heading already reads "✓ You’re done for today". */}
          <span className="mt-1 block text-[14px] text-[color:var(--m-slate-2)]">Nothing waiting on you. New asks land here first.</span>
        </div>
      ) : null}
      {done.length > 0 || doneUnread ? (
        <div data-today-done="">
          <TodayEyebrow>Done today</TodayEyebrow>
          {doneUnread ? <TodayNoteRow label={DONE_UNREAD_LINE} line="Nothing was lost · your answers were saved" rowIcon="help" marker="done-unread" /> : null}
          {done.map((d) => (
            <TodayNoteRow key={d.key} label={d.label} line={d.line} rowIcon="check" marker={d.key} />
          ))}
        </div>
      ) : null}
    </>
  );
}

/** 🏅 The Next badge card — the Completed bookings tile's own goal, its real art with a small lock (drawing `.nbg`). */
export function TodayNextBadge({ tile }: { tile: { src: string | null; title: string; toGo: string; locked: boolean; how: string } | null }) {
  if (!tile) return null;
  return (
    <div data-today-next-badge="" className="my-3 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-[var(--sn-frame-radius)] bg-frame p-3 shadow-sn-frame">
      <span className="relative block h-[61px] w-16">
        {tile.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tile.src} alt="" width={64} height={61} className="block h-[61px] w-16" />
        ) : null}
        {tile.locked ? (
          <i aria-hidden className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-white text-[11px] not-italic shadow">
            🔒
          </i>
        ) : null}
      </span>
      <span className="min-w-0">
        <b className="block text-[15px] font-bold leading-tight text-ink">{tile.title}</b>
        <span className="block text-[13px] text-[color:var(--m-slate-2)]">
          <span className="font-extrabold text-sn-accent">{tile.toGo}</span> · Completed bookings
        </span>
        <span className="block text-[13px]">
          <InfoTip label="What counts" align="start">
            {tile.how}
          </InfoTip>
        </span>
      </span>
    </div>
  );
}

/** One recommended / grow / trending row: one line why, one button (drawing `.rec`). */
function RecRow({ icon, label, line, tag, button, href, end }: { icon: Parameters<typeof RowIcon>[0]['name']; label: string; line: string; tag: TodayBadgeTag | null | undefined; button: string; href: string; end?: ReactNode }) {
  return (
    // Two buttons ("Not now" + the move) sit on their own line under the words, so the task stays readable at 390.
    <div className={`grid min-h-16 items-center gap-x-3 gap-y-2 border-t border-ink/10 py-2.5 first:border-t-0 ${end ? 'grid-cols-[36px_minmax(0,1fr)]' : 'grid-cols-[36px_minmax(0,1fr)_auto]'}`}>
      <RowIcon name={icon} />
      <RowHead label={label} line={line} tag={tag ?? null} />
      <span className={`flex items-center gap-2 ${end ? 'col-start-2 justify-end' : ''}`}>
        {end}
        <ActionButton tone="brand" icon={<ChevronRight {...ico} />} label={button} href={href} className="min-h-11" />
      </span>
    </div>
  );
}

/** 🌱 Grow your business — the shop's stage and its next moves. Not counted toward "done for today" (pick 2). */
export function TodayGrow({ stage }: { stage: GrowStage | null }) {
  if (!stage || stage.moves.length === 0) return null;
  return (
    <div data-today-grow={stage.n}>
      <TodayEyebrow>Grow your business</TodayEyebrow>
      <div className="rounded-[var(--sn-frame-radius)] bg-frame px-3.5 pb-1 pt-3 shadow-sn-frame">
        <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--m-slate-2)]">Stage {stage.n} of 5</span>
        <b className="block text-[16px] font-extrabold leading-tight text-ink">{stage.title}</b>
        <span aria-hidden className="my-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <i
              key={n}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: n < stage.n ? 'rgb(var(--color-ok))' : n === stage.n ? 'rgb(var(--sn-accent-rgb, 194 78 37))' : 'rgb(var(--color-ink) / 0.08)' }}
            />
          ))}
        </span>
        {stage.why ? <p className="m-0 text-[13px] text-[color:var(--m-slate-2)]">{stage.why}</p> : null}
        {stage.moves.map((m) => (
          <RecRow key={m.key} icon={m.icon} label={m.label} line={m.line} tag={m.tag} button={m.button} href={m.href} />
        ))}
        <p className="py-1 text-[13px]">
          <InfoTip label="How the stages work" align="start">
            Five fixed stages. Today shows the first one your shop has not met yet, and its next moves. It can move back, for
            example when inquiries dip.
          </InfoTip>
        </p>
      </div>
    </div>
  );
}

/** "Also for your badges and your page" — the shop's own gaps, each from a real signal. Never counted. */
export function TodayRecommended({
  rows,
  todayIso,
  onDesk,
}: {
  rows: ReadonlyArray<{ key: string; label: string; line: string; icon: Parameters<typeof RowIcon>[0]['name']; tag: TodayBadgeTag | null; href: string; button: string; notNow: boolean }>;
  todayIso: string;
  onDesk: readonly string[];
}) {
  if (rows.length === 0) return null;
  return (
    <div data-today-recommended="">
      <TodayEyebrow>Also for your badges and your page</TodayEyebrow>
      {rows.map((r) => (
        <RecRow
          key={r.key}
          icon={r.icon}
          label={r.label}
          line={r.line}
          tag={r.tag}
          button={r.button}
          href={r.href}
          // ⏭ v3: a credit or gift row is a task — its "Not now" is "Do it tomorrow" (it lapses at Manila midnight, so it IS
          // back tomorrow). The shop's own room-to-grow rows are not tasks and keep "Not now".
          end={r.notNow ? <TodayAsideButton rowKey={r.key} how="notNow" label={r.key === 'door-credit' || r.key === 'door-gift' ? PUT_OFF_WORDS.link : 'Not now'} onDesk={onDesk} todayIso={todayIso} /> : null}
        />
      ))}
      <p className="py-1 text-[13px]">
        <InfoTip label="Why these" align="start">
          Each one is something Today already knows about your shop, and each says the badge it moves or that it improves
          your page. Not counted in “tasks today”.
        </InfoTip>
      </p>
    </div>
  );
}

/** 🔥 What's trending — two or three short lines from the demand radar and your card badges. Hidden when quiet. */
export function TodayTrending({ lines }: { lines: readonly TrendLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div data-today-trending="">
      <TodayEyebrow>What’s trending</TodayEyebrow>
      <div className="rounded-[var(--sn-frame-radius)] bg-frame px-3.5 py-1 shadow-sn-frame">
        {lines.map((t) => (
          <div key={t.key} className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-ink/10 py-2.5 first:border-t-0">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-ink/[0.05] text-[15px]">
              {t.emoji}
            </span>
            <RowHead label={t.label} line={t.line} tag={t.tag ?? null} />
            <span className="col-start-2">
              <Link href={t.href} className="inline-flex min-h-11 items-center rounded-full bg-ink/[0.06] px-4 text-[13px] font-bold text-ink">
                {t.button}
              </Link>
            </span>
          </div>
        ))}
        <p className="py-1 text-[13px]">
          <InfoTip label="Where this comes from" align="start">
            Your market’s demand radar and your own card badges. Counts only — never a couple’s name. A quiet market shows
            nothing here.
          </InfoTip>
        </p>
      </div>
    </div>
  );
}

/** The cover's line: "6 tasks today · 1 of 7 done", or "✓ You're done for today" — and the pips, done ones first. */
export function TodayV2Sub({ tasks, progress, allDone, left, pips }: { tasks: string | null; progress: string | null; allDone: boolean; left: number | null; pips: { done: number; total: number } | null }) {
  if (left === null) return null;
  // No pips when a part was unread: a row of pips is a claim about how much is done.
  const total = pips?.total ?? 0;
  const doneCount = pips?.done ?? 0;
  return (
    <span className="block" data-today-v2-sub="">
      <b className="font-semibold" data-today-tasks-chip="">
        {allDone ? '✓ You’re done for today' : tasks}
        {progress ? <span data-today-progress=""> · {progress}</span> : null}
      </b>
      {total > 0 && total <= 24 ? (
        <span aria-hidden className="mt-2 flex gap-1" data-today-pips="">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < doneCount ? 'rgb(var(--color-ok))' : 'color-mix(in srgb, currentColor 16%, transparent)' }} />
          ))}
        </span>
      ) : null}
    </span>
  );
}
