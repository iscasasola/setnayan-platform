'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-action';

/** The server action, HANDED IN by the page (`adoptSeatNameOnProfile` in
 *  dashboard/(account)/profile/actions.ts) rather than imported here — the same
 *  reason as `CelebrantActions`: this file is rendered by the guest pathway's
 *  unit test, where `server-only` does not resolve. */
export type AdoptSeatName = (input: {
  eventId: string;
  guestId: string;
}) => Promise<{ ok: true; name: string } | { ok: false; error: string }>;

/**
 * use-on-profile.tsx — "Use this on your profile" (B9), on the guest's OWN Me
 * tab. Owner 2026-09-30: *"on Claire Buanhog's account, her profile should be
 * updated with her info"* — her control, one tap, never silent.
 *
 * One quiet line: the name the event lists them as, and the action. The tap
 * asks once — "Use it · Not now" — and only "Use it" writes. Drawing the line
 * writes nothing; the page computed the offer read-only (seat-name-offer.server).
 */
export function UseOnProfile({
  eventId,
  guestId,
  name,
  adopt,
}: {
  eventId: string;
  guestId: string;
  /** The profile's name after the tap (lib/seat-name-offer.ts). */
  name: string;
  adopt: AdoptSeatName;
}) {
  const [step, setStep] = useState<'line' | 'confirm' | 'done' | 'gone'>('line');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (step === 'gone') return null;

  if (step === 'done') {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-ink/70" role="status" data-use-on-profile="done">
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
        Saved to your profile
      </p>
    );
  }

  // 🔔 Inventory #35 — a To-do in the one notice system (owner approved 14 Nov 2026), drawn where it stands on Me: the
  // name, then "Use this on your profile · Not now". The confirm stays below it.
  if (step === 'line') {
    return (
      <div data-use-on-profile="line">
        <InlineNotice
          kind="todo"
          noticeKey={`use-on-profile:${guestId}`}
          title={name}
          actions={
            <button type="button" onClick={() => setStep('confirm')} className={NOTICE_ACTION}>
              Use this on your profile
            </button>
          }
          onClose={() => setStep('gone')}
        />
      </div>
    );
  }

  function confirmUse() {
    setError(null);
    startTransition(async () => {
      const res = await adopt({ eventId, guestId });
      if (res.ok) setStep('done');
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2" role="group" aria-label="Use this on your profile" data-use-on-profile="confirm">
      <p className="text-sm text-ink">Use “{name}” on your profile?</p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button type="button" onClick={confirmUse} disabled={pending} className="button-secondary min-h-11 text-sm disabled:opacity-50">
          {pending ? 'Saving…' : 'Use it'}
        </button>
        <button
          type="button"
          onClick={() => setStep('gone')}
          disabled={pending}
          className="min-h-11 px-2 text-sm font-medium text-ink/70 disabled:opacity-50"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
