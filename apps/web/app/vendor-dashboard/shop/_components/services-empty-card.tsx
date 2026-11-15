import { Info, Layers } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';

/**
 * 🧾 SHOP › YOUR SERVICES, EMPTY (Build 3 Lane E; prototype § 4 "The services section, empty"): one honest line and the
 * forward step, New service (terracotta, filled) — the same maker the ＋ opens. The FIRST card a shop ever makes is
 * pressed here. Drawn by the services manager (and the lab) — one part, never two copies.
 */
export function ServicesEmptyCard() {
  return (
    // Design template rules 2 · 6: no card around an empty part — the section label, ONE plain line, the next step.
    <div className="space-y-2.5" data-shop-services-empty="">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">Services</p>
        <span className="text-xs text-ink/70">one card a host can book</span>
      </div>
      <p className="flex items-start gap-2 text-sm leading-snug text-ink">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" strokeWidth={1.9} />
        <span>No service cards yet · your shop is found by its cards</span>
      </p>
      <ActionButton tone="brand" main icon={<Layers aria-hidden strokeWidth={1.9} />} label="New service" href={SERVICE_MAKER_HREF} tour="shop-add-service" className="!h-11" />
    </div>
  );
}
