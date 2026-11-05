import 'server-only';

/**
 * maker-desk-title.server.ts — 🖥 THE EVENT'S NAME FOR THE DESKTOP MAKER'S TOP BAR (the adaptation doc's "Top nav":
 * "the event's name in the middle"; `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`, owner "all A").
 *
 * Its OWN small select, asked by the launch page ONLY while the desktop columns are on (dark for couples): the
 * Maker's other reads carry no name at all, and the launch page reads no GUEST by name
 * (`the-controller-wires-what-it-measured.test.ts`) — this is the EVENT's published name, never a guest's.
 *
 * ⚖ A read that failed is no name (the bar draws none) — never a placeholder that looks like the event's.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

export async function readMakerDeskTitle(supabase: SupabaseClient, eventId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('events').select('display_name').eq('event_id', eventId).maybeSingle();
    if (error) {
      logQueryError('LaunchPage.deskTitle', error, { event_id: eventId }, 'graceful_degrade');
      return null;
    }
    const name = (data as { display_name?: unknown } | null)?.display_name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}
