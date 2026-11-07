'use client';

/**
 * SearchAddRow — SEARCH OR ADD (owner 2026-10-24, verbatim: *"it is search or add for both guests and suppliers"*;
 * on the Suppliers page: *"we will show the result on the page itself. not a new screen. So it searches what we
 * already have on the shortlist, what service card has that, or add my own new supplier's service card manually
 * that i can give the supplier itself."*).
 *
 * While a page's search box holds words, the last row of its results is ONE button that adds what was typed:
 * "＋ Add “Maria” as a guest" · "＋ Add “Seda” as your own supplier". It is only the button — the page passes the
 * add door it already has (Guests: `openAddGuest`; Suppliers: the thumb row's `addYourOwn` → `AddYourOwnWalk`), so
 * there is no new mechanism here, and nothing here navigates.
 *
 * The words fit a phone: `.ab` never wraps, so a long name is clipped INSIDE its quotes (the label keeps its "as …"
 * end, which says what the press does) and the whole name is the button's accessible name.
 */
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/** The longest label drawn: 40 characters ≈ 280 px at the button's 13 px, which fits 375 with its icon and padding. */
export const SEARCH_ADD_LABEL_MAX = 40;

/** "Add “{name}” as {as}", the name clipped inside its quotes when the whole would not fit a phone. */
export function searchAddLabel(query: string, as: string): string {
  const name = query.trim();
  const rest = `Add “” as ${as}`;
  const room = Math.max(8, SEARCH_ADD_LABEL_MAX - rest.length);
  const shown = name.length > room ? `${name.slice(0, room - 1).trimEnd()}…` : name;
  return `Add “${shown}” as ${as}`;
}

/**
 * 👁 THE PREVIEW LINE (owner 2026-11-01: *"A live preview line under the box shows what will be added before Enter"*)
 * — "→ Mr. Roman Atkinson · +2 · Groomsman · #Barkada". One line, the page's own words; the page passes the text
 * (Guests: `typedGuestPreview`, the same draft its add sends). Polite live region, so a screen reader hears it settle.
 * Nothing to say → nothing drawn.
 */
export function AddPreviewLine({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  return (
    <p aria-live="polite" className={`min-w-0 truncate text-xs text-ink/65 ${className ?? ''}`} data-add-preview="">
      {text}
    </p>
  );
}

export function SearchAddRow({
  query,
  as,
  onAdd,
  className,
  preview,
}: {
  /** What is in the search box. */
  query: string;
  /** What they are added as — "a guest", "your own supplier". */
  as: string;
  /** The page's own add door, with the typed name. */
  onAdd: (name: string) => void;
  className?: string;
  /** What the add will make of the words, said under the button (`AddPreviewLine`). */
  preview?: string | null;
}) {
  const name = query.trim();
  if (!name) return null;
  return (
    <div className={`flex min-w-0 flex-col items-start gap-1 ${className ?? ''}`} data-search-add="">
      <ActionButton
        tone="brand"
        icon={Plus}
        label={searchAddLabel(name, as)}
        name={`Add “${name}” as ${as}`}
        className="max-w-full"
        onClick={() => onAdd(name)}
      />
      <AddPreviewLine text={preview} className="max-w-full px-1" />
    </div>
  );
}
