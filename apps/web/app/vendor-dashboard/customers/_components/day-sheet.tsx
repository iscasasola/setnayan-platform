import Link from 'next/link';
import { BellRing, ChevronLeft, MessageSquare, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { CALENDAR_HATCH } from '@/lib/calendar-grid';
import { dayLongWords, dayTitle, nearWord, rangeWords } from '@/lib/vendor-dates';
import { formatCount } from '@/lib/format-number';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { DatesRow } from './dates-row';

/**
 * CUSTOMERS › DATES › A DAY (S-PR3; prototype frame 35 "A day"; plan § 8 gap 11: "`calendar/[date]` → Dates › day
 * sheet (35): the day's bookings, Holding this date · 2 of 5, each holder with Chat, Block this day switch, Who works
 * it ▾. URL `?seg=dates&day=2026-10-03` (redirect from the old route)").
 *
 *   ‹ Dates · "Sat, Oct 3" · "Tomorrow · Main team"
 *   the bookings (→ the customer card) · outside clients · Holding this date N · each holder with Chat ·
 *   the waiting list (Tell them) · the shop's own holds (Reopen) · Block this day (a switch) · Who works it.
 *
 * Every write is the SHIPPED action (`calendar/actions.ts`), handed in, coming back to this day (`return_date`).
 *
 * ⚠ "Who works it" IS READ, NOT PICKED. No column records who works a given day; the shop's team is assigned to
 * SERVICES (`vendor_team_service_assignments`), so the row says whose services are booked that day — a dropdown with
 * nothing to save would be a fake door.
 */

type Action = (formData: FormData) => void | Promise<void>;

export type DaySheetData = {
  day: string;
  today: string;
  /** The calendars that hold something today, in words ("Main team"). */
  calendarsLine: string;
  backHref: string;
  bookings: { key: string; title: string; line: string; href: string | null }[];
  outside: { key: string; title: string; line: string }[];
  /** Couples in an open conversation about an unbooked event on this day. */
  holders: { threadId: string; title: string; line: string }[];
  /** The holders read reached the end — else the count says "at least". */
  holdersMeasured: boolean;
  waiting: number;
  /** Closures covering the day. */
  closures: { blockId: string; label: string; startDate: string; endDate: string; scope: string }[];
  /** The shop's own hard holds / approve-first on this day (the older day controls). */
  holds: { key: string; scope: string; title: string; line: string }[];
  /** Whose services are booked today — null when nothing is. */
  whoWorks: string | null;
};

export function DaySheet({
  data,
  actions,
}: {
  data: DaySheetData;
  actions: { addManualBlock: Action; removeBlock: Action; setCalendarDayState: Action; notifyWaitlistSlot: Action };
}) {
  const { day, today } = data;
  const back = (
    <>
      <input type="hidden" name="return_to" value="dates" />
      <input type="hidden" name="return_date" value={day} />
      <input type="hidden" name="return_month" value={day.slice(0, 7)} />
    </>
  );
  const near = nearWord(today, day);
  const sub = [near, data.calendarsLine].filter(Boolean).join(' · ');
  const single = data.closures.length === 1 ? data.closures[0]! : null;
  const blockedOn = data.closures.length > 0;

  return (
    <div data-dates-day={day}>
      <Link href={data.backHref} className="sn-press -ml-1 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-ink" data-dates-day-back="">
        <ChevronLeft aria-hidden className="h-5 w-5 text-sn-accent" strokeWidth={2} />
        Dates
      </Link>
      <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink" aria-label={dayLongWords(day)}>
        {dayTitle(today, day)}
      </h2>
      {sub ? <p className="mt-1 text-[15px] text-ink/60">{sub}</p> : null}

      <div className="mt-4" data-dates-day-rows="">
        {data.bookings.map((b) => (
          <DatesRow key={b.key} data="booked" title={b.title} line={b.line} badge={{ tone: 'ok', word: 'Booked' }} href={b.href} />
        ))}
        {data.outside.map((o) => (
          <DatesRow key={o.key} data="outside" title={o.title} line={o.line} badge={{ tone: 'quiet', word: 'Outside' }} />
        ))}

        {data.holders.length > 0 ? (
          <>
            <DatesRow
              data="holding"
              title="Holding this date"
              line={data.holdersMeasured ? 'Asked · not booked' : 'Some conversations couldn’t load'}
              strong={data.holdersMeasured ? formatCount(data.holders.length) : `${formatCount(data.holders.length)}+`}
            />
            {data.holders.map((h) => (
              <DatesRow
                key={h.threadId}
                data="holder"
                title={h.title}
                line={h.line}
                end={<ActionButton tone="info" icon={<MessageSquare aria-hidden strokeWidth={1.9} />} label="Chat" href={`/vendor-dashboard/messages/${h.threadId}`} />}
              />
            ))}
          </>
        ) : null}

        {data.waiting > 0 ? (
          <DatesRow
            data="waiting"
            title="On the waiting list"
            line={`${formatCount(data.waiting)} ${data.waiting === 1 ? 'couple' : 'couples'} · for when a seat opens`}
            end={
              <form action={actions.notifyWaitlistSlot}>
                {back}
                <input type="hidden" name="requested_date" value={day} />
                <SupplierSubmit tone="neutral" icon={<BellRing aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Tell them" pendingLabel="Telling…" />
              </form>
            }
          />
        ) : null}

        {data.holds.map((h) => (
          <DatesRow
            key={h.key}
            data="hold"
            lead={<i aria-hidden className="block h-4 w-5 shrink-0 rounded-sm" style={{ backgroundImage: CALENDAR_HATCH }} />}
            title={h.title}
            line={h.line}
            end={
              <form action={actions.setCalendarDayState}>
                {back}
                <input type="hidden" name="state_date" value={day} />
                <input type="hidden" name="scope" value={h.scope} />
                <input type="hidden" name="day_state" value="open" />
                <SupplierSubmit tone="neutral" icon={<RotateCcw aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Reopen" pendingLabel="Reopening…" />
              </form>
            }
          />
        ))}

        {/* Two closures on one day: each its own row (✕ asks once). One or none: the switch (frame 35). */}
        {data.closures.length > 1
          ? data.closures.map((c) => (
              <DatesRow
                key={c.blockId}
                data="closure"
                lead={<i aria-hidden className="block h-4 w-5 shrink-0 rounded-sm" style={{ backgroundImage: CALENDAR_HATCH }} />}
                title={c.label}
                line={`${rangeWords(c.startDate, c.endDate, today)} · ${c.scope}`}
                end={
                  <ConfirmForm action={actions.removeBlock} title="Open these days again?" confirmLabel="Open them" message={`${rangeWords(c.startDate, c.endDate, today)} becomes bookable on Setnayan again.`}>
                    {back}
                    <input type="hidden" name="block_id" value={c.blockId} />
                    <SupplierSubmit tone="danger" icon={<RotateCcw aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Open" pendingLabel="Opening…" />
                  </ConfirmForm>
                }
              />
            ))
          : null}
        {data.closures.length <= 1 ? (
          <DatesRow
            data="block-switch"
            title="Block this day"
            line={single ? `${single.label} · ${rangeWords(single.startDate, single.endDate, today)}` : 'Nothing new can hold it'}
            end={
              single ? (
                <ConfirmForm
                  action={actions.removeBlock}
                  title="Open this day again?"
                  confirmLabel="Open it"
                  destructive={false}
                  message={
                    single.startDate === single.endDate
                      ? `${rangeWords(single.startDate, single.endDate, today)} becomes bookable on Setnayan again.`
                      : `This opens the whole block — ${rangeWords(single.startDate, single.endDate, today)}.`
                  }
                >
                  {back}
                  <input type="hidden" name="block_id" value={single.blockId} />
                  <button type="submit" role="switch" aria-checked="true" aria-label="Block this day" className={SWITCH_BUTTON}>
                    <SwitchTrack on />
                  </button>
                </ConfirmForm>
              ) : (
                <form action={actions.addManualBlock}>
                  {back}
                  <input type="hidden" name="scope" value="org" />
                  <input type="hidden" name="start_date" value={day} />
                  <input type="hidden" name="end_date" value={day} />
                  <button type="submit" role="switch" aria-checked={blockedOn} aria-label="Block this day" className={SWITCH_BUTTON}>
                    <SwitchTrack on={blockedOn} />
                  </button>
                </form>
              )
            }
          />
        ) : null}

        {data.whoWorks ? <DatesRow data="who" title="Who works it" line={data.whoWorks} /> : null}
      </div>
    </div>
  );
}
