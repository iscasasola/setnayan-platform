/**
 * The shared button's class list — the ONE place it is built (`ActionButton` draws it; a `<Link>` or `<button>` that
 * cannot be the component wears it). A plain module, not `'use client'`, so a server component can call it: a function
 * exported from a client file cannot be invoked on the server (Next refuses: "Attempted to call actionButtonClass() from
 * the server but actionButtonClass is on the client"). `components/action-button.tsx` re-exports both, unchanged.
 */
export type ActionTone = 'brand' | 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

export const ACTION_TONES: readonly ActionTone[] = [
  'brand',
  'ok',
  'info',
  'warn',
  'danger',
  'neutral',
] as const;

/** The class list — exported so a guard can assert the shape without a DOM. */
export function actionButtonClass(
  tone: ActionTone,
  opts: { main?: boolean; quiet?: boolean; iconOnly?: boolean; filled?: boolean; extra?: string } = {},
): string {
  const { main, quiet, iconOnly, filled, extra } = opts;
  return [
    'ab',
    `ab-${tone}`,
    main ? 'ab-main' : '',
    filled && !main ? 'ab-fill' : '',
    quiet && !main && !filled ? 'quiet' : '',
    iconOnly ? 'icon-only' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}
