import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { ReentryPurpose } from '@/lib/guest-pass-hop';
import {
  exchangeReentryCode as exchangeWith,
  mintReentryCode as mintWith,
  reentryCodeGuest as guestWith,
  type ReentryDb,
  type ReentryExchange,
} from '@/lib/guest-reentry';

/**
 * The service-role door to lib/guest-reentry.ts (the short-lived, single-use
 * guest re-entry code — its rules and the why live there). The table has no
 * browser grant, so every call here uses the admin client; a client that
 * cannot be built answers like a refused code (null / not ok), never a throw.
 */
function admin(): ReentryDb | null {
  try {
    return createAdminClient() as unknown as ReentryDb;
  } catch {
    return null;
  }
}

export function mintReentryCode(input: { eventId: string; guestId: string; purpose: ReentryPurpose }): Promise<string | null> {
  return mintWith(input, admin());
}

export function exchangeReentryCode(input: { code: string | null | undefined; eventId: string }): Promise<ReentryExchange> {
  return exchangeWith(input, admin());
}

export function reentryCodeGuest(input: { code: string | null | undefined; eventId: string }): Promise<string | null> {
  return guestWith(input, admin());
}
