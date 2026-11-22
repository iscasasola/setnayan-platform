'use client';

import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * 🎁 The two picks of Admin › Gifts' "Send a gift from Setnayan" (owner 14 Nov 2026): what to send, and how many (gift
 * stock only). PickMenu, never a raw select; each posts through a hidden input exactly as the select did.
 */
export function SetnayanGiftPicks({
  gifts,
  maxUnits,
}: {
  /** `stock:<pack code>` (live catalogue) and `plan:<tier>`, already worded. */
  gifts: ReadonlyArray<{ key: string; label: string }>;
  maxUnits: number;
}) {
  const [gift, setGift] = useState(gifts[0]?.key ?? '');
  const [units, setUnits] = useState('1');
  const unitOptions = Array.from({ length: maxUnits }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[14rem] space-y-1">
        <span className="block text-xs font-medium text-ink/70">Gift</span>
        <input type="hidden" name="gift" value={gift} />
        <PickMenu label="Gift" value={gift} options={gifts} onPick={setGift} dataAttr="data-setnayan-gift-pick" className="w-full !min-h-11" />
      </div>
      {gift.startsWith('stock:') ? (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-ink/70">How many</span>
          <input type="hidden" name="units" value={units} />
          <PickMenu label="How many" value={units} options={unitOptions} onPick={setUnits} dataAttr="data-setnayan-gift-units" className="!min-h-11" />
        </div>
      ) : null}
    </div>
  );
}
