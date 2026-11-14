import Link from 'next/link';
import { ChevronRight, Store } from 'lucide-react';
import type { SwitcherShop } from '@/app/_components/account-switcher/get-switcher-data';
import { VendorAvatar, deriveVendorInitials } from '@/app/_components/vendor-avatar';
import { formatCount } from '@/lib/format-number';
import type { HomeSeg } from '@/lib/home-segments';
import { readHomeCardCounts } from '@/lib/home-profile.server';
import { HomePinnedRow } from './home-pin';

/**
 * home-shop-segment.tsx — HOME › SHOP (owner 11 Nov 2026, "One profile page approve" — v3 rows 6 and 7), drawn only
 * for an account that OWNS a shop (`ownsAShop`, the 21 Oct gate the Shop tab used).
 *
 * SLICE 1 draws the shop's line, the pinned row (`Shop ▾` · N service cards · N online · ＋ Card · ⚙) and the ONE door
 * the Shop tab used to be: "Open the Shop dashboard" — Today · Clients · Shop · Portfolio stay there, every room kept
 * (`vendor-nav-destinations.ts`). The cards themselves on Home (the shipped `service-card-face` with Edit · Share ·
 * Online/Offline on the card) are slice 2: they need the shop console's editing context, which lives on
 * `/vendor-dashboard/shop`, and Rule 0 says move it whole rather than redraw half of it here.
 */
export async function HomeShopSegment({ shop, segs }: { shop: SwitcherShop; segs: readonly HomeSeg[] }) {
  const counts = await readHomeCardCounts(shop.id);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6" data-home-shop="">
      <HomePinnedRow
        seg="shop"
        segs={segs}
        sub={[
          { key: 'shop:dashboard', label: 'Shop dashboard', group: 'Shop', href: '/vendor-dashboard' },
          { key: 'shop:cards', label: 'Service cards', group: 'Shop', href: '/vendor-dashboard/shop' },
          ...(shop.publicHref ? [{ key: 'shop:page', label: 'Your public page', group: 'Shop', href: shop.publicHref }] : []),
        ]}
        note={counts ? (counts.cards === 0 ? 'No service cards yet' : null) : 'Your cards couldn’t be counted just now'}
        doors={
          counts && counts.cards > 0
            ? [
                { key: 'cards', n: counts.cards, word: counts.cards === 1 ? 'service card' : 'service cards', href: '/vendor-dashboard/shop' },
                { key: 'online', n: counts.online, word: 'online', href: '/vendor-dashboard/shop' },
              ]
            : []
        }
        action={{ label: 'Card', ariaLabel: 'New service card', href: '/vendor-dashboard/services/new', mark: 'new-card' }}
      />

      <div className="sn-reveal mt-3 flex items-center gap-3" data-home-shop-line="">
        <VendorAvatar
          logoUrl={shop.logoUrl}
          initials={deriveVendorInitials(shop.name)}
          className="block h-11 w-11 shrink-0 rounded-xl text-center text-[13px] font-semibold leading-[2.75rem]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{shop.name}</p>
          <p className="text-[13px] text-ink/70">
            {counts ? `${formatCount(counts.cards)} ${counts.cards === 1 ? 'service card' : 'service cards'} · ${formatCount(counts.online)} online` : 'Your shop'}
          </p>
        </div>
      </div>

      <Link
        href="/vendor-dashboard"
        className="sn-press sn-reveal sn-glass-bare mt-4 flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-ink no-underline"
        data-home-shop-door=""
      >
        <Store className="h-5 w-5 shrink-0 text-ink/70" strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Open the Shop dashboard</span>
          <span className="block text-[13px] text-ink/70">Today · Clients · Shop · Portfolio</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-sn-accent" aria-hidden />
      </Link>
    </div>
  );
}
