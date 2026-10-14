'use client';

/**
 * The date · place line's two values (PR5): each opens its sheet IN PLACE. The line is all this page carries at first
 * paint — the sheets themselves (the calendar, the map, Help me choose) load when one is opened (`fact-sheets.tsx`),
 * so the Suppliers page pays nothing for them on the visits that never open one.
 */
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SuppliersFact } from '@/lib/suppliers-shell';
import { CHANGE_ASKED_WORD, DRAFTED_DATE_WORD, SUPPLIERS_FACT_SHEET_EVENT, type FactSheetKey } from '@/lib/suppliers-fact-sheets';

const FactSheet = dynamic(() => import('./fact-sheets').then((m) => m.FactSheet), { ssr: false });

/* ── THE LINE: two values that open their sheet ───────────────────────────────────────────────────────────────── */

const VALUE =
  'sn-press inline-flex min-h-11 items-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sn-accent';
const DOTTED = 'border-b border-dotted pb-px';
const tone = (f: SuppliersFact) =>
  f.open ? '[&>span]:border-sn-accent/60 text-sn-accent hover:[&>span]:border-sn-accent' : '[&>span]:border-ink/55 text-ink hover:[&>span]:border-ink';

export function FactLine({
  eventId,
  facts,
  drafted = false,
  changeAsked = false,
  priced = [],
}: {
  eventId: string;
  facts: { date: SuppliersFact; place: SuppliersFact };
  /** The date shown waits in the Event Hub draft (answer 7). */
  drafted?: boolean;
  /** A date change is asked of a booked supplier (answer 10). */
  changeAsked?: boolean;
  /** The build's priced picks (event_vendors ids) — Help me choose checks every one of them. */
  priced?: readonly string[];
}) {
  const [open, setOpen] = useState<{ which: FactSheetKey; help: boolean } | null>(null);
  const router = useRouter();
  /* A write made while the sheet was open owes the page ONE redraw, paid when it closes. */
  const owed = useRef(false);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ which?: FactSheetKey; help?: boolean }>).detail;
      if (d?.which === 'date' || d?.which === 'place') setOpen({ which: d.which, help: Boolean(d.help) });
    };
    window.addEventListener(SUPPLIERS_FACT_SHEET_EVENT, on);
    return () => window.removeEventListener(SUPPLIERS_FACT_SHEET_EVENT, on);
  }, []);
  const close = () => {
    setOpen(null);
    if (owed.current) {
      owed.current = false;
      router.refresh();
    }
  };
  const { date, place } = facts;
  return (
    <>
      <p data-suppliers-facts="" className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[15px] leading-snug">
        <button
          type="button"
          onClick={() => setOpen({ which: 'date', help: false })}
          data-fact="date"
          aria-haspopup="dialog"
          aria-label={`Date: ${date.text}${drafted ? `, ${DRAFTED_DATE_WORD}` : ''}`}
          className={`${VALUE} ${tone(date)}`}
        >
          <span className={DOTTED}>{date.text}</span>
        </button>
        {drafted ? (
          <span className="text-[13px] text-ink/60" data-fact-drafted="">
            {DRAFTED_DATE_WORD}
          </span>
        ) : null}
        {changeAsked ? (
          <button
            type="button"
            onClick={() => setOpen({ which: 'date', help: false })}
            data-fact-change-asked=""
            className="sn-press inline-flex min-h-11 items-center text-[13px] font-medium text-sn-accent"
          >
            · {CHANGE_ASKED_WORD}
          </button>
        ) : null}
        <span aria-hidden className="text-ink/55">
          ·
        </span>
        <button
          type="button"
          onClick={() => setOpen({ which: 'place', help: false })}
          data-fact="place"
          aria-haspopup="dialog"
          aria-label={`Place: ${place.text}`}
          className={`${VALUE} ${tone(place)}`}
        >
          <span className={DOTTED}>{place.text}</span>
        </button>
      </p>
      {open ? (
        <FactSheet
          key={`${open.which}-${open.help}`}
          eventId={eventId}
          which={open.which}
          helpFirst={open.help}
          priced={priced}
          onWrote={() => {
            owed.current = true;
          }}
          onClose={close}
        />
      ) : null}
    </>
  );
}

