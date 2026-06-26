'use client';

import { useState } from 'react';
import { activatePapicLimited } from './actions';

/**
 * Guest-camera tier picker (owner 2026-06-26 — "add the option to upgrade to
 * Unlimited"). The "a camera for every guest" card lets the couple run the WHOLE
 * guest list at either tier:
 *   • Limited   — ₱30/guest/day · 30 photos + 10 clips each · capped
 *   • Unlimited — ₱100/guest/day · no shot limit · archived to Drive · capped
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

type TierInfo = { billPhp: number; perDayPhp: number; cameraCap: number };

function TierOption({
  tier,
  label,
  includes,
  info,
  selected,
  isCurrent,
  onSelect,
}: {
  tier: 'roll' | 'unlimited';
  label: string;
  includes: string;
  info: TierInfo;
  selected: boolean;
  isCurrent: boolean;
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
        <span className="mt-0.5 block text-xs text-ink/60">{includes}</span>
        <span className="mt-1 block text-xs text-ink/55">
          {php(info.perDayPhp)} / guest / day
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-medium tabular-nums text-ink">
          {php(info.billPhp)}
        </span>
        <span className="block text-[10px] text-ink/45">1 day</span>
      </span>
    </button>
  );
}

export default function GuestCameraTierPicker({
  eventId,
  guestCount,
  live,
  currentTier,
  limited,
  unlimited,
}: {
  eventId: string;
  guestCount: number;
  live: boolean;
  currentTier: 'roll' | 'unlimited' | null;
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
          includes="30 photos + 10 clips each, per day"
          info={limited}
          selected={tier === 'roll'}
          isCurrent={currentTier === 'roll'}
          onSelect={() => setTier('roll')}
        />
        <TierOption
          tier="unlimited"
          label="Unlimited"
          includes="No shot limit · archived to your Drive"
          info={unlimited}
          selected={tier === 'unlimited'}
          isCurrent={currentTier === 'unlimited'}
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
