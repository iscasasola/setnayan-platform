/**
 * discover-event-card.tsx — ONE Discover event card: the event's cover with a
 * date plate, a host line and exactly one action. Rendered by the two event
 * shelves in `front-door-discover.tsx`.
 *
 * Its own module (2026-10-03) so the card can be rendered and tested without
 * the shelves' Follow button, whose server action does not load outside Next.
 *
 * ─── TWO DOORS ON ONE CARD, NEVER NESTED ──────────────────────────────────
 * The title carries the stretched link to `/{slug}`; the host's name opens
 * `/u/{slug}` and the action opens the request door — both raised above the
 * stretch, siblings, never descendants (the `.fd-chan` rule in
 * `front-door.css`).
 */
import Link from 'next/link';

import type { DiscoverEventCard as Card } from '@/lib/discover-events-core';
import { shopInitials } from '@/lib/shop-initials';
import { ChannelLink } from './front-door-feed';
import { DiscoverEventCover } from './discover-event-cover';

function relationText(card: Card): string | null {
  if (card.relation === 'connected') return 'Connected';
  if (card.relation === 'follow') return 'You follow them';
  return null;
}

export function DiscoverEventCard({ card }: { card: Card }) {
  const rel = relationText(card);
  const place = [rel, card.regionLabel].filter(Boolean).join(' · ');
  return (
    <div className="fd-item" data-discover-card>
      <DiscoverEventCover card={card} />
      <div className="fd-imeta">
        <span className="fd-ava" aria-hidden="true">
          {shopInitials(card.host?.name ?? card.title, 2, '·')}
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">
            <Link href={card.href} className="fd-stretch">
              {card.title}
            </Link>
          </p>
          {card.typeLabel || card.host ? (
            <p className="fd-by">
              {card.typeLabel ? (
                <span className="fd-kindtag fd-kindtag-w">{card.typeLabel}</span>
              ) : null}
              {card.host ? (
                <ChannelLink slug={card.host.slug} name={card.host.name} className="fd-chan" />
              ) : null}
            </p>
          ) : null}
          {place ? <p className="fd-by fd-rel">{place}</p> : null}
          <div className="fd-act">
            {card.askHref ? (
              <Link href={card.askHref} className="fd-ask">
                Ask to join
              </Link>
            ) : (
              <span className="fd-ask quiet">Guest list only</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
