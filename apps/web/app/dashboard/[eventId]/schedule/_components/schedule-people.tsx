'use client';

/**
 * 👥 THE PEOPLE COLUMN — desktop only (event chapters slice 10; the prototype's "Desktop · 1440 and 1280": the day · the
 * opened chapter · the people). What needs you, every supplier and the chapters they serve, the coordinator, the
 * Host/MC, and Release — each a row, never a tab or a thumb strip. A supplier is a door: tap one to see the day as them
 * (View as is Pro; on a Free event the row only reads).
 */
import type { ReactNode } from 'react';
import { chapterSuppliers } from '@/lib/schedule-chapters';
import { initialsOf } from '@/lib/day-list';
import { lensAllowed } from '@/lib/schedule-view-as';
import { useChapters } from './chapters-context';

export function SchedulePeople({ needs }: { needs: ReactNode }) {
  const ch = useChapters();
  if (!ch) return null;
  const onEvery = ch.suppliers.filter((s) => s.everyChapter);
  const hostIds = new Set((ch.viewAs?.data.suppliers ?? []).filter((s) => s.host).map((s) => s.vendor_id));
  const served = new Map<string, string[]>();
  for (const c of ch.chapters) {
    for (const s of chapterSuppliers(c, ch.moments, ch.tasks, ch.suppliers)) {
      if (s.everyChapter) continue;
      served.set(s.id, [...(served.get(s.id) ?? []), c.label]);
    }
  }
  const mayView = (id: string) => Boolean(ch.viewAs && lensAllowed(ch.viewAs.pro, { kind: 'supplier', vendorId: id, crew: null }));
  const row = (id: string, name: string, line: string, kind: string) => (
    <li key={`${kind}:${id}`}>
      <button
        type="button"
        data-people-row={id}
        disabled={!mayView(id)}
        onClick={() => ch.setLens({ kind: 'supplier', vendorId: id, crew: null })}
        className="sn-press flex min-h-12 w-full items-center gap-2.5 border-b border-ink/10 py-2 text-left disabled:cursor-default"
      >
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink/[0.07] text-[10.5px] font-semibold text-ink/75">{initialsOf(name)}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-ink">{name}</span>
          <span className="block truncate text-[12px] text-ink/55">{line}</span>
        </span>
      </button>
    </li>
  );
  const plain = ch.suppliers.filter((s) => !s.everyChapter && !hostIds.has(s.id));
  return (
    <div className="space-y-5 font-sans" data-schedule-people-pane="">
      <section>
        <h3 className="pb-1 text-[11px] uppercase tracking-[0.12em] text-gold-deep">Needs you</h3>
        {needs ?? <p className="text-[13px] text-ink/55">Nothing is waiting on you right now.</p>}
      </section>
      <section>
        <h3 className="pb-1 text-[11px] uppercase tracking-[0.12em] text-gold-deep">Suppliers and their chapters</h3>
        {plain.length === 0 ? <p className="text-[13px] text-ink/55">No supplier is booked yet.</p> : null}
        <ul>{plain.map((s) => row(s.id, s.name, served.get(s.id)?.join(' · ') || 'Needs a chapter', 'sup'))}</ul>
      </section>
      {onEvery.length > 0 || hostIds.size > 0 ? (
        <section>
          <h3 className="pb-1 text-[11px] uppercase tracking-[0.12em] text-gold-deep">Coordinator and Host / MC</h3>
          <ul>
            {onEvery.map((s) => row(s.id, s.name, 'Coordinator · every chapter', 'coord'))}
            {ch.suppliers.filter((s) => hostIds.has(s.id)).map((s) => row(s.id, s.name, 'Host / MC', 'host'))}
          </ul>
        </section>
      ) : null}
      <section>
        <h3 className="pb-1 text-[11px] uppercase tracking-[0.12em] text-gold-deep">Release</h3>
        <button type="button" onClick={() => ch.openSettings()} data-people-release="" className="sn-press flex min-h-12 w-full items-center justify-between border-b border-ink/10 text-left text-[14px] text-ink">
          <span>Each guest’s full schedule</span>
          <span className="text-sn-accent">Release ›</span>
        </button>
      </section>
    </div>
  );
}
