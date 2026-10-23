'use client';

// The save-first status chip — corpus 0012_papic/0012_papic_offline_note.md §6
// ("✓ Online · synced · 📡 Offline · X items queued · 🔄 Syncing X of Y"), in the
// house's words: one short line, the detail behind the ⓘ.
//
// 🔑 A FAILURE NEVER READS LIKE SUCCESS OR LIKE NOTHING (repo rule: the
// measurement must reach the render). "All saved" shows only when the queue is
// genuinely empty after this visit sent something; shots kept for credits, or
// refused, say so — with a number.

import { useEffect, useState } from 'react';
import { Check, CircleAlert, Loader2, WifiOff } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { EVENT_PUT_AWAY_CAPTURE_COPY } from '@/lib/event-accepts-captures-rule';
import { chipLabel, type ChipState } from '@/lib/papic-upload/schedule';
import { papicUploader } from '@/lib/papic-upload/browser';
import type { UploaderSnapshot } from '@/lib/papic-upload/replayer';

/** The page's uploader, as React state. Starts the uploader on first use. */
export function usePapicUploads(): UploaderSnapshot | null {
  const [snap, setSnap] = useState<UploaderSnapshot | null>(null);
  useEffect(() => papicUploader().subscribe(setSnap), []);
  return snap;
}

function refusedDetail(reason: string): string {
  switch (reason) {
    case 'guest_capture_closed':
    case 'guest_capture_not_open_yet':
    case 'event_over':
      return 'Couldn’t save these — the event’s cameras were closed when they tried to send.';
    case 'event_put_away':
      return EVENT_PUT_AWAY_CAPTURE_COPY;
    case 'expired':
      return 'Couldn’t save these — they waited more than a week without signal and were removed from this phone.';
    case 'lost_on_phone':
      return 'Couldn’t save these — this phone cleared its storage before they could send.';
    default:
      return 'Couldn’t save these — the event did not accept them.';
  }
}

function keptDetail(reason: string | null): string {
  switch (reason) {
    case 'guest_capture_closed':
    case 'guest_capture_not_open_yet':
    case 'event_over':
      return 'Not sent yet — the event’s cameras were closed when these tried to send. They stay on this phone and send if the cameras open again.';
    case 'event_put_away':
      return 'Not sent yet — the hosts put this event away. These stay on this phone and send if it comes back.';
    case null:
      return 'These belong to another event or another person on this phone. They stay here and send when that camera is open again.';
    default:
      return 'Not sent yet — the event didn’t accept these today. They stay on this phone and are tried again.';
  }
}

function detail(state: ChipState): string {
  switch (state.kind) {
    case 'saved':
      return 'Every shot from this phone reached the event. Nothing is waiting here.';
    case 'sending':
      return 'Shots save on this phone first and send in the background — small copies first, so they appear quickly. Keep this page open until it says All saved.';
    case 'offline':
      return 'No signal. Your shots are safe on this phone and send by themselves when the signal comes back. Keep this page open.';
    case 'credits':
      return 'The event’s credits ran out, so these shots are kept on this phone. They send as soon as the hosts add more.';
    case 'kept':
      return keptDetail(state.reason);
    case 'memory':
      return 'This browser won’t keep photos on the phone (a private window). Keep this page open until it says All saved, or these shots are lost.';
    case 'refused':
      return refusedDetail(state.reason);
    case 'idle':
      return '';
  }
}

/** `surface` — the pill's colours over this camera (default: the guest camera's). */
export function PapicUploadChip({ surface = 'bg-cream/10 text-cream' }: { surface?: string }) {
  const snap = usePapicUploads();
  if (!snap) return null;
  const label = chipLabel(snap.chip);
  if (!label) return null;
  const kind = snap.chip.kind;
  const Icon =
    kind === 'saved' ? Check : kind === 'sending' ? Loader2 : kind === 'offline' ? WifiOff : CircleAlert;
  // ⓘ for 'kept' explains the reason; a context wait has none (it is not a refusal).
  return (
    <span
      role="status"
      aria-live="polite"
      data-papic-upload-chip={kind}
      // The ⓘ is drawn for a light ground; over the camera it wears cream.
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${surface} [&_button]:border-cream/50 [&_button]:text-cream/80`}
    >
      <Icon aria-hidden className={`h-3.5 w-3.5 shrink-0${kind === 'sending' ? ' animate-spin' : ''}`} strokeWidth={2} />
      <InfoTip label={label} align="center">
        {detail(snap.chip)}
      </InfoTip>
    </span>
  );
}
