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
 */
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { CalendarDays, Search } from 'lucide-react';
import { ActionButton, type ActionButtonProps } from '@/components/action-button';
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

export function ThumbRow({
  name,
  left = [],
  field,
  right = [],
  action,
  children,
  className = '',
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
}) {
  const FieldIcon = field && 'kind' in field && field.kind === 'date' ? CalendarDays : Search;
  return (
    <div role="toolbar" aria-label={`${name} tools`} data-thumb-row={name} className={`${styles.row} ${className}`}>
      {children ?? (
        <>
          {left.slice(0, 2).map((r, i) => ('node' in r ? <NodeRound key={`n${i}`} node={r.node} /> : <Round key={r.label} r={r} />))}
          {field && 'node' in field ? (
            <span data-glass-row="thumb-row-field-node" className={`sn-glass-row ${styles.field} ${styles.fieldNode}`} data-thumb-seat="field">
              {field.node}
            </span>
          ) : field ? (
            <label data-glass-row="thumb-row-field" className={`sn-glass-row ${styles.field}`} data-thumb-seat="field" data-tour={field.tour}>
              <FieldIcon className={styles.glyph} strokeWidth={1.9} aria-hidden />
              <input
                type={field.kind === 'date' ? 'date' : 'search'}
                autoComplete="off"
                {...field.input}
                ref={field.inputRef}
                placeholder={field.placeholder}
                aria-label={field.label ?? field.placeholder}
                className={styles.input}
              />
            </label>
          ) : (
            <span className={styles.gap} aria-hidden />
          )}
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
