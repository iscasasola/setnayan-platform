import type { NextRequest } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/**
 * Bearer-token → RLS-scoped Supabase client, for the native app's thin API
 * surface (the Papic-gallery reuse pattern — see api/events/[eventId]/papic-gallery).
 *
 * The Expo app holds a Supabase SESSION but can't run server actions; it calls
 * these JSON endpoints with `Authorization: Bearer <access_token>`. We scope a
 * client to that token so every read/write runs under the caller's OWN RLS —
 * the exact same gating the web server actions run under. NO service-role here:
 * privileged steps (notification fan-out, first-reply stamp) reuse the existing
 * server-side helpers, which create their own admin client internally.
 *
 * Returns either a ready `{ supabase, user }` pair or a `{ response }` carrying
 * the 401/500 to return verbatim — so route handlers stay a few lines.
 */
export type BearerAuth =
  | { supabase: SupabaseClient; user: User; response?: undefined }
  | { supabase?: undefined; user?: undefined; response: Response };

export async function authVendorBearer(req: NextRequest): Promise<BearerAuth> {
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7).trim() : '';
  if (!token) {
    return { response: Response.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { response: Response.json({ error: 'server_misconfigured' }, { status: 500 }) };
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { response: Response.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  return { supabase, user };
}
