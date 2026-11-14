'use client';

/**
 * ANNOUNCE — from the Schedule, before the day and on it (Schedule rebuild,
 * slice 1 · DECISION_LOG 2026-09-26 "WHERE ANNOUNCEMENTS ARE TYPED — TODAY
 * ONLY ON THE DAY; THE SCHEDULE REBUILD FIXES IT").
 *
 * Owner, verbatim: *"so my question is for the host and coordinator, where is
 * the place where they can type in announcments."* Measured then: the only
 * composer (`day-of-mode/coordinator-broadcast-card.tsx`) mounted inside the
 * day-of grid, so before the day there was NO place to announce at all. This is
 * that place. It is NOT a new channel — owner 2026-09-25: *"all announcments go
 * there"* — it writes the same `coordinator_broadcasts` row through the same
 * `sendCoordinatorBroadcast` action, under the same INSERT policies (couple, or
 * a delegate holding `schedule: 'edit'`). The day-of Overview box stays.
 *
 * ⚠ WHEN A GUEST SEES IT IS STATED, NOT IMPLIED. The guest-side reader
 * (`app/[slug]/announcement/route.ts`, asked by the card) shows the latest
 * announcement, to identified guests only, AS SOON AS IT IS SENT — owner
 * 2026-09-28 (DECISION_LOG "OWNER ANSWERS — ANNOUNCEMENTS…", item 1). Before
 * the day it sits at the top of the guest's Invitation in the calm look; on
 * the day at the top of the Event Hub in the day-of look; once the event is
 * over it comes down. The sheet says exactly that — until 2026-09-28 it read
 * "shown on the day", which was true then and would be a lie now. A composer
 * whose helper line disagrees with the reader is the failure-that-looks-like-
 * success this repo has paid for repeatedly, in either direction.
 */

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Megaphone, Send, Volume2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { sendCoordinatorBroadcast, type ReleaseScheduleResult } from '../../_actions/day-of-broadcast';
import { PaidMark } from '@/app/_components/paid-mark';
import {
  BROADCAST_MAX_LENGTH,
  type BroadcastSenderRole,
  type CoordinatorBroadcastItem,
} from '@/lib/coordinator-broadcasts';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { formatCount } from '@/lib/format-number';
import { Tip } from './day-ui';

const SENDER: Record<BroadcastSenderRole, string> = {
  couple: 'The couple',
  coordinator: 'Your coordinator',
};

/** A real instant (`created_at`), read on the venue's clock. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    timeZone: DEFAULT_EVENT_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 📵 The send never answered. It may have gone out — so: look at the list (re-read) before sending again. */
const ANNOUNCE_NOT_CONFIRMED = 'We couldn’t confirm that went out. Check your recent announcements below before sending it again.';

