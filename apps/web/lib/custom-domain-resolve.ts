// Edge-safe custom-domain resolver used by middleware. Maps an incoming Host to
// the owner's internal path (/v/{slug} or /u/{slug}) via the SECURITY DEFINER
// resolve_custom_domain RPC. Uses a direct REST fetch with the anon key so the
// heavy supabase-js client never enters the edge middleware bundle. Fail-open:
// any miss/error returns null and the caller falls through to normal routing.

export function isSetnayanHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'setnayan.com' ||
    h.endsWith('.setnayan.com') ||
    h === 'setnayan.ph' ||
    h.endsWith('.setnayan.ph')
  );
}

export function isLocalOrPreviewHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.startsWith('localhost') ||
    h.startsWith('127.') ||
    h.startsWith('[::1') ||
    h.endsWith('.vercel.app')
  );
}

/** Resolve a verified custom domain host → '/v/{slug}' or '/u/{slug}', else null. */
export async function resolveCustomDomainPath(host: string): Promise<string | null> {
  return callResolverRpc('resolve_custom_domain', { p_host: host });
}

/**
 * Resolve a PAID event subdomain label ('juanandmaria' from
 * juanandmaria.setnayan.com) → the couple's event page at bare '/{slug}', but
 * ONLY when the event owns an active, non-expired EVENT_SUBDOMAIN order (the
 * resolve_event_subdomain SECURITY DEFINER RPC enforces that gate). Returns null
 * for a free/unowned label so the caller falls through to the free vendor rewrite.
 */
export async function resolveEventSubdomainPath(label: string): Promise<string | null> {
  return callResolverRpc('resolve_event_subdomain', { p_label: label });
}

/** Shared edge-safe scalar-text RPC caller (direct REST + anon key, fail-open). */
async function callResolverRpc(fn: string, body: Record<string, string>): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    // Scalar text RPC → the value is returned directly (JSON string) or null.
    const data: unknown = await res.json();
    return typeof data === 'string' && data.startsWith('/') ? data : null;
  } catch {
    return null;
  }
}
