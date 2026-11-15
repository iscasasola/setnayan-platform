import { Info, Package } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { LockedFeature, type LockNeed } from '@/app/_components/lock/locked-feature';
import { NEW_BUNDLE_HREF } from '@/lib/shop-add-choices';
import { BundlePreviewSample } from '@/app/vendor-dashboard/packages/_components/bundle-preview-sample';
import { ShopBundleCard, type ShopBundle } from './shop-bundle-card';

export type { ShopBundle } from './shop-bundle-card';

/**
 * 📦 SHOP › YOUR BUNDLES AND SERVICES › BUNDLES — first in the list (Build 3 Lane E item 7, owner: *"Bundles should be
 * first"*; 9 Nov: the list is "Your bundles and services", bundles listed first in it).
 *
 * Build 6 · Lane D: each bundle is a BUNDLE CARD wearing the service card row (`ShopBundleCard` — the card, then Edit ·
 * Share · Online/Offline; swipe left deletes with the warning; off/delete refused while a booking is open).
 *
 * 🔒 THE SHARED LOCK, SHOWN NEVER HIDDEN (lib/locks.ts `bundleMaker`): a shop that may not make bundles sees the
 * Bundle Maker row with its 🔒 — tap → The problem · The solution · a view-only sample · the papers · Get verified.
 *
 * EMPTY looks finished: one honest line and the New bundle door — DIMMED, never hidden, while the shop has fewer than
 * two service cards (a bundle is two or more; the line says why). UNREAD says so — never "No bundles yet" to a shop that
 * has them.
 * 🔒 shop/the-services-are-one-list.test.ts · shop/bundle-cards-wear-the-card-row.test.ts
 */
export function ShopBundles({ bundles, cards, lock = null }: { bundles: readonly ShopBundle[] | null; cards: number | null; lock?: LockNeed | null }) {
  const empty = 'rounded-2xl px-4 py-3';
  const ground = { background: 'var(--m-paper)', boxShadow: '0 1px 2px color-mix(in srgb, var(--m-ink) 6%, transparent)' };
  return (
    <div className="pb-1 pt-2" data-shop-bundles="">
      <div className="flex items-baseline justify-between pb-1.5">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">Bundles</p>
        <span className="text-xs text-ink/70">several cards as one price</span>
      </div>
      {lock ? (
        <div data-shop-bundles-locked="">
          <LockedFeature lock="bundleMaker" need={lock} lead={<Package aria-hidden className="h-[18px] w-[18px] flex-none text-ink/70" strokeWidth={1.75} />} preview={<BundlePreviewSample />} />
        </div>
      ) : bundles === null ? (
        <p role="status" className={`${empty} text-[13.5px] text-ink/70`} style={ground} data-shop-bundles-unread="">
          Couldn&rsquo;t load your bundles just now — they are still on your page.
        </p>
      ) : bundles.length === 0 ? (
        <div className={`space-y-2.5 ${empty}`} style={ground} data-shop-bundles-empty="">
          <p className="flex items-start gap-2 text-sm leading-snug text-ink/75">
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" strokeWidth={1.9} />
            <span>{cards !== null && cards < 2 ? 'No bundles yet · a bundle needs two service cards first' : 'No bundles yet · several cards as one price'}</span>
          </p>
          <span className={cards !== null && cards < 2 ? 'inline-flex opacity-50' : 'inline-flex'}>
            <ActionButton tone="neutral" icon={<Package aria-hidden strokeWidth={1.9} />} label="New bundle" href={NEW_BUNDLE_HREF} className="!h-11" />
          </span>
        </div>
      ) : (
        <ul className="space-y-5" data-shop-bundle-list="">
          {bundles.map((b) => (
            <ShopBundleCard key={b.id} bundle={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
