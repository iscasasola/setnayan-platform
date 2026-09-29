import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CollectionCard } from '@/app/_components/collection-card';
import type { OurService } from '@/lib/our-services';

/**
 * OUR SERVICES — the six cards at the top of the event's services page.
 *
 * Every card is the repo's one card (`CollectionCard`, "the only card"): the
 * service's poster wash and icon as the cover, its name on the cover, and ONE
 * status line — added, waiting for payment, free, or what adding it costs.
 * The card opens the service's own page, the same page its event-menu row
 * opens. What each card says is decided in `lib/our-services.ts`; this file
 * only lays it out.
 *
 * Phone first: two across at 375/390 (three rows for six services), three
 * across from `sm`.
 *
 * ◆ marks a paid service not yet on this event — never a padlock; the card
 * still opens, and the service's own page is where it is added.
 */
export function OurServicesGrid({ services }: { services: readonly OurService[] }) {
  if (services.length === 0) return null;
  return (
    <section aria-label="Our Services" data-our-services className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {services.map((s, i) => (
          <li key={s.key} data-our-service={s.key} className="flex flex-col gap-1.5">
            <div className="flex-1">
              <CollectionCard
                href={s.href}
                inertReason={s.inertReason}
                title={s.name}
                index={i}
                cover={
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: s.gradient }}
                  >
                    <s.Icon className="h-10 w-10 text-white/35" strokeWidth={1.5} />
                  </span>
                }
                progress={{
                  remainder: s.pro ? `◆ ${s.stateText}` : s.stateText,
                  note: s.line,
                }}
              />
            </div>
            {s.part ? (
              <Link
                href={s.part.href}
                data-our-service-part={s.part.name}
                className="sn-press flex min-h-[44px] items-center gap-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-ink">
                    {s.part.name}
                  </span>
                  <span className="block truncate text-[11px] text-ink/55">{s.part.line}</span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
