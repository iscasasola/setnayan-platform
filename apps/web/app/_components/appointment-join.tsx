'use client';

/**
 * How a VIRTUAL meeting is reached — a hand-off OUT of Setnayan, never an
 * in-app call (owner 2026-10-28 "remove both voice and video call"; meetings
 * follow-up approved 2026-11-04).
 *
 * This file used to open the in-app P2P call room on Join. It no longer imports
 * anything from the call stack (the server code stays until the owner rules on
 * deleting it) — guard: `lib/meetings-never-open-an-in-app-call.test.ts`.
 *
 *   • A confirmed meeting, from 15 min before start → one button that opens the
 *     proposer's own app: "Join on Google Meet" / "Join on Zoom" (new tab),
 *     "Open in Messenger", "Open in Viber" (viber://), "Call 0917 …" (tel:).
 *   • Before that, or while still proposed → the app + value read-only, with Copy.
 *   • No link yet (incl. every old video/voice row) → "No link yet" and an
 *     add-in-place field either party can save. Saves in place — no redirect.
 */

import { useActionState, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Phone, Video } from 'lucide-react';
import {
  joinIsOpen,
  parseVirtualLocation,
  virtualHandoff,
  virtualSummary,
  virtualValueText,
} from '@/lib/virtual-meeting';
import { setVirtualMeetingLink, type VirtualLinkState } from './appointments-actions';
import { VirtualMeetingFields } from './virtual-meeting-fields';

const NOT_YET: VirtualLinkState = { ok: false, error: null, savedAt: 0 };

export function AppointmentJoin({
  appointmentId,
  location,
  scheduledAt,
  confirmed,
  canEdit,
  returnPath,
  booked = false,
}: {
  appointmentId: string;
  /** `event_appointments.location` of a Virtual row (`"<via>|<value>"`, a bare link, or null). */
  location: string | null;
  scheduledAt: string | null;
  confirmed: boolean;
  /** Either party on a live (proposed / confirmed) meeting may add the link. */
  canEdit: boolean;
  returnPath: string;
  /** The booking check's answer for this meeting's (event, shop) — Viber / Phone hand-offs exist only when true. */
  booked?: boolean;
}) {
  const place = parseVirtualLocation(location);
  const handoff = virtualHandoff(place, booked);
  const [now, setNow] = useState(() => Date.now());
  // Re-check the 15-minute window once a minute while the card is on screen.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const [copied, setCopied] = useState(false);
  const [state, save, saving] = useActionState(setVirtualMeetingLink, NOT_YET);
  const [valid, setValid] = useState(true);

  if (!handoff) {
    // Nothing safe to open yet — say so, and let either side add it here.
    return (
      <div className="flex w-full flex-col gap-2" data-meeting-no-link>
        <p className="text-[11px] font-medium text-ink/60">
          {virtualSummary(place)} · <span className="text-ink/45">No link yet</span>
        </p>
        {canEdit ? (
          <form action={save} className="flex flex-col gap-2">
            <input type="hidden" name="appointment_id" value={appointmentId} />
            <input type="hidden" name="return_path" value={returnPath} />
            <VirtualMeetingFields
              key={state.savedAt}
              initialVia={place.via ?? 'jitsi'}
              booked={booked}
              onValidChange={setValid}
            />
            {state.error ? (
              <p role="alert" className="text-[11px] text-danger-700">
                {state.error}
              </p>
            ) : null}
            <button
              disabled={saving || !valid}
              className="inline-flex h-8 items-center self-start rounded-lg bg-ink px-3 text-xs font-semibold text-cream disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save link'}
            </button>
          </form>
        ) : null}
      </div>
    );
  }

  if (confirmed && joinIsOpen(scheduledAt, now)) {
    const Icon = place.via === 'phone' ? Phone : place.via === 'viber' ? Phone : Video;
    return (
      <a
        href={handoff.href}
        {...(handoff.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        data-meeting-join
        className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-700 px-2.5 py-1.5 text-[11px] font-semibold text-cream transition hover:bg-terracotta-800"
      >
        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {handoff.label}
        {handoff.newTab ? <ExternalLink aria-hidden className="h-3 w-3 opacity-70" strokeWidth={2} /> : null}
      </a>
    );
  }

  const text = virtualValueText(place);
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
      {confirmed ? (
        <p className="text-[10px] text-ink/45">“{handoff.label}” shows 15 min before the start.</p>
      ) : null}
    </div>
  );
}
