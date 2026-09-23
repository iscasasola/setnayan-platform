import 'server-only';

/**
 * sign-in-door.server.ts — the one place that asks the database which door an
 * email uses. Service role, through `public.sign_in_door_for_email` (revoked
 * from anon and authenticated; see its migration).
 *
 * ⚠ CALLED ONLY AFTER `signInWithPassword` HAS REFUSED, and only for the
 * credentials refusal — never on blur, never on change, never before auth
 * (owner 2026-09-23). `lib/sign-in-door.test.ts` reads app/login/actions.ts and
 * pins that ordering; this file has exactly one caller.
 *
 * Fails CLOSED into `unknown`: a refused, thrown or malformed lookup must never
 * read as "wrong password" — that is the defect one layer down.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { SignInDoor } from './sign-in-door';

export async function lookupSignInDoor(email: string): Promise<SignInDoor> {
  const e = String(email ?? '').trim();
  if (!e) return { kind: 'none' };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('sign_in_door_for_email', { p_email: e });
    if (error) {
      console.warn('[sign-in-door] lookup refused:', error.message);
      return { kind: 'unknown' };
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { has_password?: boolean | null; providers?: string[] | null }
      | undefined;
    if (!row) return { kind: 'none' };
    return {
      kind: 'account',
      hasPassword: row.has_password === true,
      providers: Array.isArray(row.providers) ? row.providers.filter((p): p is string => typeof p === 'string') : [],
    };
  } catch (err) {
    console.warn('[sign-in-door] lookup threw:', err);
    return { kind: 'unknown' };
  }
}
