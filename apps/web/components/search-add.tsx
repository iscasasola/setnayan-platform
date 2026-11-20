'use client';

/**
 * search-add.tsx — SEARCH OR ADD, THE ONE SHARED PART (owner 18–19 Nov 2026, verbatim: *"so we also do no need an add
 * button because. our text box is search / add feature"* · *"if there is no search and needs to be added the magnifying
 * glass icon changes to add"* · *"if ever they search but they want to add. they tap that search icon to become add
 * icon"* · *"perfect search and add bar is good. tap the magnifying glass to convert it to add."* · *"not all search
 * bar converts to add. just only those that needs conversion"*).
 *
 * A search that can ADD what was typed wears this icon in place of its magnifier:
 *   · 🔍 while something matches (and while the box is empty);
 *   · ＋ BY ITSELF when the words match nothing;
 *   · a tap on 🔍 while there are matches switches it to ＋ ("they search but they want to add");
 *   · as ＋, a tap on it — or Enter — adds what was typed;
 *   · a ＋ they TAPPED for holds until the box is cleared, even when the words match; a ＋ that came by itself goes
 *     back to 🔍 as soon as the words match again; clearing the box returns 🔍 either way;
 *   · the press never takes the cursor: the keyboard stays up (`holdFocus` on pointerdown and mousedown), and a
 *     finger's press is its touchend, never a click that may not come (`pressOnTouchEnd`).
 *
 * ONLY a search handed an `onAdd` gets it — a search with nothing to add keeps its plain magnifier, untouched.
 * The morph and the colours are `search-add.module.css`. Used by `components/thumb-row.tsx` (the row's own field:
 * Guests, the couple's Suppliers) and `app/_components/search-box.tsx` (the supplier's Clients).
 * 🔒 lib/a-search-that-adds-shows-add.test.ts
 */
import { useEffect, useState } from 'react';
import { holdFocus } from '@/components/clear-field';
import styles from './search-add.module.css';

export type SearchAddMode = 'search' | 'add';

/** What a search that can add is handed. */
export type SearchAdd = {
  /** Add what was typed (trimmed, never empty). */
  onAdd: (typed: string) => void;
  /** The words the list is searched with NOW (the host's own — after its wait). */
  query: string;
  /** Does anything in the list match those words? */
  matches: boolean;
};

/** The one decision: 🔍 or ＋. Pure, so the guard reads it. */
export function searchAddMode({ words, matches, asked }: { words: boolean; matches: boolean; asked: boolean }): SearchAddMode {
  if (!words) return 'search'; // an empty box is a search
  if (!matches) return 'add'; // nothing matches → it adds, by itself
  return asked ? 'add' : 'search'; // matches → 🔍, until they tap it
}

/** What a press on the icon does, from what is in the box and what the icon shows. */
export function searchAddPress(typed: string, mode: SearchAddMode): 'focus' | 'ask' | 'add' {
  if (!typed.trim()) return 'focus';
  return mode === 'add' ? 'add' : 'ask';
}

/**
 * ＋ HOLDS ONLY WHEN THEY ASKED FOR IT (owner 19 Nov 2026, the hold rule as he changed it): a tap on 🔍 over words
 * switches to ＋ and it STAYS ＋ — words that match again do not turn it back — until the box is cleared. A ＋ that
 * came BY ITSELF because nothing matched is not held: the moment the words match again it is 🔍 (the reverse morph).
 * Clearing the box returns 🔍 in both cases. Pure: `held` is "they tapped 🔍"; this is what it is after the words change.
 */
export function searchAddHeld(held: boolean, { words }: { words: boolean }): boolean {
  return words ? held : false; // cleared → 🔍; a no-match never sets it
}

/**
 * The mode a search that can add is in. `add` absent → always 'search' (and the caller draws its plain magnifier).
 * `asked` — it is ＋ while something DOES match (they tapped 🔍 — the only way that happens): Enter is then
 * the add outright, never the host's own Enter over the matches.
 */
/**
 * 👉 DRAG THE BOX RIGHT TO ADD (owner 20 Nov 2026, Guests redesign pick 1: *"Switch the thumb-row box to Add by
 * dragging it right; the shipped tap 🔍 → ＋ stays as a second way"*). How far a finger must carry the box sideways
 * before it switches — and how far the box follows it (a short rubber band, then it stops).
 */
export const SEARCH_ADD_DRAG_PX = 48;
export const SEARCH_ADD_DRAG_FOLLOW_PX = 28;

/** What a sideways drag of the box means, from how far it went: right → add, left → back to search, else nothing. */
export function searchAddDrag(dx: number, dy: number): 'add' | 'search' | null {
  if (Math.abs(dy) > Math.abs(dx)) return null; // a scroll, not a drag
  if (dx >= SEARCH_ADD_DRAG_PX) return 'add';
  if (dx <= -SEARCH_ADD_DRAG_PX) return 'search';
  return null;
}

