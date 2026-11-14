'use client';

// ============================================================================
// VendorPrepForBooking — vendor-side "Add to prep schedule" control on the
// Bookings view (HYBRID Preparation schedule, 2026-06-03).
//
// Rendered per ACCEPTED booking. A booked vendor can push dated items onto
// the couple's Preparation agenda (e.g. "Send shot list", "Final headcount
// due") backed by event_preparation_items. The vendor also sees the items
// they've already added here; each deletes by its swipe, with Undo (their own
// rows only — RLS enforces).
//
// Mirrors the couple-side prep-item-controls.tsx + the canonical Setnayan
// modal (cancel-booking-button.tsx): bottom-sheet on mobile (items-end →
// sm:items-center), ESC + backdrop dismiss, mulberry CTA. Clean Editorial
// tokens only.
// ============================================================================

import { useId, useState, useTransition } from 'react';
import { Plus, Users, Wallet, X } from 'lucide-react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import {
  vendorAddPreparationItem,
  vendorDeletePreparationItem,
} from '../actions';
import { useSaveLoader } from '@/components/sd-loader';
import { ActionButton } from '@/components/action-button';
import {
  PREP_KIND_OPTIONS,
  type PrepKind,
} from '@/app/dashboard/[eventId]/schedule/_components/prep-kind-picker';
import {
  ScheduleSheet,
  SheetChoice,
  SheetField,
  SheetFoot,
} from '@/app/dashboard/[eventId]/schedule/_components/schedule-sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export type VendorPrepItem = {
  itemId: string;
  dueDate: string;
  label: string;
  notes: string | null;
  /** 'task' | 'meeting' | 'payment' — defaults to 'task' pre-migration. */
  kind: PrepKind;
  /** Pesos on payment rows; null otherwise. */
  amountPhp: number | null;
};

function formatPhpShort(php: number): string {
  return `₱${Math.round(php).toLocaleString('en-PH')}`;
}

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
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PrepKind>('task');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formId = useId();
  const save = useSaveLoader();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const shown = items.filter((it) => !hidden.has(it.itemId));

  /**
   * 👈 A prep item's delete is its SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
   * VISIBLE ✕ ON ROWS"): left on a phone, the hover trash on a computer. It hides at once and the same
   * `vendorDeletePreparationItem` is written after the Undo window (`deleteWithUndo`); a refusal brings it back and
   * says so. The page mounts the one `UndoToastHost` (bookings/surface.tsx).
   */
  function removeItem(it: VendorPrepItem) {
    const fd = new FormData();
    fd.set('item_id', it.itemId);
    deleteWithUndo({
      label: `${it.label} removed`,
      hide: () => setHidden((h) => new Set(h).add(it.itemId)),
      restore: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(it.itemId);
          return next;
        }),
      commit: () => vendorDeletePreparationItem(fd),
      failed: `Couldn’t remove “${it.label}”. It’s back — try again.`,
    });
  }

  function close() {
    if (isPending) return;
    setOpen(false);
    setErrorMessage(null);
    setKind('task');
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // The picker drives `kind` via React state — stamp it onto the payload.
    fd.set('kind', kind);
    startTransition(async () => {
      try {
        await save.run(() => vendorAddPreparationItem(fd), {
          steps: ['Adding the item'],
          hint: 'Saving',
        });
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <ActionButton tone="brand" icon={Plus} label="Add to prep schedule" onClick={() => setOpen(true)} />
      </div>

      {shown.length > 0 ? (
        <ul className="border-t border-[color:var(--m-line)]">
          {shown.map((it) => {
            const KindIcon =
              it.kind === 'meeting' ? Users : it.kind === 'payment' ? Wallet : null;
            return (
              <SwipeToDelete
                key={it.itemId}
                as="li"
                label={`Remove ${it.label}`}
                word="Remove"
                onDelete={() => removeItem(it)}
                radiusClass="rounded-none"
                surfaceClass="bg-[var(--m-paper)]"
              >
              <div
                className="flex min-h-14 items-center gap-3 border-b border-[color:var(--m-line)] py-2"
                data-vendor-prep-item=""
              >
                {KindIcon ? (
                  <KindIcon
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-mulberry"
                    strokeWidth={1.75}
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{it.label}</span>
                  <span className="block text-[13px] text-[color:var(--m-slate-2)]">
                    {formatDateShort(it.dueDate)}
                  </span>
                </span>
                {it.kind === 'payment' && it.amountPhp != null ? (
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
                    {formatPhpShort(it.amountPhp)}
                  </span>
                ) : null}
              </div>
              </SwipeToDelete>
            );
          })}
        </ul>
      ) : null}

      <ScheduleSheet
        open={open}
        onClose={close}
        id="vendor-add-prep-headline"
        title="Add to their prep schedule"
        aside={eventName}
        data="vendor-add-step"
        foot={
          <SheetFoot>
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={close} disabled={isPending} />
            <ActionButton
              tone="brand"
              main
              icon={Plus}
              label={isPending ? 'Adding…' : 'Add item'}
              type="submit"
              form={formId}
              disabled={isPending}
              waiting={isPending}
            />
          </SheetFoot>
        }
      >
        <p className="text-[13px] text-[color:var(--m-slate-2)]">
          This dated step appears on{' '}
          <span className="font-medium text-ink">{eventName}</span>&rsquo;s
          Preparation schedule. They can remove it anytime.
        </p>
        <form id={formId} onSubmit={onSubmit} className="space-y-3.5">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
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
            label={
              kind === 'meeting'
                ? 'Meeting title'
                : kind === 'payment'
                  ? 'What is this payment for?'
                  : 'What should they do?'
            }
          >
            <input
              name="label"
              required
              maxLength={200}
              placeholder={
                kind === 'meeting'
                  ? 'e.g. Pre-event consultation'
                  : kind === 'payment'
                    ? 'e.g. Package balance'
                    : 'e.g. Send final shot list'
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
                placeholder="e.g. 15000"
                disabled={isPending}
              />
            </SheetField>
          ) : null}
          <SheetField label={kind === 'payment' ? 'Due date' : 'By when?'}>
            <input name="due_date" type="date" required defaultValue={todayLocal()} disabled={isPending} />
          </SheetField>
          <SheetField label={<>Notes <span className="text-[color:var(--m-slate-2)]">(optional)</span></>}>
            <textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="Any detail the couple should know"
              disabled={isPending}
            />
          </SheetField>

          {errorMessage ? (
            <p role="alert" className="text-[13px] text-danger-700">
              {errorMessage}
            </p>
          ) : null}
        </form>
      </ScheduleSheet>
    </div>
  );
}
