'use client';

import { Images } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/** The event the Papic gallery listens for — it opens its first photo full screen. */
export const PAPIC_OPEN_GALLERY = 'papic:open-gallery';

/**
 * 🎨 "See your N photos" OPENS THE GALLERY DIRECTLY (owner call 2, 2026-10-14) —
 * not a scroll. On the Papic page the gallery is already drawn, so the press
 * opens its viewer in place (no request); from anywhere else, `href` lands on
 * the Papic page with `?gallery=open`, which opens the same viewer on arrival.
 */
export function PapicSeePhotos({
  label,
  href,
  wide = false,
  tone = 'brand',
}: {
  label: string;
  href?: string;
  wide?: boolean;
  /** The band's is the tinted second button; Home's row is the plain one (prototype map card). */
  tone?: 'brand' | 'neutral';
}) {
  return (
    <ActionButton
      tone={tone}
      icon={<Images aria-hidden="true" strokeWidth={1.9} />}
      label={label}
      className={wide ? 'w-full justify-center' : undefined}
      data-testid="papic-see-photos"
      {...(href
        ? { href }
        : { onClick: () => window.dispatchEvent(new CustomEvent(PAPIC_OPEN_GALLERY)) })}
    />
  );
}
