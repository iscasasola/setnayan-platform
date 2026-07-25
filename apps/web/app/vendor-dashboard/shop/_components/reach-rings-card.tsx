'use client';

import { useState, useTransition } from 'react';
import { MapPin } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { ReachMap } from './reach-map';
import { updateVendorReachRings } from '../reach-actions';

/**
 * My Shop → "Coverage" — the vendor's TWO REACH RINGS (owner-locked model
 * `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 6). Flag-dark: the page
 * only renders this behind NEXT_PUBLIC_VENDOR_REACH_RINGS_V1.
 *
 *   • Ring 1 "free travel"        — inside it the vendor's proposal
 *                                   transportation line is LOCKED TO ₱0 and the
 *                                   field is disabled; the couple sees
 *                                   "Free Transportation."
 *   • Ring 2 "willing to travel"  — discoverable, couple sees "travel fee may
 *                                   apply". TIER-CAPPED (Free/Solo 30 km ·
 *                                   Pro 60 km · Enterprise 100 km) — the slider
 *                                   max here is the vendor's own cap, and the
 *                                   server re-clamps anyway.
 *   • Beyond Ring 2               — the vendor isn't shown to that couple.
 *
 * This card is the promised follow-up in `reach-map.tsx`'s header comment
 * ("read-only here; a follow-up makes it vendor-settable up to the tier
 * ceiling"). It replaces nothing — the existing read-only tier-reach block stays
 * exactly as it is while the flag is dark.
 *
 * The two sliders are constrained so Ring 1 <= Ring 2 in the UI; the authority
 * is still the server (`parseRingSettings`) and, ultimately, the read-time
 * clamp in `lib/vendor-reach-rings.ts` — a vendor who PATCHes the column
 * directly gains nothing.
 */
export function ReachRingsCard({
  hqLat,
  hqLng,
  city,
  initialRing1Km,
  initialRing2Km,
  capKm,
}: {
  hqLat: number | null;
  hqLng: number | null;
  city: string | null;
  /** Effective (already tier-clamped) Ring 1 radius. */
  initialRing1Km: number;
  /** Effective (already tier-clamped) Ring 2 radius. */
  initialRing2Km: number;
  /** This vendor's tier cap — the Ring-2 slider ceiling. */
  capKm: number;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [savedRing1, setSavedRing1] = useState(initialRing1Km);
  const [savedRing2, setSavedRing2] = useState(initialRing2Km);
  const [ring1, setRing1] = useState(initialRing1Km);
  const [ring2, setRing2] = useState(initialRing2Km);

  const dirty = ring1 !== savedRing1 || ring2 !== savedRing2;
  const from = city ?? 'your headquarters';

  function onRing2(next: number) {
    setRing2(next);
    if (ring1 > next) setRing1(next); // Ring 1 can never poke outside Ring 2
  }

  function save() {
    const fd = new FormData();
    fd.set('reach_ring1_km', String(ring1));
    fd.set('reach_ring2_km', String(ring2));
    startTransition(async () => {
      const res = await updateVendorReachRings(null, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Trust the SERVER's numbers, not the slider's — the action re-clamps to
      // the tier cap, so a stale client cap can't leave the card lying.
      setSavedRing1(res.ring1Km);
      setSavedRing2(res.ring2Km);
      setRing1(res.ring1Km);
      setRing2(res.ring2Km);
      toast.success('Coverage saved.');
    });
  }

  return (
    <div
      className="rounded-xl border p-4 sm:p-5"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
        >
          <MapPin className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Coverage</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
            Two rings from {from}. Inside the first you travel free; between the
            two a travel fee may apply; beyond the second couples don’t see you.
          </p>
        </div>
      </div>

      {hqLat !== null && hqLng !== null ? (
        <div className="mt-3">
          <ReachMap lat={hqLat} lng={hqLng} radiusKm={ring2} freeRadiusKm={ring1} />
        </div>
      ) : (
        <p className="mt-3 text-xs" style={{ color: 'var(--m-slate)' }}>
          Add your HQ address in Profile above to see your rings on a map. The
          distances below still apply.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {/* Ring 1 — the ring that FORCES ₱0 transport. */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="reach-ring1" className="text-sm text-ink">
              Free travel
            </label>
            <span className="text-sm font-medium text-ink">{ring1} km</span>
          </div>
          <input
            id="reach-ring1"
            type="range"
            min={0}
            max={ring2}
            step={1}
            value={ring1}
            onChange={(e) => setRing1(Number(e.target.value))}
            className="mt-1 w-full"
            aria-describedby="reach-ring1-note"
          />
          <p id="reach-ring1-note" className="text-xs" style={{ color: 'var(--m-slate)' }}>
            {ring1 === 0
              ? 'Off — you can charge transportation for every booking.'
              : `Inside ${ring1} km you can’t add a transportation charge — the couple’s quote says “Free Transportation.”`}
          </p>
        </div>

        {/* Ring 2 — tier-capped outer bound. */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="reach-ring2" className="text-sm text-ink">
              Willing to travel
            </label>
            <span className="text-sm font-medium text-ink">{ring2} km</span>
          </div>
          <input
            id="reach-ring2"
            type="range"
            min={0}
            max={capKm}
            step={1}
            value={ring2}
            onChange={(e) => onRing2(Number(e.target.value))}
            className="mt-1 w-full"
            aria-describedby="reach-ring2-note"
          />
          <p id="reach-ring2-note" className="text-xs" style={{ color: 'var(--m-slate)' }}>
            Your plan reaches up to {capKm} km.
            {ring2 >= capKm ? ' Upgrade to reach farther.' : null}
          </p>
        </div>
      </div>

      {dirty ? (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="mt-4 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'var(--m-orange-2)' }}
        >
          {pending ? 'Saving…' : 'Save coverage'}
        </button>
      ) : null}
    </div>
  );
}
