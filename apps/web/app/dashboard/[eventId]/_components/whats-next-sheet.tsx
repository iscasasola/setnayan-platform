'use client';

/**
 * whats-next-sheet.tsx — the sheet the Home's one "What's next" row opens (owner
 * "yes", 2026-10-03, on the five things the first-screen-only Home left without a
 * page). Inside: the ranked decisions list (with "Today's one thing"), then
 * "Coming up" — the dashboard's own components and data, moved, not redrawn.
 *
 * The sheet is server state: the row is a link to `?sheet=next`, the page draws
 * `<EventDashboard only="whatsnext">` into this shell only when that param is
 * present, so a Home that is never opened never reads the decisions. Closing
 * (✕, backdrop, Esc) returns to the plain Home URL. `children` is the server-
 * rendered list, passed through — this file adds a dialog and nothing else.
 *
 * 🔑 PORTALLED to <body>, mounted after hydration (the shared `<Sheet>` is
 * `position: fixed`; a transformed ancestor would clip it, as the More sheet found).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/app/_components/sheet';

export function WhatsNextSheet({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <Sheet open onClose={() => router.replace(closeHref, { scroll: false })} labelledById="whats-next-title" wide rise>
      <div data-whats-next-sheet="" className="px-5 pb-6 pt-4">
        <h2 id="whats-next-title" className="mb-4 pr-10 text-lg font-extrabold tracking-tight text-ink">
          What&rsquo;s next
        </h2>
        {children}
      </div>
    </Sheet>,
    document.body,
  );
}
