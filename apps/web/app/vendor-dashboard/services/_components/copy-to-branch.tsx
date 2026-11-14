'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, CopyPlus, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import { formatPhp } from '@/lib/php';
import { supplierPlanExtra, type PlanExtraResult } from '@/app/vendor-dashboard/plan-extras-actions';
import type { Location } from '@/lib/branch-copy';

/**
 * 🏢 COPY TO ANOTHER BRANCH (owner 2026-11-14, SIMPLER SUPPLIER PLANS item 10; drawing artifact Eiwc64wF1VHLfZ52Sjbs8c
 * § 7). A row in the card's "Live · delete · copy" fold, beside "Start another from this" — drawn ONLY when the shop
 * has another location to copy to (`branchCopyTargets`). The sheet asks only where it goes and what it costs there:
 *
 *   Branch ▾ · Price there · "<here> is ₱X. Each branch sets its own price." · Cards used: None — it's a copy
 *   [Copy to <branch>] · [Cancel]
 *
 * The copy keeps the words and photos, gets its own price, calendar and team, and does NOT use up a card
 * (`copy_vendor_service_to_branch`). Saving opens the new card so anything can be changed after.
 */
export function CopyToBranch({
  serviceId,
  targets,
  hereLabel,
  herePricePhp,
  priceWord,
}: {
  serviceId: string;
  targets: Location[];
  hereLabel: string;
  herePricePhp: number | null;
  /** What the headline number is on this card's basis — "Price there", "Per guest there", "Base price there". */
  priceWord: string;
}) {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState(targets[0]?.key ?? '');
  const [price, setPrice] = useState('');
  const [state, action, pending] = useActionState<PlanExtraResult | null, FormData>(supplierPlanExtra, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok && state.href) router.push(state.href);
  }, [state, router]);
  if (targets.length === 0) return null;
  const target = targets.find((t) => t.key === branch) ?? targets[0]!;
  const short = (l: string) => l.replace(/^Main · /, '');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sn-press flex min-h-11 w-full items-center justify-between gap-3 text-left text-[15px] text-ink"
        data-maker-branch-copy=""
      >
        <span className="flex items-center gap-2">
          <CopyPlus aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.75} />
          Copy to another branch
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById="branch-copy-title" title="Copy to another branch" rise>
        <form action={action} className="space-y-3" data-branch-copy-sheet="">
          <input type="hidden" name="op" value="branch_copy" />
          <input type="hidden" name="vendor_service_id" value={serviceId} />
          <p className="text-[14px] text-ink/65">Same words and photos. Change anything after.</p>
          <div className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 pt-2 text-[15px]">
            <span>Branch</span>
            <input type="hidden" name="branch" value={branch} />
            <PickMenu label="Branch" value={branch} options={targets.map((t) => ({ key: t.key, label: t.label }))} onPick={setBranch} dataAttr="data-branch-copy-branch" className="!min-h-11" />
          </div>
          <FormRows>
            <TypedRow name="Price there" note={priceWord === 'Price there' ? undefined : priceWord} value={price} empty="Set it" amount required inputMode="numeric" fieldName="price_php" onKeep={(t) => setPrice(t)} data="branch-copy-price" />
          </FormRows>
          <p className="text-[13px] text-ink/60">
            {herePricePhp ? `${short(hereLabel)} is ${formatPhp(herePricePhp)}. ` : ''}Each branch sets its own price.
          </p>
          <div className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 pt-2 text-[15px]">
            <span>Cards used</span>
            <span className="text-success-800" data-branch-copy-cards="">None — it&rsquo;s a copy</span>
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-[13.5px] text-danger-700">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-1">
            <ActionButton tone="brand" main type="submit" waiting={pending} icon={<CopyPlus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label={`Copy to ${short(target.label)}`} />
            <ActionButton tone="neutral" icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Cancel" onClick={() => setOpen(false)} />
          </div>
        </form>
      </Sheet>
    </>
  );
}
