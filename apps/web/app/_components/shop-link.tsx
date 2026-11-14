'use client';

/**
 * 🔙 A LINK INTO A SHOP THAT KNOWS WHERE IT WAS PRESSED (SB, W1 SHOP-01 — owner: Back returns to the origin). Eight
 * doors into a shop page sent no origin, so the shop's Back fell to "See more suppliers" / Home. This one carries the
 * page it sits on (`src=page&from=<this path>`, `withShopArrival`), and the shop's Back returns there. A client link
 * only for `usePathname` — it renders the same `<Link>` the doors drew.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';

import { SHOP_ARRIVAL_SRC, withShopArrival } from '@/lib/shop-back';

export function shopHrefFrom(slug: string, from: string | null, hash = ''): string {
  return withShopArrival(`/v/${encodeURIComponent(slug)}${hash}`, { src: from ? SHOP_ARRIVAL_SRC.page : null, from });
}

export function ShopLink({ slug, hash = '', ...rest }: { slug: string; hash?: string } & Omit<ComponentProps<typeof Link>, 'href'>) {
  const from = usePathname();
  return <Link href={shopHrefFrom(slug, from, hash)} {...rest} />;
}
