'use client';

/**
 * 🧾 ONE DETAILS ROW WITH ITS HISTORY — "Changed N×", tap to open (Supplier Build 3 · lane B).
 *
 * The prototype's `frow`: the fact's topic icon, its label, its value now, and a quiet tail — "Changed 2×" (a press:
 * it opens the history, newest first, who · when · from → to), "No changes", or "Couldn't load the history". The
 * same part for every fact on Details, on both sides; the facts themselves come from `lib/agreed-now.ts`.
 *
 * Opens at the family's one speed (`--sn-pill-dur`); reduced motion shows the end state.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TOPIC_ICON } from '@/lib/topic-icons';
import { changedLabel, momentWords, type AgreedRow } from '@/lib/agreed-now';

export function ChangedRow({ row, loaded = true, initialOpen = false }: { row: AgreedRow; loaded?: boolean; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const Icon = TOPIC_ICON[row.topic];
  const has = loaded && row.history.length > 0;
  const tail = changedLabel(row.history, loaded);

  const head = (
    <>
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-ink/[0.05] text-ink/60">
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="grid min-w-0">
        <span className="text-[13px] text-ink/60">{row.label}</span>
        <span className="text-[15px] font-semibold leading-snug text-ink">{row.value}</span>
      </span>
      <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[13px] ${has ? 'font-semibold text-sn-accent' : 'text-ink/45'}`}>
        {tail}
        {has ? (
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform duration-[var(--sn-pill-dur)] ease-[var(--sn-ease)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        ) : null}
      </span>
    </>
  );

  const grid = 'grid min-h-[56px] w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 py-2 text-left';
  return (
    <li className="border-t border-ink/10 first:border-t-0" data-agreed-row={row.key} data-changed={row.history.length}>
      {has ? (
        <button type="button" className={`sn-press ${grid}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {head}
        </button>
      ) : (
        <div className={grid}>{head}</div>
      )}
      {has ? (
        <div
          className="grid transition-[grid-template-rows] duration-[var(--sn-pill-dur)] ease-[var(--sn-ease)] motion-reduce:transition-none"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
          aria-hidden={!open}
          inert={!open || undefined}
        >
          <ol className="min-h-0 overflow-hidden pl-11" data-agreed-history="">
            {row.history.map((h, n) => (
              <li key={`${h.at}:${n}`} className="border-l-2 border-ink/10 py-1.5 pl-3 text-[13px] leading-snug">
                <span className="font-semibold text-ink">{h.who}</span>
                <span className="text-ink/55"> · {momentWords(h.at) ?? 'a while ago'}</span>
                <span className="block text-ink/75">
                  {h.from ?? 'Not set'} → <span className="font-semibold text-ink">{h.to ?? 'Not set'}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  );
}
