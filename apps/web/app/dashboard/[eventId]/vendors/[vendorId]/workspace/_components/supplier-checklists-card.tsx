// ==========================================================================
// The supplier's checklists — COUPLE surface (owner 23 Nov 2026: "let couples see the checklist ticks").
//
// A booked supplier's checklist hub tools (Paperwork checklist · Load-in & venue access · Delivery & drop-off · Tech
// rider …), read-only, on the couple's workspace for that supplier, under the Shot list. Written from the supplier's
// live Hub (`hubToolEntry` → `vendor_hub_tool_entries`); read by `readCoupleChecklists`, which asks the tool library
// which tools the couple sees (`hub_tools.couple_sees`), never a list in code.
//
// Drawn like its sibling, the Shot list card (design template 14 Nov 2026): grey capitals, hairline rows, the count in
// a soft chip, the explaining line behind ⓘ. Honest: a refused read says so in one line, never "no lists"; a supplier
// with no lists draws nothing — nobody is expected to keep one.
// ==========================================================================

import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import type { CoupleChecklistsRead } from '@/lib/hub-tool-entries.server';
import { checklistProgress } from '@/lib/hub-tool-entries';
import { formatCount } from '@/lib/format-number';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

export function SupplierChecklistsCard({ vendorName, read }: { vendorName: string; read: CoupleChecklistsRead }) {
  if (read.state === 'unread') {
    return (
      <section aria-label="Their checklists" data-supplier-checklists="unread">
        <ChecklistLabel title="Their checklists" />
        <p role="status" className="py-2 text-sm text-warn-800">
          Couldn’t load {vendorName}’s checklists — not the same as them not having any. Refresh to try again.
        </p>
      </section>
    );
  }
  if (read.lists.length === 0) return null;
  return (
    <>
      {read.lists.map((list) => {
        const { done, total } = checklistProgress(list.entries);
        const headingId = `checklist-${list.toolKey}-heading`;
        return (
          <section key={list.toolKey} aria-labelledby={headingId} data-supplier-checklist={list.toolKey}>
            <div className="flex items-center justify-between gap-2">
              <ChecklistLabel
                id={headingId}
                title={list.title}
                tip={`${vendorName}’s ${list.title.toLowerCase()} for your event, ticked as they go. Want something added? Message them.`}
              />
              <Badge tone="quiet">
                {formatCount(done)}/{formatCount(total)} done
              </Badge>
            </div>
            <ul className="divide-y divide-ink/10">
              {list.entries.map((e) => (
                <li key={e.id} className="flex min-h-11 items-start gap-2 py-2.5 text-[15px]">
                  {e.done ? (
                    <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success-600" strokeWidth={1.75} />
                  ) : (
                    <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/25" strokeWidth={1.75} />
                  )}
                  <span className={e.done ? 'text-ink/70' : 'text-ink'}>
                    {e.label}
                    <span className="sr-only">{e.done ? ' — done' : ' — not done yet'}</span>
                    {e.note ? <span className="block text-[13px] text-ink/70">{e.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** The section's label — grey capitals, no box; its explaining line (when there is one) behind the ⓘ. */
function ChecklistLabel({ title, tip, id }: { title: string; tip?: string; id?: string }) {
  const cls = 'text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';
  return (
    <h2 id={id} className="mb-1 mt-[18px] flex items-center gap-2">
      <ListChecks aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} />
      {tip ? (
        <InfoTip label={title} labelAs="span" labelClassName={cls} align="start">
          {tip}
        </InfoTip>
      ) : (
        <span className={cls}>{title}</span>
      )}
    </h2>
  );
}
