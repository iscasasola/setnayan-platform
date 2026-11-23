// ==========================================================================
// Shot list — COUPLE surface (DAY-10).
//
// The supplier's day-of shot list, read-only, on the couple's workspace for
// that supplier. Written from the On the Day console
// (`vendor-dashboard/on-the-day/_components/shot-list.tsx`) into
// `event_shot_list_items`; the couple reads it through
// `event_shot_list_items_event_read` (current_event_ids()).
//
// THREE STATES, NEVER TWO. `unreadable` is not `empty`: a refused read must not
// render as "your photographer hasn't shared a list", because on the wedding
// morning that sentence gets acted on (the couple chases a supplier who did
// the work). See the guest-list precedent in lib/guests.ts.
// ==========================================================================

import { Camera, CheckCircle2, Circle, FileCheck2, PackageCheck, Truck, type LucideIcon } from 'lucide-react';
import { CHECKLIST_TOOLS, type ChecklistToolKey, type ShotRow } from '@/lib/shot-list';
import { formatCount } from '@/lib/format-number';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

export type ShotListCardState =
  | { state: 'ok'; rows: ShotRow[] }
  | { state: 'unreadable' };

/** Categories whose supplier is expected to keep a shot list. */
export const SHOT_LIST_CATEGORIES: ReadonlySet<string> = new Set(['photographer', 'videographer']);

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return '';
  }
}

/** Each checklist tool's mark — the same one the supplier's Hub draws. */
const TOOL_MARK: Record<ChecklistToolKey, LucideIcon> = {
  shot_list: Camera,
  paperwork_checklist: FileCheck2,
  load_in_and_venue_access: Truck,
  delivery_and_drop_off: PackageCheck,
};

/**
 * 🧰 `tool` (DECISION_LOG 2026-11-23): the same card shows the supplier's other checklist hub tools — Paperwork
 * checklist, Load-in & venue access, Delivery & drop-off — read from the same rows (`tool_key`). Only the shot list is
 * EXPECTED of a trade; another checklist with no rows draws nothing.
 */
export function ShotListCard({
  vendorName,
  category,
  list,
  tool = 'shot_list',
}: {
  vendorName: string;
  category: string;
  list: ShotListCardState;
  tool?: ChecklistToolKey;
}) {
  const expected = tool === 'shot_list' && SHOT_LIST_CATEGORIES.has(category);
  const cfg = CHECKLIST_TOOLS[tool];
  const headingId = tool === 'shot_list' ? 'shot-list-heading' : `${tool}-heading`;

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 6 · 7 · 13): no tile — the section's grey capitals, then plain hairline
  // rows; the count is a soft chip, the explaining line sits behind ⓘ, an empty or refused read is one line.
  if (list.state === 'unreadable') {
    return (
      <section aria-labelledby={headingId}>
        <ShotListLabel tool={tool} id={headingId} />
        <p role="status" className="py-2 text-sm text-warn-800">
          Couldn’t load {vendorName}’s {cfg.title.toLowerCase()} — not the same as them not having one. Refresh to try again.
        </p>
      </section>
    );
  }

  const rows = list.rows;
  if (rows.length === 0) {
    // Only say "not shared yet" where a list is expected. For a caterer or a
    // florist an absent card is the honest answer.
    if (!expected) return null;
    return (
      <section aria-labelledby={headingId}>
        <ShotListLabel tool={tool} id={headingId} tip={`When ${vendorName} saves one from their day-of console, it shows up here — and you can follow along as shots are captured on the day.`} />
        <p className="py-2 text-sm text-ink/70">{vendorName} hasn’t shared a shot list yet.</p>
      </section>
    );
  }

  const captured = rows.filter((r) => r.captured_at != null).length;
  return (
    <section aria-labelledby={headingId} data-checklist-tool={tool}>
      <div className="flex items-center justify-between gap-2">
        <ShotListLabel
          tool={tool}
          id={headingId}
          tip={
            tool === 'shot_list'
              ? `The must-get shots ${vendorName} is working from. Want one added? Message them.`
              : `${vendorName}’s ${cfg.title.toLowerCase()} for your event. Want something added? Message them.`
          }
        />
        <Badge tone="quiet">
          {formatCount(captured)}/{formatCount(rows.length)} {cfg.doneWord}
        </Badge>
      </div>
      <ul className="divide-y divide-ink/10">
        {rows.map((r) => (
          <li key={r.item_id} className="flex min-h-11 items-start gap-2 py-2.5 text-[15px]">
            {r.captured_at ? (
              <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success-600" strokeWidth={1.75} />
            ) : (
              <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/25" strokeWidth={1.75} />
            )}
            <span className={r.captured_at ? 'text-ink/70' : 'text-ink'}>
              {r.label}
              {r.captured_at ? (
                <span className="ml-1.5 text-[13px] text-ink/70">· {cfg.doneWord} {fmtTime(r.captured_at)}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The section's label — grey capitals, no box; its explaining line (when there is one) behind the ⓘ. */
function ShotListLabel({ tip, tool, id }: { tip?: string; tool: ChecklistToolKey; id: string }) {
  const cls = 'text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';
  const Mark = TOOL_MARK[tool];
  const title = CHECKLIST_TOOLS[tool].title;
  return (
    <h2 id={id} className="mb-1 mt-[18px] flex items-center gap-2">
      <Mark aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} />
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
