'use client';

import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * 🃏 THE CARD YOU BOOKED — the head of the host review form (prototype § 1 "After · header + card").
 *
 * Owner, 6 Nov, verbatim: *"When a supplier asks for a review, they do not show other supplier requests, only their
 * services."* and *"Don't show the price. Just the service."* ⇒ only THIS shop's cards booked on THIS event, each by
 * name and photo, and NO price anywhere on it (`no-price-on-the-review-card.test.ts` holds that: this file must not
 * read or print a price). One card → shown. Several → one PickMenu ("Any set of choices is a dropdown"), preset to
 * the first; the pick rides the form as `service_id`, so the review keeps the card it is for.
 *
 * ⚖ ONE review per supplier per event stays the rule (`UNIQUE (vendor_profile_id, event_id)`, owner ruling ④), so
 * the dropdown says which card this review is FOR — it does not queue a second review.
 */
export type ReviewRequestCardItem = { serviceId: string; title: string; photoUrl: string | null };

export function ReviewRequestCard({
  cards,
  eventLine,
}: {
  /** This shop's booked cards on this event. Never another supplier's. */
  cards: ReviewRequestCardItem[];
  /** "Dec 12, 2026 · Ana & Miguel’s wedding". */
  eventLine: string;
}) {
  const [picked, setPicked] = useState<string>(cards[0]?.serviceId ?? '');
  const current = cards.find((c) => c.serviceId === picked) ?? cards[0] ?? null;
  if (!current) return null;
  return (
    <div className="mt-1" data-review-request-card>
      <input type="hidden" name="service_id" value={current.serviceId} />
      {cards.length > 1 ? (
        <div className="flex items-center justify-between gap-2.5 border-t border-ink/10 py-3">
          <div className="text-[15px]">
            Reviewing
            <small className="block text-xs text-ink/65">
              Card {formatCount(cards.findIndex((c) => c.serviceId === current.serviceId) + 1)} of {formatCount(cards.length)} from this shop
            </small>
          </div>
          <PickMenu
            label="Which card"
            value={current.serviceId}
            options={cards.map((c) => ({ key: c.serviceId, label: c.title, hint: 'Booked · not yet reviewed' }))}
            onPick={setPicked}
            dataAttr="data-review-card-pick"
          />
        </div>
      ) : null}
      <div className="sn-glass-bare mt-2.5 rounded-xl p-4" data-review-request-service>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{current.title}</span>
        </div>
        {current.photoUrl ? (
          <div className="mt-3 flex gap-1.5">
            <span className="block h-16 w-16 overflow-hidden rounded-lg bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- the card's own public cover */}
              <img src={current.photoUrl} alt="" className="h-full w-full object-cover" />
            </span>
          </div>
        ) : null}
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-terracotta-700">
            <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
            Verified booking
          </span>
          <span className="text-ink/70">{eventLine}</span>
        </p>
      </div>
    </div>
  );
}
