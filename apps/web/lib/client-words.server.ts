import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile } from '@/lib/event-type-profile';
import { CLIENT_NOUN_FALLBACK, clientNounOf } from '@/lib/client-words';

/**
 * The supplier's word for this event's client (`clientNounOf` over the event type's profile). One read of
 * `events.event_type` with the service client — the caller has ALREADY established that this shop may see this event
 * (its brief / its thread). A refused read is the neutral "client", never "couple".
 */
export async function readClientNoun(eventId: string, admin = createAdminClient()): Promise<string> {
  try {
    const { data, error } = await admin.from('events').select('event_type').eq('event_id', eventId).maybeSingle();
    if (error) {
      console.error('[client-words] event_type read failed; saying "client"', { eventId, error: error.message });
      return CLIENT_NOUN_FALLBACK;
    }
    if (!data) return CLIENT_NOUN_FALLBACK;
    const type = ((data as { event_type: string | null }).event_type ?? '').trim();
    return type ? clientNounOf(await resolveProfile(type)) : CLIENT_NOUN_FALLBACK;
  } catch (err) {
    console.error('[client-words] event_type read threw; saying "client"', { eventId, err });
    return CLIENT_NOUN_FALLBACK;
  }
}
