/**
 * Service-role Supabase client.
 *
 * Used for server-side writes that bypass RLS — chiefly for guest actions where
 * the actor is NOT a Supabase auth user (public guests authenticated via our
 * own magic-link JWT cookie). Never use from client code; never expose the
 * service-role key to the browser.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// Permissive Database type — replace with output of
// `supabase gen types typescript --project-id <ref>` once we adopt the CLI.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

let cached: SupabaseClient<Database> | null = null;

export function createAdminClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  cached = createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
