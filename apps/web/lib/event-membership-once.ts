import type { SupabaseClient } from '@supabase/supabase-js';
import { askedOnce } from '@/lib/request-once';
import { withSchemaRetry } from '@/lib/read-retry';

/**
 * apps/web/lib/event-membership-once.ts — "WHAT IS THIS PERSON ON THIS EVENT?"
 * IS ASKED ONCE PER RENDER.
 *
 * ── WHY (measured 2026-10-20, the couple's Guests tab) ─────────────────────
 * One render sent the byte-identical request
 * `event_members?select=member_type&event_id=eq.<e>&user_id=eq.<u>` THREE
 * times: the event layout's gate, the entitlement client's "does this viewer
 * host it?" (`viewerHostsEvent`), and the page's `fetchEventViewer`. Same
 * client, same question, same row — three trips, and production's log shows
 * `event_members` at 8.3k reads a day.
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────
 * That one read, remembered for the render by `askedOnce` (`lib/request-once.ts`):
 *   · keyed by WHO asks (the client's authority — a session client is one
 *     viewer, never another's), the event AND the user, so no answer is ever
 *     handed to a different person or event;
 *   · per render only — outside one (a server action, a route, a job) every
 *     call reads afresh, so a gate in an action still reads the database;
 *   · the schema-cache blip retry (`withSchemaRetry`) runs INSIDE the one read,
 *     so every asker gets the retried answer — the layout's gate still sees the
 *     same `{ data, error, status }` it always did and still throws
 *     "Reconnecting…" on a blip that outlasts the window, never a 404.
 * The answer is handed out as the database gave it — an error stays an error
 * for every asker, each of which degrades exactly as it did before.
 */
export function eventMemberTypeOnce(client: SupabaseClient, eventId: string, userId: string) {
  return askedOnce(client, 'event_members.member_type', [eventId, userId], () =>
    withSchemaRetry(() =>
      client
        .from('event_members')
        .select('member_type')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle(),
    ),
  );
}
