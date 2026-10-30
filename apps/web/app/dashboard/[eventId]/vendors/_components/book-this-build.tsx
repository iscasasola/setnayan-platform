'use client';

/**
 * BookThisBuild — "📅 Book this build", at the end of the Build bar (Suppliers
 * PR3; prototype `bookbuild`; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md`).
 *
 * A LOOP OVER THE ONE BOOKING PATH. Each pick that is not booked yet is sent
 * through the shipped `finalizeVendor`, one at a time, with exactly the fields
 * its own Book button posts (`lib/book-this-build.ts`). What comes back is
 * sorted there; this file only shows it:
 *
 *   everything went through  → the prototype's toast, and the Booked body
 *   anything else            → ONE sheet: what was asked, what needs the
 *                              couple's yes (a date that becomes official,
 *                              saved builds or suppliers a booking closes —
 *                              answered once, together), what has its own step
 *                              on the supplier's card, and what was refused
 *
 * A pick that cannot be booked (taken on the date, declined) is never sent:
 * its line says why. A time slot, reservation terms and a first payment keep
 * their own shipped step — each carries a consent this sheet must not stand in
 * for — so they are listed with the door to that supplier's card.
 *
 * Nothing here books by itself: no status is written from this file.
 *
 * 🗓 IT ASKS FIRST (approved final frame 14-build-book, owner 2026-10-30): a press opens "Book this build — This asks
 * each supplier to book your date.", one row per pick with its price, what booking means, and Not yet · ✓ Yes, book
 * them in the thumb zone. Only "Yes" starts the loop above. Both sheets are the house template (`ScheduleSheet` +
 * `SheetFoot`), and the button is the bar's MAIN answer (frame 12: Save quiet on the left, Book on the right).
 * 🔒 lib/the-build-is-the-approved-frame.test.ts
 */
