import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey } from '@/lib/api-keys';

export type ApiAuthResult = {
  userId: string;
  apiKeyId: string;
};

export type ApiAuthError = {
  status: number;
  error: 'missing_auth' | 'invalid_format' | 'invalid_key' | 'revoked' | 'expired';
};

const ERROR_HTTP_STATUS: Record<ApiAuthError['error'], number> = {
  missing_auth: 401,
  invalid_format: 401,
  invalid_key: 401,
  revoked: 401,
  expired: 401,
};

function authError(error: ApiAuthError['error']): ApiAuthError {
  return { status: ERROR_HTTP_STATUS[error], error };
}

/**
 * Resolves an incoming request to an authenticated API user.
 *
 * Expects `Authorization: Bearer sk_live_…`. Hashes the supplied key and
 * looks it up via the admin client (bypassing RLS). Returns the matched
 * user_id + api_key_id on success, or a structured error on failure.
 *
 * Fire-and-forget updates last_used_at when the key is valid. Never blocks
 * the response on the update.
 */
export async function authenticateApiRequest(
  req: Request,
): Promise<ApiAuthResult | ApiAuthError> {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return authError('missing_auth');

  const key = match[1].trim();
  if (!key.startsWith('sk_')) return authError('invalid_format');
  const hash = hashApiKey(key);

  const admin = createAdminClient();
  const { data } = await admin
    .from('api_keys')
    .select('api_key_id, user_id, revoked_at, expires_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!data) return authError('invalid_key');
  if (data.revoked_at) return authError('revoked');
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return authError('expired');
  }

  // Don't await — log the touch and return immediately.
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key_id', data.api_key_id)
    .then();

  return { userId: data.user_id, apiKeyId: data.api_key_id };
}

export function isAuthError(
  result: ApiAuthResult | ApiAuthError,
): result is ApiAuthError {
  return 'error' in result;
}
