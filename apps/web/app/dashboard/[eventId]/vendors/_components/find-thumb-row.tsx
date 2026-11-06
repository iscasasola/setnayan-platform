'use client';

/**
 * FindThumbRow — the floating row at the thumb of Find (owner 2026-10-07
 * evening; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2 "UPDATED
 * 2026-10-07 EVENING / LATE"; acceptance pictures 19–22):
 *
 *     ⇕ Expand all / Collapse all  ·  Search suppliers  ·  ⇅ Sort & filter  ·  ＋ Add your own
 *
 * Since 2026-10-22 ("One thumb row") the controls are drawn by the shared
 * `components/thumb-row.tsx`; this file keeps the slide, the portal and the
 * empty-box panel. The placeholder is "Search suppliers" — the old
 * "Search all suppliers or add your own" was cut at 375 (the ＋ says the rest).
 *
 * It OWNS NOTHING. The bench (`shortlist-categories.tsx`) keeps the state —
 * which categories are open, the search text, the "add your own" form — and
 * this row is only where three of its controls now live. Nothing here writes.
 *
 * The universal rules it carries (`BUTTON_RULE_2026-10-07_fable.md`):
 *   3a  the row changes state AS ONE — icon + word → word → icon (`useFitRow`);
 *   3b  the field keeps at least 60 % of the row; the buttons are what give;
 *   4   the search runs 250 ms after the last keystroke, and typing never
 *       rebuilds the box (its text is this component's own state);
 *   5   it slides UP once the mode has rendered and DOWN before the body swaps;
 *   7   it is glass: no background of its own — the field and the neutral
 *       control are frosted (`.sn-glass-row`), and Add keeps its full colour.
 *
 * THE EMPTY BOX IS THE DOOR TO FIND (owner 2026-10-21 — *"Why do i have this
 * find supplier button? When we have the search bar at the bottom?"* ⇒ the big
 * button is gone): tapped with nothing typed, the box opens the Find page's own
 * category list (`emptyPanel` — `FindCategoryList`, drawn by the page from
 * `readFindList`) right above it. Typing closes it and narrows the page as
 * before; a row goes where the Find page's row goes; a tap outside or Escape
 * closes it. `?find=1` on the address opens it (the doors that used to open the
 * Find page's browse — see `findDoorHref`).
 *
 * Drawn into <body>: the dashboard's page wrapper captures `position: fixed`.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import { ThumbRow, type ThumbMenu } from '@/components/thumb-row';
import { FIND_DOOR_PARAM } from '@/lib/suppliers-shell';
import { THUMB_SLIDE_MS, useSuppliersMode } from './suppliers-mode';

/**
 * The words name the place (owner 2026-10-13: *"whatever category is picked, that is where we add manually and
 * search"*; 2026-10-22: short enough to read whole at 320). One open category with a short name → "Search Florists";
 * a long one → "Search this category"; nothing open → "Search suppliers".
 */
export function findPlaceholder(scope: string): string {
  if (scope === 'all suppliers') return 'Search suppliers';
  return scope.length <= 14 && scope.trim().split(/\s+/).length <= 2 ? `Search ${scope}` : 'Search this category';
}

/** Rule 4 — the shipped Guests search waits the same 250 ms. */
export const THUMB_SEARCH_DEBOUNCE_MS = 250;


