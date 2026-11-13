'use client';

import { useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { formatCount } from '@/lib/format-number';
import { StayForm } from '@/app/_components/stay-form';

/**
 * "USES" — which halls a card books (owner 2026-10-14 🏛 "Approve all", prototype "A card uses halls": the maker's
 * Schedule row becomes **Uses** — one list with checkmarks, pick one or more; "A + B · joined"). The card books every
 * hall it uses (`vendor_service_halls` → `resolvePoolIdsForService` → `acquire_schedule_pools`, all-or-nothing).
 *
 * Posts the shipped `setServiceHalls` through its stay door (the card stays open — owner 2026-10-26 "a save never resets
 * the screen"); "Save" appears only when the ticks changed, so opening the list never writes.
 * Shown on a card only when the shop has halls.
 */
export function HallsUsesPick({
  serviceId,
  halls,
  uses,
  action,
}: {
  serviceId: string;
  halls: readonly { poolId: string; name: string }[];
  /** The halls this card uses now. */
  uses: readonly string[];
  /** The shipped `setServiceHalls`. */
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>([...uses]);
  const changed = picked.length !== uses.length || picked.some((p) => !uses.includes(p));
  const words = picked.length > 0 ? `${halls.filter((h) => picked.includes(h.poolId)).map((h) => h.name).join(' · ')}${picked.length > 1 ? ' · joined' : ''}` : 'Which halls this card books';
  return (
    <StayForm door="supCalendar.setServiceHalls" action={action} className="flex min-h-14 flex-wrap items-center gap-3 border-t border-[color:var(--m-line)] py-2" data-halls-uses={serviceId}>
      <input type="hidden" name="vendor_service_id" value={serviceId} />
      <input type="hidden" name="return_to" value="shop" />
      {picked.map((id) => (
        <input key={id} type="hidden" name="pool_ids" value={id} />
      ))}
      <MapPin aria-hidden className="h-5 w-5 flex-none text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-ink">Uses</span>
        <span className="block truncate text-sm text-[color:var(--m-slate-2)]">{words}</span>
      </span>
      <PickMenu
        label="Uses which halls"
        value={picked[0] ?? null}
        picked={picked}
        buttonText={`${formatCount(picked.length)} of ${formatCount(halls.length)}`}
        options={halls.map((h) => ({ key: h.poolId, label: h.name }))}
        onPick={(k) => setPicked((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))}
        dataAttr="data-halls-uses-pick"
        className="!min-h-11"
      />
      {changed ? <SupplierSubmit tone="brand" main icon={<Check aria-hidden strokeWidth={1.9} />} label="Save" pendingLabel="Saving…" /> : null}
    </StayForm>
  );
}
