import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * pin-door.tsx — 📌 THE APP'S ONE COUNT DOOR on a pinned row: the number bold, the word quiet, no frame, a 44-px target;
 * filtering = the number underlined (`aria-pressed`), the count that waits on you = the brand colour (`hot`).
 *
 * Owner 2026-10-30, "all yes" (DECISION_LOG "ONE SELECTOR FOR EVERY PAGE — COUPLE · SUPPLIER · ADMIN", Q3): *"the three
 * count-door shapes become one (number + word, underlined when it filters)"*. Until then the supplier dashboard drew its
 * own two-line round tile four times over (Today · Customers' doors · Customers' figures · Shop's figures) beside the
 * People row's door. This is that People door (`PinnedRow`, the Guests pinned row's `button.pinCount`), lifted out so
 * every row draws the SAME part — `PinnedRow` draws it too, never a copy.
 *
 *   · `onTap` → a button (a filter in place; `on` = `aria-pressed`); `href` → a link (a figure is a door, never a dead
 *     number — "a compressed figure still taps").
 *   · HONEST: `value === null` = the page could not read it — "—" then "couldn't load" in the warn ink, never 0, and
 *     never the words of a read one on its face; the figure's own word stays in the accessible name (`aria-label`).
 *   · The shared fold (`use-pin-fold.ts` + `pin-fold.css`) reads `data-pin-door` / `data-pin-n` / `data-pin-w`; `short`
 *     is the word on the folded line where the full one cannot fit beside a peso figure at 390 px.
 *
 * 🔒 app/vendor-dashboard/every-supplier-top-row-is-one-selector.test.ts · lib/the-pinned-row-is-one-row.test.ts
 */
// The People door's look (was `pinned-row.module.css` `.pinDoor`), as classes — no CSS module, so a server render in a guard
// needs no stylesheet stub. Tight (`[data-tight]`, the doors' fit pass in `pin-doors.tsx`): smaller type, less air.
const DOOR = [
  'inline-flex min-h-11 shrink-0 items-center gap-[3px] self-stretch whitespace-nowrap border-0 bg-transparent px-[5px] text-[13.5px] text-ink/70',
  '[&>b]:text-[15px] [&>b]:font-bold [&>b]:tabular-nums [&>b]:text-ink [&>b]:decoration-2 [&>b]:underline-offset-4',
  '[&[aria-pressed=true]>b]:underline',
  'focus-visible:rounded-[var(--m-r-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--color-mulberry))]',
  '[[data-tight]_&]:gap-[2px] [[data-tight]_&]:px-[3px] [[data-tight]_&]:text-[12px] [[data-tight]_&>b]:text-[13.5px]',
].join(' ');
const HOT = 'text-[rgb(var(--color-mulberry-700))] [&>b]:text-[rgb(var(--color-mulberry-700))]';

export type PinDoorMark = Readonly<Record<`data-${string}`, string>>;

export function PinDoor({
  value,
  word,
  short,
  hot = false,
  on,
  onTap,
  href,
  controls,
  mark,
  unreadMark,
  'data-tour': tour,
}: {
  /** Already worded ("3", "₱48K", "12+") — or null: not read, drawn "—" + "couldn't load", never 0. */
  value: ReactNode | null;
  word: string;
  /** The word on the FOLDED line, when the full one cannot fit (Money's "to come"). */
  short?: string;
  /** The brand colour — the count that waits on you. */
  hot?: boolean;
  /** Filtering to this door right now (buttons only). */
  on?: boolean;
  onTap?: () => void;
  href?: string;
  /** The list this door shows (`aria-controls`). */
  controls?: string;
  /** The page's own marks (`data-today-number="waiting"`). */
  mark?: PinDoorMark;
  /** The mark on an unread door's word (`data-today-unread`). */
  unreadMark?: `data-${string}`;
  /** 🔦 A spotlight stop on this door. */
  'data-tour'?: string;
}) {
  const inner =
    value === null ? (
      <>
        <b style={{ color: 'rgb(var(--color-warn))' }} aria-hidden data-pin-n="">
          —
        </b>
        <span data-pin-w="" {...(unreadMark ? { [unreadMark]: '' } : {})}>
          couldn&rsquo;t load
        </span>
      </>
    ) : (
      <>
        <b data-pin-n="">{value}</b>
        <span data-pin-w="">
          {short ? (
            <>
              <span className="[[data-folded]_&]:hidden">{word}</span>
              <span className="hidden [[data-folded]_&]:inline">{short}</span>
            </>
          ) : (
            word
          )}
        </span>
      </>
    );
  const cls = `${DOOR} ${hot && value !== null ? HOT : ''}`;
  // An unread door wears no word of a read one on its face; which figure it is stays in its name.
  const name = value === null ? `${word} · couldn’t load` : undefined;
  if (href !== undefined) {
    return (
      <Link href={href} scroll className={cls} aria-label={name} {...mark} data-tour={tour} data-pin-door="">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={on} aria-controls={controls} aria-label={name} onClick={onTap} className={cls} {...mark} data-tour={tour} data-pin-door="">
      {inner}
    </button>
  );
}

export { PinDoors } from './pin-doors';

/**
 * The LEFT of a row whose page has no choices to pick — the WORD form of the one selector (DECISION_LOG 2026-10-30:
 * *"word-only when there are no choices"*): no pill and no ▾, because a frame goes only on what you press. Today on a
 * phone; Today and the Hub word in the shell's bar from 701 (`supplier-page-menu.tsx`).
 */
export function PinWord({
  children,
  mark,
  barAbove = false,
}: {
  children: ReactNode;
  mark?: PinDoorMark;
  /** A page row under the supplier shell's bar: from 701 the bar already names the page, so this copy steps aside
   *  (the way `[data-customers-view]` / `[data-shop-segmented]` do in `supplier-frame.css`). */
  barAbove?: boolean;
}) {
  return (
    <span
      className={`shrink-0 truncate px-1 text-[15px] font-semibold text-ink ${barAbove ? 'tab:[.fd[data-pinned-bar]_&]:hidden' : ''}`}
      data-pin-word=""
      {...mark}
    >
      {children}
    </span>
  );
}
