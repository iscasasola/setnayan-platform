'use client';

import { useState } from 'react';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import { BoothVendorCard } from '@/app/_components/plan3d/booth-vendor-card';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';
import type { Lab3DBooth } from '@/lib/seating-3d';

/**
 * 🏪 THE GUEST'S 2D MAP, WITH THE BOOKED SUPPLIERS' BOOTHS (owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH VIEW
 * DOES" item 5): *"tapping a booth in the host's 2D plan AND on the guest's 2D map opens that booked supplier's card, as
 * 3D does"*. The shared `WayfindingMap`, plus the 3D walk's own `BoothVendorCard` (the guest's wording: "Book this
 * vendor" where the supplier takes bookings). The booths come from `readGuestBooths` — public business identity only.
 */
export function GuestSeatMap({
  booths = [],
  ...map
}: {
  tables: EventTableRow[];
  entrance: EntrancePos;
  targetTableId: string | null;
  look?: 'plain' | 'theme';
  faint?: boolean;
  booths?: readonly Lab3DBooth[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const booth = open ? booths.find((b) => b.id === open) ?? null : null;
  return (
    <>
      <WayfindingMap {...map} booths={booths.map((b) => ({ id: b.id, label: b.vendor?.name ?? b.label, x: b.xPct, y: b.yPct }))} onBooth={setOpen} />
      {booths.length > 0 ? <BoothVendorCard booth={booth} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
