'use client';

// ============================================================================
// VendorPrepForBooking — vendor-side "Add to prep schedule" control on the
// Bookings view (HYBRID Preparation schedule, 2026-06-03).
//
// Rendered per ACCEPTED booking. A booked vendor can push dated items onto
// the couple's Preparation agenda (e.g. "Send shot list", "Final headcount
// due") backed by event_preparation_items. The vendor also sees the items
// they've already added here, each with an inline delete control (their own
// rows only — RLS enforces).
//
// Mirrors the couple-side prep-item-controls.tsx + the canonical Setnayan
// modal (cancel-booking-button.tsx): bottom-sheet on mobile (items-end →
// sm:items-center), ESC + backdrop dismiss, mulberry CTA. Clean Editorial
// tokens only.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  vendorAddPreparationItem,
  vendorDeletePreparationItem,
} from '../actions';

export type VendorPrepItem = {
  itemId: string;
  dueDate: string;
  label: string;
  notes: string | null;
};

function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateShort(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function VendorPrepForBooking({
  eventId,
  vendorProfileId,
  eventName,
  items,
}: {
  eventId: string;
  vendorProfileId: string;
  eventName: string;
  items: VendorPrepItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) labelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPending]);

  function close() {
    if (isPending) return;
    setOpen(false);
    setErrorMessage(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await vendorAddPreparationItem(fd);
        setOpen(false);
        setErrorMessage(null);
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not add this item.',
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Prep schedule
          {items.length > 0 ? (
            <span className="ml-1 text-ink/35">· {items.length}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-mulberry/30 bg-cream px-2.5 py-1 text-xs font-medium text-mulberry transition-colors hover:border-mulberry/50 hover:bg-mulberry/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Add to prep schedule
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.itemId}
              className="flex items-center gap-2 rounded-md border border-mulberry/15 bg-mulberry/[0.03] px-2.5 py-1.5"
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/50">
                {formatDateShort(it.dueDate)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink/80">
                {it.label}
              </span>
              <VendorDeletePrepItem itemId={it.itemId} label={it.label} />
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-add-prep-headline"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === overlayRef.current) close();
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-5 shadow-xl sm:p-6">
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              disabled={isPending}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-mulberry/10 text-mulberry">
                <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <h2
                id="vendor-add-prep-headline"
                className="text-lg font-semibold tracking-tight text-ink"
              >
                Add to their prep schedule
              </h2>
            </div>
            <p className="mb-4 text-xs text-ink/60">
              This dated step appears on{' '}
              <span className="font-medium text-ink">{eventName}</span>&rsquo;s
              Preparation schedule. They can remove it anytime.
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-ink">What should they do?</span>
                <input
                  ref={labelRef}
                  name="label"
                  required
                  maxLength={200}
                  placeholder="e.g. Send final shot list"
                  className="input-field"
                  disabled={isPending}
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-ink">By when?</span>
                <input
                  name="due_date"
                  type="date"
                  required
                  defaultValue={todayLocal()}
                  className="input-field"
                  disabled={isPending}
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-ink">
                  Notes <span className="text-ink/40">(optional)</span>
                </span>
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  placeholder="Any detail the couple should know"
                  className="input-field min-h-[80px] py-2"
                  disabled={isPending}
                />
              </label>

              {errorMessage ? (
                <p role="alert" className="text-xs text-rose-700">
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={isPending}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                      Add item
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VendorDeletePrepItem({ itemId, label }: { itemId: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function onDelete() {
    setErrorMessage(null);
    const fd = new FormData();
    fd.set('item_id', itemId);
    startTransition(async () => {
      try {
        await vendorDeletePreparationItem(fd);
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not remove this item.',
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isPending}
      title={errorMessage ?? `Remove “${label}”`}
      aria-label={`Remove ${label}`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-ink/5 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
      ) : (
        <Trash2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
      )}
    </button>
  );
}
