'use client';

import { useRef, useState, useTransition } from 'react';
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
import { formatCount } from '@/lib/format-number';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

const LABEL = 'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/70';

/**
 * Coordinator P3 (Coordinator_Role_Feature_Spec_2026-07-18 §P3) — the day-of
 * broadcast card, wired to `coordinator_broadcasts`.
 *
 * Data arrives as props resolved server-side by the day-of page (the grid's
 * existing read model: server fetch → props into cards). Without the
 * `broadcast` prop — Data Privacy control 'coordinator_day_of_broadcast'
 * inactive, or the read failed — the card renders the pre-P3 "Coming soon"
 * stub. (The env var previously named here is read by no code.)
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
            ? `Sent ${formatCount(result.sent)} of ${formatCount(result.total)} call-time emails (${result.failed} failed).`
            : `Sent ${result.sent} call-time email${result.sent === 1 ? '' : 's'}.`,
        );
      } else if (result.reason === 'not_configured') {
        setEmailStatus('Email sending is not configured yet.');
      } else if (result.reason === 'nothing_to_send') {
        setEmailStatus('No call times to send — tag suppliers on schedule rows first.');
      } else {
        setEmailStatus('Could not send call-time emails. Try again.');
      }
    });
  };

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 6 · 7 · 13 · 14 · 15): no box and no boxes inside it — grey capitals,
  // one hairline row per broadcast (who · when in plain grey words), an empty or refused read is one line; the two
  // presses are the shared pills (44 px floor, a grey "waiting" instead of a dimmed button); the hints are 13 px.
  return (
    <section aria-labelledby="day-of-broadcast" className="space-y-2">
      <h2 id="day-of-broadcast" className={LABEL}>
        <Megaphone aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2} />
        Coordinator broadcast
      </h2>

      {!broadcast.broadcastsMeasured ? (
        <p role="status" className="py-2 text-sm text-warn-800">
          We couldn&rsquo;t load recent broadcasts right now. Refresh in a
          moment.
        </p>
      ) : broadcast.items.length === 0 ? (
        <p className="py-2 text-sm text-ink/75">
          No broadcast yet — updates from the planning team will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {broadcast.items.map((item) => (
            <li key={item.broadcastId} className="min-h-14 py-2.5">
              <p className="text-[15px] text-ink">{item.body}</p>
              <p className="mt-0.5 text-[13px] text-ink/75">
                {SENDER_LABEL[item.senderRole]} · {formatTime(item.createdAt)}
              </p>
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
            className="input-field w-full text-sm"
          />
          {composeError ? (
            <p role="alert" className="text-[13px] text-danger-700">{composeError}</p>
          ) : null}
          <ActionButton
            tone="brand"
            icon={Send}
            label={isPending ? 'Sending…' : 'Broadcast'}
            onClick={handleSend}
            waiting={isPending}
          />

          <div className="border-t border-ink/10 pt-2">
            <ActionButton
              tone="neutral"
              icon={Mail}
              label={`Email call-times to suppliers${broadcast.callTimeCount > 0 ? ` (${broadcast.callTimeCount})` : ''}`}
              onClick={handleEmailCallTimes}
              waiting={isPending}
              disabled={!broadcast.emailConfigured || broadcast.callTimeCount === 0}
            />
            {broadcast.callTimeCount === 0 ? (
              <p className="mt-1 text-[13px] text-ink/75">
                Tag suppliers as responsible on schedule rows to derive their call
                times.
              </p>
            ) : !broadcast.emailConfigured ? (
              <p className="mt-1 text-[13px] text-ink/75">
                Email sending is not configured yet — call times stay in-app.
              </p>
            ) : null}
            {emailStatus ? (
              <p role="status" className="mt-1 text-[13px] text-ink">{emailStatus}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Pre-P3 stub, byte-for-byte the shipped card — renders whenever the feature
 * flag is off (or the page passed no data), so flag-off = today's behavior.
 */
function CoordinatorBroadcastStub() {
  const [optedIn, setOptedIn] = useState(true);

  return (
    <section data-coming-soon aria-labelledby="day-of-broadcast" className="space-y-2">
      <header className="flex min-h-11 items-center justify-between gap-2">
        <h2 id="day-of-broadcast" className={LABEL}>
          <Megaphone aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2} />
          <InfoTip label="Coordinator broadcast" labelAs="span" align="start">
            Composer ships with iteration 0019 (force-majeure comms) and 0023 (admin escalation).
          </InfoTip>
        </h2>
        <Badge tone="quiet">Coming soon</Badge>
      </header>

      <p className="py-2 text-sm text-ink/75">
        No broadcast yet — your coordinator can send updates here on the day.
      </p>

      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 border-t border-ink/10 text-[15px] text-ink">
        <span>Receive broadcasts on this device</span>
        <input
          type="checkbox"
          checked={optedIn}
          onChange={(e) => setOptedIn(e.target.checked)}
          className="h-5 w-5 cursor-pointer accent-terracotta"
        />
      </label>
    </section>
  );
}
