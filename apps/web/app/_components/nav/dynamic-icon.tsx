'use client';

/* eslint-disable @next/next/no-img-element */

import { Circle } from 'lucide-react';
import { getLucideIcon } from '@/lib/nav-icons';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { NavIconDescriptor } from '@/lib/nav-registry-types';
import type { ComponentType, SVGProps } from 'react';

/**
 * <DynamicIcon> — renders a registry icon descriptor (client-safe).
 *
 * - kind 'lucide'  → the allowlisted Lucide component (falls back to Circle if a
 *                    name is somehow not in the curated set).
 * - kind 'custom'  → an inline mark (customRef, e.g. SetnayanMark, paints in
 *                    currentColor) OR an uploaded image (customUrl → <img>).
 * - kind 'none'    → nothing.
 *
 * Consumers resolve a slot server-side (lib/nav-registry) and pass `icon` here.
 * `className` carries sizing (e.g. "h-5 w-5") + color for currentColor marks.
 */

type InlineMark = ComponentType<SVGProps<SVGSVGElement>>;

const CUSTOM_INLINE: Record<string, InlineMark> = {
  SetnayanMark,
};

export function DynamicIcon({
  icon,
  className,
  strokeWidth,
  'aria-hidden': ariaHidden = true,
}: {
  icon: NavIconDescriptor | null | undefined;
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}) {
  if (!icon || icon.kind === 'none') return null;

  if (icon.kind === 'custom') {
    const Mark = icon.customRef ? CUSTOM_INLINE[icon.customRef] : undefined;
    if (Mark) {
      return <Mark className={className} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />;
    }
    if (icon.customUrl) {
      return <img src={icon.customUrl} alt="" className={className} aria-hidden={ariaHidden} />;
    }
    return null;
  }

  const Lucide = getLucideIcon(icon.lucideName) ?? Circle;
  return <Lucide className={className} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />;
}
