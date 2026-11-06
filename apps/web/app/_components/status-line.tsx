import type { ReactNode } from 'react';
import { Check, CircleAlert, TriangleAlert } from 'lucide-react';

/**
 * STATUS LINE — what the page has to say that STAYS on the page (`INTERACTION_RULES.md` § 9, kind 12 "Messages"; the
 * approved gallery `prototypes/control_templates_2026-10-08.html` § 12; drawn for Prints and the seat plan in
 * `prototypes/maker_prints_seat_counter_2026-10-13.html` `.status`). The toast (`toast/peek-toast.tsx`) is the result
 * that peeks and leaves; this is its lasting copy.
 *
 *   · ONE soft band in the flow of the page: a mark, the words, and at most ONE action in words at its right
 *     ("Save again" · "Undo" · "Change" · "Try again") — underlined, its own 44 px target;
 *   · THREE tones, never told apart by colour alone — each has its own mark AND its words say what happened:
 *       info  ✓  a step that landed and can be taken back ("Chair 8 removed.")            — the quiet ground
 *       warn  ⓘ  something to look at, nothing wrong ("Changed since you printed on …")   — the warm amber
 *       bad   ⚠  something is WRONG, in plain words ("This photo is 1200 × 1600 pixels — small for A3 …") — the red;
 *   · it is a live region: `status` for info and warn, `alert` for bad.
 *
 * No colour is written here but the house's semantic families (`warn-*`, `danger-*`, `ink`); no state, no hook — it
 * renders on the server or the client alike, and costs no request. Guard: `lib/the-status-line-is-one-drawing.test.ts`.
 */
export type StatusTone = 'info' | 'warn' | 'bad';

const TONE: Readonly<Record<StatusTone, string>> = {
  info: 'bg-ink/[0.05] text-ink/75',
  warn: 'bg-warn-50 text-warn-800',
  bad: 'bg-danger-50 text-danger-800',
};

const MARK = { info: Check, warn: CircleAlert, bad: TriangleAlert } as const;

/** The action's look — words, underlined, the line's own ink; 44 px to the finger. Exported for an action that is a component of its own (a save). */
export const STATUS_LINE_ACTION =
  'sn-press inline-flex min-h-11 flex-none items-center px-1.5 text-[14px] font-bold underline underline-offset-2 disabled:opacity-50';

export function StatusLine({
  tone,
  children,
  action,
  data,
}: {
  tone: StatusTone;
  /** The words — what happened, in plain words. */
  children: ReactNode;
  /** ONE action: `{ label, onClick }` drawn in the line's look, or a node of the caller's (a save button). */
  action?: { label: string; onClick: () => void; disabled?: boolean } | ReactNode;
  /** `data-status-line="<data>"`. */
  data?: string;
}) {
  const Mark = MARK[tone];
  const act =
    action && typeof action === 'object' && 'label' in (action as object) && 'onClick' in (action as object)
      ? (action as { label: string; onClick: () => void; disabled?: boolean })
      : null;
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      data-status-line={data ?? ''}
      data-status-tone={tone}
      className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl py-1.5 pl-3.5 pr-2 text-[14px] leading-snug ${TONE[tone]}`}
    >
      <Mark aria-hidden className="h-[18px] w-[18px] flex-none" strokeWidth={2.2} />
      <span data-status-words="" className="min-w-0 flex-1 py-1">
        {children}
      </span>
      {act ? (
        <button type="button" data-status-action="" onClick={act.onClick} disabled={act.disabled} className={STATUS_LINE_ACTION}>
          {act.label}
        </button>
      ) : action ? (
        <span data-status-action="" className="flex-none">
          {action as ReactNode}
        </span>
      ) : null}
    </div>
  );
}
