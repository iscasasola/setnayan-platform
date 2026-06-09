'use client';

/**
 * AccordionBuildButton — the Shortlist card's primary CTA in the 0016 Plan
 * Builder: "Add to build" (and its "✓ In your build" / Remove state).
 *
 * This REPLACES the old "Lock this pick" on the Shortlist card (owner 2026-06-09).
 * Adding to the build is a soft, reversible pick — it writes `event_build_picks`
 * (one vendor per category) via setBuildPick, NOT the hardened finalizeVendor.
 * The hardened lock (conflict + soft-hold gates) relocates to the Lock tab,
 * where each build pick gets a "Lock to confirm" button (the same
 * `AccordionLockButton`, finalizeVendor unchanged).
 *
 * When the category already has a DIFFERENT build pick, tapping "Add to build"
 * opens the Replace / Add-both popup (prototype): both stay shortlisted; only
 * the single build-pick pointer moves. The popup portals to <body> because the
 * card carries the rail's coverflow `transform` (which would trap position:fixed).
 */

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Hammer, Check, X } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { setBuildPick, removeBuildPick } from '../build-pick-actions';

const peso = (php: number | null | undefined) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;

function portal(node: React.ReactNode) {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

export function AccordionBuildButton({
  eventId,
  groupId,
  groupLabel,
  vendorId,
  vendorName,
  isBuildPick,
  existing,
}: {
  eventId: string;
  groupId: string;
  groupLabel: string;
  vendorId: string;
  vendorName: string;
  /** Is THIS vendor the category's current build pick? */
  isBuildPick: boolean;
  /** The category's current build pick, when it's a DIFFERENT vendor (→ popup). */
  existing: { name: string; pricePhp: number | null; thisPricePhp: number | null } | null;
}) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Esc closes the replace popup.
  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm]);

  const pin = () => {
    haptic('confirm');
    startTransition(async () => {
      await setBuildPick({ eventId, planGroupId: groupId, vendorId });
      setConfirm(false);
    });
  };

  const unpin = () => {
    haptic('tick');
    startTransition(async () => {
      await removeBuildPick({ eventId, planGroupId: groupId });
    });
  };

  if (isBuildPick) {
    return (
      <div className="mt-2.5 flex items-center gap-2">
        <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-mulberry/30 bg-mulberry/5 px-3 py-2 text-[12.5px] font-semibold text-mulberry">
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
          In your build
        </span>
        <button
          type="button"
          onClick={unpin}
          disabled={isPending}
          className="rounded-[10px] border border-ink/15 px-3 py-2 text-[12px] font-medium text-ink/55 hover:text-ink disabled:opacity-50"
        >
          {isPending ? '…' : 'Remove'}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (existing) {
            haptic('tick');
            setConfirm(true);
          } else {
            pin();
          }
        }}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-terracotta px-3 py-2.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-terracotta-600 disabled:opacity-60"
      >
        <Hammer className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
        {isPending ? 'Adding…' : 'Add to build'}
      </button>

      {confirm && existing
        ? portal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setConfirm(false);
              }}
            >
              <div className="w-full max-w-md rounded-t-2xl bg-cream p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl ring-1 ring-ink/10 sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl italic text-ink">Replace on your build?</h3>
                  <button
                    type="button"
                    onClick={() => setConfirm(false)}
                    aria-label="Cancel"
                    className="rounded-full p-1 text-ink/45 hover:bg-ink/5 hover:text-ink"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
                <p className="mt-1 text-sm text-ink/65">
                  Your build already has <b className="text-ink">{existing.name}</b> for {groupLabel}.
                  What should happen with <b className="text-ink">{vendorName}</b>?
                </p>
                <div className="mt-3 space-y-2">
                  <Row name={existing.name} sub="currently in build" price={existing.pricePhp} />
                  <Row name={vendorName} sub="new pick" price={existing.thisPricePhp} />
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirm(false)}
                    className="flex-1 rounded-[10px] border border-ink/15 px-3 py-2.5 text-[13px] font-medium text-ink/70 hover:bg-ink/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={pin}
                    disabled={isPending}
                    className="flex-1 rounded-[10px] border border-ink/15 px-3 py-2.5 text-[13px] font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-60"
                  >
                    Add both
                  </button>
                  <button
                    type="button"
                    onClick={pin}
                    disabled={isPending}
                    className="flex-1 rounded-[10px] bg-terracotta px-3 py-2.5 text-[13px] font-semibold text-cream hover:bg-terracotta-600 disabled:opacity-60"
                  >
                    {isPending ? '…' : 'Replace'}
                  </button>
                </div>
                <p className="mt-2.5 text-center font-display text-[11px] italic text-ink/45">
                  “Add both” keeps both shortlisted under {groupLabel} — only the build pick moves.
                </p>
              </div>
            </div>,
          )
        : null}
    </>
  );
}

function Row({ name, sub, price }: { name: string; sub: string; price: number | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink">{name}</div>
        <div className="text-[11px] text-ink/55">{sub}</div>
      </div>
      <div className="shrink-0 font-display text-[15px] font-semibold text-ink">{peso(price)}</div>
    </div>
  );
}
