import { cache } from 'react';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { createClient } from '@/lib/supabase/server';
import { eventPapicGuestAccess } from '@/lib/papic-guest';
import { logQueryError } from '@/lib/supabase/error-detect';
import { papicHeadKind, shootNowLine, SHOOT_NOW_LABEL } from '@/lib/papic-shoot-now';
import {
  PAPIC_CAPTURE_GRACE_HOURS,
  formatCaptureCloseLabel,
  manilaCaptureCloseIso,
  manilaDate,
  formatPapicDayInWords,
} from '@/lib/papic-window';

/**
 * "When guests can shoot" — the host's say over everyone else's phone, now the HEAD SWITCH of Home's Papic card.
 *
 * Owner, 2026-08-07: *"The guests can have the option to use the app on the exact event or when the host allows it"* →
 * *"there should be a button for the host of the event to allow guests to use the papic."* Owner, 2026-10-30:
 * *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic on papic's widget
 * with that toggle switch"*.
 *
 * ── ONE CONTROL PER FACT ────────────────────────────────────────────────────
 * Until 2026-10-30 this was a button row inside the card's settings ("When guests can shoot" · "Open now" / "Event
 * day"). The head switch (`ShootNowSwitch`, mounted by `PapicHeadControl` in `papic-camera-settings.tsx`) replaces it:
 * the row is gone, and this file only READS what the head needs — which switch, its saved value, and the words for the
 * settings' ⓘ. Its only seat was the card (the Papic page is removed), so no other door lost a control.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 * Guests had NO time gate of any kind. A guest who redeemed their invite six months out could shoot into the couple's
 * gallery on any random Tuesday, and the couple had no way to say no.
 *
 * ── THE SWITCH IS ABSENT WHEN THERE IS NOTHING TO DECIDE ────────────────────
 * Papic off, or guest access 'off' (no pass, no pool, the host said No) → the head keeps the Papic switch: a "shoot
 * now" there would be a control that cannot change what the guest sees. 'unknown' access keeps the shoot-now switch —
 * it only widens WHEN; the upload route still runs `eventPapicGuestActive`.
 *
 * `cache()` — the head's switch, its line and the settings' ⓘ each ask; one render reads once.
 */
export type ShootNowState =
  | { kind: 'papic' }
  | { kind: 'shoot-now'; early: boolean | null; line: string; detail: string | null };

export const readShootNow = cache(async (eventId: string, papicOn: boolean | null): Promise<ShootNowState> => {
  if (papicOn !== true) return { kind: 'papic' };
  const supabase = await createClient();
  const [read, access] = await Promise.all([
    supabase.from('events').select('papic_guest_capture_early, event_date, papic_window_end').eq('event_id', eventId).maybeSingle(),
    // The pass/pool check reads rows the couple's own client is not entitled to — the same call the guest camera makes.
    eventEntitlementClient(eventId)
      .then((ent) => eventPapicGuestAccess(ent, eventId))
      .catch((): 'unknown' => 'unknown'),
  ]);
  if (papicHeadKind(papicOn, access) === 'papic') return { kind: 'papic' };

  // ⚠ Supabase resolves with { error } rather than throwing, and an RLS denial reads as an empty result. Either way the
  // saved value is NOT KNOWN — said so on the head ("Couldn’t check just now"), never drawn as an "off".
  // 🚨 For weeks `papic_guest_capture_early` carried no SELECT grant and this read was refused on every render (fixed by
  // 20271179873885) — the log is so the NEXT refusal leaves a trail instead of a blank space.
  if (read.error) logQueryError('readShootNow.event', read.error, { eventId }, 'graceful_degrade');
  if (read.error || !read.data) return { kind: 'shoot-now', early: null, line: shootNowLine(null), detail: null };

  const row = read.data as { papic_guest_capture_early: boolean | null; event_date: string | null; papic_window_end: string | null };
  const early = row.papic_guest_capture_early === true;
  return { kind: 'shoot-now', early, line: shootNowLine(early), detail: shootNowDetail(early, row.event_date, row.papic_window_end) };
});

/**
 * ⏰ THE ⓘ's SENTENCE IS BUILT FROM THE GATE'S OWN NUMBERS (owner 2026-09-22). Each label is formatted from the exact
 * instant `guestCaptureGate` compares against: the stored window end when the switch is ON, and
 * `manilaCaptureCloseIso(event day)` when it is OFF — literally the expression in that resolver's switch-OFF branch.
 */
export function shootNowDetail(early: boolean, eventDate: string | null, windowEnd: string | null): string {
  const eventDay = manilaDate(eventDate);
  if (early) {
    const openCloseLabel = formatCaptureCloseLabel(windowEnd);
    return `${SHOOT_NOW_LABEL} is on: your guests can take photos any time through your capture window${
      openCloseLabel ? `, which closes ${openCloseLabel}` : ''
    } — good for the pre-nup shoot, the fitting, or the night before.`;
  }
  const dayCloseLabel = eventDay ? formatCaptureCloseLabel(manilaCaptureCloseIso(eventDay)) : null;
  return `${SHOOT_NOW_LABEL} is off: your guests’ cameras open${
    eventDay ? ` on ${formatPapicDayInWords(eventDay) ?? eventDay}` : ' on your event day'
  } and stay on${
    dayCloseLabel
      ? ` until ${dayCloseLabel} — ${PAPIC_CAPTURE_GRACE_HOURS} hours past the end of the day`
      : ` until ${PAPIC_CAPTURE_GRACE_HOURS} hours after your event day ends`
  }. Switch it on if you want photos of the preparations too.`;
}
