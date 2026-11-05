'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Maximize2, Navigation, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { guestsViewHref } from '@/lib/guests-views';
import { GUEST_SEAT_VIEW_LABEL, seatViewParts } from '@/lib/guest-seat-view';
import { formatCount } from '@/lib/format-number';
import { guestSeatView, type GuestSeatPreview as Preview } from '../seat-view-actions';

/* The map and the supplier card load only when a seated guest's card draws this — never with the card itself. */
const GuestSeatMap = dynamic(() => import('@/app/_components/guest-seat-map').then((m) => m.GuestSeatMap), { ssr: false });
const WayfindingMap = dynamic(() => import('@/app/_components/wayfinding-map').then((m) => m.WayfindingMap), { ssr: false });

/**
 * 🪑 "AS THEY'LL SEE IT" — the guest card's seat, the guest's own way (owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH
 * VIEW DOES" item 4): *"The host's guest card shows that guest's seat plan exactly as the guest will see it (per that
 * setting), their seat lit, tap for full screen."* The SAME picture the guest's seat page draws (`seatViewParts` over
 * the couple's Seats ⚙ choice, the theme-look map with their table lit and the booked suppliers' booths); a tap opens
 * it full screen, where the booths open their supplier's card. With the 3D walk chosen, the way in is the host's own
 * 3D test of it (Guests › Seats › 3D · Guide me, `?guide=`). Read when drawn (`guestSeatView` › preview); a refused read
 * says so with Retry — never an empty room.
 */
export function GuestSeatPreview({
  eventId,
  guestId,
  firstName,
  read: readStandIn,
}: {
  eventId: string;
  guestId: string;
  firstName: string;
  /** 🧪 The dev lab's stand-in reader (no database); absent = the shipped `guestSeatView` › preview. */
  read?: () => Promise<Preview>;
}) {
  const [p, setP] = useState<Preview | null>(null);
  const [full, setFull] = useState(false);
  const headId = useId();
  const read = useCallback(() => {
    setP(null);
    (readStandIn ? readStandIn() : guestSeatView(eventId, { kind: 'preview', guestId }))
      .then(setP)
      .catch(() => setP({ ok: false }));
  }, [eventId, guestId, readStandIn]);
  useEffect(() => {
    read();
  }, [read]);

  if (p === null) {
    return (
      <p className="text-xs text-ink/60" data-guest-seat-preview="reading">
        Reading their seat…
      </p>
    );
  }
  if (!p.ok) {
    return (
      <div className="flex items-center gap-2" data-guest-seat-preview="failed">
        <p className="min-w-0 flex-1 text-xs text-danger-700">Couldn’t read how they’ll see their seat just now.</p>
        <ActionButton tone="neutral" quiet icon={RotateCcw} label="Retry" onClick={read} />
      </div>
    );
  }
  const table = p.tableId ? p.tables.find((t) => t.table_id === p.tableId) ?? null : null;
  if (!table) return null; // not seated: the Table pick above already says so
  // The 3D walk is offered wherever the room has seats (the guest's own rule, `resolveRoomLinks` › 'venue').
  const parts = seatViewParts(p.view, true);
  const seatWords = `${table.table_label}${p.seatNumber !== null ? ` · seat ${formatCount(p.seatNumber + 1)}` : ''}`;
  const walkHref = `${guestsViewHref(eventId, 'seats', { seat: '3d' })}&guide=${encodeURIComponent(guestId)}`;
  const walk = (
    <Link
      href={walkHref}
      data-guest-seat-preview-walk=""
      className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink"
    >
      <Navigation aria-hidden className="h-4 w-4" />
      Watch {firstName} walk to it in 3D
    </Link>
  );
  return (
    <div className="flex min-w-0 flex-col gap-2" data-guest-seat-preview={p.view}>
      <p className="text-xs text-ink/60">
        As {firstName} will see it · {GUEST_SEAT_VIEW_LABEL[p.view]} · {seatWords}
      </p>
      {parts.map ? (
        <button
          type="button"
          onClick={() => setFull(true)}
          aria-label={`See ${firstName}’s seat full screen — ${seatWords}`}
          data-guest-seat-preview-open=""
          className="relative block w-full text-left"
        >
          {/* Lit: their table (the guest's own YOU pin). Not pressable here — the full screen is. */}
          <WayfindingMap look="theme" tables={p.tables} entrance={p.entrance} targetTableId={table.table_id} booths={p.booths.map((b) => ({ id: b.id, label: b.vendor?.name ?? b.label, x: b.xPct, y: b.yPct }))} />
          <span aria-hidden className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 text-ink/70 shadow-sm">
            <Maximize2 className="h-4 w-4" />
          </span>
        </button>
      ) : null}
      {parts.walk !== 'none' ? walk : null}
      <Sheet open={full} onClose={() => setFull(false)} labelledById={headId} full rise title={`${firstName}’s seat`}>
        <div className="flex min-w-0 flex-col gap-3 p-4" data-guest-seat-preview-full="">
          <h2 id={headId} className="text-base font-semibold text-ink">
            {seatWords}
          </h2>
          <GuestSeatMap look="theme" tables={p.tables} entrance={p.entrance} targetTableId={table.table_id} booths={p.booths} />
          {parts.walk !== 'none' ? walk : null}
        </div>
      </Sheet>
    </div>
  );
}
