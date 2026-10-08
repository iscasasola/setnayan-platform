'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SP_STYLE_CARD, SP_STYLE_NAME, SP_STYLE_PICTURE, SP_STYLE_STRIP, styleCardIsWide } from '@/lib/maker-stage-room';
import { StylePreview } from './style-preview';

/**
 * 🎠 STYLE'S LOOK CARDS — the toolbar's rows 1–3 (owner 2026-10-09, `TOOLBAR-SPEC-2026-10-09.md` § STYLE; the
 * approved prototype's `.cr` / `.lc`): one card per SHIPPED style of the part's scene (`lib/scene-styles.ts`, never
 * a new family), each the phone-shaped frame AS TALL AS THE ROWS IT HAS (*"maximize the height … portrait"*)
 * holding a REAL miniature (`StylePreview` — centred and scaled to fit, never cut) over its short name — no
 * description line, no "Recommended" tag.
 *
 *   · THE PICKED CARD IS IN THE MIDDLE, the previous and the next in view on either side — on opening, after a
 *     pick, and when a card changes width. The strip is swiped sideways; nothing here scrolls up and down.
 *   · A LOOK OF ONE LONG LINE (the Title, the Date, the Names in a row) gets a wider card — 60 % of the toolbar's
 *     inner width — so its words are read, not squeezed (`styleCardIsWide`, from the part as the page drew it).
 *
 * A tap applies at once (the page above IS the full preview), through the caller's save.
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
  /** Which looks draw one long line (told by each miniature once it has measured its part). */
  const [wide, setWide] = useState<Readonly<Record<string, boolean>>>({});
  /** The room before the first card and after the last, so either can rest in the middle. */
  const [ends, setEnds] = useState<{ first: number; last: number }>({ first: 0, last: 0 });
  /** Put the picked card in the middle of the strip. */
  const centre = useCallback((smooth: boolean) => {
    const c = car.current;
    const cards = c ? Array.from(c.querySelectorAll<HTMLElement>('[data-style-card]')) : [];
    if (!c || cards.length === 0) return;
    const gap = Number.parseFloat(getComputedStyle(c).columnGap) || 0;
    const room = (card: HTMLElement) => Math.max(0, Math.round(c.clientWidth / 2 - card.offsetWidth / 2 - gap));
    const next = { first: room(cards[0]!), last: room(cards[cards.length - 1]!) };
    setEnds((was) => (was.first === next.first && was.last === next.last ? was : next));
    const on = cards.find((x) => x.getAttribute('aria-checked') === 'true');
    if (on) c.scrollTo({ left: Math.max(0, on.offsetLeft + on.offsetWidth / 2 - c.clientWidth / 2), behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  /* On opening and whenever a card or the strip changes size (a card widened, the phone turned): at once. */
  useLayoutEffect(() => centre(false), [centre, ends.first, ends.last, wide, options.length]);
  useEffect(() => {
    const c = car.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => centre(false));
    ro.observe(c);
    return () => ro.disconnect();
  }, [centre]);
  /* After a pick: it glides to the middle. */
  const picked = useRef(value);
  useEffect(() => {
    if (picked.current === value) return;
    picked.current = value;
    centre(true);
  }, [centre, value]);
  return (
    <div ref={car} role="radiogroup" aria-label={label} data-style-carousel={data} data-look-cards="" className={SP_STYLE_STRIP}>
      <span aria-hidden data-look-end="first" className="shrink-0" style={{ width: ends.first }} />
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-style-card={o.id}
            data-wide={wide[o.id] ? '' : undefined}
            className={SP_STYLE_CARD}
            onClick={() => {
              if (!pending && !on) onPick(o.id);
            }}
          >
            {/* The part as a guest's phone draws it — whole, in the middle of the card. */}
            <span data-style-card-preview="" className={SP_STYLE_PICTURE}>
              <StylePreview
                canvasKey={canvasKey}
                sceneType={sceneType}
                styleId={o.id}
                current={on}
                focus={focus}
                onDrawn={(shape) => {
                  const w = styleCardIsWide(shape);
                  setWide((was) => (Boolean(was[o.id]) === w ? was : { ...was, [o.id]: w }));
                }}
              />
            </span>
            <span className={SP_STYLE_NAME}>{o.name}</span>
          </button>
        );
      })}
      <span aria-hidden data-look-end="last" className="shrink-0" style={{ width: ends.last }} />
    </div>
  );
}
