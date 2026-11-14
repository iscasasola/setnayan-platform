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

/**
 * The shop address (`/v/<slug>`, optionally with `#section`) carrying the page it was pressed on. Callers write the
 * address as a LITERAL (`href={`/v/${slug}`}`) so the route map (`port:baseline`, `ugat:screens`) still sees the door.
 */
export function shopHrefFrom(href: string, from: string | null): string {
  return withShopArrival(href, { src: from ? SHOP_ARRIVAL_SRC.page : null, from });
}

export function ShopLink({ href, ...rest }: { href: string } & Omit<ComponentProps<typeof Link>, 'href'>) {
  const from = usePathname();
  return <Link href={shopHrefFrom(href, from)} {...rest} />;
}
