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
 * Drawn into <body>: the dashboard's page wrapper captures `position: fixed`.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsDownUp, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { ActionButton, useFitRow } from '@/components/action-button';
import { THUMB_SLIDE_MS, useSuppliersMode } from './suppliers-mode';

/** Rule 4 — the shipped Guests search waits the same 250 ms. */
export const THUMB_SEARCH_DEBOUNCE_MS = 250;

/** Add is terracotta and FILLED at every width (the prototype's thumb row), but
 *  it is not the row's "main verb" to the fit pass — on a phone it is the ＋
 *  circle, so it must be allowed to drop its word with the rest of the row. */
const ADD_FILLED = '!border-mulberry !bg-mulberry !text-white';

export function FindThumbRow({
  allOpen,
  onToggleAll,
  scope,
  onSearch,
  onAdd,
}: {
  /** Every category is open → the control offers "Collapse all". */
  allOpen: boolean;
  onToggleAll: () => void;
  /** What the box searches — "all suppliers", or the open category's name. */
  scope: string;
  /** Called 250 ms after the last keystroke, with the text as typed. */
  onSearch: (text: string) => void;
  /** Opens "add your own" — for the open category, or asking which first. */
  onAdd: () => void;
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

  if (!host) return null;
  const words = `Search ${scope} or add your own`;
  return createPortal(
    <div
      data-find-thumb=""
      data-on={up ? 'true' : 'false'}
      inert={!up}
      className={`pointer-events-none fixed inset-x-0 bottom-[var(--sn-bottomdock-h,64px)] z-[25] px-4 py-2.5 transition-transform ease-out motion-reduce:transition-none lg:bottom-7 lg:left-auto lg:right-7 lg:w-[720px] lg:px-0 ${
        up ? 'translate-y-0' : 'translate-y-[calc(100%_+_32px)]'
      }`}
      style={{ transitionDuration: `${THUMB_SLIDE_MS}ms` }}
    >
      <ThumbControls
        allOpen={allOpen}
        onToggleAll={onToggleAll}
        words={words}
        text={text}
        onText={setText}
        onAdd={onAdd}
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
}: {
  allOpen: boolean;
  onToggleAll: () => void;
  words: string;
  text: string;
  onText: (text: string) => void;
  onAdd: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  return (
    <div ref={rowRef} className="pointer-events-auto flex min-w-0 items-center gap-1.5">
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
      <label
        data-glass-row="suppliers-find"
        data-fit-field=""
        className="sn-glass-row flex h-10 min-w-[60%] flex-1 items-center gap-2 rounded-full px-3.5 text-ink"
      >
        <Search className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.9} aria-hidden />
        <input
          type="search"
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={words}
          aria-label={words}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink/55"
        />
      </label>
      <ActionButton tone="brand" icon={Plus} label="Add your own" onClick={onAdd} className={ADD_FILLED} />
    </div>
  );
}
