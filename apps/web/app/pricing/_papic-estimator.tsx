'use client';

/**
 * PapicEstimator — a DISPLAY-ONLY Papic price estimator for /pricing.
 *
 * ⚠ This widget NEVER touches checkout, payment, entitlements, or any server
 * action. It is pure client-side arithmetic over rates passed in as props so a
 * couple can eyeball what a Papic build would cost before they ever start an
 * order. The authoritative charge is always resolved server-side at order time
 * (lib/papic-cameras.ts · computeCameraQuote) — this is a marketing calculator,
 * not a purchase surface.
 *
 * EVERY number here arrives as a prop, derived server-side from the live
 * catalog + the admin-editable papic_tier_config (owner 2026-07-20 — "make
 * every Papic price/capacity claim honest and derived, never hardcoded"). This
 * file must never spell a rung, a photo/clip count, or a cap peso figure:
 *   • rungs        → publicPapicLadder(papic_tier_config)
 *   • capacity     → papicCapacityShort(points_per_day)
 *   • wedding cap  → papic_tier_config.wedding_day_cap_php, PER RUNG
 *   • free cameras → papic_tier_config.free.seats_per_event
 * `lib/papic-copy-guardrails.test.ts` fails CI if a literal creeps back.
 *
 * Cap semantics MIRROR computeCameraQuote: the cap clamps that tier's WHOLE
 * camera subtotal (cameras × rate × days — it is not multiplied by days), it
 * applies to WEDDINGS ONLY (every other event type bills the raw subtotal), and
 * it does NOT cover the one-time add-ons. The old widget applied ONE flat cap
 * figure to the whole build (both tiers, add-ons included, multiplied by days)
 * and claimed it "auto-upgraded to Unlimited with every booster included" —
 * neither was true of the charge path; both are gone.
 */

import { useState } from 'react';

export type EstimatorTier = {
  /** papic_tier_config.tier_code — used only as a React key / selection id. */
  key: string;
  /** papic_tier_config.display_title (e.g. "Papic Mini"). */
  label: string;
  /** Per-camera per-day rate from the tier's catalog rate SKU. */
  pricePhp: number;
  /** Derived capacity sentence (papicCapacityShort) — never written here. */
  capacity: string;
  /** WEDDING-only cap on this tier's camera subtotal. null = uncapped. */
  weddingCapPhp: number | null;
};

export type EstimatorRates = {
  /** Free cameras every event gets, from papic_tier_config.free.seats_per_event. */
  freeCameras: number;
  /** The public ladder, in sort order. Empty = the catalog is unreadable. */
  tiers: EstimatorTier[];
  /** Tickable one-time add-ons — label + price, resolved from the catalog. */
  addons: Array<{ key: string; label: string; price: number }>;
};

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function Stepper({
  value,
  onDec,
  onInc,
}: {
  value: string | number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-ink/15 bg-cream p-1">
      <button
        type="button"
        onClick={onDec}
        aria-label="Decrease"
        className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-ink/70 transition-colors hover:bg-ink/[0.05]"
      >
        −
      </button>
      <span className="min-w-[2ch] text-center text-base font-semibold tabular-nums text-ink">
        {value}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label="Increase"
        className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-ink/70 transition-colors hover:bg-ink/[0.05]"
      >
        +
      </button>
    </div>
  );
}

