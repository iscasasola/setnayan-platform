'use client';

/**
 * How a VIRTUAL meeting is reached — a Jitsi room Setnayan makes, opened OUT of Setnayan, never an in-app call
 * (owner 2026-10-28 "remove both voice and video call"; 2026-11-04 "VIRTUAL = JITSI ONLY" and "ONE BUTTON THAT SAYS
 * WHAT THE ROOM NEEDS"). Nothing from the call stack is imported here — guard:
 * `lib/meetings-never-open-an-in-app-call.test.ts`.
 *
 *   • A confirmed meeting, from 15 min before start → ONE button (`roomButtonFor`):
 *       – no room yet → "Create the room" (ⓘ: you open it, signing in once). The proposer is offered it first
 *         (filled); the other side sees it outlined with a note, and may press it too. Pressing records who/when
 *         ONCE (`createMeetingRoom`) and opens the Jitsi link in a new tab;
 *       – created → "Room created · Enter the room" for everyone (ⓘ: no account needed).
 *     The state is read on load and set from the press's answer — no live connection.
 *   • Before that, or while still proposed → the link read-only, with Copy.
 *   • An older row's Meet / Zoom / Messenger link keeps its own "Join on …" (no room to create).
 */

import { useEffect, useState, useTransition } from 'react';
import { Check, Copy, ExternalLink, Video } from 'lucide-react';
import { InfoTip } from './info-tip';
import {
  joinIsOpen,
  meetingHasRoom,
  parseVirtualLocation,
  roomButtonFor,
  virtualHandoff,
  virtualSummary,
  virtualValueText,
} from '@/lib/virtual-meeting';
import { createMeetingRoom } from './appointments-actions';

const FILLED =
  'inline-flex items-center gap-1.5 rounded-lg bg-terracotta-700 px-2.5 py-1.5 text-[11px] font-semibold text-cream transition hover:bg-terracotta-800 disabled:opacity-60';
const OUTLINED =
  'inline-flex items-center gap-1.5 rounded-lg border border-terracotta-700/50 px-2.5 py-1.5 text-[11px] font-semibold text-terracotta-800 transition hover:bg-terracotta-700/[0.06] disabled:opacity-60'; // no-card-ok: the outlined "Create the room" <button> the other side is offered

export function AppointmentJoin({
  appointmentId,
  location,
  scheduledAt,
  confirmed,
  isProposer,
  roomCreatedAt,
  returnPath,
}: {
  appointmentId: string;
  /** `event_appointments.location` of a Virtual row (`"jitsi|<link>"`, an older app's value, a bare link, or null). */
  location: string | null;
  scheduledAt: string | null;
  confirmed: boolean;
  /** This viewer's side proposed the meeting (`initiated_by`) — offered "Create the room" first. */
  isProposer: boolean;
  /** `event_appointments.room_created_at` as read on load. */
  roomCreatedAt: string | null;
  returnPath: string;
}) {
  const [place, setPlace] = useState(() => parseVirtualLocation(location));
  const [createdAt, setCreatedAt] = useState(roomCreatedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  // Re-check the 15-minute window once a minute while the card is on screen (a clock, not a connection).
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const [copied, setCopied] = useState(false);

  const handoff = virtualHandoff(place);
  const open = confirmed && joinIsOpen(scheduledAt, now);

  // An older row's own app — no room to create; its link just opens.
  if (!meetingHasRoom(place)) {
    if (handoff && open) {
      return (
        <a href={handoff.href} target="_blank" rel="noopener noreferrer" data-meeting-join className={FILLED}>
          <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {handoff.label}
          <ExternalLink aria-hidden className="h-3 w-3 opacity-70" strokeWidth={2} />
        </a>
      );
    }
    return <ReadOnly text={virtualValueText(place)} copied={copied} setCopied={setCopied} note={confirmed && handoff ? `“${handoff.label}” shows 15 min before the start.` : null} />;
  }

  const room = roomButtonFor(createdAt, isProposer);

  if (open) {
    if (room.kind === 'enter' && handoff) {
      return (
        // The ⓘ hangs from the ROW's start (`!static` + a `relative` row), not from the ⓘ: from the ⓘ, ~150 px in,
        // an 18rem popover ran past a 390-px screen.
        <div className="relative flex flex-wrap items-center gap-2" data-meeting-room="enter">
          <span className="text-[11px] font-medium text-ink/60">{room.lead}</span>
          <a href={handoff.href} target="_blank" rel="noopener noreferrer" data-meeting-join className={FILLED}>
            <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {room.label}
            <ExternalLink aria-hidden className="h-3 w-3 opacity-70" strokeWidth={2} />
          </a>
          <InfoTip label="About entering" align="start" labelClassName="sr-only" className="!static">
            {room.tip}
          </InfoTip>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1" data-meeting-room="create">
        <div className="relative flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className={room.primary ? FILLED : OUTLINED}
            onClick={() => {
              setError(null);
              // Open the tab NOW, inside the tap — a tab opened after an await is blocked on iPhone.
              const tab = window.open('', '_blank');
              if (tab) {
                tab.opener = null;
                if (handoff) tab.location.href = handoff.href;
              }
              startTransition(async () => {
                const res = await createMeetingRoom(appointmentId, returnPath);
                if (!res.ok) {
                  tab?.close();
                  setError(res.error);
                  return;
                }
                setCreatedAt(res.createdAt);
                setPlace(parseVirtualLocation(`jitsi|${res.href}`));
                if (tab && !handoff) tab.location.href = res.href;
              });
            }}
          >
            <Video aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {pending ? 'Creating…' : room.label}
          </button>
          <InfoTip label="About creating the room" align="start" labelClassName="sr-only" className="!static">
            {room.tip}
          </InfoTip>
        </div>
        {room.note ? <p className="text-[10px] text-ink/50">{room.note}</p> : null}
        {error ? (
          <p role="alert" className="text-[11px] text-danger-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // Not yet — the link read-only (or "No link yet": the room makes it), and when the button will show.
  const when = confirmed ? `“${room.kind === 'enter' ? 'Enter the room' : 'Create the room'}” shows 15 min before the start.` : null;
  if (!place.value) {
    return (
      <div className="flex flex-col gap-1" data-meeting-no-link>
        <p className="text-[11px] font-medium text-ink/60">
          {virtualSummary(place)} · <span className="text-ink/45">No link yet</span>
        </p>
        {when ? <p className="text-[10px] text-ink/45">{when}</p> : null}
      </div>
    );
  }
  return <ReadOnly text={virtualValueText(place)} copied={copied} setCopied={setCopied} note={when} />;
}

function ReadOnly({
  text,
  copied,
  setCopied,
  note,
}: {
  text: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
  note: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1" data-meeting-readonly>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-[11px] text-ink/75">{text}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              },
              () => undefined,
            );
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink/15 px-1.5 py-0.5 text-[10px] font-medium text-ink/65 hover:bg-ink/[0.04]"
        >
          {copied ? <Check aria-hidden className="h-3 w-3" /> : <Copy aria-hidden className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {note ? <p className="text-[10px] text-ink/45">{note}</p> : null}
    </div>
  );
}
