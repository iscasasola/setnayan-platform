'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { ChapteredMoment } from '@/lib/love-story-moments';

/**
 * ✋ STUDIO › LOVE STORY — ONE CARD PER MOMENT, DRAG TO REORDER (owner
 * 2026-10-06 DECISION_LOG "STUDIO › SCHEDULE AND LOVE STORY": *"one card per
 * moment — photo · year · title · first line · grip"*; the couple's own order
 * approved 2026-10-07, "THE MISSING FIELDS ARE APPROVED").
 *
 * A drag of the grip (finger or mouse) moves the card as it goes; letting go
 * posts ONE `intent=order` with every id, first to last — the moment action's
 * own intent (`applyMomentIntent`), into the DRAFT like every other moment edit,
 * guests see it at Apply. The grip also answers ↑ / ↓ from the keyboard.
 *
 * Drawn only in the new Maker's Studio (`makerStagesStudioEnabled` →
 * `LoveStoryBook studio`). Nothing is written by opening it.
 */
export function MomentOrderCards({
  moments,
  mediaUrls,
  onOrder,
}: {
  /** The story as guests read it (`sortMoments`). */
  moments: readonly ChapteredMoment[];
  mediaUrls: Readonly<Record<string, string>>;
  /** Every id, first to last — called once per drop that changed the order. */
  onOrder: (ids: string[]) => void;
}) {
  const ids = moments.map((m) => m.id);
  const key = ids.join(',');
  const [order, setOrder] = useState<string[]>(ids);
  const [dragging, setDragging] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const start = useRef<string>(key);
  /* A save (or a refusal putting it back) re-draws from the story. */
  useEffect(() => {
    if (!dragging) setOrder(key ? key.split(',') : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const byId = new Map(moments.map((m) => [m.id, m]));

  const finish = (next: string[]) => {
    setDragging(null);
    if (next.join(',') !== start.current) onOrder(next);
  };
  /** Which place the pointer is over, from the cards' own boxes. */
  const placeAt = (y: number): number => {
    const cards = [...(list.current?.querySelectorAll<HTMLElement>('[data-moment-card]') ?? [])];
    let i = 0;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (y > r.top + r.height / 2) i += 1;
    }
    return Math.min(i, cards.length - 1);
  };
  const moveTo = (id: string, to: number, from: readonly string[]) => {
    const rest = from.filter((x) => x !== id);
    rest.splice(Math.max(0, Math.min(to, rest.length)), 0, id);
    return rest;
  };

  if (moments.length === 0) return null;
  return (
    <section data-moment-order-cards="" aria-label="Your moments, in order" className="mx-auto mb-10 max-w-xl">
      <ol ref={list} className="flex flex-col gap-2">
        {order.map((id, i) => {
          const m = byId.get(id);
          if (!m) return null;
          const photo = (m.media ?? []).map((r) => mediaUrls[r]).find(Boolean) ?? null;
          return (
            <li
              key={id}
              data-moment-card={id}
              className={`flex min-h-16 items-center gap-3 rounded-md bg-[color:var(--ls-surface)] px-2 py-2 shadow-sm ${
                dragging === id ? 'opacity-80 ring-2 ring-[color:var(--ls-heading)]' : ''
              }`}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
              ) : (
                <span aria-hidden className="h-12 w-12 shrink-0 rounded bg-black/5" />
              )}
              <a href={`#moment-${id}`} className="min-w-0 flex-1">
                <span className="block text-[12px] text-[color:var(--ls-muted)]">{m.date?.y ?? '—'}</span>
                <b className="block truncate font-pahina text-[16px] font-medium">{m.title || m.line.split('\n')[0]}</b>
                {m.title ? <span className="block truncate text-[13px] text-[color:var(--ls-muted)]">{m.line.split('\n')[0]}</span> : null}
              </a>
              <button
                type="button"
                aria-label={`Move ${m.title || 'this moment'} — drag, or use the arrow keys`}
                data-moment-grip={id}
                className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-[color:var(--ls-muted)] active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  start.current = order.join(',');
                  setDragging(id);
                }}
                onPointerMove={(e) => {
                  if (dragging !== id) return;
                  const to = placeAt(e.clientY);
                  setOrder((o) => (o.indexOf(id) === to ? o : moveTo(id, to, o)));
                }}
                onPointerUp={() => dragging === id && finish(order)}
                onPointerCancel={() => {
                  setDragging(null);
                  setOrder(start.current.split(','));
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                  e.preventDefault();
                  const to = i + (e.key === 'ArrowUp' ? -1 : 1);
                  if (to < 0 || to >= order.length) return;
                  start.current = order.join(',');
                  const next = moveTo(id, to, order);
                  setOrder(next);
                  finish(next);
                }}
              >
                <GripVertical aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
