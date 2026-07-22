'use client';

import { useState } from 'react';
import { purchasePapicExtras } from './actions';

/**
 * Papic extra-cameras picker — the THREE-rung ladder (owner 2026-07-20).
 *
 * The only way to add a camera for a shooter who is NOT on the guest list (a
 * videographer friend, a hired second shooter). Off the list there's no guest
 * record, so these are anonymous claim-link seats — but they now span the full
 * ladder rather than Unlimited-only:
 *
 *     Papic Mini  · ₱30/camera/day · 20 capture points a day
 *     Papic Ltd   · ₱50/camera/day · 70 capture points a day
 *     Papic Unli · ₱100/camera/day · no limit, archived to Drive
 *
 * ⚠ Every label, per-day budget, rate and cap arrives as a PROP resolved
 * server-side from papic_tier_config + platform_retail_catalog_v2 — nothing
 * about the ladder is hardcoded here, so the owner can settle prices/titles in
 * the DB without touching this file. The quote math mirrors computeCameraQuote
 * (lib/papic-cameras.ts) exactly: per-rung min(count × rate, rung cap), summed.
 * FLAT per camera — the capture-window length is NOT a price multiplier
 * (2026-07-22 naming lock; matches /pricing _papic-estimator.tsx).
 *
 * Self-contained (only the server action import) so nothing server-only leaks
 * into the client bundle.
 */
function php(amount: number): string {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** One rung as the server resolved it. `rung` is the posted form field name. */
export type ExtraCameraRung = {
  rung: 'mini' | 'ltd' | 'unlimited';
  /** papic_tier_config.display_title — e.g. "Papic Mini". */
  title: string;
  /** Live per-camera-per-day rate from the catalog. */
  ratePhp: number;
  /** papic_tier_config.points_per_day · null = unlimited. */
  pointsPerDay: number | null;
  /** Wedding-only order cap for this rung (Number.MAX_SAFE_INTEGER = uncapped). */
  capPhp: number;
  /** An unlock pass covers this rung → ₱0 and never capped. */
  free: boolean;
};

/** "20 points a day — 20 photos, or 6 clips" / "No limit". */
function budgetLine(rung: ExtraCameraRung): string {
  if (rung.pointsPerDay == null) {
    return 'No limit · archived to your Drive';
  }
  const clips = Math.floor(rung.pointsPerDay / 3);
  return `${rung.pointsPerDay} points a day — ${rung.pointsPerDay} photos, or ${clips} clips`;
}

function Stepper({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label={`Remove one ${label} camera`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-8 w-8 rounded-full border border-ink/15 text-lg leading-none text-ink"
      >
        −
      </button>
      <span className="w-6 text-center text-sm font-medium tabular-nums text-ink">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Add one ${label} camera`}
        onClick={() => onChange(value + 1)}
        className="h-8 w-8 rounded-full border border-ink/15 text-lg leading-none text-ink"
      >
        +
      </button>
    </div>
  );
}

export default function ExtraCamerasPicker({
  eventId,
  rungs,
  days = 1,
  windowSummary = '',
}: {
  eventId: string;
  /** The ladder, entry rung first. Server-resolved — see ExtraCameraRung. */
  rungs: ExtraCameraRung[];
  /**
   * Capture-window length (days) — informational only (how long the cameras
   * shoot). NOT a price multiplier: the charge is FLAT count × rate (2026-07-22
   * naming lock), matching /pricing.
   */
  days?: number;
  /** Human window label, e.g. "Jun 12–14 · 3 days". */
  windowSummary?: string;
}) {
  // Start with one camera on the entry rung so the primary action is never a
  // no-op (mirrors the old Unlimited-only picker's `useState(1)`).
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    rungs.length > 0 ? { [rungs[0]!.rung]: 1 } : {},
  );

  const d = Math.max(1, Math.floor(days) || 1);
  const lines = rungs.map((r) => {
    const count = counts[r.rung] ?? 0;
    // FLAT: count × rate. The window length `d` never multiplies the price
    // (2026-07-22 flat naming lock) — it only labels the coverage span below.
    const raw = count * r.ratePhp;
    const charge = r.free ? 0 : Math.min(raw, r.capPhp);
    return { rung: r, count, raw, charge, capped: !r.free && raw > r.capPhp };
  });
  const total = lines.reduce((s, l) => s + l.charge, 0);
  const totalCameras = lines.reduce((s, l) => s + l.count, 0);
  const free = total === 0;
  const dayLabel = windowSummary || `${d} day${d === 1 ? '' : 's'}`;
  const cappedLines = lines.filter((l) => l.capped);

  return (
    <form action={purchasePapicExtras} className="flex flex-col gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      {rungs.map((r) => (
        <input
          key={r.rung}
          type="hidden"
          name={r.rung}
          value={counts[r.rung] ?? 0}
          readOnly
        />
      ))}

      <div
        role="group"
        aria-label="Extra cameras by tier"
        className="flex flex-col gap-2"
      >
        {lines.map(({ rung, count }) => (
          <div
            key={rung.rung}
            className={
              count > 0
                ? 'flex items-center justify-between gap-3 rounded-lg border-2 border-terracotta/60 bg-terracotta/5 p-3'
                : 'flex items-center justify-between gap-3 rounded-lg border border-ink/10 p-3'
            }
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{rung.title}</div>
              <div className="text-xs text-ink/55">{budgetLine(rung)}</div>
              <div className="mt-0.5 text-xs text-ink/55">
                {rung.free
                  ? 'Free with your unlock pass'
                  : `${php(rung.ratePhp)} / camera`}
              </div>
            </div>
            <Stepper
              value={count}
              label={rung.title}
              onChange={(next) =>
                setCounts((prev) => ({ ...prev, [rung.rung]: next }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink/60">
          {totalCameras} extra camera{totalCameras === 1 ? '' : 's'} · {dayLabel}
        </span>
        <span className="text-lg font-medium tabular-nums text-ink">
          {free ? 'Free' : php(total)}
        </span>
      </div>

      {cappedLines.map((l) => (
        <p key={l.rung.rung} className="text-xs text-ink/55">
          Price locked — {l.rung.title} caps at {php(l.rung.capPhp)} (would be{' '}
          {php(l.raw)}).
        </p>
      ))}

      <button
        type="submit"
        disabled={totalCameras < 1}
        className="w-full rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {totalCameras < 1
          ? 'Pick at least one camera'
          : free
            ? `Add ${totalCameras} extra camera${totalCameras === 1 ? '' : 's'} · Free`
            : `Add ${totalCameras} extra camera${totalCameras === 1 ? '' : 's'} · ${php(total)}`}
      </button>
      <p className="text-center text-xs text-ink/50">
        {free
          ? 'Each gets a claim link to share. Activates right away.'
          : 'Apply-then-pay — payment instructions next. Each gets a claim link to share.'}
      </p>
    </form>
  );
}
