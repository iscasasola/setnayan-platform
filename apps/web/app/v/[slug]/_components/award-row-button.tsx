'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ImageBadge } from '@/app/_components/image-badge';
import type { AwardRowItem } from '@/lib/shop-award-fact';

/**
 * 🏅 ONE AWARD IN THE SHOP PAGE'S AWARDS ROW — its badge + one plain fact, as ONE button that opens it full screen
 * (v16 `data-b`). The full screens are the award kit's (app/_components/award, #7752), reused as shipped and fetched
 * only on the tap that opens one, so the page's first load is unchanged:
 *   · a tiered badge → `BadgeFullscreen` (its tier, its family's tap show) — never "You achieved this after N days",
 *     which is the shop owner's view, not the public page's (v16, owner 15 Nov);
 *   · a seal → `SealPlaque` with the date its row was given.
 * The words are the PUBLIC page's (v16 `openFS`: "mean: fact + '.'" for a seal, "fact + ' on Setnayan.'" for a badge) —
 * never the kit's owner-facing copy ("Congratulations! … you stood first"), which speaks to the shop, not a couple.
 */
const LazyBadgeFullscreen = dynamic(() => import('@/app/_components/award/badge-fullscreen').then((m) => m.BadgeFullscreen), {
  ssr: false,
});
const LazySealPlaque = dynamic(() => import('@/app/_components/award/seal-plaque').then((m) => m.SealPlaque), { ssr: false });

export function AwardRowButton({ item, shopName }: { item: AwardRowItem; shopName: string }) {
  const [open, setOpen] = useState(false);
  const origin = useRef<HTMLSpanElement | null>(null);
  const big = <ImageBadge {...item.image} uid={`full-${item.key.replace(/[^a-z0-9]/gi, '-')}`} size={168} label={item.fact} />;
  const { open: o } = item;


  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-2 text-left" data-shop-award-fact="">
        <span ref={origin} className="inline-flex leading-[0]" data-shop-badge={item.key}>
          <ImageBadge {...item.image} uid={`shop-${item.key.replace(/[^a-z0-9]/gi, '-')}`} size={48} label={item.fact} />
        </span>
        <span className="text-sm leading-snug">{item.fact}</span>
      </button>
      {open && o.kind === 'tier' ? (
        <LazyBadgeFullscreen
          art={big}
          tier={{ index: o.tierIndex, name: o.tierName }}
          title={o.title}
          lines={[`${item.fact} on Setnayan.`]}
          shopName={shopName}
          family={o.family}
          origin={origin.current}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {open && o.kind === 'seal' ? (
        <LazySealPlaque
          variant={o.seal === 'no1' ? 'no1' : 'gold'}
          seal={o.seal === 'no1' ? undefined : big}
          year={o.year ?? undefined}
          eyebrow={o.year ? `Setnayan · ${o.year}` : 'Setnayan'}
          title={o.title}
          shopName={shopName}
          awardedOn={o.awardedOn ?? undefined}
          body={`${item.fact}.`}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
