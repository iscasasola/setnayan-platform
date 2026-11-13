'use client';

/**
 * 🃏 ONE SERVICE CARD ON SHOP › SERVICES — the card, the row under it, swipe left to delete (owner 10 Nov on PR #7464,
 * verbatim: *"You placed the service card inside another frame. No. Use the service card. Add a row under. … swipe
 * left to delete"*).
 *
 *   · NO FRAME. The `<li>` draws nothing — no border, no rounded box, no fill. The card is the card; the row
 *     (`ServiceCardMenuRow`) sits directly under it at the same width, then the shop-only facts.
 *   · SWIPE LEFT ON THE CARD = Delete, through the SHIPPED swipe (`SwipeToDelete`, #7441) — no new gesture code. The
 *     card face's tap still opens the Card Maker (the face is passed in with its stretched link).
 *   · AN OPEN BOOKING REFUSES (owner: *"You cannot delete a service card until all booked are complete."*): the swipe
 *     snaps back and the line under the row names each open booking — no warning, no delete, no Undo toast. The server
 *     refuses the same (`deleteOrRetireOwnService`); this only says it before the tap.
 *   · OTHERWISE IT WARNS FIRST (owner: *"You must also warn them…"*): the house bottom sheet (`Sheet`), its
 *     lines from `deleteWarningLines` — checked against what the delete does. Only Delete calls the server.
 *   · THEN THE SHIPPED UNDO (`deleteWithUndo`): the card hides and the write WAITS for the Undo window, so Undo puts
 *     back everything — nothing was written. A card a couple ever picked is HIDDEN by the server instead of deleted
 *     (their record stays): it comes back here, offline, and the toast says so.
 *
 * 🔒 app/vendor-dashboard/services/the-card-menu-row-is-edit-share-go-online.test.ts
 */
import { useId, useState, type ReactNode } from 'react';
import { Trash2, X } from 'lucide-react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton, EqualRow } from '@/components/action-button';
import { deleteWithUndo, type CommitResult } from '@/app/_components/undo/delete-with-undo';
import { guestToast } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { ServiceCardMenuRow, type ServiceCardMenuRowProps } from './service-card-menu-row';

export type ServiceCardItemProps = {
  /** The `<li>`'s own attributes — Shop's thumb row narrows the list by them. */
  liId: string;
  live: boolean;
  nameLower: string;
  /** The card face — `ServiceCardView` + its stretched "open in the Card Maker" link. */
  face: ReactNode;
  /** The shop-only facts and the card record, under the row. */
  below?: ReactNode;
  row: Omit<ServiceCardMenuRowProps, 'action' | 'save'>;
  /** The switch's save — the shipped `toggleVendorServiceActive` (a lab passes a `save` stand-in beside it). */
  action: ServiceCardMenuRowProps['action'];
  save?: ServiceCardMenuRowProps['save'];
  /** Set when this card may NOT be deleted: its open bookings, each on its own line (or "could not check"). */
  deleteRefusal: string | null;
  /** The warning's lines (`deleteWarningLines`), shown before anything is deleted. */
  warningLines: readonly string[];
  /** The server's delete-or-hide, answered as a value (`removeVendorServiceFromList`). */
  remove: (vendorServiceId: string) => Promise<{ ok: true; retired: boolean } | { ok: false; error: string }>;
  /** A lab's stand-in for the Undo window (ms). */
  windowMs?: number;
};

export function ServiceCardItem({ liId, live, nameLower, face, below, row, action, save, deleteRefusal, warningLines, remove, windowMs }: ServiceCardItemProps) {
  const [gone, setGone] = useState(false);
  const [warn, setWarn] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const warnTitleId = `card-delete-${useId().replace(/:/g, '')}`;

  function onSwipeDelete(close: () => void) {
    close();
    if (deleteRefusal) {
      setRefusal(deleteRefusal);
      return;
    }
    setRefusal(null);
    setWarn(true);
  }

  function confirmDelete() {
    setWarn(false);
    deleteWithUndo({
      label: `${row.cardName} deleted`,
      hide: () => setGone(true),
      restore: () => setGone(false),
      windowMs,
      commit: async (): Promise<CommitResult> => {
        const r = await remove(row.vendorServiceId);
        if (!r.ok) {
          setRefusal(r.error);
          return { ok: false, error: r.error };
        }
        if (r.retired) {
          setGone(false);
          guestToast.info('Couples booked this card, so it is hidden instead of deleted — their record stays.');
        }
        return { ok: true };
      },
    });
  }

  return (
    <li
      id={liId}
      data-shop-card=""
      data-shop-card-live={live ? '1' : '0'}
      data-shop-card-name={nameLower}
      hidden={gone}
      className="scroll-mt-24 space-y-2 border-b border-ink/10 pb-5 last:border-b-0 last:pb-0"
    >
      <SwipeToDelete label={`Delete ${row.cardName}`} onDelete={onSwipeDelete} radiusClass="rounded-xl" surfaceClass="bg-cream">
        {face}
      </SwipeToDelete>
      <ServiceCardMenuRow {...row} action={action} save={save} />
      {below}
      {refusal ? (
        <p role="alert" className="whitespace-pre-line text-[13px] leading-snug text-[rgb(var(--color-danger))]" data-card-delete-refusal="">
          {refusal}
        </p>
      ) : null}
      {/* The approved prototype's frame D: the house bottom sheet, its head "Delete this card", the card named, the
          warning's lines, then Cancel · Delete at equal width (Delete destructive). Only Delete calls the server. */}
      <Sheet open={warn} onClose={() => setWarn(false)} labelledById={warnTitleId} title="Delete this card" rise>
        <div className="space-y-3 px-5 pb-2 pt-1">
          <h3 id={warnTitleId} className="text-[17px] font-semibold leading-snug text-ink">
            {`Delete “${row.cardName}”?`}
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-snug text-[color:var(--m-slate-2)]" data-card-delete-warning="">
            {warningLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <EqualRow data="card-delete">
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setWarn(false)} data-card-delete-cancel="" />
            <ActionButton tone="danger" main icon={Trash2} label="Delete" onClick={confirmDelete} data-card-delete-confirm="" />
          </EqualRow>
        </div>
      </Sheet>
    </li>
  );
}
