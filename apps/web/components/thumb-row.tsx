'use client';

/**
 * ThumbRow — THE ONE ROW AT THE THUMB (owner 2026-10-22, "Yes to all", on the
 * prototype `prototypes/one_thumb_row_2026-10-22.html`; DECISION_LOG
 * "ONE THUMB ROW"). *"The one on event-suppliers page is the one that looks the
 * best"* — so the Couple › Suppliers (Find) row is the template, and every list
 * screen draws it through this component:
 *
 *     ⇕ ☑  ·  [ 🔍 Search guests ]  ·  ≡  ·  (＋)
 *     left     field (the widest)     right  action — ONE terracotta round, last
 *
 * · NO BAND. Every control is its own frosted glass (`.sn-glass-row`); nothing
 *   is drawn under the row, so the page scrolls through the gaps.
 * · 44 px rounds, icon only — the word is the accessible name (`label`).
 * · The placeholder NAMES THE PLACE (ruling 2026-09-23) and is at most three
 *   words, so it reads whole at 320 (`every-thumb-row-is-the-one-row.test.ts`).
 * · A screen shows only the seats it has, in this order, and never two main
 *   verbs. A screen with one action and no field passes `action` alone: the same
 *   round, at the right. A screen with no list draws no row at all.
 * · `children` replaces the four seats for a MODE row (Guests › Select: Invite N
 *   · Set ▾ · Done) — same row, same glass, the mode's own buttons.
 *
 * It is ONLY the row. Where it sits (above the bottom dock, sliding up once the
 * page has rendered) stays with the host that already owned that plumbing —
 * Find's `FindThumbRow`, Guests' `.lower` — so this lands as a re-drawing, not
 * a move. The data handle is `data-thumb-row={name}`.
 *
 * ⌨ IT RIDES THE KEYBOARD — BY DEFAULT (owner 2026-10-24, "Yes", buttons fold;
 * `prototypes/keyboard_rides_the_input_2026-10-24.html`). While its field is
 * being typed into and the keyboard is up (`useKeyboardRide`), the row is the
 * Maker's typing template: the ONE typing band ("Typing · <the placeholder>" +
 * ✓ Done, `app/_components/typing-band.tsx`) stands on it, the band's cream
 * plate reaching down behind it to the keyboard; the field takes the whole row,
 * wears the accent ring and gains ✕ (clear); ⇕ · ≡ · ＋ FOLD and come back on
 * Done (the keyboard's own key does the row's verb). The row itself does not
 * move: its host stands it on `--sn-bottomdock-h`, which is the keyboard's while
 * it is up (`bottom-nav.tsx`). `rides={false}` opts out — only with a written
 * reason at the call (`every-bottom-input-rides-the-keyboard.test.ts` counts them).
 */