export function PapicEstimator({ rates }: { rates: EstimatorRates }) {
  const [tierKey, setTierKey] = useState<string>(rates.tiers[0]?.key ?? '');
  const [cameras, setCameras] = useState(10);
  const [days, setDays] = useState(1);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // No readable ladder → render nothing rather than an invented price.
  const tier = rates.tiers.find((t) => t.key === tierKey) ?? rates.tiers[0];
  if (!tier) return null;

  const rawCameraTotal = cameras * tier.pricePhp * days;
  // The wedding cap clamps the tier's WHOLE camera subtotal (mirrors
  // computeCameraQuote); other event types pay the raw subtotal.
  const cameraTotal =
    tier.weddingCapPhp != null
      ? Math.min(rawCameraTotal, tier.weddingCapPhp)
      : rawCameraTotal;
  const capped = tier.weddingCapPhp != null && rawCameraTotal > tier.weddingCapPhp;
  const addonsTotal = rates.addons.reduce(
    (sum, a) => (checked[a.key] ? sum + a.price : sum),
    0,
  );
  const total = cameraTotal + addonsTotal;

  return (
    <div className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        Build your Papic
      </p>
      <p className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
        Pick a tier, your cameras &amp; add-ons.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
        Your first {rates.freeCameras} camera{rates.freeCameras === 1 ? '' : 's'} are
        free. Beyond that Papic is priced per camera, per day — pick a tier, set
        your cameras and event days, and tick the add-ons you want. The total
        updates live. This is a rough estimate; set exact options in the app.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Papic tier
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {rates.tiers.map((t) => (
              <button
                type="button"
                key={t.key}
                onClick={() => setTierKey(t.key)}
                aria-pressed={t.key === tier.key}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  t.key === tier.key
                    ? 'border-terracotta bg-terracotta/[0.06]'
                    : 'border-ink/15 bg-cream hover:border-ink/30'
                }`}
              >
                <span className="block text-sm font-medium text-ink">{t.label}</span>
                <span className="mt-0.5 block font-mono text-xs text-ink/60">
                  {peso(t.pricePhp)}/cam·day
                </span>
                <span className="mt-1 block text-xs text-ink/55">{t.capacity}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Cameras · <span className="text-ink/70">{cameras}</span> guests shooting
          </label>
          <Stepper
            value={cameras}
            onDec={() => setCameras((c) => clamp(c - 10, 10, 500))}
            onInc={() => setCameras((c) => clamp(c + 10, 10, 500))}
          />
        </div>
        <div>
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Event days · <span className="text-ink/70">{days}</span>
          </label>
          <Stepper
            value={days}
            onDec={() => setDays((d) => clamp(d - 1, 1, 3))}
            onInc={() => setDays((d) => clamp(d + 1, 1, 3))}
          />
        </div>
      </div>

      {rates.addons.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Add-ons for Papic — tick what you want
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rates.addons.map((a) => {
              const on = Boolean(checked[a.key]);
              return (
                <button
                  type="button"
                  key={a.key}
                  onClick={() =>
                    setChecked((prev) => ({ ...prev, [a.key]: !prev[a.key] }))
                  }
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    on
                      ? 'border-terracotta/50 bg-terracotta/[0.06]'
                      : 'border-ink/15 bg-cream hover:border-ink/30'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                      on ? 'border-terracotta bg-terracotta text-cream' : 'border-ink/25'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="flex-1 text-sm text-ink">{a.label}</span>
                  <span className="font-mono text-xs text-ink/60">{peso(a.price)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2 rounded-xl border border-ink/10 bg-ink/[0.02] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">
              Papic · {tier.label}
              {capped ? (
                <span className="ml-2 inline-flex rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta">
                  wedding cap
                </span>
              ) : null}
            </p>
            <p className="text-xs text-ink/55">
              {cameras} cams × {peso(tier.pricePhp)} × {days}d
              {capped ? ` = ${peso(rawCameraTotal)}, capped` : ''}
            </p>
          </div>
          <p className="font-sans text-base font-medium tabular-nums text-ink/80">
            {peso(cameraTotal)}
          </p>
        </div>
        {rates.addons
          .filter((a) => checked[a.key])
          .map((a) => (
            <div key={a.key} className="flex items-baseline justify-between gap-3">
              <p className="text-xs text-ink/65">{a.label} · one-time</p>
              <p className="font-mono text-xs tabular-nums text-ink/65">
                {peso(a.price)}
              </p>
            </div>
          ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-ink/10 pt-3">
          <p className="text-sm font-semibold text-ink">Your total</p>
          <p className="font-sans text-2xl font-semibold tabular-nums text-ink">
            {peso(total)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/50">
        {tier.weddingCapPhp != null
          ? `For a wedding, your ${tier.label} cameras never total more than ${peso(
              tier.weddingCapPhp,
            )} — however many you add. Other event types are billed at the plain per-camera total. Add-ons are charged separately.`
          : `${tier.label} cameras are billed at the plain per-camera total. Add-ons are charged separately.`}{' '}
        Estimate only — no charge is made here.
      </p>
    </div>
  );
}
