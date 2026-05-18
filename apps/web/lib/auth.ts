import 'server-only';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Per-request memoization of `supabase.auth.getUser()`. Each dashboard
// navigation used to call `getUser()` from middleware, the outer layout,
// the event layout, and the page — four sequential auth-server round-trips
// in a row. With this helper they all resolve to the same Promise so the
// auth check fires exactly once per request.
//
// Cache key is the empty argument list (cache() is identity-stable for
// no-arg calls in the same render pass), so user A and user B in concurrent
// requests get separate caches automatically.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
