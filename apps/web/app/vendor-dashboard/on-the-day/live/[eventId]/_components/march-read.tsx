import { ChevronDown, Footprints } from 'lucide-react';
import type { MarchSection } from '@/lib/march-drag';
import { formatCount } from '@/lib/format-number';
import { marchWalkCount } from '@/lib/supplier-march';

/**
 * 🚶 THE WEDDING MARCH, READ-ONLY — for the band and the coordinator (owner, tracker 2026-10-23: YES).
 *
 * The same march the couple arranges (`loadMarch` → `marchSections`, exactly what the Maker draws), live as
 * APPLIED — never the couple's unapplied draft. Nothing here moves a name: no drag, no button inside a row.
 *
 * Folded by default (a 48-walk march is a long scroll above the tools a band needs on the night); the summary is the
 * one pressable thing. A march that could not be read is SAID — never drawn as "nobody walks" — and an event with no
 * walks draws nothing at all (`page.tsx` decides).
 */
export function MarchRead({ sections, unread }: { sections: readonly MarchSection[]; unread: boolean }) {
  if (unread) {
    return (
      <p role="status" data-supplier-march="unread" className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">
        The Wedding March couldn&rsquo;t load just now &mdash; that&rsquo;s on us. Refresh to try again.
      </p>
    );
  }
  const walks = marchWalkCount(sections);
  let step = 0;
  return (
    <details data-supplier-march="read" className="group">
      <summary className="sn-press flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <Footprints aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.75} />
        <span className="text-base font-semibold text-ink">Wedding March</span>
        <span className="text-sm text-[color:var(--m-slate-2)]">
          {formatCount(walks)} {walks === 1 ? 'walk' : 'walks'} · read-only
        </span>
        <ChevronDown aria-hidden className="ml-auto h-4 w-4 text-[color:var(--m-slate-2)] transition-transform duration-sn-control ease-sn group-open:rotate-180" strokeWidth={1.75} />
      </summary>
      <p className="mt-1 text-sm leading-relaxed text-[color:var(--m-slate-2)]">The order the couple set. Only they can change it.</p>
      <div className="mt-3 space-y-4">
        {sections.map((section) => (
          <section key={section.key} aria-label={section.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">{section.label}</p>
            <ol className="mt-1.5">
              {section.rows.map((row, i) => {
                step += 1;
                const [left, right] = row;
                return (
                  <li key={`${section.key}-${i}`} className="grid grid-cols-[1.75rem_1fr_1fr] items-baseline gap-2 py-1.5 text-sm">
                    <span className="text-sm tabular-nums text-[color:var(--m-slate-2)]">{step}</span>
                    <Person p={left} alone={!right} />
                    <Person p={right} alone={!left} />
                  </li>
                );
              })}
            </ol>
            <hr className="mt-2 border-[color:var(--m-line)]" />
          </section>
        ))}
      </div>
    </details>
  );
}

function Person({ p, alone }: { p: MarchSection['rows'][number][number]; alone: boolean }) {
  if (!p) return <span className="text-sm text-[color:var(--m-slate-2)]">{alone ? '' : 'walks alone'}</span>;
  return (
    <span className="min-w-0 break-words text-ink">
      {p.name}
      {p.tag ? <span className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">{p.tag}</span> : null}
    </span>
  );
}
