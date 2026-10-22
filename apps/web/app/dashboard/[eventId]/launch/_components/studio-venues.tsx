'use client';

/**
 * 📍 STUDIO › INFO › VENUES — THE PIN IS SET HERE WHEN IT IS THE COUPLE'S (owner 2026-10-22, DECISION_LOG "A MANUAL
 * VENUE TAKES THE COUPLE'S PIN; A SHOP'S VENUE TAKES THE SHOP'S"): *"can we place the setting the pin here also? ·
 * manual entry venues can set pin. · venues from actual suppliers cannot customize pin, only follows what the
 * suppliers pinned."* · *"manual is the manual added suppliers."*
 *
 * Amends 2026-10-06 "DATE AND VENUE LIVE IN SUPPLIERS" for the venue's PIN only (the date stays read-only). One card
 * per venue, its door from `lib/venue-pin-door.ts`:
 *
 *   · shop   — a Setnayan shop: one quiet row, the name and whose pin guests follow, or "<shop> hasn't pinned their
 *              place yet". Nothing to press.
 *   · manual — a supplier added by hand: its name, then the shipped `AddressPinField` on ITS OWN contact card
 *              (`saveManualVenuePin`, from the Studio actions context so a lab stands in) — the value Suppliers edits.
 *   · own    — nothing booked (or "Enter your own" over a booking that is not a shop): the name and the
 *              `AddressPinField`, drafted into the event's own venue columns through Info's one draft door
 *              (`studioDraftKeep`) — guests see it at ✓ Apply, like every Info row.
 *   · record — a venue-list pick: one quiet row, set in Suppliers.
 *
 * Loaded through `details-lazy.tsx` (`StudioTool`, the `maker-details` chunk), and the map itself only when a card
 * that has one is drawn (`next/dynamic`) — never in the Maker's first load.
 */
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { FactRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { STUDIO_SUPPLIERS_LINE } from '@/lib/studio-details';
import { shopPinLine, venuePinDoor } from '@/lib/venue-pin-door';
import { ManualVenuePin } from '../../_components/venue-pin-part';
import type { VenueSlot } from './details-your-event';
import { useStudioActions } from './studio-actions-context';
import { STUDIO_INFO_ROWS, studioDraftKeep } from './studio-info';
import { plainRefusal } from '../../guests/_components/plain-refusal';

const AddressPinField = dynamic(() => import('../../_components/address-pin-field').then((m) => m.AddressPinField), {
  loading: () => <div aria-hidden className="h-44 rounded-md bg-ink/[0.04]" data-pin-field-loading="" />,
});

/** The pause after the last change before a card is drafted (the Maker's AutoDraft rule). */
const KEEP_MS = 900;

/** The words under a manual supplier's name — where it came from. */
export const STUDIO_MANUAL_VENUE_LINE = 'Added by you in Suppliers';

/** The venues as the slots hold them — the shape `VenuesEditor` reads (`details-your-event-load.tsx`). */
export type StudioVenueSlot = Pick<VenueSlot, 'slot' | 'label' | 'booked' | 'choice' | 'typed' | 'address' | 'pin' | 'columns'>;

export function StudioVenues({ eventId, slots }: { eventId: string; slots: readonly StudioVenueSlot[] }) {
  return (
    <div className="flex flex-col gap-3" data-studio-venues="">
      {slots.map((s) => (
        <StudioVenueCard key={s.slot} eventId={eventId} s={s} />
      ))}
    </div>
  );
}

function StudioVenueCard({ eventId, s }: { eventId: string; s: StudioVenueSlot }) {
  const { saveManualVenuePin } = useStudioActions();
  const own = !s.booked || s.choice.source === 'own';
  const door = venuePinDoor(s.booked, own);
  if (door === 'own') return <StudioOwnVenue eventId={eventId} s={s} />;
  const booked = s.booked!;
  const name = (own ? s.typed.trim() : '') || booked.name;
  return (
    <div className="flex flex-col gap-1.5" data-studio-venue={s.slot} data-studio-venue-door={door}>
      <FormRows attrs={STUDIO_INFO_ROWS}>
        <FactRow
          name={s.label}
          value={name}
          where={door === 'shop' ? shopPinLine(booked.name, booked.pin != null) : door === 'manual' ? STUDIO_MANUAL_VENUE_LINE : STUDIO_SUPPLIERS_LINE}
          attrs={{ 'data-studio-read-only': `venue-${s.slot}`, ...(door === 'shop' ? { 'data-venue-shop-pin': booked.pin ? 'pinned' : 'unpinned' } : {}) }}
        />
      </FormRows>
      {door === 'manual' && booked.vendorId ? (
        <ManualVenuePin eventId={eventId} vendorId={booked.vendorId} slot={s.slot} address={booked.address ?? ''} pin={booked.pin} save={saveManualVenuePin} />
      ) : null}
    </div>
  );
}

/** Nothing booked (or the couple's own details over a booking that is not a shop): name + address + pin, drafted. */
function StudioOwnVenue({ eventId, s }: { eventId: string; s: StudioVenueSlot }) {
  const [v, setV] = useState({ name: s.typed, address: s.address, pin: s.pin });
  const [error, setError] = useState<string | null>(null);
  const watch = JSON.stringify(v);
  const sent = useRef(watch);
  const latest = useRef(v);
  latest.current = v;
  /* Opening sends nothing; a short pause after the last change drafts the card's four columns in ONE request. */
  useEffect(() => {
    if (watch === sent.current) return;
    const t = window.setTimeout(() => {
      sent.current = watch;
      const x = latest.current;
      void studioDraftKeep(eventId, `venue-${s.slot}`, {
        [s.columns.name]: x.name.trim() || null,
        [s.columns.address]: x.address.trim() || null,
        [s.columns.lat]: x.pin?.lat ?? null,
        [s.columns.lng]: x.pin?.lng ?? null,
      }).then((r) => setError(r.ok ? null : plainRefusal(r.error, 'Please try again.')));
    }, KEEP_MS);
    return () => window.clearTimeout(t);
  }, [watch, eventId, s.slot, s.columns]);
  return (
    <div className="flex flex-col gap-1.5" data-studio-venue={s.slot} data-studio-venue-door="own">
      <FormRows attrs={STUDIO_INFO_ROWS}>
        <TypedRow
          name={s.label}
          value={v.name}
          maxLength={160}
          empty="Add"
          attrs={{ 'data-venue-name': s.slot }}
          onKeep={(t) => setV((was) => ({ ...was, name: t }))}
        />
      </FormRows>
      <AddressPinField
        id={`studio-venue-${s.slot}`}
        initialAddress={s.address}
        initialPin={s.pin}
        hideHints
        onChange={(next) => setV((was) => ({ ...was, address: next.address, pin: next.pin }))}
      />
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
