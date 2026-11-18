'use client';

import { MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * ⋯ on a booking-fee row (design template 2026-11-14, "Booking fees · after · the ⋯ menu"). It keeps the one door
 * the row always had — the payment search — and adds the supplier's shop, which already exists. Nothing on it
 * decides money; money is still confirmed where the proof is. The fee's code moves into the menu's head.
 *
 * ⚠ The drawing also shows "Open the bill". There is no admin page for one bill (order) today, so it is NOT drawn
 * here — a door to nowhere would be worse than none. Listed for the second pass in the PR's STATUS.
 */
export function FeeRowMore({
  title,
  code,
  paymentHref,
  shopHref,
}: {
  title: string;
  code: string | null;
  paymentHref: string | null;
  shopHref: string;
}) {
  const router = useRouter();
  const options = [
    ...(paymentHref ? [{ key: 'payment', label: 'Check their payment' }] : []),
    { key: 'shop', label: 'Open the shop' },
  ];
  return (
    <PickMenu
      label={`More for ${title}`}
      value=""
      options={options}
      head={
        <span className="block px-1 pb-1">
          <b className="block text-[15px] font-semibold text-ink">{title}</b>
          {code ? <span className="block text-[13px] text-[color:var(--m-slate-2)]">{code}</span> : null}
        </span>
      }
      trigger={<MoreHorizontal aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.75} />}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/5"
      onPick={(key) => {
        if (key === 'payment' && paymentHref) router.push(paymentHref);
        else if (key === 'shop') router.push(shopHref);
      }}
    />
  );
}
