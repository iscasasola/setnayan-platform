import 'server-only';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

export type EnforceResult = { ok: boolean; retryAfterSecs: number; remaining: number };

/**
 * Two-layer rate limit. L1 = in-memory fixed-window (lib/rate-limit.ts) — a cheap
 * per-instance short-circuit. L2 = durable Postgres sliding-window (the
 * check_rate_limit RPC, service-role only). FAILS OPEN: if the RPC is missing or
 * errors, the request is allowed — never hard-fail a real user on a limiter outage,
 * and this lets the code ship safely BEFORE the migration is applied (L1-only until
 * then). Key on identity (user.id / api_key_id) where possible; IP is best-effort
 * (spoofable — see lib/client-ip.ts).
 */
export async function enforceRateLimit(
  bucket: string,
  ident: string | null,
  opts: { limit: number; windowSecs: number },
): Promise<EnforceResult> {
  const key = ident && ident.length ? ident : 'unknown';

  // L1 — in-memory fixed window. Cheap deny, absorbs single-instance floods.
  const l1 = rateLimit(`${bucket}:${key}`, opts.limit, opts.windowSecs * 1000);
  if (!l1.ok) {
    return { ok: false, retryAfterSecs: Math.max(1, Math.ceil(l1.retryAfterMs / 1000)), remaining: 0 };
  }

  // L2 — durable Postgres sliding window. Fail open on any error / absent RPC.
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_ident: key,
      p_limit: opts.limit,
      p_window_secs: opts.windowSecs,
    });
    if (error) return { ok: true, retryAfterSecs: 0, remaining: l1.remaining };
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; remaining?: number; retry_after_secs?: number }
      | null
      | undefined;
    if (row && row.allowed === false) {
      return {
        ok: false,
        retryAfterSecs: Math.max(1, Number(row.retry_after_secs ?? opts.windowSecs)),
        remaining: 0,
      };
    }
    return { ok: true, retryAfterSecs: 0, remaining: Number(row?.remaining ?? l1.remaining) };
  } catch {
    return { ok: true, retryAfterSecs: 0, remaining: l1.remaining };
  }
}

/** 429 response matching the existing /api/upload shape (JSON + Retry-After). */
export function rateLimited429(retryAfterSecs: number): NextResponse {
  return NextResponse.json(
    { error: 'rate_limited', message: 'Too many requests — please slow down.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSecs)) } },
  );
}
