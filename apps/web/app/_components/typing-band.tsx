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
 *   · over a row (`over`) — the same band, standing on a bottom row that rides the keyboard (`ThumbRow`): its plate
 *     reaches down behind that row, so the band and the row read as ONE cream plate.
 *
 * Outside the Maker the band carries the app's own copy of the Maker's three neutrals (`[data-typing-band="app"]` in
 * globals.css, with a dark pair); inside it, it reads the Maker's (`STAGE_PANEL_VARS`) — so the Maker is unchanged.
 * This is the only typing band (`every-bottom-input-rides-the-keyboard.test.ts`).
 */
import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties, type FocusEvent, type ReactNode, type Ref, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SP_KEY_BAR, SP_KEY_BAR_FIXED, SP_KEY_DONE } from '@/lib/maker-stage-room';
import { useKeyboardRide } from '@/lib/keyboard-ride';

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
   *  is focused would close under the finger). Always on for `over`. */
  keepFocus?: boolean;
};

const holdFocus = (e: { preventDefault: () => void }) => e.preventDefault();

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
 *  `below` px down past the row to its host's foot. */
export function TypingBand(props: Common & { over: { left: number; width: number; below: number } }): ReactNode;
export function TypingBand(
  props: Common & { inline?: true; fixed?: true; over?: { left: number; width: number; below: number }; bottom?: number; className?: string; style?: CSSProperties },
): ReactNode {
  const { place, onDone, children, before, barRef, keepFocus, inline, fixed, over, bottom: atBottom, className, style, ...attrs } = props as typeof props & Record<string, unknown>;
  void fixed;
  const k = useKeyboardRide();
  const [here, setHere] = useState(false);
  useEffect(() => setHere(true), []);

  if (inline) {
    return (
      <div
        ref={barRef}
        {...attrs}
        onPointerDown={keepFocus ? holdFocus : undefined}
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
    const { left, width, below } = over as { left: number; width: number; below: number };
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
        style={{ left, width, top: -44, bottom: -below }}
        // A press on the band never takes the focus from the field it is typing for (Done's own press blurs it).
        onPointerDown={holdFocus}
        onMouseDown={holdFocus}
        className="pointer-events-none absolute z-[-1] flex flex-col rounded-t-2xl bg-[var(--tb-plate)]"
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
 * while `riding` (`data-riding`). The band's words are the focused field's own placeholder, else its accessible name.
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
  /* Where the band's plate reaches: out to the screen's edges, and down past the row to its host's foot (the host's
     own bottom padding) — measured, because each host pads its row its own way. */
  const [over, setOver] = useState<{ left: number; width: number; below: number } | null>(null);
  useLayoutEffect(() => {
    if (!riding) return setOver(null);
    const row = rowRef.current;
    if (!row) return;
    const layer = layerOf(row);
    const read = () => {
      const r = row.getBoundingClientRect();
      const foot = layer && layer !== row ? layer.getBoundingClientRect().bottom : r.bottom;
      const next = { left: Math.round(-r.left), width: document.documentElement.clientWidth, below: Math.max(0, Math.round(foot - r.bottom)) };
      setOver((o) => (o && o.left === next.left && o.width === next.width && o.below === next.below ? o : next));
    };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(row);
    if (layer && layer !== row) ro?.observe(layer);
    return () => ro?.disconnect();
  }, [riding, kb.bottom, kb.height, rowRef]);
  return {
    riding,
    typing,
    band: riding && over ? <TypingBand over={over} place={typing} data-ride-band="" /> : null,
    rowProps: { 'data-ride-row': '', 'data-riding': riding ? '' : undefined, onFocus, onBlur },
  };
}
