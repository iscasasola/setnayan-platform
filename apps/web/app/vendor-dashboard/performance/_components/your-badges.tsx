import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { InfoTip } from '@/app/_components/info-tip';
import type { BadgeShelf } from '@/lib/shop-badges';

/**
 * 🏅 YOUR BADGES — on Shop › How it is going (owner 2026-10-29: *"Their badges will be on the supplier shop
 * performance page"*). Every badge the shop wears today, drawn by THE one pill (`ShopBadgePill`, never a second
 * drawing), and the next step with how far it is ("Next to earn: 100 events · Gold · 4 to go"). Title + one short
 * line; what earns each badge is behind the ⓘ. A pure view — the page hands in `badgeShelf(facts)`, read in its own
 * batch. A refused read says so ("Couldn’t load your badges" · "—"), never "none".
 *
 * Today's "You earned …" line (`badge-earned-line.tsx`) STAYS: it announces a NEW badge once; this is where they live.
 */
export function YourBadges({ shelf }: { shelf: BadgeShelf }) {
  return (
    <section aria-labelledby="your-badges-title" data-your-badges={shelf.measured ? 'measured' : 'unread'}>
      <h2 id="your-badges-title" className="sn-sec">
        <InfoTip label="Your badges" align="start">
          Couples see these on your page. Verified comes with your approved documents; the event badges climb at 10 ·
          50 · 100 · 500 · 1,000 · 5,000 · 10,000 finished events; the stars come from trusted reviews; the years from
          the year you started.
        </InfoTip>
      </h2>
      <p className="mt-0.5 text-[14px] text-ink/70" data-your-badges-next="">
        {shelf.next}
      </p>
      {!shelf.measured ? (
        <p className="mt-2 text-[14px] text-ink/60" data-your-badges-empty="unread">
          Couldn’t load your badges just now.
        </p>
      ) : shelf.pills.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink/60" data-your-badges-empty="none">
          None yet — they show here by themselves as you earn them.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2" data-your-badges-pills="">
          {shelf.pills.map((b) => (
            <ShopBadgePill key={b.key} badge={b} size="sm" title={b.label} />
          ))}
        </div>
      )}
    </section>
  );
}
