'use client';

import type { ReactNode } from 'react';
import { rememberPickedOrigin } from '../../clients/[eventId]/_components/picked-client-motion';

/**
 * 🎬 Records WHERE a client was opened from — the tapped row's rect + this list's URL — just before the soft
 * navigation, so the picked client rises from that row and its ✕ is the exact reverse back into it
 * (THE ONE BUILD, 8 Nov 2026 · `picked-client-motion.ts`). Capture phase: it runs before the link navigates, and it
 * never stops or changes the tap.
 */
export function RememberPickedOrigin({ to, children }: { to: string; children: ReactNode }) {
  return (
    <span
      className="contents"
      data-remember-picked-origin=""
      onClickCapture={(e) => rememberPickedOrigin(e.currentTarget.closest('[data-customer-row]'), to)}
    >
      {children}
    </span>
  );
}
