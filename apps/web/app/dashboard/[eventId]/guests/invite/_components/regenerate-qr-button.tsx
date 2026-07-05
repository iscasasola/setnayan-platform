'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { useToast } from '@/app/_components/toast/toast-provider';
import { useSaveLoader } from '@/components/sd-loader';
import { regenerateInviteQr } from '../actions';

/**
 * RegenerateQrButton — couple control to rotate the guest-invite join token
 * (Data Flow Map audit gap #9). Confirms before rotating because it's
 * destructive to already-shared links: any printed QR or forwarded URL using
 * the old token stops working the instant the new one is minted.
 *
 * Local to the Invite stage (kept out of a shared module to avoid a
 * cross-feature import per [[project_setnayan_app_linking_contract]]); mirrors
 * the InviteLink co-location. After a successful rotation it router.refresh()es
 * so the server component re-renders the new QR + link from the rotated token.
 */
export function RegenerateQrButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const save = useSaveLoader();

  async function handleClick() {
    const ok = await confirm({
      title: 'Regenerate your invite QR?',
      body: (
        <>
          This creates a brand-new link and QR code. Any{' '}
          <span className="font-medium text-ink">printed QR codes or links you&rsquo;ve already shared</span>{' '}
          will stop working — you&rsquo;ll need to share the new one. Guests who already joined stay on your list.
        </>
      ),
      confirmLabel: 'Regenerate',
      cancelLabel: 'Keep current',
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    const result = await save.run(() => regenerateInviteQr(eventId), {
      steps: ['Regenerating your QR'],
      hint: 'Saving',
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('New invite QR ready. Share the fresh link with your guests.');
    startTransition(() => router.refresh());
  }

  const working = busy || isPending;

  return (
    <>
      {dialog}
      <button
        type="button"
        onClick={handleClick}
        disabled={working}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw
          aria-hidden
          className={`h-4 w-4 ${working ? 'animate-spin' : ''}`}
          strokeWidth={2}
        />
        {working ? 'Regenerating…' : 'Regenerate QR'}
      </button>
    </>
  );
}
