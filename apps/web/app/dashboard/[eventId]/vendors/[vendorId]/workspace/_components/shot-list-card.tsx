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

import { Camera, CheckCircle2, Circle } from 'lucide-react';
import type { ShotRow } from '@/lib/shot-list';
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

export function ShotListCard({
  vendorName,
  category,
  list,
}: {
  vendorName: string;
  category: string;
  list: ShotListCardState;
}) {
  const expected = SHOT_LIST_CATEGORIES.has(category);

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 6 · 7 · 13): no tile — the section's grey capitals, then plain hairline
  // rows; the count is a soft chip, the explaining line sits behind ⓘ, an empty or refused read is one line.
  if (list.state === 'unreadable') {
    return (
      <section aria-labelledby="shot-list-heading">
        <ShotListLabel />
        <p role="status" className="py-2 text-sm text-warn-800">
          Couldn’t load {vendorName}’s shot list — not the same as them not having one. Refresh to try again.
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
      <section aria-labelledby="shot-list-heading">
        <ShotListLabel tip={`When ${vendorName} saves one from their day-of console, it shows up here — and you can follow along as shots are captured on the day.`} />
        <p className="py-2 text-sm text-ink/70">{vendorName} hasn’t shared a shot list yet.</p>
      </section>
    );
  }

  const captured = rows.filter((r) => r.captured_at != null).length;
  return (
    <section aria-labelledby="shot-list-heading">
      <div className="flex items-center justify-between gap-2">
        <ShotListLabel tip={`The must-get shots ${vendorName} is working from. Want one added? Message them.`} />
        <Badge tone="quiet">
          {formatCount(captured)}/{formatCount(rows.length)} captured
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
                <span className="ml-1.5 text-[13px] text-ink/70">· captured {fmtTime(r.captured_at)}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The section's label — grey capitals, no box; its explaining line (when there is one) behind the ⓘ. */
function ShotListLabel({ tip }: { tip?: string }) {
  const cls = 'text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';
  return (
    <h2 id="shot-list-heading" className="mb-1 mt-[18px] flex items-center gap-2">
      <Camera aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} />
      {tip ? (
        <InfoTip label="Shot list" labelAs="span" labelClassName={cls} align="start">
          {tip}
        </InfoTip>
      ) : (
        <span className={cls}>Shot list</span>
      )}
    </h2>
  );
}
