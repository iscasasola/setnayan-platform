import type { SupabaseClient } from '@supabase/supabase-js';

import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';

/**
 * apps/web/lib/event-entitlement-client.ts
 *
 * THE DECISION HALF of the one host-facing entitlement resolver. The server
 * wrapper that builds the real clients is `lib/event-entitlement-client.server.ts`
 * (server-only); this file holds no secret and takes every client as a
 * parameter, so a test can drive the real rule with stand-in clients.
 *
 * ── THE OWNER RULE (DECISION_LOG 2026-10-02, "A PRO PURCHASE UNLOCKS THE EVENT,
 *    NOT THE PERSON WHO PAID") ─────────────────────────────────────────────────
 * Every Pro / paid-service check asks "does THIS EVENT hold it?", never "did
 * THIS USER buy it?" — for every host and co-host, on every page and in every
 * server check, and the page and the server must read it the same way.
 *
 * 🔑 WHY A CLIENT, NOT A BOOLEAN. `orders` RLS is purchaser-scoped: through a
 * signed-in user's own session, `eventSkuActive` sees only the orders THAT user
 * placed. So a co-host who did not place the order read "not owned" while the
 * server gate (service client) allowed it — the Live Studio control page told a
 * co-host "no route" for a channel the event had paid for. Every entitlement
 * reader in the repo (`eventSkuActive`, `eventOwnsSku`, `eventActiveSkus`,
 * `resolveAddOnState`, `eventCoupleWebsiteProActive`, `resolveBroadcastWindow`,
 * …) already takes the client as its first parameter, so the fix is to hand
 * every host-facing call the SAME client the server checks use — the service
 * client — and to hand it out ONLY to a host of that event.
 *
 * 🔑 WHO COUNTS AS A HOST: everyone a host surface already admits — the UNION
 * of the existing host gates, so no viewer who reaches a host page can be
 * refused by this read:
 *   • an accepted, non-removed `event_moderators` row (any subtype — the event
 *     dashboard, `app/dashboard/[eventId]/layout.tsx`, admits a viewer helper);
 *   • an `event_members` row with `member_type` 'couple' (the dashboard) or
 *     'coordinator' (the Live Studio controller, `isLiveStudioSetupHost` in
 *     lib/panood-control-room-access.ts).
 * The entitlement is a fact about the event; anyone a host page shows the event
 * to must see the same fact, or the "Buy Pro" a co-host is shown for an event
 * that already has it is this bug again. Writes keep their own, stricter host
 * checks — this resolver only decides what an entitlement READ can see.
 *
 * 🔑 THE EVENT ID IS NEVER TRUSTED. Membership is read through the viewer's OWN
 * session (RLS lets a user read their own membership rows), for the exact
 * `eventId` the read is about. A guest, a supplier, a stranger, or a host of a
 * different event gets `NotAnEventHostError` — never the service client.
 *
 * Guests and suppliers are unchanged: their surfaces keep their own readers.
 */

/** Thrown when the signed-in viewer is not a host of the event being read. */
export class NotAnEventHostError extends Error {
  constructor(eventId: string) {
    super(`Not a host of event ${eventId || '(none)'} — an entitlement read is refused.`);
    this.name = 'NotAnEventHostError';
  }
}

/**
 * Is `userId` a host of `eventId`? Read through the viewer's OWN client. Any
 * read error is a "no" — a membership we could not confirm never unlocks the
 * service client.
 */
export async function viewerHostsEvent(
  userClient: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<boolean> {
  if (!userId || !eventId) return false;

  const { data: member, error: memberError } = await userClient
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memberError) {
    console.error('[supabase-error] lib/event-entitlement-client.ts · from:event_members.select', memberError, {
      event_id: eventId,
    });
  }
  // THE ONE definition of a host member type (app/[slug]/_lib/host-scope.ts) —
  // never a second copy of the literal.
  if (!memberError && isHostMemberType((member as { member_type?: string } | null)?.member_type)) {
    return true;
  }

  const { data: moderator, error: moderatorError } = await userClient
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderatorError) {
    console.error('[supabase-error] lib/event-entitlement-client.ts · from:event_moderators.select', moderatorError, {
      event_id: eventId,
    });
    return false;
  }
  return Boolean(moderator);
}

/**
 * THE RESOLUTION. Returns the service client for an entitlement read about
 * `eventId` when — and only when — the viewer hosts that event; otherwise throws
 * {@link NotAnEventHostError}. The service client is built lazily, after the
 * membership check, so a refused viewer never causes one to exist.
 */
export async function resolveEventEntitlementClient(deps: {
  eventId: string;
  userId: string | null;
  userClient: SupabaseClient;
  serviceClient: () => SupabaseClient;
}): Promise<SupabaseClient> {
  const { eventId, userId, userClient, serviceClient } = deps;
  if (!userId || !(await viewerHostsEvent(userClient, userId, eventId))) {
    throw new NotAnEventHostError(eventId);
  }
  return serviceClient();
}
