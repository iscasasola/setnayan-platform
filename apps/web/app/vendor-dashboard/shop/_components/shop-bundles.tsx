import Link from 'next/link';
import { ChevronRight, Info, Package } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatCentavosPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { NEW_BUNDLE_HREF } from '@/lib/shop-add-choices';

/**
 * 📦 SHOP › YOUR SERVICES › BUNDLES — first in the list (Build 3 Lane E item 7, owner: *"Bundles should be first"*).
 * The shipped packages (`vendor_packages`), each a row to its maker (`/vendor-dashboard/packages/<id>`).
 *
 * EMPTY looks finished: one honest line and the New bundle door — DIMMED, never hidden, while the shop has fewer than
 * two service cards (the bundle maker's "Add a card" lists the shop's own cards; the line says why). UNREAD says so —
 * never "No bundles yet" to a shop that has them.
 * 🔒 shop/the-services-are-one-list.test.ts
 */
export type ShopBundle = { id: string; name: string; priceCentavos: number | null; live: boolean; cards: number };

export function ShopBundles({ bundles, cards }: { bundles: readonly ShopBundle[] | null; cards: number | null }) {
  return (
    <div className="pb-1 pt-2" data-shop-bundles="">
      <div className="flex items-baseline justify-between pb-1.5">
        <p className="sn-eye">Bundles</p>
        <span className="text-[11.5px] text-ink/50">several cards as one price</span>
      </div>
      {bundles === null ? (
        <p role="status" className="rounded-2xl px-4 py-3 text-[13.5px] text-ink/70" style={{ background: 'var(--m-paper)', boxShadow: '0 1px 2px color-mix(in srgb, var(--m-ink) 6%, transparent)' }} data-shop-bundles-unread="">
          Couldn&rsquo;t load your bundles just now — they are still on your page.
        </p>
      ) : bundles.length === 0 ? (
        <div className="space-y-2.5 rounded-2xl px-4 py-3" style={{ background: 'var(--m-paper)', boxShadow: '0 1px 2px color-mix(in srgb, var(--m-ink) 6%, transparent)' }} data-shop-bundles-empty="">
          <p className="flex items-start gap-2 text-[14px] leading-snug text-ink/75">
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.9} />
            <span>{cards !== null && cards < 2 ? 'No bundles yet · a bundle needs two service cards first' : 'No bundles yet · several cards as one price'}</span>
          </p>
          <span className={cards !== null && cards < 2 ? 'inline-flex opacity-50' : 'inline-flex'}>
            <ActionButton tone="neutral" icon={<Package aria-hidden strokeWidth={1.9} />} label="New bundle" href={NEW_BUNDLE_HREF} />
          </span>
        </div>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-2xl px-4" style={{ background: 'var(--m-paper)', boxShadow: '0 1px 2px color-mix(in srgb, var(--m-ink) 6%, transparent)' }} data-shop-bundle-list="">
          {bundles.map((b) => (
            <li key={b.id}>
              <Link href={`/vendor-dashboard/packages/${b.id}`} className="sn-press flex min-h-[64px] items-center gap-3 py-2.5" data-shop-bundle={b.id}>
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
                  <Package className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{b.name}</span>
                  <span className="block truncate text-[13px] text-ink/60">
                    {formatCount(b.cards)} {b.cards === 1 ? 'card' : 'cards'}
                    {b.priceCentavos != null ? ` · ${formatCentavosPhp(b.priceCentavos)}` : ''} · {b.live ? 'live' : 'draft'}
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