export function FindThumbRow({
  allOpen,
  onToggleAll,
  scope,
  onSearch,
  onAdd,
  emptyPanel = null,
  sortMenu = null,
  onGoToCategory,
}: {
  /** Every category is open → the control offers "Collapse all". */
  allOpen: boolean;
  onToggleAll: () => void;
  /** What the box searches — "all suppliers", or the open category's name. */
  scope: string;
  /** Called 250 ms after the last keystroke, with the text as typed. */
  onSearch: (text: string) => void;
  /** Opens "add your own" — for the open category, or asking which first —
   *  with the name already typed in the box, if any. */
  onAdd: (typed: string) => void;
  /** What the box shows while it is open with nothing typed — the Find page's
   *  category list. Null → nothing (the box is only a search box). */
  emptyPanel?: ReactNode;
  /** ⇅ — Sort · Price · Rating in ONE dropdown, the ≡ seat after the field (owner 2026-10-29, Find v4.2;
   *  `find-sort-menu.tsx`). Null → no seat. */
  sortMenu?: ThumbMenu | null;
  /**
   * GO TO A CATEGORY (owner 2026-10-29: *"when we are deep in the search can our thumb rule be the place to return and
   * see the other categories?"*) — a row of the empty box's category list that is ON this page opens HERE: the
   * current category folds, that one opens and lands pinned. Returns false for a row this page does not draw, which
   * then goes where the Find page's row goes, as before.
   */
  onGoToCategory?: (tile: string) => boolean;
}) {
  const { mode, leaving, thumbUp } = useSuppliersMode();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  // ── Rule 5 — up once Find has rendered, down first when leaving it.
  const wanted = mode === 'find' && !leaving;
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (!wanted) {
      thumbUp.current = false;
      setUp(false);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        thumbUp.current = true;
        setUp(true);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [wanted, thumbUp]);
  useEffect(
    () => () => {
      thumbUp.current = false;
    },
    [thumbUp],
  );

  // ── Rule 4 — the box keeps its own text; the list hears it 250 ms later.
  const [text, setText] = useState('');
  const said = useRef('');
  useEffect(() => {
    if (text === said.current) return;
    const t = window.setTimeout(() => {
      said.current = text;
      onSearch(text);
    }, THUMB_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [text, onSearch]);

  // ── The empty state: open while the box is in use with nothing typed.
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const showPanel = open && up && emptyPanel != null && text.trim() === '';
  // `?find=1` — a door that used to open the Find page's browse lands here.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(FIND_DOOR_PARAM) !== '1') return;
      url.searchParams.delete(FIND_DOOR_PARAM);
      window.history.replaceState(null, '', url);
      setOpen(true);
    } catch {
      // No URL/history — the box simply opens closed.
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    // Closed by a press OUTSIDE the row (never on blur: a press on a category
    // row blurs the box first, and must still land on the row).
    const onDown = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  // Leaving Find closes it.
  useEffect(() => {
    if (!wanted) setOpen(false);
  }, [wanted]);

  // A category row ON this page opens here (`onGoToCategory`); any other keeps going where the Find page's row goes.
  const goFromPanel = (e: { target: EventTarget; preventDefault: () => void }) => {
    const tile = (e.target as HTMLElement).closest('[data-find-tile]')?.getAttribute('data-find-tile');
    if (tile && onGoToCategory?.(tile)) {
      e.preventDefault();
      setOpen(false);
    }
  };
  if (!host) return null;
  return createPortal(
    <div
      data-find-thumb=""
      ref={rowRef}
      data-on={up ? 'true' : 'false'}
      inert={!up}
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--sn-ride-h,var(--sn-bottomdock-h,64px))] z-[25] pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] py-2.5 transition-transform ease-out motion-reduce:transition-none tab:bottom-7 tab:left-[var(--sup-col-left,auto)] tab:right-[var(--sup-col-right,max(1.75rem,var(--sn-safe-r)))] tab:w-[var(--sup-col-w,min(720px,calc(100vw-128px)))] tab:px-0 ${
        up ? 'translate-y-0' : 'translate-y-[calc(100%_+_32px)]'
      }`}
      style={{ transitionDuration: `${THUMB_SLIDE_MS}ms` }}
    >
      {showPanel ? (
        // A menu of choices floating over the page — the one surface here that
        // needs an edge to read against what is under it. Its rows are divided,
        // never framed (they are the Find page's own rows).
        <div
          id={panelId}
          role="region"
          aria-label="Categories"
          data-find-empty=""
          onClick={goFromPanel}
          className="pointer-events-auto mb-2 max-h-[min(62vh,560px)] overflow-y-auto overscroll-contain rounded-2xl bg-paper px-4 pb-4 shadow-[0_-6px_28px_rgba(0,0,0,0.14)] ring-1 ring-ink/10"
        >
          {emptyPanel}
        </div>
      ) : null}
      {/* ONE THUMB ROW (owner 2026-10-22): this row is the template, drawn through the shared component —
          ⇕ · "Search suppliers" · ＋ Add your own, each its own glass at 44 px. */}
      <ThumbRow
        name="suppliers-find"
        left={[
          {
            icon: allOpen ? ChevronsDownUp : ChevronsUpDown,
            label: allOpen ? 'Collapse all' : 'Expand all',
            expanded: allOpen,
            onClick: () => {
              setOpen(false);
              onToggleAll();
            },
          },
        ]}
        field={{
          placeholder: findPlaceholder(scope),
          label: `Search ${scope}`,
          tour: 'suppliers-find',
          input: {
            value: text,
            onChange: (e) => setText(e.target.value),
            onFocus: emptyPanel != null ? () => setOpen(true) : undefined,
            onClick: emptyPanel != null ? () => setOpen(true) : undefined,
            'aria-expanded': emptyPanel != null ? showPanel : undefined,
            'aria-controls': showPanel ? panelId : undefined,
          },
        }}
        right={sortMenu ? [sortMenu] : []}
        action={{
          icon: Plus,
          label: text.trim() ? 'Add' : 'Add your own',
          tour: 'suppliers-add-own',
          onClick: () => {
            // The typed name goes INTO the walk; the box is then the search box
            // again, empty (the prototype's `add()`), and the list hears it now.
            const typed = text;
            setOpen(false);
            said.current = '';
            setText('');
            onSearch('');
            onAdd(typed);
          },
        }}
      />
    </div>,
    host,
  );
}
