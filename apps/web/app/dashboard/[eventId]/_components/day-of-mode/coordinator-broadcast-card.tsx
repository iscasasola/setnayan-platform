'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Megaphone, Send } from 'lucide-react';
import {
  emailVendorCallTimes,
  sendCoordinatorBroadcast,
} from '../../_actions/day-of-broadcast';
import {
  BROADCAST_MAX_LENGTH,
  type BroadcastCardData,
  type BroadcastSenderRole,
} from '@/lib/coordinator-broadcasts';

/**
 * Coordinator P3 (Coordinator_Role_Feature_Spec_2026-07-18 §P3) — the day-of
 * broadcast card, wired to `coordinator_broadcasts`.
 *
 * Data arrives as props resolved server-side by the day-of page (the grid's
 * existing read model: server fetch → props into cards). Without the
 * `broadcast` prop — flag NEXT_PUBLIC_COORDINATOR_P3_ENABLED off, or absent —
 * the card renders the pre-P3 "Coming soon" stub exactly as before.
 */

const SENDER_LABEL: Record<BroadcastSenderRole, string> = {
  couple: 'The couple',
  coordinator: 'Your coordinator',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CoordinatorBroadcastCard({
  eventId,
  broadcast,
}: {
  eventId?: string;
  broadcast?: BroadcastCardData;
}) {
  if (!eventId || !broadcast) return <CoordinatorBroadcastStub />;
  return <LiveBroadcastCard eventId={eventId} broadcast={broadcast} />;
}

function LiveBroadcastCard({
  eventId,
  broadcast,
}: {
  eventId: string;
  broadcast: BroadcastCardData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [composeError, setComposeError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = broadcast.senderRole !== null;

  const handleSend = () => {
    const body = textareaRef.current?.value ?? '';
    setComposeError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set('body', body);
      const result = await sendCoordinatorBroadcast(formData);
      if (result.ok) {
        if (textareaRef.current) textareaRef.current.value = '';
        router.refresh();
      } else {
        setComposeError(result.error);
      }
    });
  };

  const handleEmailCallTimes = () => {
    setEmailStatus(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('event_id', eventId);
      const result = await emailVendorCallTimes(formData);
      if (result.ok) {
        setEmailStatus(
          result.failed > 0
            ? `Sent ${result.sent} of ${result.total} call-time emails (${result.failed} failed).`
            : `Sent ${result.sent} call-time email${result.sent === 1 ? '' : 's'}.`,
        );
      } else if (result.reason === 'not_configured') {
        setEmailStatus('Email sending is not configured yet.');
      } else if (result.reason === 'nothing_to_send') {
        setEmailStatus('No call times to send — tag vendors on schedule rows first.');
      } else {
        setEmailStatus('Could not send call-time emails. Try again.');
      }
    });
  };

  return (
    <article className="space-y-3 rounded-2xl border border-ink/15 bg-cream/40 p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <Megaphone aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Coordinator broadcast
        </p>
      </header>

      {broadcast.items.length === 0 ? (
        <div className="rounded-md bg-cream/60 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Last broadcast
          </p>
          <p className="mt-1 text-sm text-ink/55">
            No broadcast yet — updates from the planning team will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {broadcast.items.map((item) => (
            <li key={item.broadcastId} className="rounded-md bg-cream/60 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                {SENDER_LABEL[item.senderRole]} · {formatTime(item.createdAt)}
              </p>
              <p className="mt-1 text-sm text-ink/80">{item.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canSend ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            maxLength={BROADCAST_MAX_LENGTH}
            rows={2}
            placeholder="Send an update to everyone — “Dinner is moving up 15 minutes.”"
            className="w-full rounded-md border border-ink/15 bg-white/70 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta/50 focus:outline-none"
          />
          {composeError ? (
            <p className="text-[11px] text-terracotta-700">{composeError}</p>
          ) : null}
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {isPending ? 'Sending…' : 'Broadcast'}
          </button>

          <div className="border-t border-ink/10 pt-2">
            <button
              type="button"
              onClick={handleEmailCallTimes}
              disabled={isPending || !broadcast.emailConfigured || broadcast.callTimeCount === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream/60 px-3 py-1.5 text-sm text-ink/80 transition-colors hover:border-ink/30 disabled:opacity-50"
            >
              <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Email call-times to vendors
              {broadcast.callTimeCount > 0 ? ` (${broadcast.callTimeCount})` : ''}
            </button>
            {broadcast.callTimeCount === 0 ? (
              <p className="mt-1 text-[11px] text-ink/45">
                Tag vendors as responsible on schedule rows to derive their call
                times.
              </p>
            ) : !broadcast.emailConfigured ? (
              <p className="mt-1 text-[11px] text-ink/45">
                Email sending is not configured yet — call times stay in-app.
              </p>
            ) : null}
            {emailStatus ? (
              <p className="mt-1 text-[11px] text-ink/60">{emailStatus}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Pre-P3 stub, byte-for-byte the shipped card — renders whenever the feature
 * flag is off (or the page passed no data), so flag-off = today's behavior.
 */
function CoordinatorBroadcastStub() {
  const [optedIn, setOptedIn] = useState(true);

  return (
    <article className="space-y-3 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.02] p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <Megaphone aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Coordinator broadcast
        </p>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
          Coming soon
        </span>
      </header>

      <div className="rounded-md bg-cream/60 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Last broadcast
        </p>
        <p className="mt-1 text-sm text-ink/55">
          No broadcast yet — your coordinator can send updates here on the day.
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-md border border-ink/10 bg-cream/60 px-3 py-2 text-sm">
        <span className="text-ink/70">Receive broadcasts on this device</span>
        <input
          type="checkbox"
          checked={optedIn}
          onChange={(e) => setOptedIn(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-terracotta"
        />
      </label>

      <p className="text-[11px] text-ink/45">
        Composer ships with iteration 0019 (force-majeure comms) and 0023
        (admin escalation).
      </p>
    </article>
  );
}