import { createContext, useContext, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Check, Search, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { goToBuildTab } from '@/lib/budget-build';
import { askLine } from '@/lib/booking-ask-words';
import { bookFields, bookOutcomeOf, bookedToast, type BookOutcome, type BookPick } from '@/lib/book-this-build';
import { formatPhp } from '@/lib/php';
import { ScheduleSheet, SheetFoot } from '@/app/dashboard/[eventId]/schedule/_components/schedule-sheet';
import { finalizeVendor, type FinalizeVendorResult } from '../actions';

/** A STAND-IN FOR THE BOOKING — `/dev/suppliers-lab` only. `null` everywhere else. */
export const BookStandInCtx = createContext<null | ((fields: Array<[string, string]>) => Promise<FinalizeVendorResult>)>(null);

/** Each pick's price, from the Build body's own lines (`build-body.tsx` provides it) — what the ask lists beside a name. */
export const BookPricesCtx = createContext<ReadonlyMap<string, number | null>>(new Map());

/** The prototype's words when every pick is booked or already asked. */
export const NOTHING_TO_BOOK = 'Nothing to book — every pick is booked or already asked';

/** The bar's MAIN verb now (frame 12) — the one terracotta answer; Save beside it is the quiet one. */
const BAR_FLEX = 'max-tab:!flex-1 lg:!flex-1';

type Row = { pick: BookPick; outcome: BookOutcome | null };

export function BookThisBuild({ eventId, picks, basePath }: { eventId: string; picks: BookPick[]; basePath?: string }) {
  const router = useRouter();
  const standIn = useContext(BookStandInCtx);
  const base = basePath ?? `/dashboard/${eventId}/vendors`;
  const [pending, startTransition] = useTransition();
  const prices = useContext(BookPricesCtx);
  const [rows, setRows] = useState<Row[] | null>(null);
  // The ask before anything is sent (frame 14).
  const [asking, setAsking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // What the couple has already said yes to, per supplier — kept across rounds
  // so a later gate never asks the same question again.
  const agreed = useRef(new Map<string, Set<string>>());

  const send = async (pick: BookPick): Promise<BookOutcome> => {
    const fields = bookFields(eventId, pick.vendorId, [...(agreed.current.get(pick.vendorId) ?? [])]);
    try {
      let result: FinalizeVendorResult;
      if (standIn) result = await standIn(fields);
      else {
        const fd = new FormData();
        for (const [k, v] of fields) fd.set(k, v);
        result = await finalizeVendor(fd);
      }
      return bookOutcomeOf(result, pick.name);
    } catch {
      return { kind: 'refused', why: 'Something went wrong. Try again.' };
    }
  };

  /** One pass over the picks still to send. */
  const loop = (todo: BookPick[], before: Row[]) => {
    startTransition(async () => {
      const next = [...before];
      for (const pick of todo) {
        const outcome: BookOutcome = pick.blockedNote ? { kind: 'refused', why: pick.blockedNote } : await send(pick);
        const at = next.findIndex((r) => r.pick.vendorId === pick.vendorId);
        if (at >= 0) next[at] = { pick, outcome };
        else next.push({ pick, outcome });
      }
      const done = next.flatMap((r) => (r.outcome?.kind === 'done' ? [r.outcome.how] : []));
      const open = next.some((r) => r.outcome?.kind !== 'done');
      if (!open) {
        agreed.current.clear();
        setRows(null);
        setToast(bookedToast(done));
        goToBuildTab('budget');
        return;
      }
      setRows(next);
    });
  };

  const start = () => {
    setAsking(false);
    agreed.current.clear();
    loop(picks, []);
  };

  /** The button: the ask first — or, with nothing left to book, the prototype's one line. */
  const press = () => {
    if (picks.length === 0) {
      setToast(NOTHING_TO_BOOK);
      return;
    }
    setAsking(true);
  };

  const confirmAll = () => {
    if (!rows) return;
    const again: BookPick[] = [];
    for (const r of rows) {
      if (r.outcome?.kind !== 'confirm') continue;
      const set = agreed.current.get(r.pick.vendorId) ?? new Set<string>();
      for (const f of r.outcome.flags) set.add(f);
      agreed.current.set(r.pick.vendorId, set);
      again.push(r.pick);
    }
    loop(again, rows);
  };

  const close = () => {
    const done = (rows ?? []).flatMap((r) => (r.outcome?.kind === 'done' ? [r.outcome.how] : []));
    setRows(null);
    const said = bookedToast(done);
    if (said) setToast(said);
  };

  const openCard = (tile: string) => {
    setRows(null);
    // The bus first, then the deep link — see `findIn` in `build-body.tsx`.
    goToBuildTab('shortlist');
    router.push(`${base}?tab=shortlist&open=${encodeURIComponent(tile)}`, { scroll: false });
  };

  return (
    <>
      {/* Always on the bar (frame 12): with nothing left to book it says so. The component stays mounted, so the
          toast below outlives the last pick it booked (seen in the lab: the bar dropped the button and the toast went
          with it). */}
      <ActionButton tone="brand" main icon={CalendarCheck} label="Book this build" onClick={press} disabled={pending} aria-haspopup="dialog" className={BAR_FLEX} />
      <ScheduleSheet
        open={asking}
        onClose={() => setAsking(false)}
        id="book-ask-h"
        title="Book this build"
        aside="This asks each supplier to book your date."
        data="book-ask"
        foot={
          <SheetFoot>
            <ActionButton tone="neutral" label="Not yet" onClick={() => setAsking(false)} />
            <ActionButton tone="brand" main icon={Check} label="Yes, book them" onClick={start} disabled={pending} />
          </SheetFoot>
        }
      >
        <div data-book-sheet="ask">
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {picks.map((p) => {
              const price = prices.get(p.vendorId);
              return (
                <li key={p.vendorId} className="flex items-baseline justify-between gap-3 py-2.5 text-sm" data-book-ask-row={p.tile}>
                  <span className="text-ink/60">{p.category}</span>
                  <b className="min-w-0 text-right font-semibold text-ink">
                    {p.name}
                    {price != null ? ` · ${formatPhp(price)}` : ''}
                  </b>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-ink/75">
            <b className="text-ink">This books your date.</b> Each one is a <b className="text-ink">request</b> until the supplier
            says yes — then you pay the first payment to them and record it here. Setnayan never holds your money.
          </p>
        </div>
      </ScheduleSheet>
      <ScheduleSheet
        open={rows != null}
        onClose={close}
        id="book-build-h"
        title="Book this build"
        aside={rows && rows.some((r) => r.outcome?.kind === 'confirm') ? 'Some of these need your yes before they are asked.' : 'Not every supplier could be asked.'}
        data="book-outcome"
        foot={null}
      >
        {rows ? <BookSheet rows={rows} busy={pending} onConfirm={confirmAll} onClose={close} onOpenCard={openCard} /> : null}
      </ScheduleSheet>
      {toast && typeof document !== 'undefined'
        ? createPortal(
            <PeekToast key={toast} tone="ok" data="book-build" onGone={() => setToast(null)}>
              {toast}
            </PeekToast>,
            document.body,
          )
        : null}
    </>
  );
}

const DONE_WORDS: Record<'asked' | 'booked' | 'proposed', string> = {
  // The supplier's card reads the same row as "Asked to book · waiting for your yes".
  asked: askLine('requested', 'couple'),
  booked: 'Booked ✓',
  proposed: 'Proposed · waiting for the hosts to confirm',
};

function BookSheet({
  rows,
  busy,
  onConfirm,
  onClose,
  onOpenCard,
}: {
  rows: Row[];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onOpenCard: (tile: string) => void;
}) {
  const toConfirm = rows.filter((r) => r.outcome?.kind === 'confirm');
  return (
    <div data-book-sheet="">
      <ul className="divide-y divide-ink/10">
        {rows.map(({ pick, outcome }) => (
          <li key={pick.vendorId} className="py-2.5" data-book-row={outcome?.kind ?? 'waiting'}>
            <p className="text-sm font-medium text-ink">{pick.name}</p>
            <p className="text-xs uppercase tracking-[0.08em] text-ink/55">{pick.category}</p>
            {outcome?.kind === 'done' ? <p className="mt-1 text-[13px] text-success-700 dark:text-success-200">{DONE_WORDS[outcome.how]}</p> : null}
            {outcome?.kind === 'confirm' ? (
              <div className="mt-1 text-[13px] text-ink/75">
                <p className="font-medium text-ink">{outcome.headline}</p>
                <ul className="mt-0.5 space-y-1">
                  {outcome.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {outcome?.kind === 'own_step' ? (
              <div className="mt-1 space-y-1.5">
                <p className="text-[13px] text-mulberry-700">{outcome.why}</p>
                <ActionButton tone="brand" icon={Search} label={`Find in ${pick.category}`} onClick={() => onOpenCard(pick.tile)} />
              </div>
            ) : null}
            {outcome?.kind === 'refused' ? <p className="mt-1 text-[13px] text-mulberry-700">Not asked — {outcome.why}</p> : null}
          </li>
        ))}
      </ul>
      <SheetFoot>
        {toConfirm.length > 0 ? (
          <>
            <ActionButton tone="neutral" icon={X} label="Not yet" onClick={onClose} disabled={busy} />
            <ActionButton tone="brand" main icon={Check} label={busy ? 'Booking…' : 'Yes, book them'} onClick={onConfirm} disabled={busy} />
          </>
        ) : (
          <ActionButton tone="brand" main icon={Check} label="OK" onClick={onClose} className="col-span-2" />
        )}
      </SheetFoot>
    </div>
  );
}
