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
 *   ⚠ Papic One is GONE (owner 2026-08-26: "no 2 ways of papic service.
 *     just 1"). Setting shots aside for one camera is a FEATURE of the single
 *     pot, done inside the event — never a second thing to buy here.
 *   • Papic — ONE pot of shots the whole celebration draws from, a flat pass
 *     per bucket (3,000 / 6,000 / 10,000 shots).
 * The old per-camera × rate × days engine (and the per-tier wedding cap it
 * applied to the removed "Papic Max" rung) is gone.
 *
 * EVERY number here arrives as a prop, derived server-side from the live
 * catalog + the admin-editable papic_tier_config (owner 2026-07-20 — "make
 * every Papic price/capacity claim honest and derived, never hardcoded"). This
 * file must never spell a rung, a photo/clip count, or a free-camera count:
 *   • Papic shot pots   → platform_retail_catalog_v2 (PAPIC_GUEST*)
 *   • free ONE camera    → PAPIC_FREE_ONE_CAMERA_COUNT (structural) +
 *                          papic_event_pool_config.free_one_camera_points
 * `lib/papic-copy-guardrails.test.ts` fails CI if a literal creeps back.
 */

import { useState } from 'react';

/** One shot pot (a flat bucket price). */
export type EstimatorPoolBucket = {
  /** platform_retail_catalog_v2 service_code — React key / selection id. */
  key: string;
  /** Bucket label (e.g. "3,000 shots"), derived from the catalog title. */
  label: string;
  /** Flat pass price. */
  pricePhp: number;
};

export type EstimatorRates = {
  /** The shot pots, in price order. Empty = none active. */
  pool: EstimatorPoolBucket[];
  /** Tickable one-time add-ons — label + price, resolved from the catalog. */
  addons: Array<{ key: string; label: string; price: number }>;
};


const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

export function PapicEstimator({ rates }: { rates: EstimatorRates }) {
  const hasPool = rates.pool.length > 0;

  const [bucketKey, setBucketKey] = useState<string>(rates.pool[0]?.key ?? '');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Nothing readable → render nothing rather than an invented price.
  if (!hasPool) return null;

  const bucket = rates.pool.find((b) => b.key === bucketKey) ?? rates.pool[0];
  const productTotal = bucket ? bucket.pricePhp : 0;

  const addonsTotal = rates.addons.reduce(
    (sum, a) => (checked[a.key] ? sum + a.price : sum),
    0,
  );
  const total = productTotal + addonsTotal;

  // Summary line — computed with narrowing so no non-null assertions are needed.
  let productLabel = '';
  let productDetail = '';
  if (bucket) {
    productLabel = `Papic · ${bucket.label}`;
    productDetail = 'One pot of shots for the whole celebration';
  }

  return (
    <div className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        Build your Papic
      </p>
      <p className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
        Estimate your Papic — one pot of shots for the whole celebration.
      </p>

      {/* ⚠ THERE IS NO PRODUCT TOGGLE, AND THERE MUST NEVER BE ONE AGAIN.
          Owner, 2026-08-26: *"we do not have papic one or papic pool. no 2
          ways of papic service. just 1. papic pool will be our papic service.
          this was documented before already."* (First locked 2026-08-11.)

          What used to sit here was a two-way switch between "A camera of its
          own" and "Papic", plus a whole flat-per-camera branch. It has not
          RENDERED on the live page for some time — it draws itself only when
          both catalog rungs are active, and the dedicated-camera rung is
          `is_active = false` in production ("Dedicated camera (legacy)"). But
          it was one catalog flip away from offering a fork the owner has ruled
          does not exist, so it is deleted rather than left armed.

          🔑 GIVING ONE CAMERA ITS OWN SHOTS IS A FEATURE OF THIS ONE PRODUCT,
          NOT AN ALTERNATIVE TO IT. Owner: *"they just alot some photos for a
          specific Papic. so for example they get 3000 photos. and then they can
          assign the 500 photos to 1 papic."* That ships — `setCameraShots`
          writes it and `papic_reserve_capture_split` spends the camera's own
          allocation first, then the pot, under one row lock. Dedicated shots
          are a FLOOR, never a ceiling. The estimator prices the pot; the
          allocation happens later, inside the event. */}

      {/* The shot pots — flat buckets. */}
      {bucket ? (
        <div className="mt-6">
          <p className="max-w-2xl text-sm leading-relaxed text-ink/65">
            Papic is one pot of shots the whole celebration draws from &mdash; every
            camera, every guest, no per-camera maths. Pick your pot below. You can
            set some of it aside for a particular camera later, and take back
            whatever they don&rsquo;t use.
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
        Papic is one pot of shots for the whole celebration. Cameras are free and
        unlimited; add-ons are charged separately.{' '}
        Estimate only — no charge is made here.
      </p>
    </div>
  );
}
