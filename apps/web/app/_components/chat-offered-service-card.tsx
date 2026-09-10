'use client';

import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { ServiceCardFace } from '@/app/vendor-dashboard/services/_components/service-card-face';
import type { Snapshot } from '@/lib/service-card-snapshot';
import type { OfferedServiceCardData } from '@/lib/offered-service-card-decide';

/**
 * chat-offered-service-card.tsx — a service OFFERED inside a conversation,
 * drawn as the card the supplier actually built.
 *
 * ── WHAT IT REPLACES (owner 2026-09-09) ────────────────────────────────────
 * *"the service card of each service still needs that photo/image/video."*
 * A supplier offering a service produced one word in the couple's "Inquiring
 * about" chip row — and because both live services have a null title, that word
 * was the bare category. Three caterers were three identical chips. The card is
 * the pitch.
 *
 * 🔑 IT DOES NOT DRAW A CARD. `ServiceCardFace` is the card — the same
 * component the supplier's own list and editor render, so what the couple
 * receives is what the supplier was shown when they built it. A second drawing
 * would agree on the day it was written and drift by the first change to
 * either. This file fetches, handles the three ways a fetch ends, and appends
 * the clip.
 *
 * ⚠ IT FETCHES THROUGH A ROUTE RATHER THAN READING THE TABLE. Every other card
 * in this stream reads its own table straight from the browser. This one cannot:
 * the cover and the clip are stored `r2://…` refs and turning one into
 * something an <img> can load requires signing with a secret. So the resolution
 * happens server-side and arrives already presigned and short-lived.
 *
 * 🔑 A REFUSED FETCH SAYS SO. A card that never loads is otherwise
 * indistinguishable from an offer that was never sent, in a conversation where
 * the supplier believes they have pitched and the couple is deciding between
 * suppliers on what they can see. The `body` fallback keeps the offer legible
 * either way.
 */

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; card: OfferedServiceCardData }
  | { kind: 'absent' }
  | { kind: 'refused' };

export function ChatOfferedServiceCard({
  messageId,
  fallbackBody,
}: {
  messageId: string;
  /** The message's own text — shown while loading and if the card can't load. */
  fallbackBody: string;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/chat/offered-service/${messageId}`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: 'absent' });
          return;
        }
        if (!res.ok) {
          console.error('[chat] offered service card refused', res.status);
          setState({ kind: 'refused' });
          return;
        }
        const json = (await res.json()) as { card?: OfferedServiceCardData };
        if (cancelled) return;
        if (!json.card) {
          setState({ kind: 'refused' });
          return;
        }
        setState({ kind: 'ok', card: json.card });
      } catch (e) {
        if (cancelled) return;
        console.error('[chat] offered service card fetch failed', e);
        setState({ kind: 'refused' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  if (state.kind === 'ok') {
    const c = state.card;
    // The face reads a Snapshot. Everything in it was derived server-side by
    // `snapshotFromService` — the one implementation of this card's money.
    const snap: Snapshot = {
      name: c.name,
      priceText: c.priceText,
      discountBadge: c.discountBadge,
      includesLine: c.includesLine,
      notIncluded: c.notIncluded,
      hasExclusive: c.hasExclusive,
      givesSetnayanGift: c.givesSetnayanGift,
      hasCover: c.coverUrl !== null,
    };
    return (
      <div className="w-full max-w-[92%] space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          Offered service
        </p>
        <ServiceCardFace
          snap={snap}
          leafPathLabel={c.categoryLabel ?? ''}
          coverUrl={c.coverUrl}
          /* No mock "Request a quote" chip in a live conversation — the reply
             box below IS how a couple asks. null, not undefined: see the face. */
          footer={null}
        />
        {c.clipUrl ? (
          <figure className="space-y-1">
            <video
              src={c.clipUrl}
              poster={c.coverUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-xl border border-ink/10 bg-ink/5"
            />
            <figcaption className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              <Film aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Their showcase clip
            </figcaption>
          </figure>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[92%] rounded-xl border border-terracotta/40 bg-terracotta/[0.06] p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
        Offered service
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink/80">
        {fallbackBody}
      </p>
      {state.kind === 'refused' ? (
        <p className="mt-1.5 text-[11px] text-ink/55">
          Their card didn’t load. Refresh to see the photo and price.
        </p>
      ) : null}
    </div>
  );
}
