'use client';

import { useState } from 'react';
import { purchasePapicCameras } from './actions';

/**
 * Papic per-camera buy picker (PR2). Two steppers (Roll / Unlimited), a live
 * cost total clamped to the event cost cap, the 5-camera-minimum gate, and a
 * form that posts to the purchasePapicCameras server action (apply-then-pay).
 * Free funnel cameras are separate — this is the PAID upgrade.
 *
 * Fully self-contained (no lib imports beyond the server action) so nothing in
 * a server-only transitive import chain can leak into the client bundle.
 */
const MIN_PAID = 5; // mirrors PAPIC_MIN_PAID_CAMERAS

function php(amount: number): string {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function Stepper({
  label,
  hint,
  perDay,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  perDay: number;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs text-ink/55">{hint}</div>
        <div className="text-xs text-ink/55">{php(perDay)} / camera / day</div>
      </div>
      <div className="flex items-center gap-2">
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
    </div>
  );
}

export default function CameraPicker({
  eventId,
  rollRate,
  unlimitedRate,
  ltdCapPhp,
  unliCapPhp,
}: {
  eventId: string;
  rollRate: number;
  unlimitedRate: number;
  ltdCapPhp: number;
  unliCapPhp: number;
}) {
  const [roll, setRoll] = useState(0);
  const [unlimited, setUnlimited] = useState(0);

  const paidCount = roll + unlimited;
  // Per-tier cap (owner 2026-06-26): Ltd locks at ₱6,000, Unli at ₱10,000, each
  // tier independently. Mirrors computeCameraQuote on the server.
  const ltdRaw = roll * rollRate;
  const unliRaw = unlimited * unlimitedRate;
  const ltdCharge = Math.min(ltdRaw, ltdCapPhp);
  const unliCharge = Math.min(unliRaw, unliCapPhp);
  const rawTotal = ltdRaw + unliRaw;
  const total = ltdCharge + unliCharge;
  const capped = ltdRaw > ltdCapPhp || unliRaw > unliCapPhp;
  const belowMin = paidCount > 0 && paidCount < MIN_PAID;
  const canBuy = paidCount >= MIN_PAID;

  return (
    <form action={purchasePapicCameras} className="flex flex-col gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="roll" value={roll} readOnly />
      <input type="hidden" name="unlimited" value={unlimited} readOnly />

      <Stepper
        label="Ltd"
        hint="30 photos + 10 videos each, per day"
        perDay={rollRate}
        value={roll}
        onChange={setRoll}
      />
      <Stepper
        label="Unli"
        hint="No limit — archived to your Drive"
        perDay={unlimitedRate}
        value={unlimited}
        onChange={setUnlimited}
      />

      <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
        <span className="text-sm text-ink/60">
          {paidCount} camera{paidCount === 1 ? '' : 's'} · 1 day
        </span>
        <span className="text-lg font-medium tabular-nums text-ink">{php(total)}</span>
      </div>

      {capped ? (
        <p className="text-xs text-ink/55">
          Price locked — Ltd caps at {php(ltdCapPhp)}, Unli at {php(unliCapPhp)}{' '}
          (would be {php(rawTotal)}).
        </p>
      ) : null}

      {belowMin ? (
        <p className="text-xs text-amber-700">
          Minimum {MIN_PAID} cameras — add {MIN_PAID - paidCount} more.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canBuy}
        className="w-full rounded-md bg-mulberry px-4 py-3 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {canBuy ? `Get ${paidCount} cameras · ${php(total)}` : 'Add at least 5 cameras'}
      </button>
      <p className="text-center text-xs text-ink/50">
        Apply-then-pay — you’ll get payment instructions next. Face-sorting &amp;
        privacy are free.
      </p>
    </form>
  );
}
