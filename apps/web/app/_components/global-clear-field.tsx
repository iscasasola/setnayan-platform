'use client';

/**
 * GlobalClearField — EVERY TYPE BOX HAS THE ✕ (owner 2026-10-31, live iPhone: *"We want every type box too have the
 * clear button"*). Mounted once in `app/providers.tsx`, beside `GlobalHaptics`, for the same reason: the app has
 * hundreds of type boxes across forms, sheets and searches, and one mechanism keeps one look and one behaviour where
 * hundreds of hand-made copies would drift (`lib/every-type-box-has-the-clear-button.test.ts` counts them).
 *
 * WHEN. While a box that takes words (`isClearableField`, `components/clear-field.tsx` — the rule and its exclusions
 * live there) is being typed into and holds words, the shared `ClearButton` stands inside its right end — the iPhone's
 * own "while editing" ✕. With no words, or once the box is left, it is gone. A box that draws its own ✕ (every thumb-row
 * search, the Search box) keeps its own, which is the same shared button — never two.
 *
 * WHAT IT DOES. One press empties the box through `clearTyped` — the native setter and an `input` event — so the form
 * hears it exactly as it hears a backspace: React state, `onChange`, a save-as-you-type with its own Undo. The press
 * never moves the focus (the keyboard stays up, the caret stays in the box).
 *
 * WHERE IT IS DRAWN. Portaled INTO the box's own parent (never <body>): so a press on it is, to the page, a press
 * inside the sheet, card or riding row the box lives in — a sheet's "tap outside closes" and the riding row's tap-away
 * (`useTapAway`) both read it as inside. It stands over the box's right end, re-measured every frame while the box is
 * focused (a scroll, the keyboard's glide, a sheet's rise), and the box gives it room (`[data-clearing]` in
 * globals.css: its end padding and no browser search ✕). If anything else is drawn at that spot (the box's own unit, a
 * button over it, a clip), the ✕ is not shown.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClearButton, clearTyped, isClearableField } from '@/components/clear-field';

/** The ✕'s press target: the box's height, from 28 to 44 px. */
const MIN = 28;
const MAX = 44;
/** A box narrower than this has no room for words AND a ✕ (a two-letter code, an inline count). */
const MIN_WIDTH = 120;

/** Where the ✕ stands, in its containing block; `placed` once it has been measured into place (hidden until then). */
type Spot = { host: HTMLElement; size: number; left: number; top: number; placed: boolean };

export function GlobalClearField() {
  const [spot, setSpot] = useState<Spot | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const button = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const give = (el: HTMLInputElement, size: number) => {
      if (el.hasAttribute('data-clearing')) return;
      const own = parseFloat(getComputedStyle(el).paddingRight) || 0;
      el.style.setProperty('--sn-clear-room', `${Math.max(own, size + 2)}px`);
      el.setAttribute('data-clearing', '');
    };
    const takeBack = (el: HTMLInputElement | null) => {
      if (!el) return;
      el.removeAttribute('data-clearing');
      el.style.removeProperty('--sn-clear-room');
    };
    const hide = () => {
      takeBack(field.current);
      setSpot((s) => (s ? null : s));
    };
    const tick = () => {
      raf = 0;
      const el = field.current;
      if (!el || !el.isConnected || document.activeElement !== el || !isClearableField(el)) {
        hide();
        field.current = null;
        return;
      }
      const host = el.parentElement;
      const r = el.getBoundingClientRect();
      if (!host || !el.value || r.width < MIN_WIDTH || r.height < MIN - 4) {
        hide();
      } else {
        const size = Math.round(Math.min(MAX, Math.max(MIN, r.height)));
        const want = { x: r.right - size, y: r.top + (r.height - size) / 2 };
        // Anything else drawn where the ✕ would stand (a unit, a button over the box, a clip) → no ✕.
        const under = document.elementsFromPoint(want.x + size / 2, want.y + size / 2).find((n) => !button.current?.contains(n));
        if (under !== el) {
          hide();
        } else {
          give(el, size);
          setSpot((s) => {
            // Where the ✕ is now drawn vs where it should be: move it by the difference (any containing block).
            const b = s && s.host === host ? button.current?.getBoundingClientRect() : undefined;
            if (!s || !b) return { host, size, left: 0, top: 0, placed: false };
            const left = s.left + (want.x - b.left);
            const top = s.top + (want.y - b.top);
            if (s.placed && s.size === size && Math.abs(s.left - left) < 0.5 && Math.abs(s.top - top) < 0.5) return s;
            return { host, size, left, top, placed: true };
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Element | null;
      if (!isClearableField(t)) return;
      if (field.current && field.current !== t) hide();
      field.current = t;
      start();
    };
    document.addEventListener('focusin', onFocusIn, true);
    // A box focused before this mounted (an autofocus field on the first paint).
    if (isClearableField(document.activeElement)) {
      field.current = document.activeElement;
      start();
    }
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      if (raf) cancelAnimationFrame(raf);
      takeBack(field.current);
    };
  }, []);

  if (!spot) return null;
  return createPortal(
    <span
      ref={button}
      // The first frame draws it at (0, 0) of its containing block, hidden; the next moves it into place.
      data-global-clear=""
      style={{ position: 'absolute', left: spot.left, top: spot.top, width: spot.size, height: spot.size, zIndex: 2, visibility: spot.placed ? undefined : 'hidden' }}
    >
      <ClearButton
        label="Clear"
        className="sn-press grid h-full w-full place-items-center rounded-full bg-transparent p-0"
        discClassName={`grid place-items-center rounded-full bg-ink/[0.08] text-ink/70 ${spot.size < 36 ? 'h-6 w-6' : 'h-7 w-7'}`}
        onClear={() => {
          const el = field.current;
          if (el) clearTyped(el);
        }}
      />
    </span>,
    spot.host,
  );
}
