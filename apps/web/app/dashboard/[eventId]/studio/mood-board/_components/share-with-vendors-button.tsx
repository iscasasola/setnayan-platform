'use client';

/**
 * "Share with vendors" — one press pings every booked marketplace vendor that
 * the couple's Mood Board is ready (Mood Board · Surface B, 2026-06-28). Free
 * convenience layer: booked vendors already have read access via the
 * get_vendor_mood_board RPC; this just nudges them with an in-app notification
 * deep-linking to the read-only view, so the couple gets a "Shared with N
 * vendors" toast instead of chasing each vendor down a chat thread.
 *
 * V1 default is all-booked (no category filtering — locked). When there are no
 * booked marketplace vendors yet, the affordance reads as a gentle empty state
 * rather than a dead button.
 */

import { useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { shareMoodBoardWithVendors } from '../actions';
import { useSaveLoader } from '@/components/sd-loader';

export function ShareWithVendorsButton({
  eventId,
  bookedVendorCount,
}: {
  eventId: string;
  bookedVendorCount: number;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const save = useSaveLoader();
  const hasVendors = bookedVendorCount > 0;

  function share() {
    if (pending || !hasVendors) return;
    startTransition(async () => {
      try {
        const { sharedCount } = await save.run(
          () => shareMoodBoardWithVendors(eventId),
          { steps: ['Sharing with your vendors'], hint: 'Sharing' },
        );
        setDoneCount(sharedCount);
        if (sharedCount > 0) {
          toast.success(
            `Shared with ${sharedCount} ${sharedCount === 1 ? 'vendor' : 'vendors'}`,
          );
        } else {
          // Booked vendors exist but none have a claimed Setnayan account yet —
          // they'll see the board the moment they claim their profile.
          toast.info('No booked vendors to notify yet');
        }
      } catch {
        toast.error('Could not share — please try again.');
      }
    });
  }

  if (!hasVendors) {
    return (
      <p className="text-sm text-ink/55">
        Once you’ve booked vendors on Setnayan, you can share this mood board with
        them here so they can match your palette and reception design.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={share}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream/40 border-t-cream"
            />
            Sharing…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden />
            Share with vendors
          </>
        )}
      </button>
      <p className="text-xs text-ink/55">
        {doneCount !== null && doneCount > 0
          ? 'Your booked vendors have been notified — they can open your board any time.'
          : `Notify your ${bookedVendorCount} booked ${
              bookedVendorCount === 1 ? 'vendor' : 'vendors'
            } that your mood board is ready to view.`}
      </p>
    </div>
  );
}
