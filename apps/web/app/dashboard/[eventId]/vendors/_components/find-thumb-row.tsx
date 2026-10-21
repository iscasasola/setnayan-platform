'use client';

/**
 * FindThumbRow — the floating row at the thumb of Find (owner 2026-10-07
 * evening; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2 "UPDATED
 * 2026-10-07 EVENING / LATE"; acceptance pictures 19–22):
 *
 *     ⇕ Expand all / Collapse all  ·  Search all suppliers or add your own  ·  ＋ Add your own
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
import { ChevronsDownUp, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { FIND_DOOR_PARAM, SUP_REACH_X } from '@/lib/suppliers-shell';
import { THUMB_SLIDE_MS, useSuppliersMode } from './suppliers-mode';

/** Rule 4 — the shipped Guests search waits the same 250 ms. */
export const THUMB_SEARCH_DEBOUNCE_MS = 250;


export function FindThumbRow({
  allOpen,
  onToggleAll,
  scope,
  onSearch,
  onAdd,
  emptyPanel = null,
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

  if (!host) return null;
  const words = `Search ${scope} or add your own`;
  return createPortal(
    <div
      data-find-thumb=""
      ref={rowRef}
      data-on={up ? 'true' : 'false'}
      inert={!up}
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--sn-bottomdock-h,64px)] z-[25] pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] py-2.5 transition-transform ease-out motion-reduce:transition-none tab:bottom-7 tab:left-auto tab:right-[max(1.75rem,var(--sn-safe-r))] tab:w-[min(720px,calc(100vw-128px))] tab:px-0 ${
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
          className="pointer-events-auto mb-2 max-h-[min(62vh,560px)] overflow-y-auto overscroll-contain rounded-2xl bg-paper px-4 pb-4 shadow-[0_-6px_28px_rgba(0,0,0,0.14)] ring-1 ring-ink/10"
        >
          {emptyPanel}
        </div>
      ) : null}
      <ThumbControls
        allOpen={allOpen}
        onToggleAll={() => {
          setOpen(false);
          onToggleAll();
        }}
        words={words}
        text={text}
        onText={setText}
        panel={emptyPanel != null ? { id: panelId, open: showPanel, onOpen: () => setOpen(true) } : null}
        onAdd={() => {
          // The typed name goes INTO the walk; the box is then the search box
          // again, empty (the prototype's `add()`), and the list hears it now.
          const typed = text;
          setOpen(false);
          said.current = '';
          setText('');
          onSearch('');
          onAdd(typed);
        }}
      />
    </div>,
    host,
  );
}

/**
 * The row's three controls — their OWN component, on purpose.
 *
 * 🪤 The row is drawn into <body>, so it does not exist on the first render
 * (`host` is null until mount). `useFitRow` measures in an effect that runs
 * ONCE for the component that calls it: called from `FindThumbRow`, it ran
 * while the row was not there yet, found no element, and never ran again — the
 * buttons kept their words and the field was squeezed to one letter (measured
 * on the preview at 375, 2026-10-08: the placeholder showed only "S"). Here the
 * hook mounts WITH the row, so the fit pass always has a row to measure.
 *
 * The field's 60 % is also held in CSS (`min-w-[60%]`), so it is true before
 * any script runs; the buttons are what give.
 */
function ThumbControls({
  allOpen,
  onToggleAll,
  words,
  text,
  onText,
  onAdd,
  panel,
}: {
  allOpen: boolean;
  onToggleAll: () => void;
  words: string;
  text: string;
  onText: (text: string) => void;
  onAdd: () => void;
  /** The empty state's door — null when the row has none. */
  panel: { id: string; open: boolean; onOpen: () => void } | null;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  return (
    <div ref={rowRef} className="pointer-events-auto flex min-w-0 items-center gap-1.5">
      {/* 👆 The glass clips what leaves it (`overflow:hidden`, for the blur), so the 44-px reach is the wrapper's:
          a press on the reach or on the glass's own edge is the button's press. */}
      <span
        className={`${SUP_REACH_X} inline-flex shrink-0`}
        data-press-reach=""
        onClick={(e) => {
          if (!(e.target as Element).closest('button')) e.currentTarget.querySelector('button')?.click();
        }}
      >
        <span className="sn-glass-row inline-flex shrink-0 rounded-full">
          <ActionButton
            tone="neutral"
            icon={allOpen ? ChevronsDownUp : ChevronsUpDown}
            label={allOpen ? 'Collapse all' : 'Expand all'}
            aria-expanded={allOpen}
            onClick={onToggleAll}
            className="!border-transparent"
          />
        </span>
      </span>
      <label
        data-glass-row="suppliers-find"
        data-fit-field=""
        className="sn-glass-row flex h-10 min-w-[60%] flex-1 items-center gap-2 rounded-full px-3.5 text-ink"
        data-tour="suppliers-find"
      >
        <Search className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.9} aria-hidden />
        <input
          type="search"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onFocus={panel?.onOpen}
          onClick={panel?.onOpen}
          aria-expanded={panel ? panel.open : undefined}
          aria-controls={panel?.open ? panel.id : undefined}
          placeholder={words}
          aria-label={words}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink/55"
        />
      </label>
      {/* Add is terracotta and FILLED at every width (the prototype's thumb row), but
          it is not the row's "main verb" to the fit pass — on a phone it is the ＋
          circle, so it may drop its word with the rest of the row: `filled`. With a
          name typed the word is simply "Add" — the name is the "your own". */}
      <ActionButton tone="brand" filled icon={Plus} label={text.trim() ? 'Add' : 'Add your own'} onClick={onAdd} className={SUP_REACH_X} />
    </div>
  );
}
