import 'server-only';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getCurrentUser } from '@/lib/auth';
import { resolveEventEntitlementClient } from '@/lib/event-entitlement-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * apps/web/lib/event-entitlement-client.server.ts
 *
 * THE ONE HOST-FACING ENTITLEMENT RESOLVER (owner rule 2026-10-02: a Pro
 * purchase unlocks the EVENT, not the person who paid). Every host page and
 * host server check passes the client this returns as the first argument of
 * the existing entitlement reader it already calls:
 *
 *     const ent = await eventEntitlementClient(eventId);
 *     const owned = await eventSkuActive(ent, eventId, SKU);
 *
 * It is the service client — the same one the server gates read through — and
 * it is handed out only after the signed-in viewer is confirmed as a host of
 * THAT event (see lib/event-entitlement-client.ts for the rule and the why).
 * A non-host gets `NotAnEventHostError`; call sites that already `.catch(() =>
 * false)` therefore fail closed.
 *
 * cache()d per request and per event, so a page that reads ten SKUs confirms
 * membership once.
 *
 * 🚫 Do not pass a user-session client (`await createClient()`) to an
 * entitlement reader on a host surface — `orders` RLS is purchaser-scoped and a
 * co-host would read "not owned". `lib/pro-unlocks-the-event.test.ts` fails the
 * build if one comes back.
 */
export const eventEntitlementClient = cache(async (eventId: string): Promise<SupabaseClient> => {
  const user = await getCurrentUser();
  return resolveEventEntitlementClient({
    eventId,
    userId: user?.id ?? null,
    userClient: await createClient(),
    serviceClient: createAdminClient,
  });
});