export function useSearchAdd(add: SearchAdd | null | undefined): {
  mode: SearchAddMode;
  asked: boolean;
  press: (input: HTMLInputElement | null) => void;
  /** 👉 Dragged right (true) or back left (false). A box dragged right adds even while empty, until it is dragged
      back or cleared with ✕ (`forget`). */
  drag: (toAdd: boolean) => void;
  forget: () => void;
} {
  const [held, setHeld] = useState(false);
  /* 👉 What the last drag asked for — 'add' (dragged right) or 'search' (dragged back); null = no drag, the rules above
     decide. Dragged back holds 🔍 only while the box has words: an emptied box forgets it. */
  const [dragged, setDragged] = useState<SearchAddMode | null>(null);
  const query = add?.query ?? '';
  const words = query.trim().length > 0;
  const matches = add?.matches ?? true;
  useEffect(() => {
    setHeld((h) => searchAddHeld(h, { words }));
  }, [words]);
  useEffect(() => {
    if (!words) setDragged((d) => (d === 'search' ? null : d));
  }, [words]);
  const ruled: SearchAddMode = add ? searchAddMode({ words, matches, asked: held }) : 'search';
  const mode: SearchAddMode = add && dragged ? dragged : ruled;
  const press = (input: HTMLInputElement | null) => {
    if (!add || !input) return;
    const typed = input.value.trim();
    /* What the icon SHOWS decides — except that words the list has not been searched with yet (the host's wait) and
       that the box already holds are words: 🔍 pressed over them asks for the add. */
    const act = searchAddPress(typed, mode);
    if (act === 'focus') input.focus({ preventScroll: true });
    else if (act === 'ask') setHeld(true);
    else add.onAdd(typed);
  };
  const drag = (toAdd: boolean) => setDragged(toAdd ? 'add' : 'search');
  /** ✕ cleared the box: a drag's choice goes with the words. */
  const forget = () => setDragged(null);
  return { mode, asked: mode === 'add' && (matches || dragged === 'add'), press, drag, forget };
}

/**
 * 👆 A FINGER'S PRESS DOES NOT WAIT FOR THE CLICK. The icon refuses its pointerdown (the cursor stays in the box), and
 * a refused pointerdown may take the click with it — measured 19 Nov 2026 in WebKit under touch: pointerdown ·
 * touchstart · pointerup · touchend, and NO click, so 🔍 never became ＋. So the touch's own end is the press, and it
 * is refused its default too: no click follows it (never two presses), and the cursor still stays. A touch the page
 * took for a scroll (not cancelable) or that ended off the icon is not a press. Mouse, pen and keyboard: the click.
 */
export function pressOnTouchEnd(onPress: () => void) {
  return (e: { cancelable: boolean; preventDefault: () => void; currentTarget: { getBoundingClientRect: () => { left: number; right: number; top: number; bottom: number } }; changedTouches: { length: number; [i: number]: { clientX: number; clientY: number } } }) => {
    if (!e.cancelable) return;
    const t = e.changedTouches[0];
    const r = e.currentTarget.getBoundingClientRect();
    if (!t || t.clientX < r.left || t.clientX > r.right || t.clientY < r.top || t.clientY > r.bottom) return;
    e.preventDefault();
    onPress();
  };
}

/** The icon: ONE svg, three strokes, switched by `data-mode` (the drawing's `.mg-ring` · `.mg-bar1` · `.mg-bar2`). */
export function SearchAddIcon({ mode, onPress, place, tour, className = '' }: { mode: SearchAddMode; onPress: () => void; /** "guests" — for its name. */ place?: string; /** 🔦 `data-tour`. */ tour?: string; /** Where it stands in its host's box (margins only). */ className?: string }) {
  return (
    <button
      type="button"
      data-search-add-icon=""
      data-mode={mode}
      data-tour={tour}
      aria-label={mode === 'add' ? 'Add what you typed' : `Search${place ? ` ${place}` : ''}, or tap to add`}
      className={`${styles.icon} ${className}`}
      onPointerDown={holdFocus}
      onMouseDown={holdFocus}
      onTouchEnd={pressOnTouchEnd(onPress)}
      onClick={onPress}
    >
      <svg className={`mg ${styles.mg}`} viewBox="0 0 24 24" aria-hidden="true">
        <circle className={`mg-ring ${styles.ring}`} cx="12" cy="12" r="6.5" />
        <line className={`mg-bar1 ${styles.bar1}`} x1="0" y1="-5" x2="0" y2="5" />
        <line className={`mg-bar2 ${styles.bar2}`} x1="0" y1="-5" x2="0" y2="5" />
      </svg>
    </button>
  );
}
