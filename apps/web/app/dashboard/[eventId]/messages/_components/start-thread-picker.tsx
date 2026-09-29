'use client';

/**
 * StartThreadPicker — Messages' "Start a conversation": ONE PickMenu of the
 * suppliers on Your Team (owner 2026-09-28: *"any set of choices is a
 * dropdown"*). Picking one opens that supplier's conversation.
 *
 * NOT A SECOND WAY TO OPEN A THREAD. It calls `contactShortlistVendor`, the
 * same thin resolver the bench's Inquire and the budget card's Message button
 * use (via `ContactShortlistVendorButton`), which delegates to the canonical
 * `startServiceInquiry` — so the follow-gate, the one-thread-per-shop dedupe
 * and the inquiry-source stamp are inherited, and a shop already in a
 * conversation simply reopens it.
 *
 * Why it replaced the email box: see `lib/messages-team-picker.ts`.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { contactShortlistVendor } from '../../vendors/_actions/contact-shortlist-vendor';
import type { TeamPick } from '@/lib/messages-team-picker';

export function StartThreadPicker({ eventId, team }: { eventId: string; team: readonly TeamPick[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const open = (vendorId: string) => {
    haptic('confirm');
    setPicked(vendorId);
    setErr(null);
    start(async () => {
      const res = await contactShortlistVendor({ eventId, vendorId });
      if (res.status === 'ok') {
        router.push(`/dashboard/${res.eventId}/messages/${res.threadId}`);
        return;
      }
      if (res.status === 'not_signed_in') {
        router.push('/login');
        return;
      }
      setPicked(null);
      if (res.status === 'not_marketplace' || res.status === 'no_event') {
        setErr('This supplier can’t be messaged here.');
      } else if (res.status === 'not_secured') {
        setErr('Save your account first to message this supplier.');
      } else {
        setErr(res.status === 'error' ? res.message : 'Could not open the conversation.');
      }
    });
  };

  return (
    <div className="space-y-2" data-start-thread-picker>
      <div className="flex flex-wrap items-center gap-2">
        <PickMenu
          label="Message a supplier on your team"
          value={picked}
          options={team.map((t) => ({ key: t.vendorId, label: t.name }))}
          onPick={open}
          buttonText={pending ? 'Opening…' : 'Choose a supplier'}
          className="border border-ink/15"
        />
        {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin text-ink/50" /> : null}
      </div>
      {err ? (
        <p role="alert" className="text-xs text-danger-700">
          {err}
        </p>
      ) : null}
    </div>
  );
}
