import Link from 'next/link';
import { BellRing, CalendarX2, ChevronLeft, Clock, MapPin, MessageSquare, QrCode, RotateCcw, Users } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { CALENDAR_HATCH } from '@/lib/calendar-grid';
import { dayLongWords, rangeWords, type DayAnswer, type DayGroup } from '@/lib/vendor-dates';
import { formatCount } from '@/lib/format-number';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { DatesRow, RowTile } from './dates-row';

/**
 * CUSTOMERS › DATES › A DAY (S-PR3, redrawn to the 2026-10-14 approved prototype `SCREENS.day`; plan § 8 gap 11).
 *
 *   ‹ Dates · "Sat, Dec 12" · "in 2 months"
 *   THE ANSWER LINE — Free · Still has room · Full · Not available (one coloured word + a few plain words)
 *   the day, schedule by schedule (a group heading with "room for 1 more" when the shop runs several): what is not
 *     available (its hours), what is booked here (→ the customer card), the bookings from outside (by time)
 *   the couples asking (Chat each) · "Holding this date · N of M" (the plan's ceiling, read live) · the waiting list
 *     (Tell them) · the shop's own holds (Reopen)
 *   Not available (a switch) · Who works it · Show a QR (the booked QR with this date filled)
 *
 * Every write is the SHIPPED action (`calendar/actions.ts`), handed in, coming back to this day (`return_date`).
 *
 * ⚠ "Who works it" IS READ, NOT PICKED. No column records who works a given day; the shop's team is assigned to
 * SERVICES (`vendor_team_service_assignments`), so the row says whose services are booked that day — a dropdown with
 * nothing to save would be a fake door.
 */

type Action = (formData: FormData) => void | Promise<void>;

export type DaySheetClosure = {
  blockId: string;
  label: string;
  startDate: string;
  endDate: string;
  scope: string;
  /** "Every Sunday" for a repeat; '' for a one-off. */
  repeatWords: string;
};

export type DaySheetData = {
  day: string;
  today: string;
  /** "in 2 months · Main schedule" — the day's distance, and the schedule on show. */
  sub: string;
  backHref: string;
  /** The day's one answer; null when the shop has no schedule (then "Not set"). */
  answer: DayAnswer | null;
  /** The day, schedule by schedule. One schedule → one group, drawn without its heading. */
  groups: DayGroup[];
  /** Couples in an open conversation about an unbooked event on this day. */
  holders: { threadId: string; title: string; line: string }[];
  /** The holders read reached the end — else the count says "at least". */
  holdersMeasured: boolean;
  /** The plan's ceiling on couples holding one date (`whitelistPerDate`, read live); null = no limit. */
  holdingCeiling: number | null;
  waiting: number;
  /** ALL-DAY closures covering the day (the switch's subject). Part-day blocks are rows in their group. */
  closures: DaySheetClosure[];
  /** The shop's own hard holds / approve-first on this day (the older day controls). */
  holds: { key: string; scope: string; title: string; line: string }[];
  /** Whose services are booked today — null when nothing is. */
  whoWorks: string | null;
  /** The booked QR with this date filled (`/vendor-dashboard/invite?mode=locked&date=`). */
  qrHref: string;
  /**
   * A VENUE'S DAY, PER HALL (owner 2026-10-14 🏛): the answer ("Hall B · Hall C free · Hall A booked"), a row per hall,
   * and "Joined halls" — each card using several halls, free or saying which hall is taken. Null for other shops.
   */
  venue?: {
    answer: { tone: 'ok' | 'bad'; word: string; line: string } | null;
    halls: { key: string; title: string; line: string; badge: { tone: 'ok' | 'quiet'; word: string }; href: string | null }[];
    joined: { key: string; title: string; line: string; free: boolean }[];
  } | null;
};

