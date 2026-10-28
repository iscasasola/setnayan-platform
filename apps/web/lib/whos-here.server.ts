import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { WHOS_HERE_WINDOW_MIN, hubViewsEnabled, parseHubViewers, type HubViewers } from './whos-here';

/**
 * Home's ONE read for Who's here (owner 2026-10-29): `event_hub_viewers`, under the viewer's own session — the
 * function is SECURITY INVOKER, so the event's policies (and the guests table's) decide what comes back. `null` = the
 * read failed or came back in a shape it does not promise: the card says "Couldn't load", never "nobody".
 * With the beacon switched off (`HUB_VIEWS_DISABLED`) nothing is read — the card says it is off.
 */
export async function readHubViewers(supabase: SupabaseClient, eventId: string): Promise<HubViewers | null> {
  if (!hubViewsEnabled()) return null;
  try {
    const { data, error } = await supabase.rpc('event_hub_viewers', {
      p_event_id: eventId,
      p_window_minutes: WHOS_HERE_WINDOW_MIN,
    });
    if (error) {
      console.error('[supabase-error] lib/whos-here.server.ts · rpc:event_hub_viewers', error);
      return null;
    }
    return parseHubViewers(data);
  } catch (err) {
    console.error('[whos-here] read failed', err);
    return null;
  }
}