import { useCallback, useRef, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { CalendarDays, Search, X } from 'lucide-react';
import { ActionButton, type ActionButtonProps } from '@/components/action-button';
import { rowRides, useRidingRow } from '@/app/_components/typing-band';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import styles from './thumb-row.module.css';

type IconComponent = ActionButtonProps['icon'];

export type ThumbRound = {
  icon: IconComponent;
  /** The word — the round's accessible name. */
  label: string;
  onClick?: () => void;
  href?: string;
  /** A link that opens in a new tab (Shop › Page's 👁 View my page). */
  target?: '_blank';
  /** `aria-expanded` for a toggle (⇕ Expand all). */
  expanded?: boolean;
  waiting?: boolean;
  testId?: string;
  tour?: string;
};

/** ≡ — one dropdown in a 44 round; its current option's icon is the face. */
export type ThumbMenu = {
  menu: readonly PickOption[];
  label: string;
  value: string | null;
  onPick: (key: string) => void;
  buttonText?: string;
  /** A data attribute on the wrapper (`data-thumb-sort`), for tests and the tour. */
  mark?: string;
};

/**
 * A seat whose control is a SHIPPED component that owns its own sheet or address (the supplier's Search box, Check a
 * date, ＋ Add a booking, ✓ Log a payment): the row gives it the seat's shape — the field's glass and width, or the
 * main verb's 44 round (its word kept as its accessible name) — and the component keeps everything it does.
 */
export type ThumbNode = { node: ReactNode };

export type ThumbField = {
  /** Names the place — "Search guests". ≤ 3 words. */
  placeholder: string;
  /** The accessible name when it must say more than the placeholder. */
  label?: string;
  kind?: 'search' | 'date';
  inputRef?: Ref<HTMLInputElement>;
  /** Anything else the host's input already does (value, onInput, onKeyDown, data-*). */
  input?: InputHTMLAttributes<HTMLInputElement> & Record<`data-${string}`, string | undefined>;
  tour?: string;
};

/** A shipped control in a round seat — a PickMenu (drawn as the 44 round, its option's icon the face) or an icon
 *  ActionButton; the seat is the glass. */
function NodeRound({ node }: { node: ReactNode }) {
  return (
    <span className={`sn-glass-row ${styles.round} ${styles.menu} ${styles.nodeRound}`} data-thumb-seat="round">
      {node}
    </span>
  );
}

function Round({ r }: { r: ThumbRound }) {
  const common = {
    tone: 'neutral' as const,
    iconOnly: true,
    icon: r.icon,
    label: r.label,
    waiting: r.waiting,
    tour: r.tour,
    'data-testid': r.testId,
    className: styles.btn,
  };
  return (
    <span className={`sn-glass-row ${styles.round}`} data-thumb-seat="round">
      {r.href ? (
        <ActionButton {...common} href={r.href} target={r.target} />
      ) : (
        <ActionButton {...common} onClick={r.onClick} aria-expanded={r.expanded} />
      )}
    </span>
  );
}

/** ⌨ The riding decision — the shared row's (`useRidingRow`, typing-band.tsx); kept under this name for the guard. */
export const thumbRowRides = rowRides;

/** Put words in a React-controlled input as a person would (its `onChange` / `onInput` hear it). */
function setTyped(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function ThumbRow({
  name,
  left = [],
  field,
  right = [],
  action,
  children,
  className = '',
  rides = true,
}: {
  /** Which screen's row — the guard's and the tour's handle. */
  name: string;
  /** ≤ 2 neutral rounds before the field — ⇕ then ☑. */
  left?: readonly (ThumbRound | ThumbNode)[];
  field?: ThumbField | ThumbNode | null;
  /** Rounds after the field — a `ThumbMenu` is the ≡ dropdown. */
  right?: readonly (ThumbRound | ThumbMenu)[];
  /** THE one main verb — terracotta, last. */
  action?: ThumbRound | ThumbNode | null;
  /** A mode row's own buttons, in place of the seats. */
  children?: ReactNode;
  className?: string;
  /**
   * ⌨ Ride the keyboard while the field is typed into (the default — the Maker's template). `false` ONLY with a
   * written reason beside it at the call; the guard counts every one.
   */
  rides?: boolean;
}) {
  const FieldIcon = field && 'kind' in field && field.kind === 'date' ? CalendarDays : Search;
  const rowRef = useRef<HTMLDivElement>(null);
  const ownInput = useRef<HTMLInputElement | null>(null);
  /* ⌨ The ONE riding row (`useRidingRow`): the band's words are the field's placeholder. */
  const ride = useRidingRow(rowRef, { rides, mode: Boolean(children), place: field && !('node' in field) ? field.placeholder : undefined });
  const riding = ride.riding;
  const onFieldFocus = ride.rowProps.onFocus;
  const onFieldBlur = ride.rowProps.onBlur;
  /* 📌 The words changed → the first result is pinned (`lib/search-pin.ts`, through the one riding row). */
  const onFieldInput = ride.rowProps.onInput;
  const setInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      ownInput.current = el;
      const r = field && !('node' in field) ? field.inputRef : undefined;
      if (typeof r === 'function') r(el);
      else if (r && typeof r === 'object') (r as { current: HTMLInputElement | null }).current = el;
    },
    [field],
  );
  /* A press on the band or ✕ never takes the focus from the field (it would close the band under the finger) — on
     `mousedown` only: a cancelled `pointerdown` also cancels a touch's click in WebKit (measured 2026-10-24). */
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  return (
    <div ref={rowRef} role="toolbar" aria-label={`${name} tools`} data-riding={riding ? '' : undefined} data-thumb-row={name} className={`${styles.row} ${className}`}>
      {/* The band first in the reading order — it is drawn above the row (Done before the field, as seen). */}
      {ride.band}
      {children ?? (
        <>
          {left.slice(0, 2).map((r, i) => ('node' in r ? <NodeRound key={`n${i}`} node={r.node} /> : <Round key={r.label} r={r} />))}
          {field && 'node' in field ? (
            <span
              data-glass-row="thumb-row-field-node"
              className={`sn-glass-row ${styles.field} ${styles.fieldNode}`}
              data-thumb-seat="field"
              data-rides={rides ? '' : undefined}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
              onInput={onFieldInput}
            >
              {field.node}
            </span>
          ) : field ? (
            <label data-glass-row="thumb-row-field" className={`sn-glass-row ${styles.field}`} data-thumb-seat="field" data-tour={field.tour} data-rides={rides ? '' : undefined} onFocus={onFieldFocus} onBlur={onFieldBlur} onInput={onFieldInput}>
              <FieldIcon className={styles.glyph} strokeWidth={1.9} aria-hidden />
              <input
                type={field.kind === 'date' ? 'date' : 'search'}
                autoComplete="off"
                {...field.input}
                ref={setInputRef}
                placeholder={field.placeholder}
                aria-label={field.label ?? field.placeholder}
                className={styles.input}
              />
            </label>
          ) : (
            <span className={styles.gap} aria-hidden />
          )}
          {/* ✕ — clears the words while typing (the typed row's ✕); the field keeps its focus. */}
          {riding && field && !('node' in field) ? (
            <span className={`sn-glass-row ${styles.round} ${styles.clear}`} data-thumb-seat="clear" onMouseDown={keepFocus}>
              <ActionButton
                tone="neutral"
                iconOnly
                icon={X}
                label="Clear"
                className={styles.btn}
                onClick={() => {
                  const el = ownInput.current;
                  if (!el) return;
                  setTyped(el, '');
                  el.focus();
                }}
              />
            </span>
          ) : null}
          {right.map((r) =>
            'menu' in r ? (
              <span key={r.label} className={`sn-glass-row ${styles.round} ${styles.menu}`} data-thumb-seat="menu" {...(r.mark ? { [r.mark]: '' } : {})}>
                <PickMenu label={r.label} value={r.value} options={r.menu} onPick={r.onPick} buttonText={r.buttonText} />
              </span>
            ) : (
              <Round key={r.label} r={r} />
            ),
          )}
          {action && 'node' in action ? (
            <span className={`${styles.round} ${styles.actionNode}`} data-thumb-seat="action">
              {action.node}
            </span>
          ) : action ? (
            <span className={styles.round} data-thumb-seat="action">
              {action.href ? (
                <ActionButton tone="brand" filled iconOnly icon={action.icon} label={action.label} href={action.href} tour={action.tour} data-testid={action.testId} className={styles.btn} />
              ) : (
                <ActionButton
                  tone="brand"
                  filled
                  iconOnly
                  icon={action.icon}
                  label={action.label}
                  onClick={action.onClick}
                  waiting={action.waiting}
                  tour={action.tour}
                  data-testid={action.testId}
                  className={styles.btn}
                />
              )}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
