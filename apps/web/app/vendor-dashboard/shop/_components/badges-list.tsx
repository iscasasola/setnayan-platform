import { Gift, Plus } from 'lucide-react';
import { routes } from '@/lib/routes';
import { goalWords, isShopBadgeKey } from '@/lib/supplier-store';
import { SHOP_BADGE_STEPS, TIER_KEYS, tierName } from '@/lib/badge-tiers';
import { badgeArtSrc, type ShelfTile } from '@/lib/shop-badge-shelf';
import { formatCount } from '@/lib/format-number';
import { ActionButton } from '@/components/action-button';
import { ToolFail } from '@/app/vendor-dashboard/_components/tool-page';
import { BadgeArt, BadgeRing, FittedArt } from './shop-badge-row';

/**
 * 🏅 THE BADGES PAGE'S LIST (drawing `supplier_store_graphs_badges_2026-11-23` v10, F10) — every badge with its ring,
 * what it counts, what is left, the seven-step ladder and the next gift. The page reads once and hands the shelf here;
 * the supplier lab mounts the same list on fixtures. `null` = the badges could not be read (said, never zero).
 */
export function BadgesList({ tiles }: { tiles: ShelfTile[] | null }) {
  return (
    <>
      {tiles === null ? (
        <ToolFail title="Couldn’t load your badges" line="Nothing is lost — try again in a moment." retryHref={routes.vendorDashboard.shop.badges()} />
      ) : (
        <ul className="mt-3 space-y-3" data-badges-page="">
          {orderForPage(tiles).map((t, i) => (
            <li key={t.key} id={t.key} className="sn-frame scroll-mt-24 p-4" data-badge-card={t.key} data-badge-state={t.state}>
              <BadgeCard tile={t} i={i} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5">
        <ActionButton tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label="Pick the badges on your Shop" href={routes.vendorDashboard.shop.store.shelf('badges')} />
      </div>
    </>
  );
}

/** The five tiered badges in the drawing's order, then Setnayan Verified. */
function orderForPage(tiles: ShelfTile[]): ShelfTile[] {
  const tiered = tiles.filter((t) => t.key !== 'verified');
  const verified = tiles.filter((t) => t.key === 'verified');
  return [...tiered, ...verified];
}

function BadgeCard({ tile, i }: { tile: ShelfTile; i: number }) {
  const goal = goalWords(tile);
  return (
    <>
      <div className="flex items-start gap-3">
        <BadgeRing tile={tile} i={i}>
          <BadgeArt tile={tile} size={60} />
        </BadgeRing>
        <div className="min-w-0 flex-1">
          <h2 className="text-sn-xl font-bold leading-tight text-ink">{tile.title}</h2>
          <p className="mt-0.5 text-sn-md leading-snug text-[color:var(--m-slate-2)]">{tile.how}</p>
          {goal ? (
            <p className="mt-1 text-sn-lg font-semibold text-[color:var(--m-orange-deep)]" data-badge-goal="">
              {goal}
            </p>
          ) : tile.state === 'unread' || tile.state === 'not_counted' ? (
            <p className="mt-1 text-sn-base font-semibold text-[rgb(var(--color-warn))]">{tile.sub}</p>
          ) : tile.key === 'verified' ? (
            <p className="mt-1 text-sn-base font-semibold text-ink">{tile.state === 'earned' ? 'Earned. Your papers were approved.' : 'Not yet'}</p>
          ) : null}
          {tile.now ? <p className="text-sn-base text-ink">{tile.now.replace(/^Now: /, 'You have ')}.</p> : null}
        </div>
      </div>
      {isShopBadgeKey(tile.key) && tile.family ? <Ladder tile={tile} /> : null}
      {tile.reward.next || tile.reward.gave ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[color:var(--surface-soft)] p-3 text-sn-base leading-snug text-ink" data-badge-gift="">
          <Gift aria-hidden className="mt-0.5 h-4 w-4 flex-none text-[rgb(var(--color-link))]" strokeWidth={1.9} />
          <span>{[tile.reward.gave, tile.reward.next].filter(Boolean).join(' · ')}</span>
        </p>
      ) : null}
      {tile.door ? (
        <div className="mt-3">
          <ActionButton tone="brand" icon={<Plus aria-hidden strokeWidth={2} />} label={tile.door.label} href={tile.door.href} />
        </div>
      ) : null}
    </>
  );
}

/** The seven steps, Bronze → Black Diamond: reached in full colour, the next one marked, the far ones faded. */
function Ladder({ tile }: { tile: ShelfTile }) {
  if (!isShopBadgeKey(tile.key) || !tile.family) return null;
  const steps = SHOP_BADGE_STEPS[tile.key];
  const reached = tile.tier ?? 0;
  const known = tile.state === 'earned' || tile.state === 'locked';
  return (
    <ol className="mt-3 grid grid-cols-7 gap-1" aria-label={`${tile.title} steps`} data-badge-ladder={tile.key}>
      {TIER_KEYS.map((tk, n) => {
        const step = n + 1;
        const got = known && step <= reached;
        const next = known && step === reached + 1;
        return (
          <li
            key={tk}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-center ${next ? 'bg-[color:var(--surface-soft)]' : ''}`}
            data-step-state={got ? 'got' : next ? 'next' : 'far'}
          >
            <span className={`relative block h-9 w-9 overflow-hidden ${got || next ? '' : 'opacity-40'}`}>
              <FittedArt src={badgeArtSrc(tile.family!, step)} box={36} loading="lazy" />
            </span>
            <span className={`text-sn-2xs font-semibold leading-tight ${next ? 'text-ink' : 'text-[color:var(--m-slate-2)]'}`}>{tierName(tk).replace('Black Diamond', 'Black D.')}</span>
            <span className="text-sn-2xs tabular-nums leading-tight text-[color:var(--m-slate-2)]">{formatCount(steps[n]!)}</span>
          </li>
        );
      })}
    </ol>
  );
}
