import { NextResponse } from 'next/server';
import { isPublicApiEnabled, publicApiDisabledResponse } from "@/lib/public-api-flag";
import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiErrorResponse,
  authenticateApiRequest,
  authErrorResponse,
  isAuthError,
  requireScope,
} from '@/lib/api-auth';

/**
 * Auth-gated whoami. The most basic authenticated endpoint — used to
 * verify a token works and to expose the calling user's public profile
 * fields. Future endpoints follow the same pattern: authenticate, then
 * use the resolved user_id with the admin client.
 */
export async function GET(req: Request) {
  // Public API disabled by default (no-public-API-in-V1 lock; owner blesses via PUBLIC_API_ENABLED). See lib/public-api-flag.ts.
  if (!isPublicApiEnabled()) return publicApiDisabledResponse();
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);

  const scopeError = requireScope(auth, 'me.read');
  if (scopeError) return scopeError;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('user_id, public_id, email, display_name, account_type, locale, created_at')
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (!profile) {
    return apiErrorResponse(404, 'user_not_found', 'User profile not found.');
  }

  return NextResponse.json(
    { data: profile },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}
