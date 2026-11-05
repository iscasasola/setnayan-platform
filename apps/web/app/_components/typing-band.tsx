'use client';

/**
 * typing-band.tsx — THE BAND ON THE KEYBOARD: "Typing · <place>" and ✓ Done (owner 2026-10-24, "Yes", on
 * `prototypes/keyboard_rides_the_input_2026-10-24.html`: *"Like this."* — the Maker's — and *"This should be a
 * template that will make everyone adapt."*).
 *
 * It is the Maker's typing bar, extracted: the classes are `SP_KEY_BAR` / `SP_KEY_BAR_FIXED` / `SP_KEY_DONE`
 * (`lib/maker-stage-room.ts`), the words are "Typing · <place>", and the ONE action is the app's main button, Done.
 * Done blurs the open field (`document.activeElement.blur()`), which KEEPS what was typed (the typed row's rule); a
 * caller may pass its own `onDone` (the Maker's typing-in-place closes its session).
 *
 * Three ways to stand, one look:
 *   · in flow (`inline`) — the Maker's toolbar draws it over its one open field (`stage-tools.tsx`);
 *   · on the keyboard (`fixed`) — portaled to <body>, edge to edge, its foot on the keyboard's top
 *     (`bottom` px, else `useKeyboardRide().bottom`): the Maker's typing-in-place and its RSVP words;
 *   · over a row (`over`) — standing on a bottom row that rides the keyboard (`ThumbRow`): its plate reaches down
 *     behind that row, so the band and the row read as ONE cream plate. With `search` (every riding row — owner
 *     2026-10-24, *"can this be gone? just tap away and keyboard should disappear"*) it is the plate ONLY: no words, no
 *     Done; a tap or a drag away closes the keyboard (`useTapAway`). The Maker keeps its words and its Done.
 *
 * Outside the Maker the band carries the app's own copy of the Maker's three neutrals (`[data-typing-band="app"]` in
 * globals.css, with a dark pair); inside it, it reads the Maker's (`STAGE_PANEL_VARS`) — so the Maker is unchanged.
 * This is the only typing band (`every-bottom-input-rides-the-keyboard.test.ts`).
 */
import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties, type FocusEvent, type FormEvent, type ReactNode, type Ref, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SP_KEY_BAR, SP_KEY_BAR_FIXED, SP_KEY_DONE } from '@/lib/maker-stage-room';
import { rideSmoothly, useKeyboardRide } from '@/lib/keyboard-ride';
import { useSearchPin } from '@/lib/search-pin';

/** Done's default: leave the field (a press outside it KEEPS — the typed row's own rule). */
export function blurTyping() {
  (document.activeElement as HTMLElement | null)?.blur?.();
}

type Common = {
  /** What is being typed — "Search guests", "Names", "Message". */
  place: ReactNode;
  onDone?: () => void;
  /** Anything else of the bar (an error line, its own <style>), drawn inside it. */
  children?: ReactNode;
  /** Drawn first inside the bar (a `<style>` the bar carries). */
  before?: ReactNode;
  /** The bar's own role (`toolbar`); `aria-*` and `data-*` given at the call land on the bar itself too. */
  role?: string;
  barRef?: Ref<HTMLDivElement>;
  /** A press on the band never takes the focus from the field it types for (a band that lives only while the field
   *  is focused would close under the finger). Always on for `over`. By `mousedown` only (a touch's click survives). */
  keepFocus?: boolean;
};

const holdFocus = (e: { preventDefault: () => void }) => e.preventDefault();

/** The band's height over a riding row (`over`: drawn from 44 px above the row). */
export const BAND_H = 44;

/** Where an `over` plate reaches: out to the screen's edges, `below` px past the row to its host's foot, and (the
 *  search band) `above` px over the row to its host's top. */
type Over = { left: number; width: number; below: number; above?: number };

function Face({ place, onDone }: { place: ReactNode; onDone?: () => void }) {
  return (
    <>
      <span className="min-w-0 truncate">Typing · {place}</span>
      {/* Done is the bar's ONE action: the app's main button (the accent — `ActionButton`), never an ink pill. */}
      <span data-type-done="" className={SP_KEY_DONE}>
        <ActionButton tone="brand" main icon={Check} label="Done" onClick={onDone ?? blurTyping} />
      </span>
    </>
  );
}

