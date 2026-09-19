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

  if (list.state === 'unreadable') {
    return (
      <section className="sn-tile p-4 sm:p-5" aria-labelledby="shot-list-heading">
        <h2 id="shot-list-heading" className="flex items-center gap-2 text-base font-semibold">
          <Camera aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} /> Shot list
        </h2>
        <p className="mt-2 text-sm text-warn-800">
          We couldn’t load {vendorName}’s shot list just now. Refresh to try again — this is not the
          same as them not having one.
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
      <section className="sn-tile p-4 sm:p-5" aria-labelledby="shot-list-heading">
        <h2 id="shot-list-heading" className="flex items-center gap-2 text-base font-semibold">
          <Camera aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} /> Shot list
        </h2>
        <p className="mt-2 text-sm text-ink/60">
          {vendorName} hasn’t shared a shot list yet. When they save one from their day-of console,
          it shows up here — and you can follow along as shots are captured on the day.
        </p>
      </section>
    );
  }

  const captured = rows.filter((r) => r.captured_at != null).length;
  return (
    <section className="sn-tile p-4 sm:p-5" aria-labelledby="shot-list-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="shot-list-heading" className="flex items-center gap-2 text-base font-semibold">
          <Camera aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} /> Shot list
        </h2>
        <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {captured}/{rows.length} captured
        </span>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        The must-get shots {vendorName} is working from. Want one added? Message them.
      </p>
      <ul className="mt-3 space-y-1">
        {rows.map((r) => (
          <li key={r.item_id} className="flex items-start gap-2 text-sm">
            {r.captured_at ? (
              <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success-600" strokeWidth={1.75} />
            ) : (
              <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/25" strokeWidth={1.75} />
            )}
            <span className={r.captured_at ? 'text-ink/50' : 'text-ink/80'}>
              {r.label}
              {r.captured_at ? (
                <span className="ml-1.5 text-xs text-ink/40">· captured {fmtTime(r.captured_at)}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
