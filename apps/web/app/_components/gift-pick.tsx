'use client';

import { ChevronDown, Gift } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { giftLine, giftMenu, giftTip, type GiftHost, type GiftPick } from '@/lib/gift-pick';
import type { FreeByKind, ShopGiftPack } from '@/lib/shop-gifts';

/**
 * THE GIFT ROW — one field, drawn the same on the service card and the bundle (makers prototype 7 Nov 2026 § 3 / § 4:
 * "one Gift dropdown on the card — No gift (default) · Setnayan gift · the shop's packs — the gift's own ⓘ carries the
 * shipped sentences").
 *
 * The prototype's one rhythm: a label ("Gift · optional" + ⓘ) · its 48 px box (the shipped `PickMenu`, a dropdown —
 * any set of choices is one) · a quiet hint naming what the pick does. The rules are `lib/gift-pick.ts`; this file only
 * draws them. It owns no storage: the card posts hidden inputs, the bundle keeps a draft — each from `onPick`.
 *
 * 🔒 Held by `lib/the-card-gift-is-one-dropdown.test.ts`.
 */
export function GiftPickRow({
  host,
  value,
  onPick,
  packs,
  free,
  dataAttr,
  className = '',
}: {
  host: GiftHost;
  value: GiftPick;
  onPick: (next: GiftPick) => void;
  /** The giftable packs on the live catalogue — `null` = unread (only No gift · Setnayan gift are offered then). */
  packs: readonly ShopGiftPack[] | null;
  /** What the shop can still offer of each kind — `null` = unread (packs listed as unreadable, never as empty). */
  free: FreeByKind | null;
  /** The guard's anchor on the dropdown button. */
  dataAttr: string;
  className?: string;
}) {
  const options = giftMenu(packs, free, value);
  const picked = options.find((o) => o.key === value);
  return (
    <div className={className} data-gift-row={host}>
      <div className="mb-1.5 flex items-center gap-2 text-[14px] font-medium text-ink">
        <span>
          Gift <span className="text-[12px] font-normal text-ink/50">optional</span>
        </span>
        <InfoTip label="" ariaLabel="About gifts" align="start">
          <span className="block font-semibold">Gifts</span>
          {giftTip(host).map((t) => (
            <span key={t} className="mt-1 block">
              {t}
            </span>
          ))}
        </InfoTip>
      </div>
      <PickMenu
        label="Gift"
        value={value}
        options={options}
        onPick={onPick}
        dataAttr={dataAttr}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-ink/15 bg-raised px-4 text-left text-[15px] text-ink"
        trigger={
          <>
            <span className={`flex min-w-0 items-center gap-2 truncate ${value ? '' : 'text-ink/55'}`}>
              {value ? <Gift aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={1.75} /> : null}
              <span className="truncate">{picked?.label ?? 'No gift'}</span>
            </span>
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
          </>
        }
      />
      <p className="mt-1.5 text-[12px] leading-snug text-ink/55" data-gift-hint="">
        {giftLine(host, value, packs, free)}
      </p>
    </div>
  );
}
