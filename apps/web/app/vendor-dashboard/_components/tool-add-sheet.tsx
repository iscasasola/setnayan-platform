'use client';

/**
 * ＋ → a sheet (the supplier tool pages redraw v3, 21 Nov 2026): a page's one main action is the thumb row's ＋, and it
 * RISES the page's shipped add form — "Add a segment", "Add a line" — instead of that form sitting open at the top of
 * the page. The form is the page's own (server-drawn, the same action and fields), handed in as `children`; this only
 * owns the ＋, the sheet and its title. The sheet shuts on its ✕, Esc, the backdrop or Back (the house `Sheet`).
 */
import { useId, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ThumbRow } from '@/components/thumb-row';
import { SupplierThumbRow } from './supplier-thumb-row';

export function ToolAddSheet({ name, label, title, children }: { name: string; label: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const headId = useId();
  return (
    <>
      <SupplierThumbRow name={name} label={`${title} actions`} row={<ThumbRow name={name} action={{ icon: Plus, label, onClick: () => setOpen(true) }} />} />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId}>
        <div className="flex flex-col gap-2.5 pb-2">
          <h2 id={headId} className="sn-sheet-name text-ink">
            {title}
          </h2>
          {children}
        </div>
      </Sheet>
    </>
  );
}
