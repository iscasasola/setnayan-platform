'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarX2, Pencil, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { FormCounter } from '@/app/_components/form-counter';
import { ChosenRow, FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SWITCH_TRACK } from '@/app/_components/switch-track';
import type { CalendarDay } from '@/lib/calendar-grid';
import { DAY_PARTS, DAY_PART_WORDS, repeatOptions, type DayPart, type RepeatRule } from '@/lib/not-available';
import { SupplierSubmit } from '../../_components/supplier-submit';

/**
 * CUSTOMERS › DATES — the sheets its rows and thumb row open (S-PR3; plan § 2 "Block days · Waitlist · Capacity";
 * § 8 gap 10 "Customers › Add (people/dates): … Block a date"; § 10 "Block a date: Customers › Dates › Block a date
 * = 3 taps").
 *
 * 🔑 THE SHIPPED ACTIONS, NOT NEW ONES. Each sheet posts the action the retired `calendar/surface.tsx` posted —
 * `addManualBlock`, `createCalendar`, `editCalendar`, `reassignCategoryPool` — handed in by the page, with the same
 * fields; only the drawing is the templates': Form rows, one main button in the brand colour, the sheet from the
 * bottom. Every one comes back to Dates (`return_to=dates`) where the outcome is said.
 *
 * Portalled to <body>: the thumb row is `position: fixed` with its own stacking layer.
 */

type Action = (formData: FormData) => void | Promise<void>;
export type DatesPool = { poolId: string; label: string };

