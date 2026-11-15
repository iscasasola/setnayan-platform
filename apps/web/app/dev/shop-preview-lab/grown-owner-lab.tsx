'use client';

import { useState } from 'react';
import { ServiceDetailsSheet } from '@/app/v/[slug]/_components/service-details-sheet';
import type { ServiceCard } from '@/lib/service-card-view-model';

/**
 * 🃏 The shop's OWN grown card on lab data (ruling 5970): hide per card, 👁 Couple view and the card's opens — the real
 * sheet, with the hides kept in this page (nothing is written). `/dev/shop-preview-lab?view=card-owner`.
 */
export function GrownOwnerLab({ card, hidden: start }: { card: ServiceCard; hidden: string[] }) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(start));
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button type="button" className="m-4 underline" onClick={() => setOpen(true)}>
        Open the card again
      </button>
    );
  }
  return (
    <ServiceDetailsSheet
      card={card}
      inquireMode="focus"
      shopName="Bloom & Co."
      onClose={() => setOpen(false)}
      owner={{
        hidden,
        saving: new Set<string>(),
        saveError: null,
        opens: 37,
        onToggle: (key, hide) =>
          setHidden((h) => {
            const next = new Set(h);
            if (hide) next.add(key);
            else next.delete(key);
            return next;
          }),
      }}
    />
  );
}
