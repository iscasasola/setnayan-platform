'use client';

import { useEffect, useRef } from 'react';
import { SP_LOOK_CARD, SP_LOOK_NAME, SP_PHONE_PICTURE } from '@/lib/maker-stage-room';
import { StylePreview } from './style-preview';

/**
 * 🎠 STYLE › LOOK'S LAYOUTS — the prototype's `.lcar` (owner 2026-10-07: *"should be a
 * preview of the style and not text"*): one card per SHIPPED style of the part's scene
 * (`lib/scene-styles.ts`, never a new family), each a phone-shaped frame (`.sn-phone-card`, owner 2026-10-08:
 * *"show in mobile view, not like a header that is short and wide"*) holding a
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
  focus = null,
  label = 'Layout',
  data = '',
}: {
  /** 🔎 One block of the scene the cards are fitted on (`StylePreview` `focus`) — the palette's "Our colours". */
  focus?: string | null;
  /** What the set is, for a screen reader — "Layout" (a scene's styles), "Palette" (its palette looks). */
  label?: string;
  /** Which set this carousel is (`data-style-carousel`) — '' for a scene's own styles. */
  data?: string;
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
      aria-label={label}
      data-style-carousel={data}
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
            className={SP_LOOK_CARD}
          >
            {/* 📱 The ONE phone-shaped frame (`.sn-phone-card`, 3 : 4): the part as a guest's phone draws it. */}
            <span
              data-style-card-preview=""
              className={`${SP_PHONE_PICTURE} ${
                on ? 'border-2 border-[var(--sp-cta)] shadow-[0_0_0_3px_var(--sp-cta-wash)]' : 'border border-[var(--sp-line)]'
              }`}
            >
              <StylePreview canvasKey={canvasKey} sceneType={sceneType} styleId={o.id} current={on} focus={focus} />
            </span>
            <span className={`${SP_LOOK_NAME} ${on ? 'text-[var(--sp-ink)]' : 'text-[var(--sp-ink2)]'}`}>{o.name}</span>
          </button>
        );
      })}
    </div>
  );
}
