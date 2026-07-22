'use client';

/**
 * PapicEstimator — a DISPLAY-ONLY Papic price estimator for /pricing.
 *
 * ⚠ This widget NEVER touches checkout, payment, entitlements, or any server
 * action. It is pure client-side arithmetic over rates passed in as props so a
 * couple can eyeball what a Papic build would cost before they ever start an
 * order. The authoritative charge is always resolved server-side at order time.
 *
 * FLAT MODEL (2026-07-22 naming lock · migration 20270830568357). Papic is two
 * products, both flat-priced — no per-day multiplier, no per-tier wedding cap:
 *   • Papic One  — dedicated cameras, a flat price PER CAMERA (first N free).
 *   • Papic Pool — one shared shot pool for every guest's phone, a flat pass
 *     per bucket (3,000 / 6,000 / 10,000 shots).
 * The old per-camera × rate × days engine (and the per-tier wedding cap it
 * applied to the removed "Papic Max" rung) is gone.
 *
 * EVERY number here arrives as a prop, derived server-side from the live
 * catalog + the admin-editable papic_tier_config (owner 2026-07-20 — "make
 * every Papic price/capacity claim honest and derived, never hardcoded"). This
 * file must never spell a rung, a photo/clip count, or a free-camera count:
 *   • Papic One price + capacity → papic_tier_config + papicCapacityShort()
 *   • Papic Pool buckets         → platform_retail_catalog_v2 (PAPIC_GUEST*)
 *   • free cameras               → papic_tier_config.free.seats_per_event
 * `lib/papic-copy-guardrails.test.ts` fails CI if a literal creeps back.
 */

import { useState } from 'react';

/** Papic One — the dedicated-camera product (flat, per camera, no days). */
export type EstimatorOne = {
  /** papic_tier_config.display_title — "Papic One". */
  label: string;
  /** Flat price per camera, from the tier's catalog rate SKU. */
  pricePhp: number;
  /** Derived capacity sentence (papicCapacityShort) — never written here. */
  capacity: string;
};

/** Papic Pool — one shared shot-pool pass (a flat bucket price). */
export type EstimatorPoolBucket = {
  /** platform_retail_catalog_v2 service_code — React key / selection id. */
  key: string;
  /** Bucket label (e.g. "3,000 shots"), derived from the catalog title. */
  label: string;
  /** Flat pass price. */
  pricePhp: number;
};

export type EstimatorRates = {
  /** Free cameras every event gets, from papic_tier_config.free.seats_per_event. */
  freeCameras: number;
  /** Papic One — the dedicated-camera rung. null = the ladder is unreadable. */
  one: EstimatorOne | null;
  /** Papic Pool — the shared-pool buckets, in price order. Empty = none active. */
  pool: EstimatorPoolBucket[];
  /** Tickable one-time add-ons — label + price, resolved from the catalog. */
  addons: Array<{ key: string; label: string; price: number }>;
};

