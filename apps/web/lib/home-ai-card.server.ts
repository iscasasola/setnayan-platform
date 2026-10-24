import 'server-only';

/**
 * lib/home-ai-card.server.ts — "SAI ON WATCH" FOR HOME'S SETNAYAN AI CARD (owner-approved 2026-10-24,
 * `home_control_center_2026-10-24_fable.html`). Nothing here is new knowledge: the alerts are the guard notifications
 * Setnayan AI already raises for this event (`lib/setnayan-ai-guard-plan.ts` → `ai_guard_alert` · `ai_payment_due`), still
 * unread, each with the deep link the guard wrote. Scoped to THIS event by that link (`/dashboard/<event>/…`) — the
 * notification row carries no event column.
 *
 * 🔒 HONEST — a refused read answers 'unread' (Supabase RESOLVES with `{ error }`), so the card says "Couldn't load",
 * never "all quiet". Held by `app/dashboard/[eventId]/home-ai-card-reads-honestly.test.ts`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/** The two notification types the AI guard emits (`setnayan-ai-guard-plan.ts`). */
export const SAI_WATCH_TYPES = ['ai_guard_alert', 'ai_payment_due'] as const;

export type SaiWatchAlert = { id: string; title: string; body: string | null; href: string | null };

export async function readSaiOnWatch(supabase: SupabaseClient, userId: string, eventId: string): Promise<SaiWatchAlert[] | 'unread'> {
  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id,title,body,related_url,created_at')
    .eq('user_id', userId)
    .in('type', [...SAI_WATCH_TYPES])
    .is('read_at', null)
    .like('related_url', `/dashboard/${eventId}/%`)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    logQueryError('HomeAiCard.saiOnWatch', error, { event_id: eventId }, 'graceful_degrade');
    return 'unread';
  }
  return ((data ?? []) as Array<{ notification_id: string; title: string | null; body: string | null; related_url: string | null }>).map((r) => ({
    id: r.notification_id,
    title: r.title ?? 'Sai noticed something',
    body: r.body,
    href: r.related_url,
  }));
}
