import { createElement, type SVGProps } from 'react';
import { iconFor, type IconName } from './icon-map';

/**
 * <Icon name="guests" size={20} /> — an icon by its JOB (brand refresh step 3, owner 2026-10-26).
 *
 * The name is a semantic role from icon-map.ts (`ICONS`); which glyph it draws, and from which icon
 * set, is decided THERE — so switching sets never touches a component. Decorative by default
 * (`aria-hidden`); pass `aria-label` (and `aria-hidden={false}`) when the icon is the only label.
 *
 * Server-safe (no hooks, no 'use client'). New code reaches icons through this, never through
 * `lucide-react` — scripts/lint-icon-source.mjs holds that line.
 */
export function Icon({
  name,
  size,
  strokeWidth,
  className,
  'aria-hidden': ariaHidden = true,
  ...rest
}: { name: IconName; size?: number | string; strokeWidth?: number | string } & Omit<SVGProps<SVGSVGElement>, 'ref'>) {
  const Glyph = iconFor(name);
  // createElement, not JSX: this module is also rendered by node:test (tsx, classic JSX runtime).
  return createElement(Glyph, { size, strokeWidth, className, 'aria-hidden': ariaHidden, ...rest });
}
