'use client';

// ============================================================================
// Couple-side controls for the HYBRID Preparation schedule (2026-06-03).
//
// PR #840 shipped /dashboard/[eventId]/schedule's Preparation mode as a
// read-only autofill. This file adds the couple's add/delete affordances on
// top of it, backed by the new `event_preparation_items` table:
//
//   • AddPreparationItem — a compact "+ Add to schedule" trigger that opens
//     the canonical Setnayan modal (bottom-sheet on mobile via items-end →
//     sm:items-center; ESC + backdrop dismiss; matches cancel-booking-button
//     .tsx). Fields: label (required), date (required), optional notes.
//     Calls the addPreparationItem server action.
//
//   • DeletePreparationItemButton — a small inline Trash2 affordance rendered
//     on the deletable agenda rows (the event_preparation_items rows only,
//     NOT the autofill rows). Calls deletePreparationItem. A couple may
//     remove their own items AND dismiss vendor-added ones (RLS allows both).
//
// Clean Editorial tokens only (cream / ink / terracotta / mulberry). All
// interaction is contained here; the agenda stays a server component and
// receives these as leaf controls.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { addPreparationItem, deletePreparationItem } from '../prep-actions';
import { PrepKindPicker, type PrepKind } from './prep-kind-picker';

// ── Add ─────────────────────────────────────────────────────────────────

export function AddPreparationItem({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PrepKind>('task');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLInputElement | null>(null);

  // Focus the label field on open so a couple can type immediately.
  useEffect(() => {
    if (open) labelRef.current?.focus();
  }, [open]);

  // Escape-key dismissal (blocked mid-submit).
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
    setKind('task');
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // The picker drives `kind` via React state, not a native field — stamp it
    // onto the payload so the server action sees it.
    fd.set('kind', kind);
    startTransition(async () => {
      try {
        await addPreparationItem(fd);
        setOpen(false);
        setErrorMessage(null);
        setKind('task');
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not add this item.',
        );
      }
    });
  }

  // Default the date to today (local) for a sensible starting point.
  const today = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-mulberry/30 bg-cream px-3 py-2 text-sm font-medium text-mulberry transition-colors hover:border-mulberry/50 hover:bg-mulberry/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
      >
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
        Add to schedule
      </button>

      {open ? (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-prep-headline"
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

            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-mulberry/10 text-mulberry">
                <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <h2
                id="add-prep-headline"
                className="text-lg font-semibold tracking-tight text-ink"
              >
                Add to your schedule
              </h2>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <input type="hidden" name="event_id" value={eventId} />
              <PrepKindPicker value={kind} onChange={setKind} disabled={isPending} />
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-ink">
                  {kind === 'meeting'
                    ? 'Meeting title'
                    : kind === 'payment'
                      ? 'What is this payment for?'
                      : 'What is it?'}
                </span>
                <input
                  ref={labelRef}
                  name="label"
                  required
                  maxLength={200}
                  placeholder={
                    kind === 'meeting'
                      ? 'e.g. Final venue walkthrough'
                      : kind === 'payment'
                        ? 'e.g. Caterer balance'
                        : 'e.g. Final dress fitting'
                  }
                  className="input-field"
                  disabled={isPending}
                />
              </label>
              {kind === 'payment' ? (
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-ink">Amount (₱)</span>
                  <input
                    name="amount_php"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 25000"
                    className="input-field"
                    disabled={isPending}
                  />
                </label>
              ) : null}
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-ink">
                  {kind === 'meeting' ? 'When?' : kind === 'payment' ? 'Due date' : 'When?'}
                </span>
                <input
                  name="due_date"
                  type="date"
                  required
                  defaultValue={today}
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
                  placeholder="Anything to remember for this step"
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
    </>
  );
}

// ── Delete ──────────────────────────────────────────────────────────────

/**
 * Inline delete affordance rendered on deletable agenda rows (manual /
 * vendor-added). Single-tap delete — these rows are cheap to re-add and a
 * confirm dialog would be heavy for a planning list. Removes the row +
 * refreshes; errors surface inline as a tiny tooltip-style title.
 */
export function DeletePreparationItemButton({
  eventId,
  itemId,
  label,
}: {
  eventId: string;
  itemId: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function onDelete() {
    setErrorMessage(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('item_id', itemId);
    startTransition(async () => {
      try {
        await deletePreparationItem(fd);
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
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-ink/5 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
    </button>
  );
}
