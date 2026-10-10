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
 */
import { createContext, useContext, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Check, Search, X } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { goToBuildTab } from '@/lib/budget-build';
import { bookFields, bookOutcomeOf, bookedToast, type BookOutcome, type BookPick } from '@/lib/book-this-build';
import { finalizeVendor, type FinalizeVendorResult } from '../actions';

/** A STAND-IN FOR THE BOOKING — `/dev/suppliers-lab` only. `null` everywhere else. */
export const BookStandInCtx = createContext<null | ((fields: Array<[string, string]>) => Promise<FinalizeVendorResult>)>(null);

/** Filled green in the bar (rule 7: a toned button keeps its full colour)
 *  without being the row's main verb, so the fit pass may drop its word. */
const BAR_OK = '!flex-1 !border-[rgb(var(--color-ok))] !bg-[rgb(var(--color-ok))] !text-white';

type Row = { pick: BookPick; outcome: BookOutcome | null };

export function BookThisBuild({ eventId, picks, basePath }: { eventId: string; picks: BookPick[]; basePath?: string }) {
  const router = useRouter();
  const standIn = useContext(BookStandInCtx);
  const base = basePath ?? `/dashboard/${eventId}/vendors`;
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[] | null>(null);
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
      if (!standIn) router.refresh();
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
    agreed.current.clear();
    loop(picks, []);
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
    router.push(`${base}?tab=shortlist&open=${encodeURIComponent(tile)}`, { scroll: false });
    goToBuildTab('shortlist');
  };

  return (
    <>
      <ActionButton tone="ok" icon={CalendarCheck} label="Book this build" onClick={start} disabled={pending} className={BAR_OK} />
      {rows && typeof document !== 'undefined'
        ? createPortal(
            <Sheet open onClose={close} labelledById="book-build-h" title="Book this build">
              <BookSheet rows={rows} busy={pending} onConfirm={confirmAll} onClose={close} onOpenCard={openCard} />
            </Sheet>,
            document.body,
          )
        : null}
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
  asked: 'Asked to book · waiting for their yes',
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
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  const toConfirm = rows.filter((r) => r.outcome?.kind === 'confirm');
  return (
    <div className="space-y-4 px-1 pb-4" data-book-sheet="">
      <p id="book-build-h" className="text-sm text-ink/70">
        {toConfirm.length > 0 ? 'Some of these need your yes before they are asked.' : 'Not every supplier could be asked.'}
      </p>
      <ul className="divide-y divide-ink/10">
        {rows.map(({ pick, outcome }) => (
          <li key={pick.vendorId} className="py-2.5" data-book-row={outcome?.kind ?? 'waiting'}>
            <p className="text-sm font-medium text-ink">{pick.name}</p>
            <p className="text-xs uppercase tracking-[0.08em] text-ink/55">{pick.category}</p>
            {outcome?.kind === 'done' ? <p className="mt-1 text-[13px] text-success-700">{DONE_WORDS[outcome.how]}</p> : null}
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
      <div ref={rowRef} className="flex min-w-0 flex-wrap items-center gap-2">
        {toConfirm.length > 0 ? (
          <>
            <ActionButton tone="ok" main icon={Check} label={busy ? 'Booking…' : 'Yes, book them'} onClick={onConfirm} disabled={busy} />
            <ActionButton tone="neutral" icon={X} label="Not yet" onClick={onClose} disabled={busy} />
          </>
        ) : (
          <ActionButton tone="neutral" icon={Check} label="OK" onClick={onClose} />
        )}
      </div>
    </div>
  );
}