export function AnnounceButton({
  eventId,
  isEventDay,
  recent,
  round = false,
  release = null,
}: {
  /** 📣 Release (plan §3, §3b): the full schedule's state for this event; null = not offered here (the Maker). */
  release?: ReleaseState | null;
  /** 🔊 A 44-px round at the end of Booked › Schedule's one line (frame 19, owner 2026-10-31) — the word is its name. */
  round?: boolean;
  eventId: string;
  /** Inside the day-of window — guests see it at once. Before: on the day. */
  isEventDay: boolean;
  /** Latest announcements, newest first; `null` = the read was refused. */
  recent: CoordinatorBroadcastItem[] | null;
}) {
  const router = useRouter();
  // 📣 `?announce=1` — the supplier's "Message everyone" door (S9, owner 2026-10-29) lands with the sheet open.
  const arrivedToAnnounce = useSearchParams()?.get('announce') === '1';
  const [open, setOpen] = useState(arrivedToAnnounce);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const whenLine = isEventDay
    ? 'Guests see it at the top of their Event Hub right away.'
    : 'Guests see your latest announcement at the top of their Event Hub right away, and it stays there through the day.';

  function send() {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('body', text);
      /* 📵 A send that never answered (no signal, a 5xx) is NOT known to have failed — the announcement may have gone
         out, and pressing again would send it twice. So it is never thrown into this transition (it replaced the
         whole page with the app's error screen), never called sent, and never called failed: the words stay in the
         box, the list below is re-read so it shows whether it went, and the line says to look first. */
      let result: Awaited<ReturnType<typeof sendCoordinatorBroadcast>>;
      try {
        result = await sendCoordinatorBroadcast(fd);
      } catch {
        setError(ANNOUNCE_NOT_CONFIRMED);
        // one-render: keep (after-failure) — a send that never answered revalidated nothing here; re-read whether it went.
        router.refresh();
        return;
      }
      if (result.ok) {
        setText('');
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {/* 🔊 The door: a 44-px round on Booked › Schedule's one line (its word is its name), else icon + "Announce". */}
      <ActionButton
        tone="neutral"
        icon={round ? Volume2 : Megaphone}
        label={round ? 'Announce to your guests' : 'Announce'}
        iconOnly={round}
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        aria-haspopup="dialog"
        data-announce-door={round ? 'round' : 'word'}
        className={round ? 'shrink-0' : undefined}
      />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById="announce-title" wide rise>
        <div className="space-y-4 px-5 pb-6 pt-5">
          <div className="flex items-center gap-2 pr-14">
            <h2 id="announce-title" className="text-lg font-semibold leading-tight text-ink">
              Announce to your guests
            </h2>
            <Tip align="end">
              One message to every guest who has opened their invitation. The latest one sits at the top
              of their Event Hub. Hosts and your approved coordinator can announce.
            </Tip>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={BROADCAST_MAX_LENGTH}
            rows={3}
            aria-label="Your announcement"
            placeholder="e.g. Dinner is moving up 15 minutes — please find your seats."
            className="w-full resize-none border-0 border-b border-[color:var(--m-line)] bg-transparent px-0 py-1.5 text-base leading-normal text-ink outline-none focus:border-ink"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[color:var(--m-slate-2)]">{whenLine}</p>
            <span className="shrink-0 text-xs tabular-nums text-[color:var(--m-slate-2)]">
              {formatCount(text.length)}/{formatCount(BROADCAST_MAX_LENGTH)}
            </span>
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger-700">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p role="status" className="text-sm font-medium text-success-700">
              {isEventDay ? 'Announced.' : 'Announced — it’s at the top of your guests’ Event Hub now.'}
            </p>
          ) : null}
          <div className="flex justify-end">
            <ActionButton
              tone="brand"
              main
              icon={Send}
              label={pending ? 'Announcing…' : 'Announce'}
              onClick={send}
              waiting={pending}
              disabled={!pending && text.trim().length === 0}
            />
          </div>

          {release ? <ReleaseRow eventId={eventId} release={release} /> : null}

          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">Latest</p>
            {recent === null ? (
              <p className="mt-2 text-sm text-[color:var(--m-slate-2)]">
                We couldn’t load your recent announcements right now. Refresh in a moment.
              </p>
            ) : recent.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--m-slate-2)]">Nothing announced yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-[color:var(--m-line)]">
                {recent.map((b) => (
                  <li key={b.broadcastId} className="py-2.5">
                    <p className="text-xs font-semibold text-[color:var(--m-slate-2)]">
                      {SENDER[b.senderRole]} · {when(b.createdAt)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink">{b.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** What the 🔊 sheet knows about Release — `lib/schedule-release.server.ts` `readScheduleRelease`, as drawn. */
export type ReleaseState =
  | { kind: 'unread' }
  | { kind: 'ok'; releasedAt: string | null; pro: boolean; proHref: string | null };

/**
 * 📣 RELEASE (owner 2026-11-01: *"Coordinator or host presses release"* · *"Just norifications please"*; plan §3, §3b).
 * Until it is pressed guests see the chapters they are invited to (role holders an Estimated call time); after, each
 * guest sees their own full schedule and exact call time. Pressing asks once, then notifies every guest with an account
 * in-app — never by email — and it cannot be taken back.
 *
 * 💎 On Free the row wears ◆ Pro and its button opens the upgrade: Release never works on Free (the action refuses
 * too). Free's guests keep the before view for good — nothing breaks.
 */
function ReleaseRow({ eventId, release }: { eventId: string; release: ReleaseState }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releasedAt, setReleasedAt] = useState<string | null>(release.kind === 'ok' ? release.releasedAt : null);
  const [told, setTold] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function press() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      // Release rides the sheet's one action (`intent=release`) — the same press, one route.
      fd.set('intent', 'release');
      let result: ReleaseScheduleResult;
      try {
        result = (await sendCoordinatorBroadcast(fd)) as ReleaseScheduleResult;
      } catch {
        setError('We couldn’t confirm the release. Open this again to see whether it went through.');
        return;
      }
      if (result.ok) {
        setReleasedAt(result.releasedAt);
        setTold(result.already ? null : result.told);
        setAsking(false);
      } else {
        setError(result.error);
      }
    });
  }

  const toldLine =
    told !== null ? ` ${formatCount(told)} ${told === 1 ? 'guest was' : 'guests were'} notified.` : '';

  return (
    <div className="space-y-2 border-t border-[color:var(--m-line)] pt-4" data-release-row={release.kind === 'unread' ? 'unread' : releasedAt ? 'released' : release.pro ? 'ready' : 'free'}>
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold text-ink">Full schedule</p>
        <Tip align="end">
          Until you release it, guests see the chapters they are invited to, and people with a role see an estimated
          call time. After you release it, each guest sees their own full schedule and exact call time on Me. Guests
          with an account get a notification; there is no email.
        </Tip>
      </div>
      {release.kind === 'unread' ? (
        <p className="text-sm text-[color:var(--m-slate-2)]">We couldn’t load whether the schedule is released. Refresh in a moment.</p>
      ) : releasedAt ? (
        <p role="status" className="text-sm text-[color:var(--m-slate-2)]">
          Released {when(releasedAt)}. Each guest sees their own schedule on Me.{toldLine}
        </p>
      ) : !release.pro ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--m-slate-2)]">Guests see their chapters and an estimated call time.</p>
          {release.proHref ? (
            <ActionButton
              tone="neutral"
              icon={<PaidMark state="try" label="Part of Pro" size="xs" />}
              label="Release"
              name="Release — part of Pro"
              href={release.proHref}
              data-release-pro=""
              className="shrink-0"
            />
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--m-slate-2)]">
              Release
              <PaidMark state="try" label="Part of Pro" size="xs" />
            </span>
          )}
        </div>
      ) : asking ? (
        <div className="space-y-2" data-release-ask>
          <p className="text-sm text-[color:var(--m-slate-2)]">
            <strong className="font-semibold text-ink">Release the full schedule now?</strong> Every guest sees their own lines and call time, and guests with an account
            get a notification. This can’t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <ActionButton tone="neutral" icon={X} label="Not now" onClick={() => setAsking(false)} />
            <ActionButton
              tone="ok"
              icon={Check}
              label={pending ? 'Releasing…' : 'Release'}
              onClick={press}
              waiting={pending}
              data-release-confirm=""
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--m-slate-2)]">Guests see their chapters and an estimated call time.</p>
          <ActionButton
            tone="neutral"
            icon={Volume2}
            label="Release"
            onClick={() => setAsking(true)}
            data-release-press=""
            className="shrink-0"
          />
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
