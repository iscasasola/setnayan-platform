import 'server-only';
/**
 * 📲 GUEST PHONE UPLOADS — the couple's reads (guest upload v2; owner 2026-11-13, rulings 2026-11-14 on #7607).
 *
 * Both columns are service-role only (migration 20271345220516 — no user grant), so these read with the admin client.
 * EVERY caller is a couple-checked page (the Papic settings in Memories, the Recap) and passes the event it already
 * proved the viewer hosts; nothing here decides who may look.
 *
 * ⚠ AN UNREAD IS NOT A "NO". A failed read returns `null` and the page says it could not check — never "Right away"
 * (the default) and never "nothing to check" (an empty list), which would tell a couple their guests' photos are
 * shown or that there is nothing waiting when neither is known. The repo's rule: the measurement must reach the render.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { memoriesRefs } from '@/lib/papic-display-ref';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';
import { eventDaysOf, eventDaysWords, type EventDays, type WaitingPhoneUpload } from '@/lib/papic-phone-uploads';

export type PhoneUploadsSetting = { held: boolean; days: EventDays | null; daysWords: string | null };

/** The couple's choice ("Right away" / "After I check") and the event day(s). Null = could not read. */
export async function readPhoneUploadsSetting(eventId: string): Promise<PhoneUploadsSetting | null> {
  const { data, error } = await createAdminClient()
    .from('events')
    .select('event_date, event_end_date, papic_phone_uploads_held')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[supabase-error] lib/papic-phone-uploads.server.ts · events', error);
    return null;
  }
  const row = data as { event_date: string | null; event_end_date: string | null; papic_phone_uploads_held: boolean | null };
  const days = eventDaysOf(row.event_date, row.event_end_date);
  return { held: row.papic_phone_uploads_held === true, days, daysWords: days ? eventDaysWords(days) : null };
}


/** This event's phone uploads still waiting for the couple's check — screened clean ones, oldest first. Null = unread. */
export async function readWaitingPhoneUploads(eventId: string): Promise<WaitingPhoneUpload[] | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('papic_guest_captures')
    .select('capture_id, guest_id, media_type, duration_ms, captured_at, thumb_r2_key, tile_r2_key, display_r2_key, poster_r2_key, clip_web_r2_key, r2_object_key, full_res_dropped_at, moderation_state')
    .eq('event_id', eventId)
    .eq('phone_upload', 'waiting')
    .eq('moderation_state', 'clean')
    .order('captured_at', { ascending: true })
    .limit(300);
  if (error) {
    console.error('[supabase-error] lib/papic-phone-uploads.server.ts · waiting', error);
    return null;
  }
  const rows = (data ?? []) as Array<{
    capture_id: string;
    guest_id: string;
    media_type: string | null;
    duration_ms: number | null;
    captured_at: string;
    thumb_r2_key: string | null;
    tile_r2_key: string | null;
    display_r2_key: string | null;
    poster_r2_key: string | null;
    clip_web_r2_key: string | null;
    r2_object_key: string | null;
    full_res_dropped_at: string | null;
  }>;
  const guestIds = [...new Set(rows.map((r) => r.guest_id))];
  const names = new Map<string, string>();
  if (guestIds.length > 0) {
    const { data: guests, error: gErr } = await admin.from('guests').select(ENTOURAGE_COLUMNS).in('guest_id', guestIds);
    if (gErr) console.error('[supabase-error] lib/papic-phone-uploads.server.ts · guests', gErr);
    for (const g of (guests ?? []) as { guest_id: string; display_name: string | null; first_name: string | null }[]) {
      names.set(g.guest_id, g.display_name?.trim() || g.first_name?.trim() || 'A guest');
    }
  }
  return Promise.all(
    rows.map(async (r) => ({
      captureId: r.capture_id,
      who: names.get(r.guest_id) ?? 'A guest',
      at: new Date(r.captured_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }),
      media: r.media_type === 'clip' ? ('clip' as const) : ('photo' as const),
      durationMs: r.duration_ms,
      url: await displayUrlForStoredAsset(memoriesRefs(r).grid),
    })),
  );
}
