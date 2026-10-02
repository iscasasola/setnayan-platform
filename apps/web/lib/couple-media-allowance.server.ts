import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS, isR2Configured, r2List } from '@/lib/r2';
import { MAKER_EVENT_MEDIA_BYTES_CAP, readCoupleMediaBytes } from '@/lib/maker-media-limits';
import { measureCoupleMediaBytes } from '@/lib/couple-media-allowance';

/**
 * The I/O half of the 100 MB allowance (`lib/couple-media-allowance.ts` holds the
 * rule and its reasoning). Service-role only: both functions it calls are
 * granted to `service_role` alone, so a couple can never move their own number.
 */

type Admin = ReturnType<typeof createAdminClient>;

export type CoupleMediaReservation =
  | { kind: 'reserved'; usedBytes: number }
  | { kind: 'full'; usedBytes: number }
  | { kind: 'unavailable' };

/**
 * Add `bytes` to the event's counter only if the total stays within the cap —
 * ONE atomic UPDATE (`reserve_couple_media_bytes`), so two uploads racing for the
 * last few megabytes cannot both get in. On a refusal the counter is SETTLED
 * first (a removed photo frees its bytes there) and the reservation asked once
 * more; only a second refusal is final.
 */
export async function reserveCoupleMediaBytes(
  eventId: string,
  bytes: number,
  admin: Admin = createAdminClient(),
): Promise<CoupleMediaReservation> {
  const ask = async (): Promise<number | null | 'error'> => {
    const { data, error } = await admin.rpc('reserve_couple_media_bytes', {
      p_event_id: eventId,
      p_bytes: bytes,
      p_cap: MAKER_EVENT_MEDIA_BYTES_CAP,
    });
    if (error) {
      console.error('[couple-media] reserve_couple_media_bytes failed', { eventId, error: error.message });
      return 'error';
    }
    return typeof data === 'number' ? data : data === null ? null : Number(data);
  };

  // One file larger than the whole allowance can never fit — no settle can help.
  if (bytes > MAKER_EVENT_MEDIA_BYTES_CAP) {
    return { kind: 'full', usedBytes: await readCoupleMediaBytes(admin, eventId) };
  }

  const first = await ask();
  if (first === 'error') return { kind: 'unavailable' };
  if (first !== null && Number.isFinite(first)) return { kind: 'reserved', usedBytes: first };

  // Over by the running counter — which still holds every removed photo. Settle
  // it against what the event really keeps, then ask once more.
  const settled = await settleCoupleMediaBytes(eventId, admin);
  if (settled !== null) {
    const second = await ask();
    if (second === 'error') return { kind: 'unavailable' };
    if (second !== null && Number.isFinite(second)) return { kind: 'reserved', usedBytes: second };
  }
  return { kind: 'full', usedBytes: await readCoupleMediaBytes(admin, eventId) };
}

/**
 * Every row a couple-media ref can live on, as one string: the event row (hero,
 * film, music, gallery, Save the Date media), every scene's canvas, and the
 * Event Hub draft with its undo snapshot. WHOLE rows on purpose — a ref filed on
 * a column this list never named still counts, so a new media field can only
 * make the number larger, never let a kept picture go uncounted. Null when any
 * read fails: a settle that cannot see every row must not lower the number.
 */
async function readReferenceText(admin: Admin, eventId: string): Promise<string | null> {
  const [event, widgets, draft] = await Promise.all([
    admin.from('events').select('*').eq('event_id', eventId).maybeSingle(),
    admin.from('invitation_widgets').select('config_json').eq('event_id', eventId),
    admin.from('event_site_drafts').select('draft_json, applied_snapshot').eq('event_id', eventId).maybeSingle(),
  ]);
  if (event.error || widgets.error || draft.error || !event.data) {
    console.error('[couple-media] could not read the rows a ref lives on', {
      eventId,
      event: event.error?.message,
      widgets: widgets.error?.message,
      draft: draft.error?.message,
    });
    return null;
  }
  return JSON.stringify([event.data, widgets.data ?? [], draft.data ?? null]);
}

/**
 * Measure what the event's couple media really occupies and write it to the
 * counter (`set_couple_media_bytes`). Returns the settled number, or null when
 * it could not measure (R2 unconfigured, a truncated listing, a failed read) —
 * in which case the counter is left exactly as it was.
 */
export async function settleCoupleMediaBytes(
  eventId: string,
  admin: Admin = createAdminClient(),
): Promise<number | null> {
  if (!isR2Configured()) return null;
  try {
    const [listing, referenceText] = await Promise.all([
      r2List({ bucket: R2_BUCKETS.media, prefix: `events/${eventId}/` }),
      readReferenceText(admin, eventId),
    ]);
    // A truncated listing is a floor, not a measurement (r2List's own warning).
    if (listing.truncated || referenceText === null) return null;
    const used = measureCoupleMediaBytes({
      eventId,
      objects: listing.objects,
      referenceText,
      now: new Date(),
    });
    const { error } = await admin.rpc('set_couple_media_bytes', { p_event_id: eventId, p_bytes: used });
    if (error) {
      console.error('[couple-media] set_couple_media_bytes failed', { eventId, error: error.message });
      return null;
    }
    return used;
  } catch (err) {
    console.error('[couple-media] settle failed', { eventId, error: err instanceof Error ? err.message : err });
    return null;
  }
}
