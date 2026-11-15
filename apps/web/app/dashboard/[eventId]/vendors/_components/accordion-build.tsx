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
 * opens the Replace / Add-both sheet (prototype): both stay shortlisted; only
 * the single build-pick pointer moves. It is the app's one `Sheet` (design
 * template 14 Nov 2026, rule 9 — the house pop-up, `ScheduleSheet` + `SheetFoot`),
 * which portals to <body> itself — the card
 * carries the rail's coverflow `transform` (which would trap position:fixed).
 * Its buttons are the shared `ActionButton` (rule 3), the two choices equal widths.
 */

import { useId, useState, useTransition } from 'react';
import { Hammer, Check, Clock, Copy, Repeat, X } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { ActionButton } from '@/components/action-button';
import { ScheduleSheet, SheetFoot } from '@/app/dashboard/[eventId]/schedule/_components/schedule-sheet';
import { useSaveLoader } from '@/components/sd-loader';
import { announceBuildAdded } from '@/lib/budget-build';
import { setBuildPick, removeBuildPick } from '../build-pick-actions';

const peso = (php: number | null | undefined) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;

export function AccordionBuildButton({
  eventId,
  groupId,
  groupLabel,
  vendorId,
  vendorName,
  isBuildPick,
  priced = true,
  existing,
}: {
  eventId: string;
  groupId: string;
  groupLabel: string;
  vendorId: string;
  vendorName: string;
  /** Is THIS vendor the category's current build pick? */
  isBuildPick: boolean;
  /** Has the vendor responded with a price? Only priced services can be added to
   *  the build (owner 2026-06-09: "they can only add to build the services that
   *  vendors responded with the price"). Unpriced inquiries show a disabled note. */
  priced?: boolean;
  /** The category's current build pick, when it's a DIFFERENT vendor (→ popup). */
  existing: { name: string; pricePhp: number | null; thisPricePhp: number | null } | null;
}) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const titleId = useId();
  const save = useSaveLoader();

  const pin = () => {
    haptic('confirm');
    startTransition(async () => {
      const added = await save.run(
        () => setBuildPick({ eventId, planGroupId: groupId, vendorId }),
        { steps: ['Pinning your pick'], hint: 'Saving' },
      );
      // The cart peeks (the page's shell listens) — only for a pick that saved.
      if (added.ok) announceBuildAdded({ name: vendorName, category: groupLabel });
      setConfirm(false);
    });
  };

  const unpin = () => {
    haptic('tick');
    startTransition(async () => {
      // Pass vendorId so multi-pick categories (Look/Booths/Prints) remove only
      // THIS vendor, not every pick in the group. Single-pick is unaffected.
      await removeBuildPick({ eventId, planGroupId: groupId, vendorId });
    });
  };

  if (isBuildPick) {
    return (
      <div className="mt-2.5 flex items-center gap-2">
        <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-mulberry/10 px-3 py-2 text-[13px] font-semibold text-mulberry">
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
          In your build
        </span>
        <ActionButton
          tone="neutral"
          icon={X}
          label={isPending ? 'Removing…' : 'Remove'}
          onClick={unpin}
          disabled={isPending}
        />
      </div>
    );
  }

  // Rule (owner 2026-06-09): only a priced service can be added to the build.
  // An inquiry the vendor hasn't priced yet shows a waiting note instead.
  if (!priced) {
    return (
      <p className="mt-2.5 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-ink/70">
        <Clock className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
        Waiting for the supplier&rsquo;s price
      </p>
    );
  }

  return (
    <>
      <ActionButton
        tone="brand"
        main
        icon={Hammer}
        label={isPending ? 'Adding…' : 'Add to build'}
        disabled={isPending}
        onClick={() => {
          if (existing) {
            haptic('tick');
            setConfirm(true);
          } else {
            pin();
          }
        }}
        className="mt-2.5 w-full"
      />

      {confirm && existing ? (
        <ScheduleSheet
          open
          onClose={() => setConfirm(false)}
          id={titleId}
          title="Replace on your build?"
          aside={groupLabel}
          data="replace-build-pick"
          foot={
            <SheetFoot>
              <ActionButton tone="neutral" icon={Copy} label="Add both" onClick={pin} disabled={isPending} />
              <ActionButton
                tone="brand"
                main
                icon={Repeat}
                label={isPending ? 'Replacing…' : 'Replace'}
                onClick={pin}
                disabled={isPending}
              />
            </SheetFoot>
          }
        >
          <p className="text-[14px] text-ink/70">
            Your build already has <b className="text-ink">{existing.name}</b> for {groupLabel}.
            What should happen with <b className="text-ink">{vendorName}</b>?
          </p>
          <div className="divide-y divide-ink/10">
            <Row name={existing.name} sub="currently in build" price={existing.pricePhp} />
            <Row name={vendorName} sub="new pick" price={existing.thisPricePhp} />
          </div>
          <p className="text-[13px] text-ink/70">
            “Add both” keeps both shortlisted under {groupLabel} — only the build pick moves.
          </p>
        </ScheduleSheet>
      ) : null}
    </>
  );
}

function Row({ name, sub, price }: { name: string; sub: string; price: number | null }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink">{name}</div>
        <div className="text-[13px] text-ink/70">{sub}</div>
      </div>
      <div className="shrink-0 text-[15px] font-bold tabular-nums text-ink">{peso(price)}</div>
    </div>
  );
}
