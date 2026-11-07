import Link from 'next/link';
import { SnapCarousel } from '@/components/snap-carousel';
import { Badge } from '@/app/_components/badge';
import type { NextEventCard, NextEvents } from '@/lib/supplier-today-next-events';

/**
 * 📸 NEXT EVENTS (THE ONE BUILD A3, v113 Today): the next booked event as one photo card; two or more on that next
 * event day are the ONE shared carousel (`SnapCarousel` — centre snap, peeks both sides, loops; owner 27 Oct). No dot
 * pager (v110 "No dot pagers"): each card says "1 of 2" on its photo. ⏳ `dots={false}` is passed once L1's foundation
 * adds the prop to the shared carousel (spec §9 #4) — until then the shared part still draws its own decorative dots.
 *
 * A card is ONE link: that client's Hub page in Clients (`clientHubHref`), never the live console.
 * The photo is the event's live Hub hero; with none, the event's initials on the plain ground (`next-card.tsx`'s rule).
 * 🔒 lib/supplier-today-next-events.test.ts
 */
export function TodayNextEvents({ next }: { next: NextEvents | null }) {
  if (!next || next.cards.length === 0) return null;
  return (
    <section data-today-next-events="" data-tour="today-next-events" aria-label="Next events" className="mb-4">
      <p className="hc-k2 mb-2">
        <span>Next events</span>
        <em data-today-next-meta="">{next.meta}</em>
      </p>
      {next.cards.length === 1 ? (
        <EventCard card={next.cards[0]!} />
      ) : (
        <div className="-mx-4 sm:mx-0">
          <SnapCarousel
            label="Next events"
            attrs={{ 'data-today-next-carousel': '' }}
            cards={next.cards.map((c) => ({ key: c.key, label: c.title, node: <EventCard card={c} /> }))}
          />
        </div>
      )}
    </section>
  );
}

function EventCard({ card }: { card: NextEventCard }) {
  return (
    <Link
      href={card.href}
      data-today-next-event={card.eventId}
      className="block overflow-hidden rounded-3xl bg-[rgb(var(--color-raised))] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.06)]"
    >
      <span className="hc-ecard-plain relative block h-[120px]" data-today-next-photo={card.photo ? 'image' : 'initials'}>
        {card.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a presigned hero or a theme still; not in the next/image allowlist
          <img src={card.photo} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        ) : card.initials ? (
          <span aria-hidden className="hc-ecard-name absolute inset-0 grid place-items-center text-[34px] font-semibold">
            {card.initials}
          </span>
        ) : null}
        <span className="absolute left-3 top-3 inline-flex min-h-7 items-center rounded-full bg-white px-3 text-[13px] font-semibold text-ink" data-today-next-when="">
          {card.when}
        </span>
        {card.position ? (
          <span className="absolute right-3 top-3 inline-flex min-h-7 items-center rounded-full bg-black/45 px-2.5 text-[12px] text-white" data-today-next-position="">
            {card.position}
          </span>
        ) : null}
      </span>
      <span className="block px-4 pb-4 pt-3">
        <span className="block truncate text-[17px] font-semibold leading-tight text-ink">{card.title}</span>
        <span className="mt-1 block truncate text-[13.5px] text-ink/65">{card.dateLine}</span>
        {card.timeLine ? (
          <span
            className={`mt-0.5 block truncate text-[13.5px] ${card.timeUnread ? 'text-[rgb(var(--color-danger))]' : 'text-ink/65'}`}
            data-today-next-time={card.timeUnread ? 'unread' : ''}
          >
            {card.timeLine}
          </span>
        ) : null}
        {card.chips.length > 0 ? (
          <span className="mt-2.5 flex flex-wrap gap-1.5" data-today-next-chips="">
            {card.chips.map((c) => (
              <Badge key={c.id} tone={c.tone} data={`next-${c.id}`}>
                {c.word}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
