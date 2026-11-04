'use client';

// ============================================================================
// Couple-side controls for the HYBRID Preparation schedule (2026-06-03).
//
// PR #840 shipped /dashboard/[eventId]/schedule's Preparation mode as a
// read-only autofill. This file adds the couple's add/delete affordances on
// top of it, backed by the new `event_preparation_items` table:
//
//   • AddPreparationItem — "+ Add to schedule" (or the thumb-zone "+ Add a step")
//     opening the Schedule's ONE pop-up (schedule-sheet.tsx, 2026-10-31).
//     Fields: type, label (required), amount (payment), date (required),
//     optional notes. Calls the addPreparationItem server action.
//
//   • PrepItemSwipe — the deletable agenda rows' swipe-left Delete, with Undo
//     (owner 2026-11-03; it was a small inline Trash2 button). The
//     event_preparation_items rows only, NOT the autofill rows. Calls
//     deletePreparationItem. A couple may remove their own items AND dismiss
//     vendor-added ones (RLS allows both).
//
// Clean Editorial tokens only (cream / ink / terracotta / mulberry). All
// interaction is contained here; the agenda stays a server component and
// receives these as leaf controls.
// ============================================================================

import { useId, useState, useTransition, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '../../guests/_components/undo-toast';
import { addPreparationItem, deletePreparationItem } from '../prep-actions';
import { PREP_KIND_OPTIONS, type PrepKind } from './prep-kind-picker';
import { ScheduleAddPill, ScheduleSheet, SheetChoice, SheetField, SheetFoot } from './schedule-sheet';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '../../website/editor/_components/pick-menu';

// ── Add ─────────────────────────────────────────────────────────────────

/**
 * ＋ ADD A STEP — in the Schedule's ONE pop-up (owner 2026-10-31, live iPhone: *"the pop up. design template."* — this
 * was a boxed card pinned under the top nav). Same fields (Type · What · Amount for a payment · When · Notes), the same
 * `addPreparationItem` write; the frame, the field look and the thumb-zone answers are `schedule-sheet.tsx`'s. Type is
 * ONE dropdown (owner 2026-09-28, *"if there are choices … drop down menu"*), never a segmented row.
 *
 *   `button`  the shipped "+ Add to schedule" button, where the agenda stands alone (its empty state, the page)
 *   `pill`    "+ Add a step", the page's one add in the thumb zone (Suppliers › Booked › Schedule › Preparation)
 */
export function AddPreparationItem({ eventId, door = 'button', hidden = false }: { eventId: string; door?: 'button' | 'pill'; hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PrepKind>('task');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formId = useId();

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
      {door === 'pill' ? (
        <ScheduleAddPill label="Add a step" data="step" view="preparation" hidden={hidden || open} onPress={() => setOpen(true)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-mulberry/30 bg-cream px-3 py-2 text-sm font-medium text-mulberry transition-colors hover:border-mulberry/50 hover:bg-mulberry/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add to schedule
        </button>
      )}

      <ScheduleSheet
        open={open}
        onClose={close}
        id="add-prep-headline"
        title="Add a step"
        aside="Planning Stage"
        data="add-step"
        foot={
          <SheetFoot>
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={close} disabled={isPending} />
            <ActionButton
              tone="brand"
              main
              icon={Plus}
              label={isPending ? 'Adding…' : 'Add step'}
              type="submit"
              form={formId}
              disabled={isPending}
              waiting={isPending}
            />
          </SheetFoot>
        }
      >
        <form id={formId} onSubmit={onSubmit} className="space-y-3.5">
          <input type="hidden" name="event_id" value={eventId} />
          <SheetChoice label="Type">
            <PickMenu
              label="Type"
              value={kind}
              compact
              dataAttr="data-prep-kind"
              options={PREP_KIND_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
              onPick={(key) => setKind(key as PrepKind)}
            />
          </SheetChoice>
          <SheetField
            label={kind === 'meeting' ? 'Meeting title' : kind === 'payment' ? 'What is this payment for?' : 'What is it?'}
          >
            <input
              name="label"
              type="text"
              required
              maxLength={200}
              placeholder={
                kind === 'meeting'
                  ? 'e.g. Final venue walkthrough'
                  : kind === 'payment'
                    ? 'e.g. Caterer balance'
                    : 'e.g. Final dress fitting'
              }
              disabled={isPending}
            />
          </SheetField>
          {kind === 'payment' ? (
            <SheetField label="Amount (₱)">
              <input
                name="amount_php"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                required
                placeholder="e.g. 25000"
                disabled={isPending}
              />
            </SheetField>
          ) : null}
          <SheetField label={kind === 'payment' ? 'Due date' : 'When?'}>
            <input name="due_date" type="date" required defaultValue={today} disabled={isPending} />
          </SheetField>
          <SheetField label={<>Notes <span className="text-ink/40">(optional)</span></>}>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="Anything to remember for this step"
              disabled={isPending}
            />
          </SheetField>

          {errorMessage ? (
            <p role="alert" className="text-xs text-danger-700">
              {errorMessage}
            </p>
          ) : null}
        </form>
      </ScheduleSheet>
    </>
  );
}

// ── Delete ──────────────────────────────────────────────────────────────

/**
 * 👈 A HAND-ADDED STEP'S DELETE IS ITS SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW —
 * NO VISIBLE ✕ ON ROWS"). It was a small trash button on the row (`DeletePreparationItemButton`); now the row itself is
 * wrapped in THE ONE SWIPE (`app/_components/swipe-to-delete.tsx`) — swipe left on a phone, the hover trash on a
 * computer — and the delete waits out the Undo window (`deleteWithUndo`): the row goes at once, Undo brings it back and
 * nothing was written, a refusal brings it back and says so. Same write as before (`deletePreparationItem`, the same
 * FormData). Only the manual / supplier-added rows (`event_preparation_items`) get it; autofill rows stay read-only.
 *
 * The page's Undo toast is mounted here, once per list (`UndoToastHost` draws only its first mount).
 */
export function PrepItemSwipe({
  eventId,
  itemId,
  label,
  children,
}: {
  eventId: string;
  itemId: string;
  label: string;
  children: ReactNode;
}) {
  const [gone, setGone] = useState(false);
  if (gone) return <div hidden data-swipe-gone="" />;
  return (
    <>
      <UndoToastHost />
      <SwipeToDelete
        label={`Delete ${label}`}
        surfaceClass="bg-cream"
        onDelete={() =>
          deleteWithUndo({
            label: `“${label}” deleted`,
            hide: () => setGone(true),
            restore: () => setGone(false),
            commit: () => {
              const fd = new FormData();
              fd.set('event_id', eventId);
              fd.set('item_id', itemId);
              return deletePreparationItem(fd);
            },
            failed: `Couldn’t delete “${label}”. It’s back — try again.`,
          })
        }
      >
        {children}
      </SwipeToDelete>
    </>
  );
}
