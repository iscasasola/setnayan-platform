'use client';

/**
 * ActionButton — THE BUTTON RULE (owner 2026-10-07, corpus
 * `BUTTON_RULE_2026-10-07_fable.md`; reference implementation `bb()`/`ib()` +
 * `fitActs()` in `prototypes/suppliers_page_2026-10-07_fable.html`).
 *
 *   1. Every interactive control is a button — a 40 px pill with a border.
 *   2. Icon + word. The word is a `<span class="lbl">`; `aria-label` is the
 *      word too, so an icon-only button still reads.
 *   3. Words drop by width — `useFitRow(ref)` below: the right-most SECONDARY
 *      buttons go icon-only one at a time until the row fits; the main verb
 *      always keeps its word.
 *   4. One colour per meaning — `tone` is REQUIRED (the type will not let a
 *      caller leave it blank), mapped to the `--color-*` tokens in globals.css:
 *        brand    terracotta  the forward step (--color-mulberry)
 *        ok       green       confirm · commit · money
 *        info     blue/slate  messaging · information
 *        warn     amber       attention — waiting on you
 *        danger   red         destructive — take it back
 *        neutral  grey        manage · edit · cancel-a-dialog · pick
 *      `main` = filled; everything else outlined on a 9% wash of the tone.
 *
 * Exempt: the guest Event Hub (`app/[slug]/**`) — couples design those pages.
 *
 * `href` renders a Next `<Link>` (a button-shaped door that navigates);
 * otherwise a `<button type="button">` unless `type` says submit.
 */
import Link from 'next/link';
import {
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  type ComponentType,
  type MouseEventHandler,
  type ReactElement,
  type RefObject,
  type SVGProps,
} from 'react';

export type ActionTone = 'brand' | 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

export const ACTION_TONES: readonly ActionTone[] = [
  'brand',
  'ok',
  'info',
  'warn',
  'danger',
  'neutral',
] as const;

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

type Common = {
  /** REQUIRED — the meaning, not a look. See the table above. */
  tone: ActionTone;
  /** A lucide icon component (or any SVG component), or a ready element. */
  icon: IconComponent | ReactElement;
  /** The word. Also the `aria-label`, so icon-only still reads. */
  label: string;
  /** The row's main verb: filled, and never loses its word. */
  main?: boolean;
  /** A secondary that should not compete (Skip · Not now): hairline, muted word, no wash. */
  quiet?: boolean;
  /** Start icon-only (a toolbar of icons that are still buttons). */
  iconOnly?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  'data-testid'?: string;
};

type AsButton = Common & {
  href?: undefined;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit';
  /** `form` attribute, for a submit that lives outside its form. */
  form?: string;
  name?: string;
  value?: string;
  'aria-pressed'?: boolean;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'dialog' | 'menu' | 'listbox' | true;
};

type AsLink = Common & {
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  prefetch?: boolean;
  target?: '_blank';
};

export type ActionButtonProps = AsButton | AsLink;

/** The class list — exported so a guard can assert the shape without a DOM. */
export function actionButtonClass(
  tone: ActionTone,
  opts: { main?: boolean; quiet?: boolean; iconOnly?: boolean; extra?: string } = {},
): string {
  const { main, quiet, iconOnly, extra } = opts;
  return ['ab', `ab-${tone}`, main ? 'ab-main' : '', quiet && !main ? 'quiet' : '', iconOnly ? 'icon-only' : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

function renderIcon(icon: Common['icon']) {
  if (isValidElement(icon)) return icon;
  const Icon = icon as IconComponent;
  return <Icon aria-hidden="true" strokeWidth={1.9} />;
}

export const ActionButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, ActionButtonProps>(
  function ActionButton(props, ref) {
    const { tone, icon, label, main, quiet, iconOnly, className, title } = props;
    const cls = actionButtonClass(tone, { main, quiet, iconOnly, extra: className });
    const inner = (
      <>
        {renderIcon(icon)}
        <span className="lbl">{label}</span>
      </>
    );
    if (props.href !== undefined) {
      const { href, onClick, prefetch, target, disabled } = props;
      return (
        <Link
          ref={ref as RefObject<HTMLAnchorElement>}
          href={href}
          prefetch={prefetch}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          onClick={
            disabled
              ? (e) => {
                  e.preventDefault();
                }
              : onClick
          }
          aria-disabled={disabled || undefined}
          aria-label={label}
          title={title ?? label}
          className={cls}
          data-tone={tone}
          data-main={main ? '' : undefined}
          data-testid={props['data-testid']}
        >
          {inner}
        </Link>
      );
    }
    const p = props as AsButton;
    return (
      <button
        ref={ref as RefObject<HTMLButtonElement>}
        type={p.type ?? 'button'}
        form={p.form}
        name={p.name}
        value={p.value}
        onClick={p.onClick}
        disabled={p.disabled}
        aria-pressed={p['aria-pressed']}
        aria-expanded={p['aria-expanded']}
        aria-haspopup={p['aria-haspopup']}
        aria-label={label}
        title={title ?? label}
        className={cls}
        data-tone={tone}
        data-main={main ? '' : undefined}
        data-testid={p['data-testid']}
      >
        {inner}
      </button>
    );
  },
);

/* ─── useFitRow — rule 3, the fit pass ─────────────────────────────────────
 * Ported from the prototype's `fitActs()`: clear every `icon-only` the pass
 * added, then walk the SECONDARY buttons right-to-left adding `icon-only`
 * until `scrollWidth ≤ clientWidth`. The main verb (`.ab-main`) is never
 * dropped. The row is made `min-width: 0` so it can be narrower than its
 * content (otherwise it never overflows and nothing drops). Buttons rendered with `iconOnly` stay icon-only (the pass only
 * touches the ones it marked, tagged `data-fit-dropped`). Re-runs whenever
 * the row resizes, and when its children change. */

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** One fit pass over a row; returns how many words it dropped. Exported for the guard. */
export function fitRow(row: HTMLElement): number {
  const buttons = Array.from(row.querySelectorAll<HTMLElement>('.ab'));
  for (const b of buttons) {
    if (b.hasAttribute('data-fit-dropped')) {
      b.classList.remove('icon-only');
      b.removeAttribute('data-fit-dropped');
    }
  }
  const secondary = buttons.filter((b) => !b.classList.contains('ab-main') && !b.classList.contains('icon-only')).reverse();
  let dropped = 0;
  for (const b of secondary) {
    if (row.scrollWidth <= row.clientWidth + 1) break;
    b.classList.add('icon-only');
    b.setAttribute('data-fit-dropped', '');
    dropped += 1;
  }
  return dropped;
}

export function useFitRow(ref: RefObject<HTMLElement | null>): void {
  const run = useCallback(() => {
    const row = ref.current;
    if (row) fitRow(row);
  }, [ref]);

  useIsoLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    // A row that cannot shrink never overflows, so the measure would lie
    // (the prototype's `.detail{min-width:0}` bug). Make it shrinkable.
    if (getComputedStyle(row).minWidth === 'auto') row.style.minWidth = '0';
    run();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    ro?.observe(row);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(run) : null;
    mo?.observe(row, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', run);
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', run);
    };
  }, [run, ref]);
}
