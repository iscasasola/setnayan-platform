/**
 * lib/name-style.server.ts — reading one event's Name style
 * (`events.print_details.name_style`, lib/name-style.ts).
 *
 * ⚠ NO `import 'server-only'`, for the reason lib/role-names.server.ts gives:
 * it holds no secret (the caller hands in the client) and unit tests import
 * its callers.
 *
 * 🔑 A FAILED READ IS FULL, LOGGED — NEVER A BROKEN PAGE. The style is
 * presentation: if it cannot be read, every name still prints, whole, exactly
 * as it did before the style existed.
 *
 * Pass the session client on the dashboard (`print_details` is granted SELECT
 * to `authenticated`) and the admin client on every public surface.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_NAME_STYLE, nameStyleOfPrintDetails, type NameStyle } from '@/lib/name-style';
import { logQueryError } from '@/lib/supabase/error-detect';

export async function loadNameStyle(
  client: SupabaseClient,
  eventId: string,
  callSite = 'loadNameStyle',
): Promise<NameStyle> {
  const { data, error } = await client.from('events').select('print_details').eq('event_id', eventId).maybeSingle();
  if (error) {
    logQueryError(callSite, error, { event_id: eventId }, 'graceful_degrade');
    return DEFAULT_NAME_STYLE;
  }
  return nameStyleOfPrintDetails((data as { print_details?: unknown } | null)?.print_details);
}
