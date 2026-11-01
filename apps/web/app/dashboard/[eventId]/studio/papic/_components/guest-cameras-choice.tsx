import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { readHubDraft } from '@/lib/hub-draft-store';
import { papicIsOn } from '@/lib/event-answers';
import { logQueryError } from '@/lib/supabase/error-detect';
import { papicHeadLine, type PapicHeadFacts } from '@/lib/papic-shoot-now';
import {
  PAPIC_CAPTURE_GRACE_HOURS,
  formatCaptureCloseLabel,
  manilaCaptureCloseIso,
  manilaDate,
  formatPapicDayInWords,
} from '@/lib/papic-window';

/**
 * "When guests can shoot" — the host's say over everyone else's phone, now part of the ONE CONTROL in the head of
 * Home's Papic card: Off · On — event day · On — everyone, now (`PapicHeadPicker`, `lib/papic-shoot-now.ts`).
 *
 * Owner, 2026-08-07: *"The guests can have the option to use the app on the exact event or when the host allows it"* →
 * *"there should be a button for the host of the event to allow guests to use the papic."* Owner, 2026-10-30:
 * *"actually the switch on event home should be the let everybody shoot now function"* · *"If we cannot turn it off,
 * then maybe assign partial turn on?"*.
 *
 * ── ONE CONTROL PER FACT ────────────────────────────────────────────────────
 * Until 2026-10-30 this was a button row inside the card's settings ("When guests can shoot" · "Open now" / "Event
 * day"), beside a separate Papic switch in the head. Both are now the head's one dropdown; the row is gone, and this
 * file only READS what the head needs — the three facts and the words for the settings' ⓘ. Its only seat was the card
 * (the Papic page is removed), so no other door lost a control.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 * Guests had NO time gate of any kind. A guest who redeemed their invite six months out could shoot into the couple's
 * gallery on any random Tuesday, and the couple had no way to say no.
 *
 * `cache()` — the head's control, its line and the settings' ⓘ each ask; one render reads once.
 */
export type PapicHeadState = PapicHeadFacts & { line: string; detail: string | null };

export const readPapicHead = cache(async (eventId: string, live: boolean | null): Promise<PapicHeadState> => {
  const supabase = await createClient();
  const [read, draft] = await Promise.all([
    supabase.from('events').select('papic_guest_capture_early, event_date, papic_window_end').eq('event_id', eventId).maybeSingle(),
    /* 💾 `papic_on` as the couple is editing it — the Event Hub draft over live, the Maker's own overlay. A draft that
       cannot be read is NOT "no change": the head says it could not check, never a position it did not measure. */
    readHubDraft(supabase, eventId).then(
      (d) => ({ ok: true as const, d }),
      () => ({ ok: false as const }),
    ),
  ]);
  // ⚠ Supabase resolves with { error } rather than throwing, and an RLS denial reads as an empty result. Either way the
  // saved value is NOT KNOWN — said so on the head ("Couldn’t check just now"), never drawn as an "off".
  // 🚨 For weeks `papic_guest_capture_early` carried no SELECT grant and this read was refused on every render (fixed by
  // 20271179873885) — the log is so the NEXT refusal leaves a trail instead of a blank space.
  if (read.error) logQueryError('readPapicHead.event', read.error, { eventId }, 'graceful_degrade');
  const row = read.error ? null : (read.data as { papic_guest_capture_early: boolean | null; event_date: string | null; papic_window_end: string | null } | null);
  const early = row ? row.papic_guest_capture_early === true : null;
  const drafted = draft.ok ? ((draft.d?.events ?? {}) as Record<string, unknown>) : null;
  const draftOn = live === null || drafted === null ? null : 'papic_on' in drafted ? papicIsOn(drafted.papic_on) : live;
  const facts: PapicHeadFacts = { live, draftOn, early };
  return {
    ...facts,
    line: papicHeadLine(facts),
    detail: row && early !== null ? shootNowDetail(early, row.event_date, row.papic_window_end) : null,
  };
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
    return `On — everyone, now: your guests can take photos any time through your capture window${
      openCloseLabel ? `, which closes ${openCloseLabel}` : ''
    } — good for the pre-nup shoot, the fitting, or the night before.`;
  }
  const dayCloseLabel = eventDay ? formatCaptureCloseLabel(manilaCaptureCloseIso(eventDay)) : null;
  return `On — event day: your guests’ cameras open${
    eventDay ? ` on ${formatPapicDayInWords(eventDay) ?? eventDay}` : ' on your event day'
  } and stay on${
    dayCloseLabel
      ? ` until ${dayCloseLabel} — ${PAPIC_CAPTURE_GRACE_HOURS} hours past the end of the day`
      : ` until ${PAPIC_CAPTURE_GRACE_HOURS} hours after your event day ends`
  }. Pick On — everyone, now if you want photos of the preparations too.`;
}
