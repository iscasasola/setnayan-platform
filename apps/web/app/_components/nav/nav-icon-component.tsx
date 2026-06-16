'use client';

/* eslint-disable @next/next/no-img-element */

import { Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { getLucideIcon } from '@/lib/nav-icons';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { NavIconDescriptor } from '@/lib/nav-registry-types';

/**
 * navIconComponent(descriptor) → a STABLE icon component compatible with the
 * `icon: LucideIcon` prop the existing nav primitives (BottomNav, sidebar)
 * render as `<Icon className strokeWidth style aria-hidden />`.
 *
 * This lets us drive nav icons from the registry WITHOUT touching the
 * (lint-enforced, "unbreakable") BottomNav: a lucide name resolves to its
 * component, the SetnayanMark custom ref to its inline mark, and an uploaded
 * image to a cached <img> wrapper (so the press-grow `transform` in `style`
 * still applies). References are cached/stable so icons never remount.
 */

type IconProps = {
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
};

const NullIcon = (() => null) as unknown as LucideIcon;

const imgIconCache = new Map<string, LucideIcon>();

function imgIcon(url: string): LucideIcon {
  let comp = imgIconCache.get(url);
  if (!comp) {
    const NavImgIcon = ({ className, style, 'aria-hidden': ariaHidden }: IconProps) => (
      <img src={url} alt="" aria-hidden={ariaHidden} className={className} style={style} />
    );
    comp = NavImgIcon as unknown as LucideIcon;
    imgIconCache.set(url, comp);
  }
  return comp;
}

const CUSTOM_INLINE: Record<string, LucideIcon> = {
  SetnayanMark: SetnayanMark as unknown as LucideIcon,
};

/** Resolve a registry icon descriptor to a stable, render-ready component. */
export function navIconComponent(icon: NavIconDescriptor): LucideIcon {
  if (icon.kind === 'none') return NullIcon;
  if (icon.kind === 'custom') {
    const inline = icon.customRef ? CUSTOM_INLINE[icon.customRef] : undefined;
    if (inline) return inline;
    if (icon.customUrl) return imgIcon(icon.customUrl);
    return NullIcon;
  }
  return (getLucideIcon(icon.lucideName) ?? Circle) as LucideIcon;
}
