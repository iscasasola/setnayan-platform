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
  scopes: ApiScope[];
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Scopes — 0033 Phase A + C surface.
//
// Tokens default to the smallest useful scope (`me.read`). Owners opt in to
// the broader read scopes from /dashboard/api-keys. Future phases (webhooks,
// bookings) will add their own scope strings on top of this list.
// ---------------------------------------------------------------------------

export const API_SCOPES = [
  'me.read',
  'events.read',
  'guests.read',
  'vendors.read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const DEFAULT_SCOPES: ApiScope[] = ['me.read'];

/**
 * Human-readable copy for each scope — surfaced next to the scope checkbox
 * on /dashboard/api-keys so owners understand what they're opting into.
 */
export const SCOPE_COPY: Record<
  ApiScope,
  { label: string; description: string; alwaysOn?: boolean }
> = {
  'me.read': {
    label: 'Profile (me.read)',
    description: 'Read your own user profile via /api/v1/me. Always enabled.',
    alwaysOn: true,
  },
  'events.read': {
    label: 'Events (events.read)',
    description: 'List + read your events via /api/v1/events.',
  },
  'guests.read': {
    label: 'Guests (guests.read)',
    description:
      'Read the guest list for events you are a member of via /api/v1/events/:id/guests.',
  },
  'vendors.read': {
    label: 'Vendors (vendors.read)',
    description:
      'Reserved for the V1.5 booking flow. /api/v1/vendors is already public.',
  },
};

/**
 * Returns the deduplicated, ordered subset of `API_SCOPES` corresponding to
 * the supplied raw FormData values. Always includes `me.read` so a token
 * is never useless. Unknown values are silently dropped.
 */
export function sanitizeScopes(raw: readonly string[] | undefined): ApiScope[] {
  const set = new Set<ApiScope>(['me.read']);
  for (const value of raw ?? []) {
    if ((API_SCOPES as readonly string[]).includes(value)) {
      set.add(value as ApiScope);
    }
  }
  return API_SCOPES.filter((s) => set.has(s));
}

export function hasScope(scopes: readonly string[] | null | undefined, scope: ApiScope): boolean {
  if (!scopes) return false;
  return scopes.includes(scope);
}
