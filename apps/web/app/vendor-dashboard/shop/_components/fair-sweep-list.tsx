import Link from 'next/link';
import { ChevronRight, PencilLine } from 'lucide-react';
import type { SweepItem } from '@/lib/fair-presentation-sweep';

/**
 * 🚫 "Edit your name" — the sweep's notice as drawn (`fair-sweep-notice.tsx` reads; this draws). Its own module, with no
 * server import, so the dev lab can draw it from a fixture. In-app only; every row is a door to the field that fixes it.
 */
/** The notice itself, from what the sweep found — drawn by the Shop tab and by the dev lab. */
export function FairSweepList({ items, unread = [] }: { items: ReadonlyArray<SweepItem>; unread?: ReadonlyArray<string> }) {
  if (items.length === 0 && unread.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-3xl pt-4" data-fair-sweep={items.length} aria-labelledby="fair-sweep-title">
      {items.length > 0 ? (
        <>
          <h2 id="fair-sweep-title" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <PencilLine aria-hidden className="h-4 w-4 flex-none" style={{ color: 'rgb(var(--color-danger))' }} strokeWidth={2} />
            Edit your name
          </h2>
          <ul className="mt-1">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id ?? ''}`} className="border-t border-ink/10 first:border-t-0">
                <Link href={it.href} className="sn-press flex min-h-[52px] items-center gap-3 py-2.5" data-fair-sweep-item={it.kind}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium text-ink">{it.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'rgb(var(--color-danger))' }}>
                      {it.line}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/70" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {unread.length > 0 ? (
        <p role="status" className="mt-1 text-[12.5px] text-ink/70" data-fair-sweep-unread="">
          Couldn&rsquo;t check {unread.join(' · ')} for fair presentation just now — nothing on your shop changed.
        </p>
      ) : null}
    </section>
  );
}