function usePortal(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/* ── NOT AVAILABLE (inside the "Not available" fold) ─────────────────── */

/**
 * The "Not available" sheet (prototype SHEETS.block, owner 2026-10-14 ✅ "APPROVE": "repeating 'Not available'
 * blocks + hour ranges: YES"): From · To · Repeats · Hours · Which schedule · Why → "Mark not available".
 * Posts the SHIPPED `addManualBlock` with three new fields (`repeat_rule`, `day_part`; `end_date` is a repeat's last
 * day). Opened from the fold's grey "Mark days not available" — the thumb row's button is now "Check a date" (owner
 * call 1, 2026-10-14).
 */
export function BlockDateAdd({
  pools,
  action,
  today,
  month,
}: {
  pools: readonly DatesPool[];
  /** The shipped `addManualBlock`. */
  action: Action;
  today: CalendarDay;
  /** The month on show — the outcome comes back to it. */
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const mounted = usePortal();
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [label, setLabel] = useState('');
  const [from, setFrom] = useState<CalendarDay | null>(null);
  const [to, setTo] = useState<CalendarDay | null>(null);
  const [scope, setScope] = useState('org');
  const [repeat, setRepeat] = useState<RepeatRule>('once');
  const [part, setPart] = useState<DayPart>('all_day');
  const repeats = repeat !== 'once';

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-4 pt-5" data-dates-block-add="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Not available
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">Set once.</p>
        <form
          ref={form}
          action={action}
          className="mt-3"
          onSubmit={(e) => {
            if (!from) {
              e.preventDefault();
              nudgeFormRows(form.current ?? undefined);
            }
          }}
        >
          <input type="hidden" name="return_to" value="dates" />
          <input type="hidden" name="return_fold" value="block" />
          <input type="hidden" name="return_month" value={from ? from.slice(0, 7) : month} />
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="start_date" value={from ?? ''} />
          <input type="hidden" name="end_date" value={to ?? ''} />
          <input type="hidden" name="repeat_rule" value={repeat} />
          <input type="hidden" name="day_part" value={part} />
          <FormRows width="wide">
            <DateRow name="From" value={from} today={today} empty="Pick a date" onKeep={(d) => setFrom(d)} />
            <DateRow name="To" value={to} shown={from} today={today} min={from} empty={repeats ? 'No end' : 'Same day'} onKeep={(d) => setTo(d)} />
            <ChosenRow
              name="Repeats"
              label="Repeats"
              value={repeat}
              options={repeatOptions(from)}
              onPick={(k) => setRepeat(k as RepeatRule)}
              dataAttr="data-dates-block-repeat"
            />
            <ChosenRow
              name="Hours"
              label="Hours"
              value={part}
              options={DAY_PARTS.map((p) => ({ key: p, label: DAY_PART_WORDS[p] }))}
              onPick={(k) => setPart(k as DayPart)}
              dataAttr="data-dates-block-hours"
            />
            {pools.length > 1 ? (
              <ChosenRow
                name="Which schedule"
                label="Which schedule"
                value={scope}
                options={[{ key: 'org', label: 'All schedules' }, ...pools.map((p) => ({ key: p.poolId, label: p.label }))]}
                onPick={(k) => setScope(k)}
                dataAttr="data-dates-block-scope"
              />
            ) : null}
            <TypedRow name="Why" value={label} empty="Optional · “Masses”" maxLength={120} fieldName="label" onKeep={(t) => setLabel(t)} />
          </FormRows>
          <div className="mt-4">
            <SupplierSubmit
              tone="brand"
              main
              icon={<CalendarX2 aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              label="Mark not available"
              pendingLabel="Marking…"
              className="w-full"
            />
          </div>
        </form>
      </div>
    </Sheet>
  );

  return (
    <>
      <ActionButton tone="neutral" icon={CalendarX2} label="Mark days not available" aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid="dates-block" />
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}

/* ── A SCHEDULE — new, or its name and services (How many a day) ───────── */

export type DatesService = { serviceId: string; label: string; poolId: string | null };

export function CalendarSheet({
  pool,
  services,
  ceiling,
  createAction,
  editAction,
  month,
  trigger,
}: {
  /** The calendar to edit; absent = a new one. */
  pool?: { poolId: string; name: string; capacity: number; serviceIds: readonly string[] } | null;
  services: readonly DatesService[];
  /** The plan's most events a day (and the database's 50). */
  ceiling: number;
  createAction: Action;
  editAction: Action;
  month: string;
  /** What opens it — a pool row's name, or the "New schedule" button. */
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mounted = usePortal();
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(pool?.name ?? '');
  const on = new Set(pool?.serviceIds ?? []);
  const editing = Boolean(pool);

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-4 pt-5" data-dates-calendar-sheet={editing ? 'edit' : 'new'}>
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          {editing ? pool!.name : 'New schedule'}
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">A schedule holds how many events a day one team can take, for the services on it.</p>
        <form
          ref={form}
          action={editing ? editAction : createAction}
          className="mt-3"
          onSubmit={(e) => {
            if (!name.trim()) {
              e.preventDefault();
              nudgeFormRows(form.current ?? undefined);
            }
          }}
        >
          <input type="hidden" name="return_to" value="dates" />
          <input type="hidden" name="return_fold" value="capacity" />
          <input type="hidden" name="return_month" value={month} />
          {editing ? <input type="hidden" name="pool_id" value={pool!.poolId} /> : null}
          <FormRows width="wide">
            <TypedRow name="Name" value={name} required maxLength={80} fieldName="calendar_name" autoCapitalize="words" onKeep={(t) => setName(t)} />
          </FormRows>
          <div className="flex min-h-[60px] items-center gap-3 border-t border-ink/10">
            <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">How many a day</span>
            <FormCounter name="capacity" value={pool?.capacity ?? 1} min={1} max={ceiling} label="How many a day" data="calendar-sheet" />
          </div>
          {services.length > 0 ? (
            <fieldset className="border-t border-ink/10 pt-2">
              <legend className="home-k2 pt-3">Services on it</legend>
              {services.map((s) => (
                <label key={s.serviceId} className="flex min-h-[52px] items-center gap-3 border-t border-ink/10 first-of-type:border-t-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink">{s.label}</span>
                    {s.poolId && s.poolId !== pool?.poolId ? <span className="block text-[12.5px] text-ink/55">On another schedule</span> : null}
                  </span>
                  <input type="checkbox" role="switch" name="service_ids" value={s.serviceId} defaultChecked={on.has(s.serviceId)} className="peer sr-only" />
                  <span aria-hidden className={SWITCH_TRACK} />
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="mt-3 text-[13.5px] text-ink/60">Add a service first — then it can go on a schedule.</p>
          )}
          <div className="mt-4">
            <SupplierSubmit
              tone="brand"
              main
              icon={(editing ? <Pencil aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />)}
              label={editing ? 'Save schedule' : 'Make the schedule'}
              pendingLabel="Saving…"
              className="w-full"
            />
          </div>
        </form>
      </div>
    </Sheet>
  );

  return (
    <>
      {trigger ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="sn-press -my-1 inline-flex min-h-11 max-w-full items-center gap-1.5 text-left text-[15px] font-medium text-ink"
          data-dates-calendar-edit=""
        >
          <span className="truncate">{trigger}</span>
          <Pencil aria-hidden className="h-3.5 w-3.5 flex-none text-sn-accent" strokeWidth={2} />
        </button>
      ) : (
        <ActionButton tone="neutral" icon={Plus} label="New schedule" aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid="dates-new-calendar" />
      )}
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}

/* ── WHICH SERVICES SHARE A TEAM (the category model, Named Calendars off) ── */

/** One category's schedule, as ONE dropdown — picking moves it (the shipped `reassignCategoryPool`). */
export function ShareTeamPick({
  categoryKey,
  categoryLabel,
  value,
  pools,
  moveAction,
  month,
}: {
  categoryKey: string;
  categoryLabel: string;
  value: string;
  pools: readonly DatesPool[];
  /** The shipped `reassignCategoryPool`. */
  moveAction: Action;
  month: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const target = useRef<HTMLInputElement>(null);
  return (
    <form ref={form} action={moveAction} className="flex min-h-[60px] items-center gap-3 border-t border-ink/10" data-dates-share-team={categoryKey}>
      <input type="hidden" name="return_to" value="dates" />
      <input type="hidden" name="return_fold" value="capacity" />
      <input type="hidden" name="return_month" value={month} />
      <input type="hidden" name="category_key" value={categoryKey} />
      <input ref={target} type="hidden" name="target_pool" defaultValue={value} />
      <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{categoryLabel}</span>
      <PickMenu
        label={`${categoryLabel}’s schedule`}
        value={value}
        options={[...pools.map((p) => ({ key: p.poolId, label: p.label })), { key: 'new', label: 'Its own new schedule' }]}
        onPick={(k) => {
          if (k === value || !target.current) return;
          target.current.value = k;
          form.current?.requestSubmit();
        }}
        dataAttr="data-dates-share-pick"
        className="!min-h-11"
      />
    </form>
  );
}