type Mode = 'one' | 'pool';

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
  const hasOne = rates.one != null;
  const hasPool = rates.pool.length > 0;

  const [mode, setMode] = useState<Mode>(hasOne ? 'one' : 'pool');
  const [cameras, setCameras] = useState(5);
  const [bucketKey, setBucketKey] = useState<string>(rates.pool[0]?.key ?? '');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Nothing readable → render nothing rather than an invented price.
  if (!hasOne && !hasPool) return null;

  // A selected mode that isn't available falls back to the one that is.
  const effectiveMode: Mode =
    mode === 'one' ? (hasOne ? 'one' : 'pool') : hasPool ? 'pool' : 'one';

  const one = rates.one;
  const bucket = rates.pool.find((b) => b.key === bucketKey) ?? rates.pool[0];

  // Papic One: the first `freeCameras` are free; only the rest are billed.
  const paidCameras = Math.max(0, cameras - rates.freeCameras);
  const productTotal =
    effectiveMode === 'one' && one
      ? paidCameras * one.pricePhp
      : bucket
        ? bucket.pricePhp
        : 0;

  const addonsTotal = rates.addons.reduce(
    (sum, a) => (checked[a.key] ? sum + a.price : sum),
    0,
  );
  const total = productTotal + addonsTotal;

  // Summary line — computed with narrowing so no non-null assertions are needed.
  let productLabel = '';
  let productDetail = '';
  if (effectiveMode === 'one' && one) {
    productLabel = `Papic · ${one.label}`;
    productDetail = `${cameras} camera${cameras === 1 ? '' : 's'} · first ${rates.freeCameras} free · ${paidCameras} × ${peso(one.pricePhp)}`;
  } else if (bucket) {
    productLabel = `Papic · ${bucket.label}`;
    productDetail = 'One shared pass for the whole event';
  }

  return (
    <div className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        Build your Papic
      </p>
      <p className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
        Estimate your Papic — dedicated cameras or a shared pool.
      </p>

      {/* Product toggle — only when both are available */}
      {hasOne && hasPool ? (
        <div className="mt-5 inline-flex rounded-full border border-ink/15 bg-cream p-1">
          {(['one', 'pool'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={effectiveMode === m}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                effectiveMode === m
                  ? 'bg-terracotta text-cream'
                  : 'text-ink/70 hover:bg-ink/[0.05]'
              }`}
            >
              {m === 'one' ? (one?.label ?? 'Papic One') : 'Papic Pool'}
            </button>
          ))}
        </div>
      ) : null}

      {/* Papic One — flat per-camera */}
      {effectiveMode === 'one' && one ? (
        <div className="mt-6">
          <p className="max-w-2xl text-sm leading-relaxed text-ink/65">
            {one.label} is a flat {peso(one.pricePhp)} per camera for the friends
            or family you trust. Your first {rates.freeCameras}{' '}
            camera{rates.freeCameras === 1 ? '' : 's'} are free — beyond that,
            add as many as you like. Each camera shoots {one.capacity}.
          </p>
          <div className="mt-5">
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Cameras · <span className="text-ink/70">{cameras}</span> dedicated
              shooters
            </label>
            <Stepper
              value={cameras}
              onDec={() => setCameras((c) => clamp(c - 1, 1, 50))}
              onInc={() => setCameras((c) => clamp(c + 1, 1, 50))}
            />
          </div>
        </div>
      ) : null}

      {/* Papic Pool — flat bucket */}
      {effectiveMode === 'pool' && bucket ? (
        <div className="mt-6">
          <p className="max-w-2xl text-sm leading-relaxed text-ink/65">
            Papic Pool is one shared pass every guest&rsquo;s phone draws from —
            no per-camera math. Pick your shot pool; the whole event shares it.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {rates.pool.map((b) => (
              <button
                type="button"
                key={b.key}
                onClick={() => setBucketKey(b.key)}
                aria-pressed={b.key === bucket.key}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  b.key === bucket.key
                    ? 'border-terracotta bg-terracotta/[0.06]'
                    : 'border-ink/15 bg-cream hover:border-ink/30'
                }`}
              >
                <span className="block text-sm font-medium text-ink">{b.label}</span>
                <span className="mt-0.5 block font-mono text-xs text-ink/60">
                  {peso(b.pricePhp)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
            <p className="text-sm font-medium text-ink">{productLabel}</p>
            <p className="text-xs text-ink/55">{productDetail}</p>
          </div>
          <p className="font-sans text-base font-medium tabular-nums text-ink/80">
            {peso(productTotal)}
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
        {effectiveMode === 'one'
          ? `Papic One is a flat per-camera price with your first ${rates.freeCameras} free — no per-day or per-hour math. Add-ons are charged separately.`
          : 'Papic Pool is one flat pass for the whole event. Add-ons are charged separately.'}{' '}
        Estimate only — no charge is made here.
      </p>
    </div>
  );
}
