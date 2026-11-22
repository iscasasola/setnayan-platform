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
 *   · clearing the box returns it to 🔍;
 *   · the press never takes the cursor: the keyboard stays up (`holdFocus` on pointerdown and mousedown).
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
 * The mode a search that can add is in. `add` absent → always 'search' (and the caller draws its plain magnifier).
 * "Asked" — they tapped 🔍 — holds until the box is cleared.
 */
export function useSearchAdd(add: SearchAdd | null | undefined): { mode: SearchAddMode; asked: boolean; press: (input: HTMLInputElement | null) => void } {
  const [asked, setAsked] = useState(false);
  const query = add?.query ?? '';
  const words = query.trim().length > 0;
  useEffect(() => {
    if (!words) setAsked(false);
  }, [words]);
  const mode: SearchAddMode = add ? searchAddMode({ words, matches: add.matches, asked }) : 'search';
  const press = (input: HTMLInputElement | null) => {
    if (!add || !input) return;
    const typed = input.value.trim();
    /* What the icon SHOWS decides — except that words the list has not been searched with yet (the host's wait) and
       that the box already holds are words: 🔍 pressed over them asks for the add. */
    const act = searchAddPress(typed, mode);
    if (act === 'focus') input.focus({ preventScroll: true });
    else if (act === 'ask') setAsked(true);
    else add.onAdd(typed);
  };
  return { mode, asked, press };
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
