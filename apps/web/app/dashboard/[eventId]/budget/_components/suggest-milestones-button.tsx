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
import { useSaveLoader } from '@/components/sd-loader';
import { ActionButton } from '@/components/action-button';

export function SuggestMilestonesButton({
  eventId,
  vendorId,
}: {
  eventId: string;
  vendorId: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  function run() {
    if (pending) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      try {
        const result = await save.run(() => addSuggestedMilestones(fd), {
          steps: ['Adding the payment split'],
          hint: 'Saving',
        });
        if (result.ok) {
          toast.success('Added a First payment (50%) and Balance (50%) — edit or delete any time.');
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('Couldn’t add the suggested payments. Please try again.');
      }
    });
  }

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rule 3): the shared pill, not a hand-drawn button — outlined in the forward
  // step's colour (it is not the page's one main button), the 44-px floor, grey `waiting` while it adds (`run` ignores a second press).
  return (
    <ActionButton
      tone="brand"
      icon={Sparkles}
      label={pending ? 'Adding…' : 'Suggest a first payment + balance split'}
      onClick={run}
      waiting={pending}
    />
  );
}
