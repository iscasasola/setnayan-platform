'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRow, FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import type { CalendarDay } from '@/lib/calendar-grid';
import { seatLine, type SeatsByPool } from '@/lib/vendor-dates';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/** The halls line: of the halls picked, which are already full that day (seats the page read), or that they are free. */
function hallsSeatLine(seats: SeatsByPool | null, pools: readonly OutsidePool[], picked: readonly string[], date: string | null): { tone: 'ok' | 'bad'; text: string } | null {
  if (!seats || !date || picked.length === 0) return null;
  const name = (id: string) => pools.find((p) => p.poolId === id)?.label ?? 'A hall';
  const taken = picked.filter((id) => (seats[id]?.taken[date] ?? 0) >= (seats[id]?.capacity ?? 1)).map(name);
  if (taken.length > 0) return { tone: 'bad', text: `${taken.join(' and ')} ${taken.length === 1 ? 'is' : 'are'} booked that day` };
  return { tone: 'ok', text: `${picked.map(name).join(' + ')} free that day` };
}
import { SupplierSubmit } from '../../_components/supplier-submit';

/**
 * ADD — an outside client, from the People thumb row (S-PR2; prototype frame
 * 03: the brand "＋ Add" beside the search; owner answer 3, 2026-10-01: "+ on
 * Customers adds an outside client").
 *
 * 🔑 THE SHIPPED MECHANISM, NOT A SECOND ONE. The sheet posts the same
 * `importExternalClient` the retired Clients page posted (handed in by the
 * page), with the same fields; only the drawing is the templates': Form rows
 * (a pencil = type · an arrow = choose · a calendar = pick a date), one main
 * button in the brand colour. The action comes back to People with its outcome
 * (`return_to=people` → `?notice=`), said by the page's toast + status line.
 *
 * Opens from the thumb row's Add, or already open when the address carries
 * `?add=outside` (an older link that named the form).
 *
 * 2026-10-14 (owner ✅ "APPROVE"; prototype SHEETS.add): "Add a booking from outside" — Name · Schedule · Date ·
 * TIME (new: `client_time`) · Note, and the one line that says whether the picked day still has room on that
 * schedule (`seatLine`, from the seats the page already read — no request). The shipped To and Contact stay, last
 * and optional, so a multi-day job and a phone number keep their way in.
 *
 * The sheet is PORTALLED to <body>: the thumb row is `position: fixed` with its
 * own stacking layer, and a dialog drawn inside it would sit under the bars.
 */
export type OutsidePool = { poolId: string; label: string };

