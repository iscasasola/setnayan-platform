'use client';

import { useState } from 'react';
import { activatePapicLimited } from './actions';
import { papicCapacityPhrase } from '@/lib/papic-tier-copy';

/**
 * Guest-camera tier picker (owner 2026-06-26 — "add the option to upgrade to
 * Unlimited"). The "a camera for every guest" card lets the couple run the WHOLE
 * guest list at either tier — Limited (the roll/Mini rung) or Unlimited.
 *
 * CAPACITY COPY IS DERIVED, NEVER SPELLED (owner 2026-07-20). Each tier's daily
 * budget is capture POINTS from the admin-editable papic_tier_config (1 photo =
 * 1 pt · 1 ten-second clip = 7 pts); the parent server component resolves it
 * and passes `pointsPerDay`, which `papicCapacityPhrase` turns into copy. The
 * previous hand-typed photos-plus-clips split was already false on both counts:
 * the enforced roll budget is far smaller than it promised, and clips and
 * photos draw on ONE shared purse, so neither number can be fixed.
 *
 * One control covers fresh activation AND a live upgrade/switch: pick a tier, hit
 * the button. When already live, keeping the current tier re-syncs (free, covers
 * late RSVPs); choosing the other tier upgrades/switches (posts the new tier to
 * activatePapicLimited, which supersedes the old snapshot + re-tiers the seats).
 *
 * Self-contained (only the server action import) so nothing server-only leaks in.
 */
function php(amount: number): string {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

type TierInfo = {
  billPhp: number;
  /** Flat per-camera rate (NOT per day — 2026-07-22 flat naming lock). */
  ratePhp: number;
  cameraCap: number;
  /** Daily capture-POINT budget from papic_tier_config. null = unlimited. */
  pointsPerDay: number | null;
};

function TierOption({
  tier,
  label,
  extra,
  info,
  selected,
  isCurrent,
  dayLabel,
  onSelect,
}: {
  tier: 'roll' | 'unlimited';
  label: string;
  /** Optional non-capacity note (capacity itself is derived from `info`). */
  extra?: string;
  info: TierInfo;
  selected: boolean;
  isCurrent: boolean;
  dayLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        selected
          ? 'flex w-full items-start gap-3 rounded-xl border-2 border-terracotta bg-terracotta/5 p-3 text-left'
          : 'flex w-full items-start gap-3 rounded-xl border border-ink/15 bg-cream/60 p-3 text-left hover:border-ink/25'
      }
    >
      <span
        aria-hidden
        className={
          selected
            ? 'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-terracotta'
            : 'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/30'
        }
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-terracotta" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{label}</span>
          {isCurrent ? (
            <span className="rounded-full bg-success-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-success-900">
              Current
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-ink/60">
          {papicCapacityPhrase(info.pointsPerDay)}
          {extra ? ` · ${extra}` : ''}
        </span>
        <span className="mt-1 block text-xs text-ink/55">
          {php(info.ratePhp)} / guest
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-medium tabular-nums text-ink">
          {php(info.billPhp)}
        </span>
        <span className="block text-[10px] text-ink/45">{dayLabel}</span>
      </span>
    </button>
  );
}

export default function GuestCameraTierPicker({
  eventId,
  guestCount,
  live,
  currentTier,
  dayLabel,
  limited,
  unlimited,
}: {
  eventId: string;
  guestCount: number;
  live: boolean;
  currentTier: 'roll' | 'unlimited' | null;
  dayLabel: string;
  limited: TierInfo;
  unlimited: TierInfo;
}) {
  const [tier, setTier] = useState<'roll' | 'unlimited'>(currentTier ?? 'roll');

  const sel = tier === 'unlimited' ? unlimited : limited;
  const overflow = Math.max(0, guestCount - sel.cameraCap);
  const sameAsCurrent = live && currentTier === tier;

  let label: string;
  if (!live) {
    label = `Ready for Papic — activate ${guestCount} guest camera${
      guestCount === 1 ? '' : 's'
    } · ${php(sel.billPhp)}`;
  } else if (sameAsCurrent) {
    label = 'Re-sync from guest list';
  } else if (tier === 'unlimited') {
    label = `Upgrade to Unlimited · ${php(sel.billPhp)}`;
  } else {
    label = `Switch to Limited · ${php(sel.billPhp)}`;
  }

  return (
    <form action={activatePapicLimited} className="mt-4 space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="tier" value={tier} readOnly />

      <div role="radiogroup" aria-label="Camera tier for the guest list" className="space-y-2">
        <TierOption
          tier="roll"
          label="Limited"
          info={limited}
          selected={tier === 'roll'}
          isCurrent={currentTier === 'roll'}
          dayLabel={dayLabel}
          onSelect={() => setTier('roll')}
        />
        <TierOption
          tier="unlimited"
          label="Unlimited"
          extra="archived to your Drive"
          info={unlimited}
          selected={tier === 'unlimited'}
          isCurrent={currentTier === 'unlimited'}
          dayLabel={dayLabel}
          onSelect={() => setTier('unlimited')}
        />
      </div>

      {overflow > 0 ? (
        <p className="text-xs text-amber-700">
          {overflow} guest{overflow === 1 ? '' : 's'} beyond the {sel.cameraCap}-camera
          cap at this tier — add Unlimited extras for them, or they shoot on the free tier.
        </p>
      ) : null}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
      >
        {label}
      </button>
      <p className="text-xs text-ink/50">
        {sameAsCurrent
          ? 'New “yes” RSVPs are added automatically — no extra charge.'
          : 'Apply-then-pay — payment instructions next. Edit your list any time; we freeze the price now and cover late guests free.'}
      </p>
    </form>
  );
}
