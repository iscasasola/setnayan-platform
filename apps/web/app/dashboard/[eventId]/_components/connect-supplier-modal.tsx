'use client';

/**
 * ConnectSupplierModal — [Connect] on a self-added supplier's card.
 * (owner 2026-09-21: "give the vendor a portal to connect this to their new
 * account")
 *
 * A thin shell around `SupplierConnectPanel` — the same panel the Add-manually
 * sheet shows after save — so the portal is reachable from the card at any
 * time, not only in the one render after adding.
 *
 * ⚠ OPENING IS A READ. On open it asks `readSupplierInvite` whether a link
 * already exists and shows it; the only thing that ever mints one is the
 * panel's own "Create their link" button. Looking must not create a row.
 *
 * Motion reuses the sheet's own classes (`sn-addman-veil` / `sn-addman-sheet`,
 * fill `backwards`) — the sheet's guard documents why `both` would re-anchor
 * any fixed descendant.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { readSupplierInvite, type SupplierInviteView } from '../vendors/actions';
import { SupplierConnectPanel } from './supplier-connect-panel';

export function ConnectSupplierModal({
  eventId,
  vendorId,
  vendorName,
  onClose,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // `undefined` = still reading · `null` = no link yet · a value = the link.
  // Three states, never two: rendering "Create their link" while the read is
  // still in flight would invite a couple to mint a link that already exists.
  const [invite, setInvite] = useState<SupplierInviteView | undefined>(undefined);

  useModalA11y({ open: true, onClose, containerRef: dialogRef, initialFocusRef: closeRef });

  useEffect(() => {
    let live = true;
    readSupplierInvite(eventId, vendorId)
      .then((v) => {
        if (live) setInvite(v);
      })
      .catch(() => {
        // An unreadable link is offered as "create one" — safe, because
        // `createManualVendorInvite` is idempotent and returns the existing
        // link rather than minting a second.
        if (live) setInvite(null);
      });
    return () => {
      live = false;
    };
  }, [eventId, vendorId]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-supplier-heading"
      className="sn-addman-veil fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm focus:outline-none sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sn-addman-sheet max-h-[92dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-t-2xl border-t border-ink/10 bg-cream p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Connect</p>
            <h2 id="connect-supplier-heading" className="font-display text-xl italic text-ink">
              {vendorName}
            </h2>
            <p className="mt-1 text-xs text-ink/65">
              Give them their own account — everything you recorded comes with them.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        {invite === undefined ? (
          <p className="rounded-xl border border-ink/10 bg-paper p-3 text-xs text-ink/55">
            Checking for an existing link…
          </p>
        ) : (
          <SupplierConnectPanel
            eventId={eventId}
            vendorId={vendorId}
            vendorName={vendorName}
            initial={invite}
          />
        )}
      </div>
    </div>
  );
}
