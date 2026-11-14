'use client';

/**
 * THE DAY, BEFORE YOU ACCEPT — the one line under the booking ask, and the day it opens (owner 2026-11-04; approved
 * prototype "Supplier Four-Tab Dashboard" › Customers › an asking event › the chat › `dayck` + `daySheet`).
 *
 *   📅 Dec 19 · 0 of 4 booked · 1 shortlisted                 ›     (open day)
 *   📅 Full on Feb 14 · Lopez & Pineda booked · you take 1 a day ›   (red — Accept becomes "Waiting list")
 *
 * Tap → the sheet for that date: each card's limit ("Whole day · 2 a day" / "By time slot · 1 per slot · 3 slots") and
 * "x of N booked" or Full; on a full day one short line; then Booked that day · Also asking for that day (tap → that
 * chat) · Shortlisted you for that day (ⓘ).
 *
 * Every number comes from `vendor_day_check` — the yes's own rule (`lib/day-check.ts`). This file decides nothing.
 * A failed read is said ("Couldn't check this day") and is not pressable: there is no day to open.
 */
import { useId, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, TriangleAlert } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import {
  DAY_CHECK_FAILED,
  DAY_CHECK_FULL_LEAD,
  DAY_CHECK_NO_DATE,
  cardDayWords,
  cardLimitWords,
  dayCheckLine,
  shortDayWords,
  type DayCheck,
  type DayCheckRead,
} from '@/lib/day-check';
import { dayLongWords } from '@/lib/vendor-dates';

const ico = { 'aria-hidden': true, strokeWidth: 1.9 } as const;
const TONE: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'bg-ink/[0.05] text-ink',
  warn: 'bg-ink/[0.05] text-ink',
  bad: 'bg-danger-500/10 text-danger-900 dark:text-danger-100',
};

export function DayCheckLine({
  read,
}: {
  read: (DayCheckRead & { halls?: { taken: string[]; free: string[] } | null }) | null;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  if (!read) return null;

  if (read.kind !== 'ok') {
    return (
      <p
        className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] ${read.kind === 'failed' ? 'text-warn-900 dark:text-warn-100' : 'text-ink/70'}`}
        data-day-check={read.kind}
        role={read.kind === 'failed' ? 'status' : undefined}
      >
        {read.kind === 'failed' ? <TriangleAlert {...ico} className="mt-0.5 h-4 w-4 shrink-0" /> : <CalendarDays {...ico} className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>{read.kind === 'failed' ? DAY_CHECK_FAILED : DAY_CHECK_NO_DATE}</span>
      </p>
    );
  }

  const { check, halls } = read;
  const day = shortDayWords(check.date);
  const line = dayCheckLine(check, day);
  const tone = halls ? 'bad' : line.tone;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`sn-press mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] ${TONE[tone]}`}
        data-day-check={line.full ? 'full' : 'open'}
      >
        <CalendarDays {...ico} className="h-4 w-4 shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {line.text}
          {halls && halls.taken.length > 0 ? (
            <span className="block" data-day-check-halls="">
              {halls.taken.join(', ')} booked that day
              {halls.free.length > 0 ? ` · ${halls.free.join(' or ')} free` : ''}
            </span>
          ) : null}
        </span>
        <ChevronRight {...ico} className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={titleId} title={dayLongWords(check.date).replace(/, \d{4}$/, '')}>
        <DaySheetBody check={check} />
      </Sheet>
    </>
  );
}

function Section({ label, tip, children, empty }: { label: string; tip?: string; children: React.ReactNode[]; empty: boolean }) {
  return (
    <section className="mt-1" data-day-check-section={label}>
      <p className="flex items-center gap-1 px-5 pb-1 pt-4 text-xs font-medium uppercase tracking-[0.08em] text-ink/70">
        {tip ? (
          <InfoTip label={label} align="start">
            {tip}
          </InfoTip>
        ) : (
          label
        )}
      </p>
      {empty ? <p className="px-5 py-3 text-center text-sm text-ink/70">No one.</p> : children}
    </section>
  );
}

function Row({ name, line, badge }: { name: string; line: string; badge?: string }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-ink [overflow-wrap:anywhere]">{name}</span>
        <span className="block text-[13px] text-ink/70 [overflow-wrap:anywhere]">{line}</span>
      </span>
      {badge ? <span className="shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-medium text-warn-900 dark:text-warn-100">{badge}</span> : null}
    </>
  );
}

const ROW = 'flex min-h-14 items-center gap-3 border-b border-ink/10 px-5 py-2.5 last:border-b-0';

function DaySheetBody({ check }: { check: DayCheck }) {
  const cardOf = (serviceId: string | null) => check.services.find((s) => s.serviceId === serviceId)?.name ?? null;
  return (
    <div className="pb-[calc(16px+env(safe-area-inset-bottom))]" data-day-check-sheet={check.date}>
      {check.services.map((s) => (
        <div key={s.serviceId} className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3" data-day-check-card={s.full ? 'full' : 'room'}>
          <span className="min-w-0">
            <span className="block text-[15px] text-ink/70">{s.name}</span>
            <span className="block text-xs text-ink/70">{cardLimitWords(s)}</span>
          </span>
          <span className={`shrink-0 text-right text-[15px] font-medium ${s.full ? 'text-danger-700 dark:text-danger-100' : 'text-ink/70'}`}>{cardDayWords(s)}</span>
        </div>
      ))}
      {check.full ? <p className="px-5 pb-1 pt-3 text-[13px] text-ink/70" data-day-check-full-lead="">{DAY_CHECK_FULL_LEAD}</p> : null}

      <Section
        label="Booked that day"
        tip="The count above is what Setnayan checks when you agree: bookings made here. Bookings you added from outside are listed so you see the whole day."
        empty={check.booked.length === 0}
      >
        {check.booked.map((b, i) => (
          <div key={`${b.name}-${i}`} className={ROW}>
            <Row
              name={b.eventType ? `${b.name} · ${b.eventType}` : b.name}
              line={[b.source === 'setnayan' ? (cardOf(b.serviceId) ?? b.service) : null, b.source === 'outside' ? 'Booked outside' : 'On Setnayan']
                .filter(Boolean)
                .join(' · ')}
            />
          </div>
        ))}
      </Section>

      <Section label="Also asking for that day" empty={check.asking.length === 0}>
        {check.asking.map((a) =>
          a.threadId ? (
            <Link key={a.eventId} href={`/vendor-dashboard/messages/${a.threadId}`} className={`sn-press ${ROW}`}>
              <Row name={a.eventType ? `${a.name} · ${a.eventType}` : a.name} line="Asked to book · waiting for your yes" badge="Asking" />
              <ChevronRight {...ico} className="h-4 w-4 shrink-0 text-ink/70" />
            </Link>
          ) : (
            <div key={a.eventId} className={ROW}>
              <Row name={a.eventType ? `${a.name} · ${a.eventType}` : a.name} line="Asked to book · waiting for your yes" badge="Asking" />
            </div>
          ),
        )}
      </Section>

      <Section
        label="Shortlisted you for that day"
        tip="Couples who saved your shop for an event on this date and have not asked yet. Accepting this one may use the day they want."
        empty={check.shortlisted.length === 0}
      >
        {check.shortlisted.map((s) => (
          <div key={s.eventId} className={ROW}>
            <Row name={s.name} line={s.eventType ? `${s.eventType} · shortlisted, not asked` : 'Shortlisted, not asked'} />
          </div>
        ))}
      </Section>
    </div>
  );
}
