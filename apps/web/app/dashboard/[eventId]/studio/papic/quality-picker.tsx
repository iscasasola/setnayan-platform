'use client';

import { Check, Lock } from 'lucide-react';
import {
  PAPIC_FIDELITY_TIERS,
  asPapicFidelityTier,
  type PapicFidelityTier,
} from '@/lib/papic-fidelity';
import { setPapicQualityTier } from './actions';

/**
 * Papic photo-quality picker (couple-side setup) — brief PR-4's WRITE seam.
 *
 * The couple picks ONE fidelity tier here; it lands in
 * `events.papic_quality_tier` (via setPapicQualityTier) — the exact column the
 * capture ingest reads (lib/papic-ingest-fidelity.ts). Same form-per-card
 * idiom as StylePicker.
 *
 * Weddings default to Optimal (~12 MP — phone-native, prints to A3), so the
 * Optimal card carries a "Recommended" badge when `recommendOptimal` is set.
 * The stored/DB default stays Full resolution (pre-PR-4 behavior) until the
 * couple actively chooses.
 *
 * Downscale confirm (open-risks invariant "irreversible fidelity downscale
 * confirm"): choosing a downscaling tier means NEW photos won't retain a
 * bigger original, so those submissions ask for confirmation first. Moving
 * back to Full resolution never destroys anything → no confirm.
 */

const DOWNSCALE_CONFIRM =
  'Photos captured after this change will be stored at this size — the larger ' +
  'original of those photos is not kept. Photos already uploaded are not ' +
  'affected. Continue?';

export default function QualityPicker({
  eventId,
  current,
  recommendOptimal,
}: {
  eventId: string;
  current: string;
  recommendOptimal: boolean;
}) {
  const active: PapicFidelityTier = asPapicFidelityTier(current);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {PAPIC_FIDELITY_TIERS.map((t) => {
        const isActive = t.id === active;
        const isRecommended = recommendOptimal && t.id === 'optimal';
        const needsConfirm = t.id !== 'full_res' && !isActive;
        return (
          <form
            key={t.id}
            action={setPapicQualityTier}
            onSubmit={(e) => {
              if (needsConfirm && !window.confirm(DOWNSCALE_CONFIRM)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="quality_tier" value={t.id} />
            <button
              type="submit"
              aria-pressed={isActive}
              aria-label={`Set photo quality to ${t.label} — ${t.blurb}`}
              className={`relative flex h-full w-full flex-col gap-1 rounded-xl border p-3 text-left transition ${
                isActive
                  ? 'border-mulberry ring-2 ring-mulberry/30'
                  : 'border-ink/10 hover:border-ink/25'
              }`}
            >
              {isActive ? (
                <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-mulberry text-cream">
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              ) : null}
              <span className="flex items-center gap-2 pr-7">
                <span className="text-sm font-medium text-ink">{t.label}</span>
                {isRecommended ? (
                  <span className="rounded-full bg-mulberry/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mulberry">
                    Recommended
                  </span>
                ) : null}
              </span>
              <span className="text-xs leading-snug text-ink/55">{t.blurb}</span>
              <span className="mt-auto text-[11px] font-medium text-ink/45">
                {t.spec}
              </span>
            </button>
          </form>
        );
      })}
      <p className="col-span-full mt-1 flex items-center gap-1.5 text-xs text-ink/50">
        <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Applies to photos captured after you change it — photos already in your
        gallery are never re-processed. Video clips always record at 1080p.
      </p>
    </div>
  );
}
