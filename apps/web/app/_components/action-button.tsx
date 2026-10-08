import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * ACTION BUTTON — do something: save, send, add, restore, delete (`INTERACTION_RULES.md` § 9, kind 9; approved
 * gallery `prototypes/control_templates_2026-10-08.html` § 9).
 *
 * Owner, 2026-10-08, on Studio › Info's last rows (a greyed "Restore" that read as faded text, a gold-brown
 * "Reset…"): *"we better fix the buttons here as well"*.
 *
 *   · a FULL PILL, one line, its words in the middle; one main button a screen, the rest quieter;
 *   · `main`   — the app's accent with the ink that reads on it (`sn-accent` — never a colour written here);
 *   · `second` — white, a hairline, ink words;
 *   · `quiet`  — words only, in the accent;
 *   · `delete` — white, the DANGER token for its words and its line (what cannot be undone — it still asks once);
 *   · CANNOT BE USED YET = grey, and STILL A BUTTON: `aria-disabled`, its shape and its line kept, so it reads as a
 *     button that is waiting — never as faded text. A press on it does nothing;
 *   · two sizes — `full` (48 px, the gallery's) and `row` (40 px, the height of a Form row's pill);
 *   · the app's one press (`sn-press` + its ring).
 *
 * A plain `<button>`: it keeps the caller's handler and name. No hook, no state — it renders on the server or the
 * client alike and costs no request.
 */
export type ActionButtonTone = 'main' | 'second' | 'quiet' | 'delete';
export type ActionButtonSize = 'full' | 'row';

const BASE = 'sn-press sn-press-ring inline-flex flex-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors duration-sn-control ease-sn';
export const ACTION_BUTTON_SIZE: Record<ActionButtonSize, string> = {
  full: 'h-12 min-w-[112px] px-[22px] text-[15px]',
  row: 'h-10 min-h-10 px-4 text-[14px]',
};
export const ACTION_BUTTON_TONE: Record<ActionButtonTone, string> = {
  main: 'bg-sn-accent text-sn-on-accent',
  second: 'border border-ink/15 bg-white text-ink',
  quiet: 'text-sn-accent',
  delete: 'border border-danger-700/40 bg-white text-danger-700',
};
/** Cannot be used yet: the grey fill and words, the shape and a line kept — a button that is waiting. */
export const ACTION_BUTTON_OFF = 'cursor-default border border-ink/10 bg-ink/[0.06] text-ink/45';

/** The classes of an action button — for a control that must keep its own element (a link, a submit). */
export function actionButtonClass(tone: ActionButtonTone = 'second', size: ActionButtonSize = 'full', off = false): string {
  return `${BASE} ${ACTION_BUTTON_SIZE[size]} ${off ? ACTION_BUTTON_OFF : ACTION_BUTTON_TONE[tone]}`;
}

export function ActionButton({
  tone = 'second',
  size = 'full',
  disabled = false,
  className = '',
  onClick,
  children,
  ...rest
}: {
  tone?: ActionButtonTone;
  size?: ActionButtonSize;
  /** Cannot be used yet — grey, announced as unavailable, and a press does nothing. */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'className' | 'children'>) {
  return (
    <button
      type="button"
      {...rest}
      data-action-button={disabled ? 'off' : tone}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={`${actionButtonClass(tone, size, disabled)} ${className}`}
    >
      {children}
    </button>
  );
}
