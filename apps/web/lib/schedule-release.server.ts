import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eventCoupleWebsiteProActive } from './couple-website-pro';
import { eventEntitlementClient } from './event-entitlement-client.server';
import { asViewed } from './view-as-free.server';
import { getIapGate } from './request-platform';
import { logQueryError } from './supabase/error-detect';
import type { NotificationType } from './notifications';

/**
 * 🔔 The one notice Release writes — by the DATABASE (`release_full_schedule`), in one statement, never emitNotification.
 * The function returns the type it wrote; the press checks it against this, so the database and the app's union can
 * never drift apart in silence (a renamed enum value would otherwise reach every guest as a type the tray cannot draw).
 */
export const RELEASE_NOTICE_TYPE: NotificationType = 'schedule_released';

/**
 * 📣 RELEASE — the hosts' side (owner 2026-11-01; DECISION_LOG "FULL SCHEDULE: A HOST OR COORDINATOR PRESSES RELEASE,
 * NOTIFICATIONS ONLY"; plan §3, §3b, §4 "Release + announce · Schedule's 🔊 round").
 *
 * 💎 RELEASE IS PRO (§3b, ruled 1 Nov: *"chapters Free · View as and Release Pro"*). It is not an Event Hub part, so
 * the question is the whole of Pro (`eventCoupleWebsiteProActive`, listed in `every-pro-gate-names-its-part.test.ts`),
 * asked through the one host-facing entitlement client (a host or an accepted coordinator — `eventEntitlementClient`).
 *   · `releasePro` — THE GATE at the press: the real answer. A refused read answers Free (the press refuses).
 *   · `readScheduleRelease` — what the 🔊 sheet draws: the release time, and Pro AS THIS VIEWER IS SHOWN IT (`asViewed`
 *     — the owner's "view as a free couple" switch takes Pro away, never grants it), with the upgrade's door.
 * The guests' side asks the same question for itself (`app/[slug]/_lib/your-schedule.server.ts`), so a Free event's
 * guests never see a full schedule whatever the column says.
 */
export async function releasePro(eventId: string): Promise<boolean> {
  try {
    return await eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId);
  } catch {
    return false;
  }
}

export type ScheduleReleaseFacts =
  | { kind: 'unread' }
  | {
      kind: 'ok';
      /** When it was released (ISO); null = not yet. */
      releasedAt: string | null;
      /** The event holds Pro, as this viewer is shown it. */
      pro: boolean;
      /** Where a Free event's Release opens the upgrade; null = no door here (a store shell that sells none). */
      proHref: string | null;
    };

export async function readScheduleRelease(supabase: SupabaseClient, eventId: string): Promise<ScheduleReleaseFacts> {
  const [row, pro, gate] = await Promise.all([
    supabase.from('events').select('schedule_released_at').eq('event_id', eventId).maybeSingle(),
    asViewed(releasePro(eventId)).catch(() => false),
    getIapGate().catch(() => ({ storeShell: false, iap: false })),
  ]);
  if (row.error) {
    logQueryError('readScheduleRelease', row.error, { event_id: eventId }, 'graceful_degrade');
    return { kind: 'unread' };
  }
  return {
    kind: 'ok',
    releasedAt: (row.data as { schedule_released_at?: string | null } | null)?.schedule_released_at ?? null,
    pro,
    // 🍎 Where Apple sells Pro, its page; any other store shell sells none — the door is absent there (shell rule).
    proHref: gate.iap ? `/dashboard/${eventId}/apple-pro` : gate.storeShell ? null : `/dashboard/${eventId}/studio/website-pro`,
  };
}
