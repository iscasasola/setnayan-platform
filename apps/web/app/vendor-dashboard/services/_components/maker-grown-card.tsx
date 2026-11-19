'use client';

import { useState } from 'react';
import { couplePhotoShare } from '@/app/_actions/couple-photo-share-actions';
import { cardHideSaveError } from '@/lib/service-card-hides';
import { overlayTyped, type MakerGrownCard, type MakerTyped } from '@/lib/service-card-for-maker';
import { ServiceDetailsSheet, type GrownCardOwner } from '@/app/v/[slug]/_components/service-details-sheet';

/**
 * 🃏 THE CARD MAKER'S GROWN CARD (ruling c160a2aa, 2026-11-16). The pinned card's tap rises into the SHIPPED grown card
 * (`ServiceDetailsSheet`), from the tapped face, with the typed name · price · included lines laid over the saved card
 * (`overlayTyped`) — and the shop's hide per card, 👁 Couple view and the card's opens.
 *
 * 🔑 HIDING LIVES ONLY HERE. The hide wiring moved from the shop page's gallery (`services-gallery.tsx`, retired there by
 * the same ruling) unchanged: a toggle is drawn only once the save SUCCEEDED — never flipped first and put back, which
 * would look like it worked. While it saves the item is marked busy; a failed or refused save leaves it as it was and
 * says so. Saved through the existing `couplePhotoShare` dispatcher (op `card_hide`) — no new server action.
 *
 * `inquireMode="none"`: the shop's own card offers no Inquire — a button that does nothing is worse than none.
 */
export function MakerGrownCardSheet({
  open,
  grown,
  typed,
  shopName,
  from,
  onClose,
}: {
  /** Mounted for the whole maker so what was hidden here survives closing and re-opening; drawn only while open. */
  open: boolean;
  grown: Extract<MakerGrownCard, { status: 'ok' }>;
  typed: MakerTyped;
  shopName: string | null;
  from: HTMLElement | null;
  onClose: () => void;
}) {
  const cardId = grown.card.id;
  const [hides, setHides] = useState<string[]>(grown.hidden);
  const [pendingHide, setPendingHide] = useState<string[]>([]);
  const [hideError, setHideError] = useState<string | null>(null);
  const toggleHide = (key: string, hide: boolean) => {
    if (pendingHide.includes(key)) return;
    const busy = (on: boolean) =>
      setPendingHide((p) => {
        const cur = new Set(p);
        if (on) cur.add(key);
        else cur.delete(key);
        return [...cur];
      });
    busy(true);
    setHideError(null);
    const settle = (error: string | null) => {
      busy(false);
      if (error) {
        setHideError(error);
        return;
      }
      setHides((h) => {
        const cur = new Set(h);
        if (hide) cur.add(key);
        else cur.delete(key);
        return [...cur];
      });
    };
    couplePhotoShare({ op: 'card_hide', vendorServiceId: cardId, key, hidden: hide })
      .then((reply) => settle(cardHideSaveError(reply.op === 'card_hide' ? reply.result : null, hide)))
      .catch(() => settle(cardHideSaveError(null, hide)));
  };
  const owner: GrownCardOwner | null = grown.curate
    ? {
        hidden: new Set(hides),
        saving: new Set(pendingHide),
        saveError: hideError,
        onToggle: (key, hide) => toggleHide(key, hide),
        opens: grown.opens,
      }
    : null;

  if (!open) return null;
  return (
    <ServiceDetailsSheet
      card={overlayTyped(grown.card, typed)}
      inquireMode="none"
      shopName={shopName}
      from={from}
      owner={owner}
      onClose={onClose}
    />
  );
}
