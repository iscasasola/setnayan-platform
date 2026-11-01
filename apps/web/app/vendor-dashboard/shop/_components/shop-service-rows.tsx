import Link from 'next/link';
import { ChevronRight, Layers } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { Badge } from '@/app/_components/badge';
import { RowIcon } from '../../_components/row-icon';
import { formatPhpRounded } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import type { ShopServiceRow } from '@/lib/shop-services-summary';

/**
 * 🧰 SHOP › SERVICES — one row per service, before its cards (supplier dashboard v13, APPROVED 2026-10-29; prototype
 * `shopServices()`): the service, its cards and from-price, Live or Ready, and the line of tools every event booked for
 * it starts with. The rows are counted by `lib/shop-services-summary.ts` from what the shop already has; the cards
 * themselves stay in the cards list under them (a row lands on its first card — `#svc-<id>`, the list's own anchor).
 *
 * Title + one line visible, the rest in the ⓘ (house rule). No frame: a row is a link, drawn as a row.
 * HONEST: `rows === null` (the read failed) says so — never "No services yet", which would be a claim about the shop.
 * 🔒 lib/shop-services-summary.test.ts · shop/the-shop-sections-are-v13.test.ts
 */
export function ShopServiceRows({ rows }: { rows: readonly ShopServiceRow[] | null }) {
  return (
    <section id="shop-services" className="scroll-mt-28" aria-labelledby="shop-services-h" data-shop-services="">
      <h2 id="shop-services-h" className="sr-only">
        Services
      </h2>
      <p className="pb-1 pt-2 text-[12.5px] font-medium uppercase tracking-[0.06em] text-ink/55">
        <InfoTip label="Services" align="start">
          List and build every service you do — cards, tools, photos — while you wait. A service with a card switched on is
          live: couples can find and book it. The rest stay ready. How many can be live on each plan is set by Setnayan.
          Each service&rsquo;s tools are the ones every event booked for it starts with.
        </InfoTip>
      </p>      {rows === null ? (
        <p role="alert" className="py-3 text-[14px] text-ink/70" data-shop-services-unread="">
          <strong className="text-ink">We couldn&rsquo;t load your services just now.</strong> They are still on your page —
          only this list is missing. Reload to try again.
        </p>
      ) : rows.length === 0 ? (
        <Link href={SERVICE_MAKER_HREF} className="sn-press flex min-h-[60px] items-center gap-3 py-2.5" data-shop-services-empty="">
          <RowIcon icon={Layers} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Add your first service</span>
            <span className="block text-[13px] text-ink/60">Couples find and book you by it</span>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
        </Link>
      ) : (
        <ul className="divide-y divide-ink/10" data-shop-service-list="">
          {rows.map((r) => {
            const cards =
              r.cards === 0
                ? 'No card yet'
                : `${formatCount(r.cards)} ${r.cards === 1 ? 'card' : 'cards'}${r.fromPhp != null ? ` · from ${formatPhpRounded(r.fromPhp)}` : ''}`;
            const tools = [...r.tools, r.scanner ? `${r.scanner} scanner` : 'No scanner'].join(' · ');
            const href = r.firstCardId ? `#svc-${r.firstCardId}` : SERVICE_MAKER_HREF;
            return (
              <li key={r.key} data-shop-service={r.key}>
                <Link href={href} scroll className="sn-press flex min-h-[60px] items-start gap-3 py-3">
                  <RowIcon icon={Layers} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-tight text-ink">{r.label}</span>
                      {r.live ? (
                        <Badge tone="ok" data="shop-service-live">
                          Live
                        </Badge>
                      ) : (
                        <Badge tone="quiet" data="shop-service-ready">
                          Ready
                        </Badge>
                      )}
                    </span>
                    <span className={`mt-0.5 block text-[13px] ${r.cards === 0 ? 'text-[rgb(var(--color-warn))]' : 'text-ink/60'}`}>{cards}</span>
                    <span className="mt-1.5 block text-[12.5px] leading-snug text-ink/60" data-shop-service-tools="">
                      <span className="font-medium text-ink/75">Tools on every event · </span>
                      {tools}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
