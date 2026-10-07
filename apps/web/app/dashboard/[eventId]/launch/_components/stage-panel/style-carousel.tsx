'use client';

import { useEffect, useRef } from 'react';
import { SP_LAYOUT_CARD } from '@/lib/maker-stage-room';
import { StylePreview } from './style-preview';

/**
 * 🎠 STYLE › LOOK'S LAYOUTS — the prototype's `.lcar` (owner 2026-10-07: *"should be a
 * preview of the style and not text"*): one card per SHIPPED style of the part's scene
 * (`lib/scene-styles.ts`, never a new family), 62% wide so the next one peeks, each a
 * REAL miniature (`StylePreview`) over its short name — no description line, no
 * "Recommended" tag. The card worn now is ringed and scrolled to the middle. A tap
 * applies at once (the page above IS the full preview), through the caller's save.
 */
export function StyleCards({
  options,
  value,
  onPick,
  pending,
  canvasKey,
  sceneType,
}: {
  options: ReadonlyArray<{ id: string; name: string }>;
  value: string | null;
  onPick: (id: string) => void;
  pending: boolean;
  /** The part's canvas key (`w:countdown`) — what each miniature is copied from. */
  canvasKey: string | null;
  sceneType: string;
}) {
  const car = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = car.current;
    const on = c?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (c && on) c.scrollLeft = on.offsetLeft - (c.clientWidth - on.offsetWidth) / 2;
  }, [value]);
  return (
    <div
      ref={car}
      role="radiogroup"
      aria-label="Layout"
      data-style-carousel=""
      className="-mx-[2px] flex shrink-0 snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden px-[2px] pb-1 pt-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-style-card={o.id}
            onClick={() => {
              if (!pending && !on) onPick(o.id);
            }}
            className={SP_LAYOUT_CARD}
          >
            <span
              data-style-card-preview=""
              className={`relative block h-[104px] shrink-0 overflow-hidden rounded-lg bg-[var(--sp-page)] ${
                on ? 'border-2 border-[var(--sp-cta)] shadow-[0_0_0_3px_var(--sp-cta-wash)]' : 'border border-[var(--sp-line)]'
              }`}
            >
              <StylePreview canvasKey={canvasKey} sceneType={sceneType} styleId={o.id} current={on} />
            </span>
            <span className={`block h-[18px] truncate text-center text-[13px] font-semibold leading-[18px] ${on ? 'text-[var(--sp-ink)]' : 'text-[var(--sp-ink2)]'}`}>{o.name}</span>
          </button>
        );
      })}
    </div>
  );
}
