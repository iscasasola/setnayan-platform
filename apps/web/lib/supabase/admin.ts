import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client that uses the `service_role` key and bypasses RLS.
 *
 * Used for operations that need to read or write data the current user can't see
 * through RLS — e.g., validating an event-join token before the scanner has
 * become an event_member. Treat every call as "trust the function" and perform
 * application-level authorization inside the calling code.
 *
 * Never import this from a client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE env vars for admin client.');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
