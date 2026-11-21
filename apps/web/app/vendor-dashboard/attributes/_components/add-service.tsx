'use client';

/**
 * Attributes › ＋ Add service (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 01): the
 * top-of-page dropdown + Add became the thumb row's ＋, which rises "Add another service" — the same catalogue (the
 * services this shop has not added yet), with a search inside. Picking one is the shipped `?add=<service>`: its fields
 * open on the page, marked New, with "Add service + save".
 */
import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ThumbRow } from '@/components/thumb-row';
import { formatCount } from '@/lib/format-number';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';

export type AddableService = { key: string; en: string; tl: string | null };

export function AddService({ addable }: { addable: readonly AddableService[] }) {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState('');
  const headId = useId();
  const shown = useMemo(() => {
    const needle = words.trim().toLowerCase();
    return needle ? addable.filter((s) => `${s.en} ${s.tl ?? ''}`.toLowerCase().includes(needle)) : addable;
  }, [addable, words]);
  return (
    <>
      <SupplierThumbRow
        name="attributes"
        label="Attributes actions"
        row={<ThumbRow name="attributes" action={{ icon: Plus, label: 'Add service', onClick: () => setOpen(true) }} />}
      />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId}>
        <div className="flex flex-col gap-2.5 px-5 pb-6 pt-5">
          <h2 id={headId} className="sn-sheet-name pr-12 text-ink">
            Add another service
          </h2>
          <label className="sr-only" htmlFor={`${headId}-q`}>
            Search services
          </label>
          <input
            // field-ok: the picker's own search — it filters this list, it is never an answer that is kept
            id={`${headId}-q`}
            type="search"
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder={`Search ${formatCount(addable.length)} services`}
            className="input-field h-12 w-full rounded-full text-[15px]"
            data-attributes-add-search=""
          />
          {shown.length === 0 ? (
            <p className="px-1 py-3 text-[14px] text-[color:var(--m-slate-2)]">No service matches “{words.trim()}”.</p>
          ) : (
            <ul className="sn-frame max-h-[50vh] overflow-y-auto px-4 py-1">
              {shown.map((s) => (
                <li key={s.key}>
                  <Link
                    href={`/vendor-dashboard/attributes?add=${encodeURIComponent(s.key)}#${encodeURIComponent(s.key)}`}
                    onClick={() => setOpen(false)}
                    className="sn-press flex min-h-14 items-center gap-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block text-[15px] font-semibold text-ink">{s.en}</b>
                      {s.tl ? <span className="block text-[13px] text-[color:var(--m-slate-2)]">{s.tl}</span> : null}
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 flex-none text-[rgb(var(--color-link))]" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[14px] text-[color:var(--m-slate-2)]">Picking one opens its fields here, marked New, with “Add service + save”.</p>
        </div>
      </Sheet>
    </>
  );
}
