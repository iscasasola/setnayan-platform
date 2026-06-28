'use client';

/**
 * One-click "suggest a deposit + balance split" for an off-platform vendor that
 * has a lump-sum total but no dated milestones yet. Calls addSuggestedMilestones
 * (which seeds an editable Deposit 50% + Balance 50%) and toasts the result. The
 * server action re-checks every guard, so this is a thin trigger; on success the
 * page revalidates and the two new line items render in place (this button then
 * disappears because line items now exist).
 */

import { useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { addSuggestedMilestones } from '../actions';

export function SuggestMilestonesButton({
  eventId,
  vendorId,
}: {
  eventId: string;
  vendorId: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function run() {
    if (pending) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      try {
        const result = await addSuggestedMilestones(fd);
        if (result.ok) {
          toast.success('Added a Deposit (50%) and Balance (50%) — edit or delete any time.');
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('Couldn’t add the suggested payments. Please try again.');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-terracotta/[0.06] px-3 py-1.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10 disabled:opacity-60"
    >
      <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      {pending ? 'Adding…' : 'Suggest a deposit + balance split'}
    </button>
  );
}
