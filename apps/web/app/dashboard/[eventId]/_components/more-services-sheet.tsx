'use client';

/**
 * more-services-sheet.tsx — the phone's "More" chooser (owner 2026-09-30).
 *
 * Tapping "More" on the one bottom bar opens THIS small bottom sheet with the
 * five services — Setnayan AI · Papic · Live Studio · Music Maker · Patiktok —
 * one tap each. Tap outside, the ✕, Esc or a swipe down closes it. It is NOT
 * a sub-row of the bar: the bar stays flat (owner 2026-09-29, "no sub bottom
 * nav"; DECISION_LOG 2026-09-30 "THE SIDEBAR ROW 'MORE SERVICES' EXPANDS TO
 * THE FIVE").
 *
 * The five are the SAME plain rows the rail opens to (`ourServicesMenuChildren`
 * in layout.tsx) — this draws, it decides nothing. The shared `<Sheet>` brings
 * the backdrop, focus trap, Esc and scroll lock. Loaded lazily by
 * `CustomerBottomNav` on the first tap, so none of it rides the shared bundle.
 */

import Link from 'next/link';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from '@/app/_components/sheet';
import { EVENT_MENU_ICONS, type EventMenuChild } from '@/lib/customer-menu';

export default function MoreServicesSheet({
  open,
  onClose,
  title,
  services,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  services: ReadonlyArray<EventMenuChild>;
}) {
  const startY = useRef<number | null>(null);
  /* 🔑 PORTALLED TO <body>. This mounts inside `<BottomDock>`, whose own
     compositing (backdrop blur / transform) makes it the containing block for
     `position: fixed` — the sheet was drawn INSIDE the 64px bar, clipped, with
     only the scrim's blur showing. Loaded with `ssr: false`, so `document`
     always exists here. */
  return createPortal(
    <Sheet open={open} onClose={onClose} labelledById="more-services-title" rise>
      <div
        data-more-services-sheet=""
        className="px-5 pb-2 pt-3"
        onTouchStart={(e) => {
          startY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const y0 = startY.current;
          startY.current = null;
          const y1 = e.changedTouches[0]?.clientY;
          // A swipe DOWN of 60px or more closes it.
          if (y0 != null && y1 != null && y1 - y0 > 60) onClose();
        }}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
        <h2 id="more-services-title" className="mb-2 pr-10 text-lg font-extrabold tracking-tight text-ink">
          {title}
        </h2>
        <ul className="grid gap-1">
          {services.map((s) => {
            const Icon = EVENT_MENU_ICONS[s.icon];
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  onClick={onClose}
                  className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-[15px] text-ink hover:bg-ink/5 active:bg-ink/10"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/70">
                    <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>,
    document.body,
  );
}
