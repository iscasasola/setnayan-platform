'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { reissuePanoodCamera } from './actions';

/**
 * Reissue a camera link — destructive to whoever currently holds it, so it asks first.
 *
 * The confirm step is not ceremony: reissuing DISCONNECTS a live operator, and on the day that
 * could be someone already standing at the altar with the phone. A single mis-tap should not do
 * that silently.
 */
export function ReissueCameraButton({
  eventId,
  cameraId,
  label,
}: {
  eventId: string;
  cameraId: number;
  label: string;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleReissue() {
    startTransition(async () => {
      const res = await reissuePanoodCamera(eventId, cameraId);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label} is free again — send the new link to whoever takes it.`);
      setConfirming(false);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Reissue to someone else
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleReissue}
        className="inline-flex items-center gap-1.5 rounded-md bg-danger-600 px-3 py-1.5 text-xs font-semibold text-cream hover:opacity-90 disabled:opacity-60"
      >
        <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {isPending ? 'Reissuing…' : 'Yes, disconnect them'}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="rounded-md px-2 py-1.5 text-xs font-medium text-ink/60 hover:text-ink"
      >
        Cancel
      </button>
    </div>
  );
}