/** In flow — the Maker's toolbar (`[data-stage-keys]`). */
export function TypingBand(props: Common & { inline: true; className?: string }): ReactNode;
/** Fixed to the keyboard's top, portaled to <body>. `bottom` px, else the one keyboard reading. */
export function TypingBand(props: Common & { fixed: true; bottom?: number; className?: string; style?: CSSProperties }): ReactNode;
/** Behind and above a riding row (drawn inside it): reach `left` px out to the screen edge, `width` the screen, and
 *  `below` px down past the row to its host's foot. `search` — THE SEARCH BAND (owner 2026-10-24): no "Typing · …" and no
 *  Done, only the plate under the field, from `above` px over the row (its host's top) down to the keyboard. */
export function TypingBand(props: Common & { over: Over; search?: boolean }): ReactNode;
export function TypingBand(
  props: Common & { inline?: true; fixed?: true; over?: Over; search?: boolean; bottom?: number; className?: string; style?: CSSProperties },
): ReactNode {
  const { place, onDone, children, before, barRef, keepFocus, inline, fixed, over, search, bottom: atBottom, className, style, ...attrs } = props as typeof props & Record<string, unknown>;
  void fixed;
  const k = useKeyboardRide();
  const [here, setHere] = useState(false);
  useEffect(() => setHere(true), []);

  if (inline) {
    return (
      <div
        ref={barRef}
        {...attrs}
        onMouseDown={keepFocus ? holdFocus : undefined}
        className={`${(className as string | undefined) ?? ''} ${SP_KEY_BAR}`.trim()}
      >
        {before}
        <Face place={place} onDone={onDone} />
        {children}
      </div>
    );
  }
  if (!here) return null;
  if (over) {
    /* Drawn INSIDE the riding row (never portaled): the row's host is its own stacking layer, so a band portaled to
       <body> would cover the row. The plate is the row's back (`z-index: -1` in the row's own stacking context): it
       runs edge to edge (`left`/`width` reach out of the host's gutters), from the band's top (44 px above the row)
       down to the host's foot (`below` px under the row) — one cream surface from the band to the keyboard. */
    const { left, width, below, above = 0 } = over as Over;
    if (search) {
      /* 🔎 THE SEARCH BAND (owner 2026-10-24, on "Typing · Search guests" + ✓ Done: *"can this be gone? just tap away
         and keyboard should disappear"*): no words and no Done — only the plate, from the row's host's top down to the
         keyboard, so the field (and its ✕) reads as sitting ON the keyboard. A tap or a drag away closes it
         (`useTapAway`); Escape and the keyboard's own key still do. Decorative: the field keeps its own label. */
      return (
        <div
          ref={barRef}
          aria-hidden
          data-typing-band="app"
          data-search-band=""
          {...attrs}
          style={{ left, width, top: -above, bottom: -below }}
          className="pointer-events-none absolute z-[-1] rounded-t-2xl bg-[var(--tb-plate)] shadow-[var(--sn-sh-rise)]"
        />
      );
    }
    return (
      <div
        ref={barRef}
        // A group, not a second toolbar: it lives inside the riding row, which is the toolbar.
        role="group"
        aria-label={typeof place === 'string' ? `${place} — typing` : 'Typing'}
        data-typing-band="app"
        // The plate runs edge to edge (under a side safe area, as the bottom bar does); its words keep inside the
        // insets by the app's one rule (globals.css `[data-safe-x]`).
        data-safe-x=""
        {...attrs}
        style={{ left, width, top: -BAND_H, bottom: -below }}
        // A press on the band never takes the focus from the field it is typing for (Done's own press blurs it). On
        // `mousedown` ONLY: a cancelled `pointerdown` also cancels a touch's click in WebKit (measured 2026-10-24).
        onMouseDown={holdFocus}
        // 🪶 The plate floats over the list (owner 2026-10-24): the house float, cast up off the keyboard.
        className="pointer-events-none absolute z-[-1] flex flex-col rounded-t-2xl bg-[var(--tb-plate)] shadow-[var(--sn-sh-rise)]"
      >
        <div className={`pointer-events-auto !border-t-0 !bg-transparent ${SP_KEY_BAR}`}>
          {before}
          <Face place={place} onDone={onDone} />
          {children}
        </div>
      </div>
    );
  }
  return createPortal(
    <div
      ref={barRef}
      {...attrs}
      // On the keyboard's top while it is up; at the foot otherwise (a pinch-zoom is not a keyboard — never float).
      style={{ ...(style as CSSProperties | undefined), bottom: k.open ? ((atBottom as number | undefined) ?? k.bottom) : 0 }}
      className={`fixed inset-x-0 z-[85] ${(className as string | undefined) ?? ''} ${SP_KEY_BAR_FIXED}`.replace(/\s+/g, ' ')}
    >
      {before}
      <Face place={place} onDone={onDone} />
      {children}
    </div>,
    document.body,
  );
}

