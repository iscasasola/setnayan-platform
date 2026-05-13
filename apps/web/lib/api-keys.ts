import { createHash, randomBytes } from 'node:crypto';

const KEY_PREFIX_LIVE = 'sk_live_';

/**
 * Generates a 32-byte url-safe random token wrapped in the `sk_live_`
 * prefix. The string format aligns with industry conventions (Stripe,
 * Resend, etc.) so couples/vendors instantly recognise it.
 */
export function generateApiKey(): string {
  const raw = randomBytes(32).toString('base64url');
  return `${KEY_PREFIX_LIVE}${raw}`;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Public display prefix — first 16 chars (`sk_live_AB12CD34`). Just enough
 * for the user to recognise their own key in a list, not enough to use.
 */
export function keyPrefix(key: string): string {
  return key.slice(0, 16);
}

export function maskKey(prefix: string): string {
  return `${prefix}…`;
}

export type ApiKeyRow = {
  api_key_id: string;
  public_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
};
