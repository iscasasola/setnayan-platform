'use client';

/**
 * who-can-reply-ask.tsx — the Guest list's first visit asks ONE question.
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "THE FIRST VISIT TO THE GUEST LIST ASKS WHICH
 * KIND OF LIST"): a pop-up, "Who can reply?" — Only people on my list · Anyone,
 * I approve. Phone first (INTERACTION_RULES § 1, § 5): one question, two big
 * answers, nothing else; two options are two buttons, never a dropdown.
 *
 * It writes the EXISTING "Who can RSVP?" value through the ONE door that writes
 * it — the Maker's `hubDraftAction` save, with the whole config (see
 * `lib/who-can-reply.ts`) — so the Maker's RSVP page, the Invite panel and the
 * guest side all read the same answer afterwards. No new setting, no new action.
 *
 * 🔑 IT GOES LIVE WITH THE EVENT HUB. That door is the Maker's draft, so the
 * answer reaches guests when the couple next Applies, exactly as it does when
 * picked on the Maker's RSVP page. The toast says so in words rather than
 * letting "saved" read as "live".
 *
 * Shown once per event: an answer ends it for good (the page stops asking once
 * the key exists); closing it without an answer is remembered on this device
 * for this event (localStorage, try/catch — private windows throw). The page
 * mounts the Invite tour only when this is not showing, so the tour follows it.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { RsvpAskConfig, WhoCanRsvp } from '@/lib/rsvp-ask';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { WHO_CAN_REPLY_CHOICES, whoCanReplyPatch } from '@/lib/who-can-reply';
import { hubDraftAction } from '@/app/dashboard/[eventId]/website/hub-draft-actions';
import { pushUndo } from './undo-toast';

const dismissKey = (eventId: string) => `sn:guests:who-can-reply:${eventId}`;

export function WhoCanReplyAsk({
  eventId,
  base,
  children,
}: {
  eventId: string;
  base: RsvpAskConfig;
  /** What waits its turn — the Invite tour — drawn only once this is closed. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  // 'unknown' until this device's memory is read: neither the question nor the
  // tour behind it may flash before then.
  const [phase, setPhase] = useState<'unknown' | 'ask' | 'done'>('unknown');
  const open = phase === 'ask';
  const setOpen = (v: boolean) => setPhase(v ? 'ask' : 'done');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  // Read after hydration: the server cannot see this device's memory.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(dismissKey(eventId)) === '1';
    } catch {
      /* storage unavailable — ask */
    }
    setPhase(dismissed ? 'done' : 'ask');
  }, [eventId]);

  const close = () => {
    try {
      window.localStorage.setItem(dismissKey(eventId), '1');
    } catch {
      /* storage unavailable — it asks again next visit, which is safe */
    }
    setOpen(false);
  };

  useModalA11y({ open, onClose: close, containerRef: dialogRef, initialFocusRef: firstRef });

  const pick = (value: WhoCanRsvp, label: string) => {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify({ events: { rsvp_ask_config: whoCanReplyPatch(base, value) } }));
      let res: HubDraftActionResult;
      try {
        res = await hubDraftAction(eventId, fd);
      } catch {
        res = { ok: false, intent: 'save', error: 'Please try again.' };
      }
      if (!res.ok) {
        // Failure never looks like success: the question stays, with the reason.
        setError(`That did not save. ${res.error || 'Please try again.'}`);
        return;
      }
      setOpen(false);
      pushUndo({
        label: `${label} — live when you Apply your Event Hub`,
        undo: async () => {
          const u = new FormData();
          u.set('intent', 'undo');
          await hubDraftAction(eventId, u);
          router.refresh();
        },
      });
      router.refresh();
    });
  };

  if (phase === 'done') return <>{children}</>;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/[0.32] p-4 backdrop-blur-[6px] sm:items-center" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="who-can-reply-title"
        data-who-can-reply=""
        className="sn-pop-in w-full max-w-sm space-y-4 rounded-3xl border border-ink/10 bg-cream p-5 shadow-[0_40px_80px_-40px_rgba(30,26,18,0.55)]"
      >
        <h2 id="who-can-reply-title" className="font-display text-2xl text-ink">
          Who can reply?
        </h2>
        <div className="grid gap-2.5">
          {WHO_CAN_REPLY_CHOICES.map((c, i) => (
            <button
              key={c.value}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              disabled={pending}
              onClick={() => pick(c.value, c.label)}
              data-who-can-reply-choice={c.value}
              className="min-h-[56px] w-full rounded-2xl border border-ink/15 bg-white px-4 text-left text-base font-semibold text-ink transition-colors hover:border-ink/40 disabled:opacity-60"
            >
              {c.label}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-terracotta-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