/** The fixed layer a row stands in (its host: Find's row, Guests' `.lower`) — the box the band's plate reaches behind. */
function layerOf(el: HTMLElement | null): HTMLElement | null {
  for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n;
  return null;
}

/**
 * 👆 TAP AWAY CLOSES THE KEYBOARD (owner 2026-10-24: *"just tap away and keyboard should disappear"*). While a field of
 * `ref` holds the focus (`active`):
 *   · a TAP anywhere outside it (the list, the page) leaves the field — AFTER the tap has done its own work, so a result
 *     or the "Add …" row opens in ONE tap (the blur is queued from the capture phase, so no handler can swallow it);
 *   · a DRAG that starts outside it (a scroll of the list) leaves the field, as iOS does;
 *   · Escape leaves it (the keyboard's own hide key needs nothing: it closes the keyboard, and the row stops riding).
 * A tap that moved the focus somewhere else (a sheet's own field) is left alone.
 */
/** A finger moving less than this is still a tap. */
export const TAP_SLOP = 10;
/** A tap on plain content leaves after this — long enough for a coming click to land first. */
export const TAP_SETTLE_MS = 120;

export function useTapAway(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const inside = (t: EventTarget | null) => t instanceof Node && Boolean(ref.current?.contains(t));
    const leave = () => {
      const a = document.activeElement as HTMLElement | null;
      if (a && ref.current?.contains(a)) a.blur();
    };
    let dragFromOutside = false;
    let from = { x: 0, y: 0 };
    let settle: ReturnType<typeof setTimeout> | null = null;
    const later = (ms: number) => {
      if (settle) clearTimeout(settle);
      settle = setTimeout(leave, ms);
    };
    // A click outside (a result, the Add row, any press on a desktop): leave once the click has done its own work.
    // 🫳 A CLICK NO PERSON MADE IS NOT A TAP AWAY (owner 2026-10-31, live iPhone, Guests › March: *"Why does the x inside
    // the type box not clearing the type box"*). `GlobalHaptics` answers EVERY press of a button at finger-DOWN with the
    // iOS haptic switch — a programmatic `.click()` on a hidden checkbox appended to <body> (`lib/haptics.ts`). That click
    // landed here, "outside" the row, so the ✕'s own press queued a blur: during the finger's hold the field left, the
    // keyboard closed, the row unfolded (⇕ · ≡ · ＋ back, the field shorter) and the WebView grew — and when the finger
    // LIFTED, the ✕'s click was hit-tested where the ✕ no longer was (measured in WebKit at 390×844 with a 120 ms hold:
    // the lift hit a <p> of the list; the words stayed "Dela"). Only a click a person made can be a tap away.
    const onClick = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      if (!inside(e.target)) later(0);
    };
    const onTouchStart = (e: TouchEvent) => {
      dragFromOutside = !inside(e.target);
      const t = e.touches?.[0];
      from = { x: t?.clientX ?? 0, y: t?.clientY ?? 0 };
    };
    // A drag that starts on the page (past a finger's slop, so a tap's jitter is still a tap) leaves at once.
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (dragFromOutside && t && Math.hypot(t.clientX - from.x, t.clientY - from.y) > TAP_SLOP) {
        dragFromOutside = false;
        leave();
      }
    };
    // 📱 A tap on plain content gets NO click on an iPhone (WebKit clicks only what is clickable — measured in the lab):
    // the tap itself leaves, a beat later, so a click that IS coming (a result) still lands first and wins the order.
    const onTouchEnd = (e: TouchEvent) => {
      if (dragFromOutside && !inside(e.target)) later(TAP_SETTLE_MS);
      dragFromOutside = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inside(e.target)) leave();
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    window.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    window.addEventListener('keydown', onKey, true);
    return () => {
      if (settle) clearTimeout(settle);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [ref, active]);
}

/** ⌨ The ONE riding decision (pure, so the guard can hold it): a field of the row is typed into, the keyboard is up,
 *  the row is not in a mode (Select's buttons), and the call did not opt out. */
export function rowRides(s: { rides: boolean; typing: string | null; open: boolean; mode: boolean }): boolean {
  return s.rides && s.typing !== null && s.open && !s.mode;
}

/**
 * ⌨ THE RIDING ROW — any bottom row with a text field rides the keyboard through this ONE hook (owner 2026-10-24,
 * *"Applies all textbox like that"*): `ThumbRow` uses it, and a bottom row that is not a ThumbRow (Budget's, the
 * marketplace's, the admin music tools) uses it directly. Spread `rowProps` on the row (it must be a positioned,
 * stacking box — the band's plate is drawn behind its seats), render `band` inside it, and fold what is not the field
 * while `riding` (`data-riding`). The band is the SEARCH band (no words, no Done) and a tap or a drag away, or Escape,
 * closes the keyboard (`useTapAway`).
 */
