import 'server-only';

/**
 * lib/papic-photo-mark.server.ts — which mark an event's SERVER-MADE copies carry.
 *
 * The phone burns the mark into the copies it makes (lib/papic-upload/prepare.ts).
 * When it could not — no decode, no resize, an older camera — the server makes
 * them (lib/papic-derivatives.ts) and asks this for the SAME mark: the one
 * resolver both camera mounts use (`photoMarkOfEvent`), with Pro read through
 * the existing part gate (`eventHubPartActive(…, 'logo_qr')`).
 *
 * 🔒 FAILS TO THE SETNAYAN MARK, never to "no mark": a read that fails must not
 * leave a free event's photo unmarked (owner/controller 2026-10-24).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { eventHubPartActive } from '@/lib/couple-website-pro';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { SETNAYAN_PHOTO_MARK, type PapicMark } from '@/lib/papic-photo-mark';
import { photoMarkOfEvent, type MarkEventRow } from '@/lib/papic-photo-mark-of-event';

/** Is this event's camera dressed Pro? The Logo & QR part or Full Pro — the existing part gate.
 *  A failed read is the free camera, never a guess at Pro. */
export async function cameraProFor(admin: SupabaseClient, eventId: string): Promise<boolean> {
  return eventHubPartActive(admin, eventId, 'logo_qr').catch(() => false);
}

export async function serverPhotoMarkFor(admin: SupabaseClient, eventId: string): Promise<PapicMark> {
  try {
    const [row, pro] = await Promise.all([
      admin.from('events').select(`${HERO_MONOGRAM_COLUMNS}, logo_wanted`).eq('event_id', eventId).maybeSingle(),
      cameraProFor(admin, eventId),
    ]);
    if (row.error) {
      console.error('[supabase-error] lib/papic-photo-mark.server.ts · from:events.select (photo mark)', row.error);
      return SETNAYAN_PHOTO_MARK;
    }
    return photoMarkOfEvent((row.data ?? null) as MarkEventRow | null, pro);
  } catch {
    return SETNAYAN_PHOTO_MARK;
  }
}
