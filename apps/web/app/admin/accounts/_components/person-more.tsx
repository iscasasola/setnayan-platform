'use client';

import { useId, useState, type ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';

/**
 * ⋯ on a person's row (owner-approved 2026-11-14, `admin_accounts_insights_2026-11-14_fable.html` › "After · ⋯
 * opened"): ALL of the row's actions in ONE list — name, kind, email and ID at its head. It rises as a sheet on a
 * phone and opens as the shared drawer on a computer. This component only opens and closes; the list itself is
 * server-rendered by the surface (the same server actions and the same `ConfirmForm`s as before, so every danger row
 * still asks first).
 */
export function PersonMore({ name, head, children }: { name: string; head: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <ActionButton
        tone="neutral"
        icon={MoreHorizontal}
        label="More"
        name={`More for ${name}`}
        iconOnly
        quiet
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={titleId} rise>
        <div className="px-4 pb-5 pt-1" data-person-more="">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-[19px] font-extrabold text-ink">
                {name}
              </h2>
              <div className="text-[13px] text-[color:var(--m-slate-2)]">{head}</div>
            </div>
            <ActionButton tone="neutral" icon={X} label="Close" iconOnly type="button" onClick={() => setOpen(false)} />
          </div>
          <div className="mt-2">{children}</div>
        </div>
      </Sheet>
    </>
  );
}
