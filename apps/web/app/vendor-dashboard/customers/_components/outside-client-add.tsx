'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import type { CalendarDay } from '@/lib/calendar-grid';
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
}: {
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
  const [from, setFrom] = useState<CalendarDay | null>(null);
  const [to, setTo] = useState<CalendarDay | null>(null);

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-4 pt-5" data-outside-add="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Add an outside client · free
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">A date you sold outside Setnayan — it holds that day so the app never double-books it.</p>
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
              if (!name.trim() || !from) {
                e.preventDefault();
                nudgeFormRows(form.current ?? undefined);
              }
            }}
          >
            <input type="hidden" name="return_to" value={returnTo} />
            {returnTo === 'dates' && from ? <input type="hidden" name="return_month" value={from.slice(0, 7)} /> : null}
            <input type="hidden" name="pool_id" value={pool ?? ''} />
            <input type="hidden" name="start_date" value={from ?? ''} />
            <input type="hidden" name="end_date" value={to ?? ''} />
            <FormRows width="wide">
              <TypedRow
                name="Client name"
                value={name}
                required
                maxLength={120}
                fieldName="client_name"
                autoCapitalize="words"
                onKeep={(t) => setName(t)}
              />
              {pools.length > 1 ? (
                <ChosenRow
                  name="Schedule"
                  label="Which schedule holds the date"
                  value={pool}
                  options={pools.map((p) => ({ key: p.poolId, label: p.label }))}
                  onPick={(k) => setPool(k)}
                  dataAttr="data-outside-pool"
                />
              ) : null}
              <DateRow name="From" value={from} today={today} empty="Pick a date" onKeep={(d) => setFrom(d)} />
              <DateRow name="To" value={to} shown={from} today={today} min={from} empty="Same day" onKeep={(d) => setTo(d)} />
              <TypedRow name="Contact" value={contact} empty="Optional" maxLength={160} fieldName="client_contact" onKeep={(t) => setContact(t)} />
              <TypedRow name="Note" value={note} empty="Optional" long maxLength={500} fieldName="client_note" onKeep={(t) => setNote(t)} />
            </FormRows>
            <div className="mt-4">
              <SupplierSubmit
                tone="brand"
                main
                icon={<Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                label="Add · free"
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
      <ActionButton tone="brand" main icon={Plus} label="Add" name="Add an outside client" aria-haspopup="dialog" onClick={() => setOpen(true)} data-testid="customers-add" />
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}
