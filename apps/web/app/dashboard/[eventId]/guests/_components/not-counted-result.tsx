'use client';

/**
 * 🧮 THE LINE UNDER "NOT COUNTED FOR ▾" (owner 2026-11-04, the approved prototype `count-and-quotes.html`, "Couple · a
 * guest's card"): *"Juan's Kitchen counts 168, not 169 · Every other service still counts Mia."*
 *
 * It moves with the ticks: the field's hidden input fires `change` as the PickMenu is ticked (`CardPick`), and this
 * wrapper hears it bubble — no second copy of the picks. The words are `notCountedResult` (`lib/supplier-count.ts`),
 * which says nothing for a guest whose tick would not move the number (not attending, or outside that service's rule).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { notCountedResult, type CountSelf, type CountedService } from '@/lib/supplier-count';
import { parseNotCounted } from '@/lib/guest-not-counted';

export function NotCountedResult({
  services,
  saved,
  self,
  field,
  children,
}: {
  services: readonly CountedService[];
  /** The ticks the counts were read with. */
  saved: readonly string[];
  self: CountSelf;
  /** The hidden input's name (`NOT_COUNTED_FIELD`). */
  field: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<readonly string[]>(saved);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const heard = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.name === field) setPicked(parseNotCounted(t.value));
    };
    el.addEventListener('change', heard);
    el.addEventListener('sn-restore', heard);
    return () => {
      el.removeEventListener('change', heard);
      el.removeEventListener('sn-restore', heard);
    };
  }, [field]);
  const line = notCountedResult(services, picked, saved, self);
  const cut = line ? line.indexOf(' · Every other service') : -1;
  return (
    <div ref={ref}>
      {children}
      {line ? (
        <p className="pb-3 text-[13px] leading-snug" role="status" data-card-not-counted-result="">
          <b className="font-medium text-ink">{line.slice(0, cut)}</b>
          <span className="text-ink/60">{line.slice(cut)}</span>
        </p>
      ) : null}
    </div>
  );
}
