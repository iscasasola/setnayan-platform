'use client';

import Link from 'next/link';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';

import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from './pill-selector';

/**
 * PILL TRACK · PILL LINK · PILL BUTTON — the pill selector's "second way in" (`pill-selector.tsx`: *"a track you
 * already draw yourself"*), as three elements a screen can write where its own `<div>` / `<Link>` / `<button>` stood.
 *
 * WHY THIS FILE: the template's class strings live in a `'use client'` module, and a SERVER page cannot read a string
 * or call a function from one. A server page (a `?tab=` row of links, a form of submit buttons) therefore wears the
 * template through these — it passes only words, addresses and booleans across. A client screen may use them too, or
 * wear `PILL_TRACK_CLASS` / `pillSegClass` / `<PillThumb />` directly; both draw the ONE template.
 *
 * NOTHING HERE DECIDES A LOOK. Shape, colour, size and motion are `PILL_TRACK_CLASS`, `PILL_TRACK_GROUND`,
 * `pillSegClass` and `<PillThumb />` — this file adds no colour, radius or duration of its own. And nothing here
 * decides behaviour: every handler, `href`, `role` and `aria-*` is the caller's, passed straight through — the thumb
 * finds the picked choice by the attribute the caller already writes (`aria-pressed="true"`, `aria-current="page"`,
 * `aria-selected="true"`).
 *
 * The choices must be DIRECT children of the track (the thumb measures `:scope > …`).
 */
export function PillTrack({
  as = 'div',
  grow = false,
  slide = true,
  ground = PILL_TRACK_GROUND,
  className = '',
  children,
  ...rest
}: {
  /** The element the track is: a group (`div`), a set of links (`nav`), or a form of submit buttons. */
  as?: 'div' | 'nav' | 'form';
  /** Fill the row it sits in — left out, the track is as wide as its choices. */
  grow?: boolean;
  /** The travelling thumb. False only for a row that is not an either-or. */
  slide?: boolean;
  /** The track's ground — left out, the house one. */
  ground?: string;
  /** Layout only (a margin, a max width, scrolling) — never a colour or a radius. */
  className?: string;
  children: ReactNode;
  /** A form track's action (`as="form"`). */
  action?: (formData: FormData) => void | Promise<void>;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  const Tag = as as 'div';
  return (
    <Tag {...(rest as HTMLAttributes<HTMLDivElement>)} data-pill-track="" className={`${PILL_TRACK_CLASS} ${ground} ${grow ? 'flex-1' : 'inline-flex'} ${className}`}>
      {slide ? <PillThumb /> : null}
      {children}
    </Tag>
  );
}

/** One choice that is a LINK (a view with its own address). The caller writes `aria-current` as it always did. */
export function PillLink({ on, className = '', ...rest }: { on: boolean } & ComponentProps<typeof Link>) {
  return <Link {...rest} className={`${pillSegClass(on)} ${className}`} />;
}

/** One choice that is a BUTTON. The caller writes `aria-pressed` / `aria-selected` / `role` as it always did. */
export function PillButton({ on, className = '', type = 'button', ...rest }: { on: boolean } & ComponentProps<'button'>) {
  return <button {...rest} type={type} className={`${pillSegClass(on)} ${className}`} />;
}
