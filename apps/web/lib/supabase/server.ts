import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { applyPersistentCookieDefaults, readClientType } from './cookies';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// React `cache()` deduplicates per request: every server component in the same
// render tree shares a single Supabase client instance instead of constructing
// a fresh one in every layout/page. Combined with the cached `getCurrentUser`
// helper (lib/auth.ts) and cached data fetchers (events, roles, notifications,
// i18n), this collapses the 3-4 auth round-trips and 2-3 duplicated DB queries
// that used to fire on every dashboard navigation.
//
// Server Components in Next 15 can't set cookies — that's handled by the
// session-refresh middleware in lib/supabase/middleware.ts. Setting from a
// Route Handler or Server Action still works, so the try/catch swallows the
// Server Component case without breaking the supported paths.
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const clientHint = readClientType(
    cookieStore.get('setnayan-client-type')?.value,
  );

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                applyPersistentCookieDefaults(options, clientHint),
              ),
            );
          } catch {
            // Server Component context — middleware will refresh on the next request.
          }
        },
      },
    },
  );
});
