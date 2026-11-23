'use client';

/**
 * ⋯ ON A GUIDE — "Report a problem lives in ⋯ on the guide" (the Guide & Help drawing, owner "Approved" 21 Nov 2026,
 * § What is new). The ⋯ is a 44 round at the guide's top right; it opens THE floating surface (`Sheet`) with its one
 * row, which opens Help's Message us already filled in — topic Bug report, the guide named in the subject — through the
 * shipped form and action (`submitHelpMessage`). No new writer.
 */
import { useId, useState } from 'react';
import { Flag, MoreHorizontal } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { HelpRow, HelpRows } from './help-rows';

export function GuideMore({ reportHref }: { reportHref: string }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="More"
        className="sn-press grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-ink/5"
        data-guide-more=""
      >
        <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId}>
        <div className="px-4 pb-6 pt-1">
          <h2 id={headingId} className="text-sn-xl font-semibold text-ink">
            This guide
          </h2>
          <div className="mt-3">
            <HelpRows data="guide-more">
              <HelpRow icon={Flag} title="Report a problem" line="Something here is wrong or out of date." href={reportHref} data="report" />
            </HelpRows>
          </div>
        </div>
      </Sheet>
    </>
  );
}
