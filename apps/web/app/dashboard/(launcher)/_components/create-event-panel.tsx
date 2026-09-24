'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SidePanel, sidePanelExitMs } from '@/app/_components/side-panel';

/**
 * THE ADD FLOW'S PANEL (collection template, owner-approved 2026-09-24): the
 * header (+), the dashed "+ New event" tile and the empty state's button all
 * open the REAL first step of create-event — "What kind of event are you
 * planning?" — over the board, instead of leaving it. A right-hand panel on a
 * desktop, a bottom sheet on a phone (`phone="sheet"`).
 *
 * ─── HOW IT OPENS WITHOUT A NEW DOOR ────────────────────────────────────────
 * Nothing on the board changed its link: all three still point at
 * `/dashboard/create-event`. The launcher layout's `@modal` slot INTERCEPTS
 * that navigation (`@modal/(.)create-event/page.tsx`) when it starts from the
 * board, and renders the create-event page itself — the whole server page,
 * imported, not a copy — inside this panel. A cold load, a refresh or a shared
 * link of `/dashboard/create-event` still gets the full page, exactly as today.
 *
 * Closing goes BACK, because opening was a navigation: the URL returns to the
 * board and the slot falls back to `@modal/default.tsx` (nothing). The panel
 * is given its exit transition first, so it leaves rather than vanishes.
 *
 * Server → client: only `children` (already-rendered markup) crosses — no
 * function, no icon component.
 */
export function CreateEventPanel({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = useCallback(() => {
    setOpen(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => router.back(), sidePanelExitMs(reduce));
  }, [router]);
  return (
    <SidePanel open={open} onClose={close} title="New event" size="wide" phone="sheet">
      {children}
    </SidePanel>
  );
}