export function OutsideClientAdd({
  pools,
  action,
  startOpen = false,
  today,
  setupHref,
  returnTo = 'people',
  day = null,
  seats = null,
  label = 'Add',
  halls = false,
}: {
  /**
   * The shop's schedules are a venue's HALLS (owner 2026-10-14 🏛, prototype "Add from outside · which halls"): the
   * sheet asks "Which halls" — one or more, a dropdown with checkmarks — and each hall picked holds the day.
   */
  halls?: boolean;
  /** The shop's schedules — an outside client holds a date on one of them. */
  pools: readonly OutsidePool[];
  /** The shipped `importExternalClient` server action. */
  action: (formData: FormData) => void | Promise<void>;
  startOpen?: boolean;
  /** Today in Manila — the calendar's ring. */
  today: CalendarDay;
  /** Where a shop with no schedule sets one up. */
  setupHref: string;
  /** Where the outcome is said — People (its list) or Dates (the month it holds a day on). */
  returnTo?: 'people' | 'dates';
  /** The day screen's date, filled in. */
  day?: CalendarDay | null;
  /** Seats taken per schedule and date (Dates reads them anyway) — for the "That day is free" line. */
  seats?: SeatsByPool | null;
  /** The thumb button's word ("Add" · "Add a booking"). */
  label?: string;
}) {
  const [open, setOpen] = useState(startOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);

  const [pool, setPool] = useState<string | null>(pools[0]?.poolId ?? null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [from, setFrom] = useState<CalendarDay | null>(day);
  const [to, setTo] = useState<CalendarDay | null>(null);
  const [time, setTime] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const line = halls ? hallsSeatLine(seats, pools, picked, from) : seats ? seatLine(seats, pool, from) : null;

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-4 pt-5" data-outside-add="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Add a booking from outside
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">Holds the day so nothing double-books it. Free.</p>
        {pools.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink/70" data-outside-add-setup="">
            An outside client holds a date on one of your schedules, and you have none yet.{' '}
            <Link href={setupHref} className="inline-flex min-h-11 items-center font-semibold text-sn-accent underline">
              Set up a schedule
            </Link>
          </p>
        ) : (
          <form
            ref={form}
            action={action}
            className="mt-3"
            onSubmit={(e) => {
              // An unfinished answer shakes and the sheet moves to it — never a silent refusal.
              if (!name.trim() || !from || (halls && picked.length === 0)) {
                e.preventDefault();
                nudgeFormRows(form.current ?? undefined);
              }
            }}
          >
            <input type="hidden" name="return_to" value={returnTo} />
            {returnTo === 'dates' && from ? <input type="hidden" name="return_month" value={from.slice(0, 7)} /> : null}
            {halls ? picked.map((id) => <input key={id} type="hidden" name="pool_ids" value={id} />) : <input type="hidden" name="pool_id" value={pool ?? ''} />}
            <input type="hidden" name="start_date" value={from ?? ''} />
            <input type="hidden" name="end_date" value={to ?? ''} />
            <input type="hidden" name="client_time" value={time} />
            <FormRows width="wide">
              <TypedRow
                name="Name"
                value={name}
                required
                maxLength={120}
                fieldName="client_name"
                autoCapitalize="words"
                empty="Their name"
                onKeep={(t) => setName(t)}
              />
              {halls ? (
                <FormRow name="Which halls" data="outside-halls">
                  <PickMenu
                    label="Which halls"
                    value={picked[0] ?? null}
                    picked={picked}
                    buttonText={picked.length > 0 ? pools.filter((p) => picked.includes(p.poolId)).map((p) => p.label).join(' · ') : 'Pick one or more'}
                    options={pools.map((p) => ({ key: p.poolId, label: p.label }))}
                    onPick={(k) => setPicked((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))}
                    dataAttr="data-outside-halls"
                    className="!min-h-11"
                  />
                </FormRow>
              ) : pools.length > 1 ? (
                <ChosenRow
                  name="Schedule"
                  label="Which schedule holds the date"
                  value={pool}
                  options={pools.map((p) => ({ key: p.poolId, label: p.label }))}
                  onPick={(k) => setPool(k)}
                  dataAttr="data-outside-pool"
                />
              ) : null}
              <DateRow name="Date" value={from} today={today} empty="Pick a date" onKeep={(d) => setFrom(d)} />
              <FormRow name="Time" data="outside-time">
                {/* The phone's own time wheel. Empty, it says so — WebKit would otherwise draw a grey "12:30 PM" that
                    reads as already set (walked 2026-10-14). */}
                <span className="relative inline-flex">
                  <input
                    type="time"
                    value={time}
                    step={300}
                    onChange={(e) => setTime(e.target.value)}
                    aria-label="Time"
                    className={`min-h-11 min-w-[8.5rem] rounded-full border border-ink/15 bg-cream px-4 text-[15px] ${time ? 'text-ink' : 'text-transparent'}`}
                    data-outside-time=""
                  />
                  {time ? null : (
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] text-ink/45">
                      No time
                    </span>
                  )}
                </span>
              </FormRow>
              {line ? (
                <p className="pb-1 pt-1 text-[13px]" style={{ color: line.tone === 'bad' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-ok))' }} data-outside-seat-line="">
                  {line.text}
                </p>
              ) : null}
              <TypedRow name="Note" value={note} empty="Optional" long maxLength={500} fieldName="client_note" onKeep={(t) => setNote(t)} />
              <DateRow name="To" value={to} shown={from} today={today} min={from} empty="Same day" onKeep={(d) => setTo(d)} />
              <TypedRow name="Contact" value={contact} empty="Optional" maxLength={160} fieldName="client_contact" onKeep={(t) => setContact(t)} />
            </FormRows>
            <div className="mt-4">
              <SupplierSubmit
                tone="brand"
                main
                icon={<Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                label="Add"
                pendingLabel="Adding…"
                className="w-full"
              />
            </div>
          </form>
        )}
      </div>
    </Sheet>
  );

  return (
    <>
      <ActionButton tone="brand" main icon={Plus} label={label} name="Add a booking from outside" aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid="customers-add" />
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}
