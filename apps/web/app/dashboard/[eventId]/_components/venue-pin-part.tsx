'use client';

/**
 * 📍 A VENUE'S PIN, WHERE IT MAY BE SET (owner 2026-10-22, DECISION_LOG "A MANUAL VENUE TAKES THE COUPLE'S PIN; A
 * SHOP'S VENUE TAKES THE SHOP'S"; the rule is `lib/venue-pin-door.ts`). Two small parts every venue editor shares —
 * Studio › Info, the Suppliers place sheet and Details › Venues:
 *
 *   · `ShopPinNote`     — a venue that is a Setnayan shop: whose pin the guests' map uses, or "<shop> hasn't pinned
 *                         their place yet". Nothing to press — the shop's pin is the shop's.
 *   · `ManualVenuePin`  — a supplier the couple added by hand: the shipped `AddressPinField` (exact address · Find ·
 *                         the crosshair map · Pinned at), saving the supplier's OWN contact card through its writer
 *                         (`saveManualVenuePin` → `saveSelfAddedServiceCard`) — the one value the Suppliers card also
 *                         edits. The writer is handed in (`save`), so a lab can stand in for it.
 *
 * ⚡ NOT IN THE MAKER'S FIRST LOAD: the callers are the Studio tools and Details › Venues (the lazy `maker-details`
 * chunk, warmed by the preloaded Details tool) and the Suppliers place sheet — each already carries `AddressPinField`
 * statically, so importing it here adds no download and the first tap waits for none.
 */
import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { AddressPinField } from './address-pin-field';
import { shopPinLine } from '@/lib/venue-pin-door';
import { plainRefusal } from '../guests/_components/plain-refusal';
import type { ManualVenuePinResult } from '../vendors/[vendorId]/workspace/actions';

const FAILED = 'That did not save. Nothing changed — please try again.';
/** After a kept manual pin — it is the supplier's own card, so guests see it now (not at Apply). */
export const MANUAL_PIN_SAVED = 'Saved to your supplier’s card · guests see it now';

/** The pause after the last change before the card is saved (the Maker's AutoDraft rule). */
const PIN_SAVE_MS = 900;

/** A shop's venue: whose pin guests follow — or that the shop has not pinned yet. */
export function ShopPinNote({ shop, pinned }: { shop: string; pinned: boolean }) {
  return (
    <p className={`flex items-center gap-1 text-[12px] ${pinned ? 'text-ink/55' : 'text-warn-800'}`} data-venue-shop-pin={pinned ? 'pinned' : 'unpinned'}>
      <MapPin aria-hidden className="h-3 w-3 shrink-0" strokeWidth={1.9} />
      {shopPinLine(shop, pinned)}
    </p>
  );
}

export type ManualVenuePinSave = (input: {
  eventId: string;
  vendorId: string;
  address: string;
  pin: { lat: number; lng: number } | null;
}) => Promise<ManualVenuePinResult>;

/** A supplier the couple added by hand: its address and pin, set right here, saved to its own contact card. */
export function ManualVenuePin({
  eventId,
  vendorId,
  slot,
  address,
  pin,
  save,
}: {
  eventId: string;
  vendorId: string;
  slot: string;
  address: string;
  pin: { lat: number; lng: number } | null;
  save: ManualVenuePinSave;
}) {
  const [value, setValue] = useState({ address, pin });
  const [error, setError] = useState<string | null>(null);
  /* 🔑 Said, because it differs from the Maker's other rows: the card is the supplier's own record (Suppliers edits it
     live, as it always has), so a kept pin reaches guests now — not at Apply. One value, never a drafted copy. */
  const [saved, setSaved] = useState(false);
  const watch = JSON.stringify(value);
  const sent = useRef(watch);
  const latest = useRef(value);
  latest.current = value;
  /* Opening sends nothing; a short pause after the last change sends ONE save. */
  useEffect(() => {
    if (watch === sent.current) return;
    const t = window.setTimeout(() => {
      sent.current = watch;
      const v = latest.current;
      void save({ eventId, vendorId, address: v.address, pin: v.pin })
        .then((r) => {
          setSaved(r.ok);
          setError(r.ok ? null : plainRefusal(r.error, FAILED));
        })
        .catch(() => {
          setSaved(false);
          setError(FAILED);
        });
    }, PIN_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [watch, eventId, vendorId, save]);
  return (
    <div className="flex flex-col gap-1" data-venue-manual-pin={slot}>
      <AddressPinField id={`manual-venue-${slot}`} initialAddress={address} initialPin={pin} hideHints onChange={(next) => setValue(next)} />
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : saved ? (
        <p className="text-[11.5px] text-ink/55" data-venue-manual-saved="">
          {MANUAL_PIN_SAVED}
        </p>
      ) : null}
    </div>
  );
}