export function useRidingRow(
  rowRef: RefObject<HTMLElement | null>,
  opts: { rides?: boolean; mode?: boolean; place?: string } = {},
): {
  riding: boolean;
  typing: string | null;
  band: ReactNode;
  rowProps: {
    'data-ride-row': string;
    'data-riding': string | undefined;
    onFocus: (e: FocusEvent<HTMLElement>) => void;
    onBlur: (e: FocusEvent<HTMLElement>) => void;
    onInput: (e: FormEvent<HTMLElement>) => void;
  };
} {
  const { rides = true, mode = false, place } = opts;
  const kb = useKeyboardRide();
  const [typing, setTyping] = useState<string | null>(null);
  const riding = rowRides({ rides, typing, open: kb.open, mode });
  const onFocus = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      const t = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!/^(INPUT|TEXTAREA)$/.test(t.tagName) || ['date', 'checkbox', 'radio', 'file', 'range', 'color', 'hidden'].includes((t as HTMLInputElement).type)) return;
      setTyping(place ?? (t.placeholder || t.getAttribute('aria-label') || 'Search'));
    },
    [place],
  );
  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setTyping(null);
  }, []);
  /* 📌 A SEARCH SHOWS ITS FIRST RESULT (`lib/search-pin.ts`): the words changed → once they are still, the first result
     sits under the top chrome, or, with none, the Add row just above the band. */
  const pin = useSearchPin(rowRef);
  const onInput = useCallback(
    (e: FormEvent<HTMLElement>) => {
      const t = e.target as HTMLInputElement;
      if (t.tagName === 'INPUT' && (t.type === 'search' || t.type === 'text' || !t.getAttribute('type'))) pin.poke(t.value);
    },
    [pin],
  );
  /* 🛗 The row's host GLIDES with the keyboard (`rideSmoothly`, lib/keyboard-ride.ts): transform only, timed to it. */
  useEffect(() => {
    const layer = layerOf(rowRef.current);
    return layer ? rideSmoothly(layer) : undefined;
  }, [rowRef]);
  /* Where the band's plate reaches: out to the screen's edges, and down past the row to its host's foot (the host's
     own bottom padding) — measured, because each host pads its row its own way. */
  const [over, setOver] = useState<Over | null>(null);
  /* 👆 Every riding row is a SEARCH row: a tap or a drag away closes its keyboard (`useTapAway`). */
  useTapAway(rowRef, typing !== null);
  useLayoutEffect(() => {
    if (!riding) return setOver(null);
    const row = rowRef.current;
    if (!row) return;
    const layer = layerOf(row);
    const read = () => {
      const r = row.getBoundingClientRect();
      const host = layer && layer !== row ? layer.getBoundingClientRect() : null;
      const foot = host ? host.bottom : r.bottom;
      // The search band's plate starts at the host's top (its own padding over the row), never above it.
      const above = host ? Math.max(0, Math.round(r.top - host.top)) : 0;
      const next = { left: Math.round(-r.left), width: document.documentElement.clientWidth, below: Math.max(0, Math.round(foot - r.bottom)), above };
      setOver((o) => (o && o.left === next.left && o.width === next.width && o.below === next.below && o.above === next.above ? o : next));
      /* 📏 THE PAGE MAKES ROOM FOR THE BAND (owner 2026-10-24: the bar "overlaps with the content under it"): while the
         band is up the page's foot gains the band's height (its top, the host's top over the row, down to the host's foot) on top
         of the keyboard's (`--sn-keyboard-h`) — globals.css `html[data-ride-reserve]` — so the last result can scroll
         up above the band instead of living under it. Differences of two boxes, so a glide in flight cannot skew it. */
      root.style.setProperty('--sn-ride-band-h', `${Math.max(0, Math.round(foot - (r.top - above)))}px`);
      root.setAttribute('data-ride-reserve', '');
    };
    const root = document.documentElement;
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(row);
    if (layer && layer !== row) ro?.observe(layer);
    return () => {
      ro?.disconnect();
      root.removeAttribute('data-ride-reserve');
      root.style.removeProperty('--sn-ride-band-h');
    };
  }, [riding, kb.bottom, kb.height, rowRef]);
  return {
    riding,
    typing,
    band: riding && over ? <TypingBand over={over} search place={typing} data-ride-band="" /> : null,
    rowProps: { 'data-ride-row': '', 'data-riding': riding ? '' : undefined, onFocus, onBlur, onInput },
  };
}