const ANSWER_TONE: Record<DayAnswer['tone'], string> = {
  ok: 'rgb(var(--color-ok))',
  warn: 'rgb(var(--color-warn))',
  bad: 'rgb(var(--color-danger))',
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
  const single = data.closures.length === 1 ? data.closures[0]! : null;
  const blockedOn = data.closures.length > 0;
  const many = data.groups.length > 1;
  const holding = data.holders.length + data.waiting;

  return (
    <div data-dates-day={day}>
      <Link href={data.backHref} className="sn-press -ml-1 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-ink" data-dates-day-back="">
        <ChevronLeft aria-hidden className="h-5 w-5 text-sn-accent" strokeWidth={2} />
        Dates
      </Link>
      <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink" aria-label={dayLongWords(day)}>
        {/* "Sunday, October 18" — the prototype's long title; the year only when it is not this one. */}
        {day.slice(0, 4) === today.slice(0, 4) ? dayLongWords(day).replace(/, \d{4}$/, '') : dayLongWords(day)}
      </h2>
      {data.sub ? <p className="mt-1 text-[14px] text-ink/60">{data.sub}</p> : null}

      {/* THE ANSWER LINE (prototype `.answer`): one coloured word, then what is true. A venue answers per hall. */}
      {data.venue?.answer ? (
        <p className="mt-2 text-[17px] leading-snug" style={{ color: ANSWER_TONE[data.venue.answer.tone] }} data-dates-day-answer={data.venue.answer.word}>
          <b className="font-semibold">{data.venue.answer.word}</b> · {data.venue.answer.line}
        </p>
      ) : data.answer ? (
        <p className="mt-2 text-[17px] leading-snug" style={{ color: ANSWER_TONE[data.answer.tone] }} data-dates-day-answer={data.answer.word}>
          <b className="font-semibold">{data.answer.word}</b> · {data.answer.line}
        </p>
      ) : (
        <p className="mt-2 text-[15px] text-ink/70" data-dates-day-answer="not-set">
          Schedule not set — open How many a day on Dates to make one.
        </p>
      )}

      <div className="mt-3" data-dates-day-rows="">
        {data.venue ? (
          <div data-dates-day-halls="">
            {data.venue.halls.map((h) => (
              <DatesRow key={h.key} data="hall" lead={<RowTile><MapPin strokeWidth={1.75} /></RowTile>} title={h.title} line={h.line} badge={h.badge} href={h.href} />
            ))}
            {data.venue.joined.length > 0 ? (
              <>
                <p className="border-t border-ink/10 pb-0.5 pt-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/55" data-dates-day-joined="">
                  Joined halls
                </p>
                {data.venue.joined.map((j) => (
                  <DatesRow
                    key={j.key}
                    data="joined"
                    lead={<RowTile><MapPin strokeWidth={1.75} /></RowTile>}
                    title={j.title}
                    line={j.line}
                    badge={j.free ? { tone: 'ok', word: 'Free' } : { tone: 'quiet', word: 'Not available' }}
                  />
                ))}
              </>
            ) : null}
          </div>
        ) : null}
        {(data.venue ? [] : data.groups).map((g) => (
          <div key={g.poolId} data-dates-day-group={g.poolId}>
            {many ? (
              <p className="flex items-center gap-2 border-t border-ink/10 pb-0.5 pt-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/55 first:border-t-0">
                <span className="min-w-0 flex-1 truncate">{g.label}</span>
                <span className="text-[13px] font-medium normal-case tracking-normal" style={{ color: ANSWER_TONE[g.right.tone === 'warn' ? 'warn' : g.right.tone] }}>
                  {g.right.word}
                </span>
              </p>
            ) : null}
            {g.rows.map((r) => (
              <DatesRow
                key={r.key}
                data={r.kind}
                title={r.title}
                line={r.line || undefined}
                badge={r.badge}
                href={r.href ?? null}
                lead={r.kind === 'blocked' ? <RowTile><CalendarX2 strokeWidth={1.75} /></RowTile> : r.kind === 'outside' ? <RowTile><Users strokeWidth={1.75} /></RowTile> : undefined}
              />
            ))}
          </div>
        ))}

        {data.holders.map((h) => (
          <DatesRow
            key={h.threadId}
            data="holder"
            title={`${h.title} asking`}
            line={h.line}
            badge={{ tone: 'wait', word: 'Asking' }}
            end={<ActionButton tone="info" icon={<MessageSquare aria-hidden strokeWidth={1.9} />} label="Chat" href={`/vendor-dashboard/messages/${h.threadId}`} />}
          />
        ))}

        {holding > 0 ? (
          <DatesRow
            data="holding"
            lead={<RowTile><Clock strokeWidth={1.75} /></RowTile>}
            title="Holding this date"
            line={
              data.holdersMeasured
                ? data.holdingCeiling === null
                  ? `${formatCount(holding)} · no limit on your plan`
                  : `${formatCount(holding)} of ${formatCount(data.holdingCeiling)} · your plan’s ceiling`
                : 'Some conversations couldn’t load'
            }
            strong={data.holdersMeasured ? formatCount(holding) : `${formatCount(holding)}+`}
          />
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
      </div>

      <div className="mt-5 border-t border-ink/10" data-dates-day-tools="">
        {/* Two all-day closures on one day: each its own row (Open asks once). One or none: the switch. */}
        {data.closures.length > 1
          ? data.closures.map((c) => (
              <DatesRow
                key={c.blockId}
                data="closure"
                lead={<i aria-hidden className="block h-4 w-5 shrink-0 rounded-sm" style={{ backgroundImage: CALENDAR_HATCH }} />}
                title={c.label}
                line={`${c.repeatWords || rangeWords(c.startDate, c.endDate, today)} · ${c.scope}`}
                end={
                  <ConfirmForm action={actions.removeBlock} title="Open these days again?" confirmLabel="Open them" message={openMessage(c, today)}>
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
            lead={<RowTile><CalendarX2 strokeWidth={1.75} /></RowTile>}
            title="Not available"
            line={single ? `${single.label} · ${single.repeatWords || rangeWords(single.startDate, single.endDate, today)}` : 'Nothing new can take it'}
            end={
              single ? (
                <ConfirmForm action={actions.removeBlock} title="Open this day again?" confirmLabel="Open it" destructive={false} message={openMessage(single, today)}>
                  {back}
                  <input type="hidden" name="block_id" value={single.blockId} />
                  <button type="submit" role="switch" aria-checked="true" aria-label="Not available" className={SWITCH_BUTTON}>
                    <SwitchTrack on />
                  </button>
                </ConfirmForm>
              ) : (
                <form action={actions.addManualBlock}>
                  {back}
                  <input type="hidden" name="scope" value="org" />
                  <input type="hidden" name="start_date" value={day} />
                  <input type="hidden" name="end_date" value={day} />
                  <button type="submit" role="switch" aria-checked={blockedOn} aria-label="Not available" className={SWITCH_BUTTON}>
                    <SwitchTrack on={blockedOn} />
                  </button>
                </form>
              )
            }
          />
        ) : null}

        {data.whoWorks ? <DatesRow data="who" title="Who works it" line={data.whoWorks} badge={{ tone: 'quiet', word: 'Team' }} /> : null}

        <DatesRow
          data="qr"
          lead={<RowTile><QrCode strokeWidth={1.75} /></RowTile>}
          title="Show a QR"
          line="Booked here · this date"
          href={data.qrHref}
        />
      </div>
    </div>
  );
}

/** What opening a closure opens — the one day, the whole range, or every day a repeat covers. */
function openMessage(c: DaySheetClosure, today: string): string {
  if (c.repeatWords) return `This removes “${c.repeatWords}” — every one of those days opens again.`;
  if (c.startDate === c.endDate) return `${rangeWords(c.startDate, c.endDate, today)} becomes bookable on Setnayan again.`;
  return `This opens the whole block — ${rangeWords(c.startDate, c.endDate, today)}.`;
}
