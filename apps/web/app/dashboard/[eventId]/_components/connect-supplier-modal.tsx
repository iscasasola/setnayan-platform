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
 * Drawn in the house `Sheet` since 2026-10-12 (it was a hand-made dialog with
 * its own veil and close button).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePortalHost } from '@/lib/use-portal-host';
import { Sheet } from '@/app/_components/sheet';
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
  const portalHost = usePortalHost();
  // `undefined` = still reading · `null` = no link yet · a value = the link.
  // Three states, never two: rendering "Create their link" while the read is
  // still in flight would invite a couple to mint a link that already exists.
  const [invite, setInvite] = useState<SupplierInviteView | undefined>(undefined);

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

  // The house Sheet (INTERACTION_RULES § 9: a popup darkens AND blurs the page,
  // nothing behind it works, tapping the dark part closes it; Esc, focus trap
  // and scroll lock are the sheet's own).
  // 🔑 DRAWN INTO <body>. The dashboard's page wrapper is transformed and
  // contained, so a `fixed` sheet mounted inside it is trapped under the
  // portalled Find thumb row and the bottom bar (walked 2026-10-12: the thumb row
  // sat over the walk's footer). Every sheet on this page goes to <body> — once
  // mounted, so a server render (the dev lab draws the record sheet at once)
  // never reaches for a `document` it does not have.
  if (!portalHost) return null;
  return createPortal(
    <Sheet open onClose={onClose} labelledById="connect-supplier-heading" rise>
      <div className="px-5 pb-5 pt-5" data-connect-supplier="">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Connect</p>
        <h2 id="connect-supplier-heading" className="pr-10 text-[20px] font-semibold tracking-[-0.01em] text-ink">
          {vendorName}
        </h2>
        <p className="mt-1 text-[13px] text-ink/65">
          Give them their own account — everything you recorded comes with them.
        </p>
        <div className="mt-4 border-t border-ink/10 pt-4">
          {invite === undefined ? (
            <p className="text-[13px] text-ink/55" aria-live="polite">
              Checking for an existing link…
            </p>
          ) : (
            <SupplierConnectPanel eventId={eventId} vendorId={vendorId} vendorName={vendorName} initial={invite} />
          )}
        </div>
      </div>
    </Sheet>,
    portalHost,
  );
}
