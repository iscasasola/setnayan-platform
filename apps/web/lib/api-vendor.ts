import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Shared helpers for the /api/v1/vendor/* enterprise-vendor read endpoints.
 *
 * Every vendor route follows the same shape:
 *   1. authenticateApiRequest → resolves the key AND its blessed vendorProfileId
 *   2. requireScope('vendor.<resource>.read')
 *   3. read SAFE columns via the admin client, filtered to auth.vendorProfileId
 *   4. vendorJson(...)
 *
 * The admin client bypasses RLS, so the `.eq(vendorScopeColumn, vendorProfileId)`
 * filter IS the tenancy boundary — it must be present on every query. Routes
 * hand-pick an allowlist of columns (never `select('*')`) so a new sensitive
 * column added to a table later can't silently leak through the API.
 */

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

/** Parse + clamp a `?limit=` query param to [1, MAX_LIMIT], default DEFAULT_LIMIT. */
export function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/** Canonical no-store JSON response for the vendor API. */
export function vendorJson(body: unknown): NextResponse {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
