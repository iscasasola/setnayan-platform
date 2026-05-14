import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { applyPersistentCookieDefaults } from './cookies';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Server Components in Next 15 can't set cookies — that's handled by the
// session-refresh middleware in lib/supabase/middleware.ts. Setting from a
// Route Handler or Server Action still works, so the try/catch swallows the
// Server Component case without breaking the supported paths.
export async function createClient() {
  const cookieStore = await cookies();

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
              cookieStore.set(name, value, applyPersistentCookieDefaults(options)),
            );
          } catch {
            // Server Component context — middleware will refresh on the next request.
          }
        },
      },
    },
  );
}
