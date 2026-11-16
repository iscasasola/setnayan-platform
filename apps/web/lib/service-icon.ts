/**
 * service-icon.ts — the animated service icons as icon components.
 *
 * Owner, Nov 2026: the 16 folder icons and their services are the drawn set
 * from the approved prototype (`service-icons.html`), not stock lucide glyphs.
 * At rest each one looks like a plain line icon. A press colours it, a short
 * play runs in colour, then the colour fades back to plain.
 *
 * Each component takes the same props a lucide icon does (`size`,
 * `strokeWidth`, `className`, `aria-*` …), so it drops into every existing
 * `tileIcon()` / `folderIcon()` call site unchanged. No hooks, no `'use client'`:
 * it renders in server and client components alike. The play itself is CSS
 * (`app/service-icons.css`), started by the player in
 * `app/_components/service-icon-play.tsx` (mounted once in the root layout),
 * which adds `.go` to every `svg.si` inside the pressed control.
 *
 * Plain `createElement`, not JSX, so the `node:test` suites that import
 * `lib/taxonomy-icons.ts` outside a bundler keep loading it.
 */
import { createElement, type ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

export type IconComponent = ComponentType<LucideProps>;

/** One component per drawing. The `__html` object is created once, so React never re-sets the markup. */
export function serviceIcon(art: string, name: string): IconComponent {
  const html = { __html: art };
  function ServiceIcon({
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    color = 'currentColor',
    className,
    children: _children,
    ...rest
  }: LucideProps) {
    const width =
      absoluteStrokeWidth && Number(size) > 0 ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth;
    return createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth: width,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      ...rest,
      className: className ? `si ${className}` : 'si',
      'data-icon': name,
      dangerouslySetInnerHTML: html,
    });
  }
  ServiceIcon.displayName = `ServiceIcon(${name})`;
  return ServiceIcon;
}
