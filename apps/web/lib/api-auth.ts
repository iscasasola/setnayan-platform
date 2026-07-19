import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey, hasScope, type ApiScope } from '@/lib/api-keys';
import { resolveApiVendor } from '@/lib/enterprise-vendor-gate';

export type ApiAuthResult = {
  userId: string;
  apiKeyId: string;
  scopes: ApiScope[];
  /**
   * The vendor profile this key is scoped to — the shop that holds the
   * api_access grant. Every /api/v1/vendor/* route filters to THIS id, so the
   * resolution happens once here and routes never re-derive it. Always present
   * on a successful auth (a key can't authenticate without an api_access grant).
   */
  vendorProfileId: string;
};

export type ApiAuthError = {
  status: number;
  error: 'missing_auth' | 'invalid_format' | 'invalid_key' | 'revoked' | 'expired' | 'no_api_access';
};

const ERROR_HTTP_STATUS: Record<ApiAuthError['error'], number> = {
  missing_auth: 401,
  invalid_format: 401,
  invalid_key: 401,
  revoked: 401,
  expired: 401,
  no_api_access: 403,
};

const ERROR_MESSAGE: Record<ApiAuthError['error'], string> = {
  missing_auth: 'Missing Authorization: Bearer header.',
  invalid_format: 'Authorization header is not a Setnayan API key.',
  invalid_key: 'API key not recognised.',
  revoked: 'API key has been revoked.',
  expired: 'API key has expired.',
  no_api_access: 'The Setnayan API requires a Custom vendor plan with API access enabled.',
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

  // The /api/v1 SDK requires an explicit API-access grant on an active Custom
  // vendor plan (owner 2026-07-11: "available if custom plan of enterprise
  // requests allowing api"). Enforce it at this shared auth choke point so every
  // bearer route inherits the gate. REVOCATION: a PAID custom plan auto-lapses on
  // non-renewal — pay-activation stamps vendor_profiles.tier_expires_at = now+28d
  // (lib/sku-activation.ts), so once the window ends the tier check below excludes
  // the vendor inline (before any sweep) and sweep_vendor_tier_expiry demotes the
  // plan on their next dashboard load. Admin actions also cut access immediately:
  // un-ticking api_access + re-activating, replacing the plan, or demoting the
  // tier. Only COMP / off-platform custom deals (activateCustomPlan, tier_expires_at
  // NULL) never auto-lapse — those stay admin-revocation-only by design.
  // The resolved vendorProfileId is carried on the auth result so vendor.* routes
  // scope to exactly the blessed shop without re-querying.
  const vendor = await resolveApiVendor(admin, data.user_id);
  if (!vendor) {
    return authError('no_api_access');
  }

  // Don't await — log the touch and return immediately.
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key_id', data.api_key_id)
    .then();

  const scopes = Array.isArray(data.scopes) ? (data.scopes as ApiScope[]) : [];

  return {
    userId: data.user_id,
    apiKeyId: data.api_key_id,
    scopes,
    vendorProfileId: vendor.vendorProfileId,
  };
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
