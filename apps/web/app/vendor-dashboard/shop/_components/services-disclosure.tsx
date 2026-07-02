'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Collapsible } from '../../_components/collapsible';

/**
 * "Your services" — the top-level disclosure that hosts the whole Services
 * manager on My Shop (owner 2026-07-02: "My Services → My Shop" consolidation).
 *
 * Reuses the shared animated Collapsible so the open/close motion matches the
 * Manage tiles + QR card on this surface. The heavy manager is server-rendered
 * and passed in as children (RSC child of a client component); this component
 * only owns open/closed. Deep-links (?offpeak=/?add=/…) set `defaultOpen` so the
 * section lands open.
 */
export function ServicesDisclosure({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-white p-4 text-left transition-colors hover:border-[color:var(--m-orange-3)]"
        style={{ borderColor: open ? 'var(--m-orange-3)' : 'var(--m-line)' }}
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            Your services
          </span>
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Coverage, service cards, tier &amp; specialist tools
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className="h-5 w-5 shrink-0 transition-transform"
          strokeWidth={1.75}
          style={{
            color: 'var(--m-slate-4)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>
      <Collapsible open={open}>
        <div className="pt-1">{children}</div>
      </Collapsible>
    </section>
  );
}
