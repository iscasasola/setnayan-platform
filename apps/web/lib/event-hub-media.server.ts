import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { hubMediaRefs, type HubMedia } from '@/lib/event-hub-media';

/**
 * The Event Hub album (owner 2026-10-23): the files the LIVE Hub points at — the event row and its scenes' canvases.
 * The draft is left out on purpose: a picture the couple has not applied is not "used on your Event Hub" yet.
 *
 * ⛔ CALL ONLY FOR A VIEWER ALREADY SHOWN THE COUPLE'S SOURCES (`viewerSeesCoupleScopedPapic`). The row is read with
 * the service client because `events` grants its columns one by one and a ref may sit on any of them.
 *
 * `null` = a read failed (the album says "couldn't load", never "nothing here").
 */
export async function fetchEventHubMedia(eventId: string): Promise<HubMedia[] | null> {
  const admin = createAdminClient();
  const [event, widgets] = await Promise.all([
    admin.from('events').select('*').eq('event_id', eventId).maybeSingle(),
    admin.from('invitation_widgets').select('config_json').eq('event_id', eventId),
  ]);
  if (event.error || widgets.error) {
    console.error('[supabase-error] lib/event-hub-media.server.ts · the rows a Hub ref lives on', {
      eventId,
      event: event.error?.message,
      widgets: widgets.error?.message,
    });
    return null;
  }
  const refs = hubMediaRefs(JSON.stringify([event.data ?? null, widgets.data ?? []]), eventId);
  const signed = await Promise.all(
    refs.map(async (r) => {
      const url = await displayUrlForStoredAsset(r.ref);
      return url ? { id: `hub:${r.key}`, url, kind: r.kind } : null;
    }),
  );
  return signed.filter((m): m is HubMedia => m !== null);
}
