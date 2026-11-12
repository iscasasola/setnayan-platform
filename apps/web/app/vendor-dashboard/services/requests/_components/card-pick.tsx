'use client';

/**
 * "Choose one of your cards" — the ONE dropdown (PickMenu), posting `vendor_service_id` from a hidden input so the
 * request page's form (a stay door) sends it exactly as the raw select did.
 */
import { useState } from 'react';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function CardPick({ cards }: { cards: ReadonlyArray<{ id: string; title: string }> }) {
  const [picked, setPicked] = useState('');
  return (
    <>
      <input type="hidden" name="vendor_service_id" value={picked} />
      <PickMenu
        label="Choose one of your cards"
        value={picked || null}
        buttonText={picked ? cards.find((c) => c.id === picked)?.title : 'Choose one of your cards'}
        options={cards.map((c) => ({ key: c.id, label: c.title }))}
        className="w-full border border-ink/15"
        onPick={setPicked}
      />
    </>
  );
}
