'use client';

import { X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * 👁 THE PEEK — a guest tapped on a map (owner, Guests prototype v20: *"Tapping a guest on Map / 2D / 3D shows a PEEK
 * card (avatar · name · role · group · seat · Open); Open = the full guest card"*; prototype `peekGuest`). R4 slice 6d.
 *
 * One small card above the thumb row — never a sheet over the map, so the plan stays in view while you look. Its
 * caller places it (the Map in the Guests screen's thumb seat, Seats › 2D in the seat plan's pop-up seat) and says what
 * Open does (the SAME guest card the List opens). Words wrap, never cut. 🔒 lib/a-tap-on-a-map-peeks-first.test.ts
 */
export function GuestPeek({
  name,
  line,
  initials,
  photo = null,
  onOpen,
  onClose,
}: {
  name: string;
  /** "Ninang · Barkada · Table 3 · seat 4" — whatever is known, nothing invented. */
  line: string;
  initials: string;
  photo?: string | null;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-guest-peek=""
      role="dialog"
      aria-label={`${name} — peek`}
      className="pointer-events-auto flex min-h-14 items-center gap-2.5 rounded-2xl bg-cream px-3 py-2 shadow-lg dark:bg-raised"
    >
      <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/10 text-[12.5px] font-semibold text-ink/70">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google), as every face in Guests
          <img src={photo} alt="" width={36} height={36} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm font-medium text-ink [overflow-wrap:anywhere]">{name}</span>
        <span className="line-clamp-2 block text-xs text-ink/60 [overflow-wrap:anywhere]">{line}</span>
      </span>
      <ActionButton tone="brand" main label="Open" onClick={onOpen} />
      <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={onClose} />
    </div>
  );
}
