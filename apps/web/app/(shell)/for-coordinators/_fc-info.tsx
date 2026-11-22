/**
 * The /for-coordinators ⓘ — a server-rendered <details> that opens its words IN the page under the line it explains
 * (the approved drawing of 20 Nov 2026: ".what" — the detail lives behind it). No script: it opens with JavaScript
 * off, on a venue's bad signal, like the My Events shelf ⓘ (`app/dashboard/(launcher)/page.tsx`).
 *
 * The circle wears InfoTip's own classes token for token (`there-is-one-info-dot.test.ts` holds it): 16 px, ink at
 * rest, terracotta while hovered or open, and the `sn-dot-btn` halo that presses at 46 px.
 */

import type { ReactNode } from 'react';

export function FcInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="fc-what group">
      <summary aria-label={label}>
        <span
          aria-hidden="true"
          className="sn-dot-btn inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 group-hover:border-terracotta group-hover:text-terracotta group-open:border-terracotta group-open:text-terracotta"
        >
          i
        </span>
      </summary>
      <div className="fc-tb">{children}</div>
    </details>
  );
}
