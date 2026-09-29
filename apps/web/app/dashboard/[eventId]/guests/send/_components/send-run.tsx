'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCount } from '@/lib/format-number';
import { ArrowRight, Check, SkipForward } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { InviteEventFacts } from '@/lib/guest-invite-message';
import {
  InviteMessageEditor,
  SendInviteActions,
  type SendInviteGuest,
} from '../../_components/send-invite';

/**
 * THE RUN — "3 of 150 · Send to Maria → Next", Skip, and a done count.
 *
 * 🔑 THE QUEUE IS SNAPSHOT ONCE. A send stamps `invitation_sent_at` and
 * revalidates the page, which hands this component a fresh `guests` prop in
 * which Maria is no longer "not sent". A queue derived from props would shift
 * under the couple's thumb mid-run; this one is fixed at the moment they chose
 * who to go through, and each guest's Sent ✓ is tracked here.
 *
 * ⚖ WHO TO GO THROUGH is ONE dropdown (owner 2026-09-28: any set of choices is
 * a PickMenu, never a pill row): the ones not sent yet (the default), or
 * everyone.
 */
type Who = 'unsent' | 'everyone';

export function SendRun({
  eventId,
  guests,
  measured,
  facts,
  template: initialTemplate,
}: {
  eventId: string;
  guests: SendInviteGuest[];
  measured: boolean;
  facts: InviteEventFacts;
  template: string | null;
}) {
  const sendable = useMemo(() => guests.filter((g) => g.inviteUrl), [guests]);
  const noLink = guests.length - sendable.length;
  const [who, setWho] = useState<Who>('unsent');
  const [queue, setQueue] = useState<SendInviteGuest[]>(() => sendable.filter((g) => !g.sentAt));
  const [at, setAt] = useState(0);
  const [sentHere, setSentHere] = useState<Record<string, string | null>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const [template, setTemplate] = useState(initialTemplate);
  const [editing, setEditing] = useState(false);

  // Sent here wins over what the page loaded — including an Undo (null).
  const sentNow = (g: SendInviteGuest): string | null =>
    g.guestId in sentHere ? (sentHere[g.guestId] ?? null) : g.sentAt;
  const unsentCount = sendable.filter((g) => !sentNow(g)).length;
  const sentCount = Object.values(sentHere).filter(Boolean).length;

  function begin(next: Who, list?: SendInviteGuest[]) {
    setWho(next);
    setQueue(
      list ??
        (next === 'everyone'
          ? sendable
          : sendable.filter((g) => !sentNow(g))),
    );
    setAt(0);
    setSkipped([]);
  }

  if (!measured) {
    return (
      <p role="status" className="mt-6 rounded-xl bg-mulberry/5 p-4 text-sm text-ink/80">
        We couldn&rsquo;t load your guest list just now, so we can&rsquo;t say who still needs
        their invite. Try again in a moment.
      </p>
    );
  }

  const current = queue[at] ?? null;
  const upNext = queue[at + 1] ?? null;
  const currentSentAt = current ? sentNow(current) : null;

  return (
    <div className="mt-5 space-y-5" data-send-run="">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PickMenu
          label="Who to send to"
          dataAttr="data-send-run-who"
          value={who}
          options={[
            { key: 'unsent', label: `Not sent yet (${unsentCount})` },
            { key: 'everyone', label: `Everyone (${sendable.length})` },
          ]}
          onPick={(k) => begin(k === 'everyone' ? 'everyone' : 'unsent')}
        />
        <p className="text-sm tabular-nums text-ink/60" data-send-run-count="">
          {formatCount(sentCount)} sent{skipped.length ? ` · ${formatCount(skipped.length)} skipped` : ''}
        </p>
      </div>

      {current ? (
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-[0_10px_30px_-14px_rgba(30,34,41,0.35)]" aria-live="polite">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50" data-send-run-position="">
            {formatCount(at + 1)} of {formatCount(queue.length)}
          </p>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- our own gated QR route, the same bytes as Download */}
            <img
              src={`/api/website/qr/guest/${current.guestId}`}
              alt={`${current.fullName}’s QR`}
              width={72}
              height={72}
              className="h-[72px] w-[72px] shrink-0 rounded-lg bg-white object-contain p-1 shadow-sm"
            />
            <p className="min-w-0 break-words text-xl font-semibold leading-snug text-ink">{current.fullName}</p>
          </div>
          <SendInviteActions
            key={current.guestId}
            eventId={eventId}
            guest={{ ...current, sentAt: currentSentAt }}
            facts={facts}
            template={template}
            size="run"
            onSentChange={(s) => setSentHere((m) => ({ ...m, [current.guestId]: s }))}
            extra={
              currentSentAt ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setSkipped((s) => [...s, current.guestId]);
                    setAt((i) => i + 1);
                  }}
                  className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-ink/70"
                  data-send-run-skip=""
                >
                  <SkipForward aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Skip
                </button>
              )
            }
          />
          {currentSentAt ? (
            <button
              type="button"
              onClick={() => setAt((i) => i + 1)}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-mulberry px-5 text-base font-medium text-cream"
              data-send-run-next=""
            >
              {upNext ? `Next — ${upNext.firstName?.trim() || upNext.fullName}` : 'Finish'}
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </section>
      ) : (
        <section className="space-y-3 rounded-2xl bg-white p-5 text-center shadow-[0_10px_30px_-14px_rgba(30,34,41,0.35)]" data-send-run-done="">
          <Check aria-hidden className="mx-auto h-8 w-8 text-success-600" strokeWidth={2} />
          <p className="text-lg font-semibold text-ink">
            {queue.length === 0
              ? who === 'unsent'
                ? 'Everyone has their invite.'
                : 'Nobody to send to yet.'
              : `Done — ${formatCount(sentCount)} sent${skipped.length ? `, ${formatCount(skipped.length)} skipped` : ''}.`}
          </p>
          <div className="flex flex-col items-center gap-2">
            {skipped.length ? (
              <button
                type="button"
                onClick={() => begin(who, queue.filter((g) => skipped.includes(g.guestId)))}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
              >
                Go through the {skipped.length} skipped
              </button>
            ) : null}
            <Link
              href={`/dashboard/${eventId}/guests`}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink/70 underline underline-offset-4"
            >
              Back to the guest list
            </Link>
          </div>
        </section>
      )}

      {noLink > 0 ? (
        <p className="text-xs text-ink/55">
          {noLink} {noLink === 1 ? 'guest has' : 'guests have'} no personal link yet and {noLink === 1 ? 'is' : 'are'} left out.
          Re-issue their QR on the{' '}
          <Link href={`/dashboard/${eventId}/invitation`} className="underline underline-offset-4">
            Invitation page
          </Link>
          .
        </p>
      ) : null}

      {/* The wording, in place — never "edit it somewhere else". */}
      <div className="border-t border-ink/10 pt-4">
        {editing ? (
          <InviteMessageEditor
            eventId={eventId}
            facts={facts}
            template={template}
            sample={current ?? sendable[0] ?? null}
            onSaved={setTemplate}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink/70 underline underline-offset-4"
            data-send-run-edit=""
          >
            {template ? 'Change your message' : 'Change the message'}
          </button>
        )}
      </div>
    </div>
  );
}
