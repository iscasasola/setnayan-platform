import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey, hasScope, type ApiScope } from '@/lib/api-keys';

export type ApiAuthResult = {
  userId: string;
  apiKeyId: string;
  scopes: ApiScope[];
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

const ERROR_MESSAGE: Record<ApiAuthError['error'], string> = {
  missing_auth: 'Missing Authorization: Bearer header.',
  invalid_format: 'Authorization header is not a Setnayan API key.',
  invalid_key: 'API key not recognised.',
  revoked: 'API key has been revoked.',
  expired: 'API key has expired.',
};

function authError(error: ApiAuthError['error']): ApiAuthError {
  return { status: ERROR_HTTP_STATUS[error], error };
}

/**
 * Resolves an incoming request to an authenticated API user.
 *
 * Expects `Authorization: Bearer sk_live_…`. Hashes the supplied key and
 * looks it up via the admin client (bypassing RLS). Returns the matched
 * user_id, api_key_id, and scope list on success, or a structured error
 * on failure.
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
    .select('api_key_id, user_id, revoked_at, expires_at, scopes')
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

  const scopes = Array.isArray(data.scopes) ? (data.scopes as ApiScope[]) : [];

  return { userId: data.user_id, apiKeyId: data.api_key_id, scopes };
}

export function isAuthError(
  result: ApiAuthResult | ApiAuthError,
): result is ApiAuthError {
  return 'error' in result;
}

/**
 * Standard JSON error response for the public API. Shape mirrors the
 * 0033 spec — every error body is `{ error: { code, message } }` so
 * downstream consumers can parse without sniffing the status code.
 */
export function apiErrorResponse(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  );
}

/**
 * Translates an `ApiAuthError` into the canonical `{ error: { code, message } }`
 * response. Lets every authenticated route share one error path.
 */
export function authErrorResponse(err: ApiAuthError): NextResponse {
  return apiErrorResponse(err.status, err.error, ERROR_MESSAGE[err.error]);
}

/**
 * Returns a 403 error response if the supplied auth result is missing the
 * requested scope, or `null` if the scope is present. Routes call this
 * after `authenticateApiRequest` returns a valid token:
 *
 *     const auth = await authenticateApiRequest(req);
 *     if (isAuthError(auth)) return authErrorResponse(auth);
 *     const scopeError = requireScope(auth, 'events.read');
 *     if (scopeError) return scopeError;
 */
export function requireScope(
  auth: ApiAuthResult,
  scope: ApiScope,
): NextResponse | null {
  if (hasScope(auth.scopes, scope)) return null;
  return apiErrorResponse(
    403,
    'insufficient_scope',
    `This API key is missing the required scope: ${scope}.`,
  );
}
