'use client';

/**
 * PapicEstimator — a DISPLAY-ONLY Papic price estimator for /pricing.
 *
 * ⚠ This widget NEVER touches checkout, payment, entitlements, or any server
 * action. It is pure client-side arithmetic over rates passed in as props so a
 * couple can eyeball what a Papic build would cost before they ever start an
 * order. The authoritative charge is always resolved server-side at order time
 * (lib/v2-catalog.ts · resolvePaxPricedOrderCentavos) — this is a marketing
 * calculator, not a purchase surface.
 *
 * Every rate comes from the live catalog + papic_tier_config (passed by the
 * server page) — nothing here is hardcoded except the graceful fallbacks that
 * only surface if a row is missing from the DB. The model mirrors the
 * couple-facing Papic ladder (owner 2026-07-20):
 *   • THREE rungs — Mini · Ltd · Unli — each a per-camera, per-day rate with its
 *     own wedding cap (Mini ₱6,000 · Ltd ₱10,000 · Unli ₱15,000). The camera
 *     line locks at the CHOSEN rung's cap, exactly like computeCameraQuote does
 *     at order time.
 *   • plus one-time add-ons the couple ticks
 *   • the WHOLE build is capped at ₱capPerDay/day → beyond the cap it locks as
 *     "Unlimited + all boosters included", so it never costs more than the
 *     get-everything price.
 */

import { useState } from 'react';

export type EstimatorRung = {
  key: 'mini' | 'ltd' | 'unli';
  /** Display title from papic_tier_config (e.g. "Papic Mini"). */
  label: string;
  /** Per-camera per-day rate from the catalog. */
  rate: number;
  /** This rung's wedding order cap. */
  cap: number;
  /** Daily capture-points budget · null = unlimited. */
  pointsPerDay: number | null;
};

export type EstimatorRates = {
  /** The ladder, entry rung first — resolved server-side. */
  rungs: EstimatorRung[];
  /** Free cameras every event gets (PAPIC_FREE_CAMERA_COUNT, passed in). */
  freeCameras: number;
  /** The whole-build daily cap (₱/day). */
  capPerDay: number;
  /** Tickable one-time add-ons — label + price, resolved from the catalog. */
  addons: Array<{ key: string; label: string; price: number }>;
};

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function PapicEstimator({ rates }: { rates: EstimatorRates }) {
  const [tierKey, setTierKey] = useState<string>(rates.rungs[0]?.key ?? 'mini');
  const [cameras, setCameras] = useState(10);
  const [days, setDays] = useState(1);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const rung = rates.rungs.find((r) => r.key === tierKey) ?? rates.rungs[0];
  const rate = rung?.rate ?? 0;
  // Mirror computeCameraQuote: the camera line locks at the CHOSEN rung's cap.
  const papicRaw = cameras * rate * days;
  const papicTotal = rung ? Math.min(papicRaw, rung.cap) : papicRaw;
  const rungCapped = papicRaw > papicTotal;
  const selectedSum = rates.addons.reduce(
    (sum, a) => (checked[a.key] ? sum + a.price : sum),
    0,
  );
  const capValue = rates.capPerDay * days;
  const capped = papicTotal + selectedSum >= capValue;
  const total = capped ? capValue : papicTotal + selectedSum;

  const seg = (r: EstimatorRung) => (
    <button
      key={r.key}
      type="button"
      onClick={() => setTierKey(r.key)}
      aria-pressed={tierKey === r.key}
      className={`flex-1 rounded-full px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
        tierKey === r.key
          ? 'bg-ink text-cream'
          : 'bg-transparent text-ink/60 hover:text-ink'
      }`}
    >
      {r.label.replace(/^Papic /, '')} · {peso(r.rate)}
    </button>
  );

  const Stepper = ({
    value,
    onDec,
    onInc,
  }: {
    value: string | number;
    onDec: () => void;
    onInc: () => void;
  }) => (
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

  return (
    <div className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        Build your Papic
      </p>
      <p className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
        Pick a tier, your cameras &amp; add-ons.
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
        Papic is priced per camera, per day. Your first {rates.freeCameras}{' '}
        cameras are free — beyond that, choose a tier, set your cameras and event
        days, and tick the add-ons you want; the total updates live. This is a
        rough estimate; set exact options in the app.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Papic tier · per camera, per day
          </label>
          <div className="flex gap-1 rounded-full border border-ink/15 bg-cream p-1">
            {rates.rungs.map(seg)}
          </div>
          {rung ? (
            <p className="mt-2 text-xs text-ink/55">
              {rung.pointsPerDay == null
                ? 'No shot limit · archived to your Drive.'
                : `${rung.pointsPerDay} capture points a day per camera — ${rung.pointsPerDay} photos, or ${Math.floor(rung.pointsPerDay / 3)} five-second clips.`}{' '}
              Weddings cap at {peso(rung.cap)} for this tier.
            </p>
          ) : null}
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
              const on = capped || checked[a.key];
              return (
                <button
                  type="button"
                  key={a.key}
                  disabled={capped}
                  onClick={() =>
                    setChecked((prev) => ({ ...prev, [a.key]: !prev[a.key] }))
                  }
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    on
                      ? 'border-terracotta/50 bg-terracotta/[0.06]'
                      : 'border-ink/15 bg-cream hover:border-ink/30'
                  } ${capped ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                      on
                        ? 'border-terracotta bg-terracotta text-cream'
                        : 'border-ink/25'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="flex-1 text-sm text-ink">{a.label}</span>
                  <span className="font-mono text-xs text-ink/60">
                    {capped ? 'included' : peso(a.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2 rounded-xl border border-ink/10 bg-ink/[0.02] p-5">
        {capped ? (
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">
                Papic · Unlimited{' '}
                <span className="ml-1 inline-flex rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta">
                  auto-upgraded
                </span>
              </p>
              <p className="text-xs text-ink/55">
                Every camera · everything included × {days}d
              </p>
            </div>
            <p className="font-sans text-lg font-semibold tabular-nums text-ink">
              {peso(capValue)}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {rung?.label ?? 'Papic'}
                </p>
                <p className="text-xs text-ink/55">
                  {cameras} cams × {peso(rate)} × {days}d
                  {rungCapped ? ` · locked at the ${peso(rung!.cap)} cap` : ''}
                </p>
              </div>
              <p className="font-sans text-base font-medium tabular-nums text-ink/80">
                {peso(papicTotal)}
              </p>
            </div>
            {rates.addons
              .filter((a) => checked[a.key])
              .map((a) => (
                <div
                  key={a.key}
                  className="flex items-baseline justify-between gap-3"
                >
                  <p className="text-xs text-ink/65">{a.label} · one-time</p>
                  <p className="font-mono text-xs tabular-nums text-ink/65">
                    {peso(a.price)}
                  </p>
                </div>
              ))}
          </>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-ink/10 pt-3">
          <p className="text-sm font-semibold text-ink">Your total</p>
          <p className="font-sans text-2xl font-semibold tabular-nums text-ink">
            {peso(total)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/50">
        Your whole Papic build — cameras plus every add-on — is capped at{' '}
        {peso(rates.capPerDay)}/day. The moment it reaches that, it locks there
        as Unlimited with every booster included, so you never pay more than the
        &ldquo;get everything&rdquo; price. Estimate only — no charge is made
        here.
      </p>
    </div>
  );
}
