'use client';

import type { PointerEventHandler } from 'react';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { BOOTH_CATALOG, type BoothType } from '@/lib/seating';
import { formatCount } from '@/lib/format-number';

/**
 * 🏪 SUPPLIER SPOTS ARE NUMBERED CHIPS (owner 2026-11-20, "Yes, your picks"; drawing § 5: *"Long supplier labels
 * (LIGHTS & SOUND…) → numbered chips + 'Supplier spots · 14'. Tap a chip for its name."*).
 *
 * On Guests › Seats › 2D a booth on the floor is a small numbered chip on its wall, not its long uppercase label; the
 * one-line legend under the plan gains "Supplier spots · N", whose list says who is where; a tap on a chip shows its
 * name beside its number. The chip keeps every press the booth marker had (the editor hands its own handler in), so a
 * booked supplier's spot still opens their card and a picked spot still drags. Outside Guests the floor keeps its
 * shipped labels. 🔒 the-floor-wears-its-chrome.test.ts
 */
export type SupplierSpot = {
  id: string;
  /** 1, 2, 3… in the floor's own order. */
  n: number;
  /** Who: the booked supplier's name, else what the spot is ("Photo Booth"). */
  name: string;
  /** One line under it in the list: what the spot is, or that nobody is booked there yet. */
  hint: string;
};

type SpotBooth = { booth_id: string; booth_type: BoothType; label: string; event_vendor_id: string | null };

const typeWord = (t: BoothType) => (t === 'unassigned' ? 'New booth' : BOOTH_CATALOG.find((c) => c.type === t)?.label ?? 'Booth');

/** The floor's booths as numbered spots, in the floor's order. */
export function supplierSpots(booths: readonly SpotBooth[]): SupplierSpot[] {
  return booths.map((b, i) => {
    const booked = Boolean(b.event_vendor_id) && b.label.trim().length > 0;
    return {
      id: b.booth_id,
      n: i + 1,
      name: booked ? b.label.trim() : typeWord(b.booth_type),
      hint: booked ? typeWord(b.booth_type) : 'No supplier here yet',
    };
  });
}

/** One spot on the floor: its number, and its name too while it is named (a tap) or picked. A 44 px press. */
export function SpotChip({
  spot,
  named,
  picked,
  onPointerDown,
}: {
  spot: SupplierSpot;
  named: boolean;
  picked: boolean;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      aria-label={`Supplier spot ${spot.n} · ${spot.name}`}
      aria-pressed={named}
      data-seat-spot={spot.n}
      className="flex h-11 min-w-11 select-none items-center justify-center"
    >
      <span
        className={`flex h-6 min-w-6 items-center justify-center gap-1 whitespace-nowrap rounded-full border bg-cream px-1.5 text-[11px] font-semibold tabular-nums text-ink shadow-sm ${
          picked ? 'border-terracotta ring-2 ring-terracotta/30' : 'border-ink/30'
        }`}
      >
        {spot.n}
        {named ? <span data-seat-spot-name="" className="font-medium">· {spot.name}</span> : null}
      </span>
    </button>
  );
}

/** "Supplier spots · N" in the legend — its list is who is where; picking one names that spot on the floor. */
export function SupplierSpotsLegend({ spots, onPick }: { spots: readonly SupplierSpot[]; onPick: (id: string) => void }) {
  return (
    <span className="pointer-events-auto inline-flex">
      <PickMenu
        label="Supplier spots"
        value={null}
        buttonText={`Supplier spots · ${formatCount(spots.length)}`}
        options={spots.map((s) => ({ key: s.id, label: `${s.n} · ${s.name}`, hint: s.hint }))}
        onPick={onPick}
        dataAttr="data-seat-spots"
        compact
        opensUp
        className="shrink-0 border border-ink/15"
      />
    </span>
  );
}
