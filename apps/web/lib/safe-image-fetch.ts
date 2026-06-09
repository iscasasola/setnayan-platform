/**
 * SSRF-guarded image fetch for server-side use.
 *
 * The mood-board concept PDF (and any future feature) fetches image bytes from
 * URLs stored in `event_inspiration_assets.image_url`. Today every writer
 * (uploadMoodboardSlot) stores a server-produced R2/Supabase public URL, but
 * the column's schema explicitly permits `source_kind = 'url_paste'` — a
 * free-text URL the host typed. The moment such a writer ships, an unguarded
 * server fetch() becomes an SSRF primitive (cloud metadata, localhost,
 * internal services). This helper closes that door regardless:
 *
 *   - only http/https
 *   - reject hostnames that resolve to private / loopback / link-local /
 *     metadata IP ranges
 *   - no redirect following (redirects are a classic allowlist-bypass)
 *   - require an image/* Content-Type
 *   - bounded by a timeout and a max body size
 *
 * Returns the image bytes, or null if the URL is unsafe / unreachable / not an
 * image — callers treat null as "skip this image".
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_V4: RegExp[] = [
  /^0\./, // "this" network
  /^10\./, // private
  /^127\./, // loopback
  /^169\.254\./, // link-local (incl. 169.254.169.254 cloud metadata)
  /^172\.(1[6-9]|2\d|3[01])\./, // private 172.16/12
  /^192\.168\./, // private
  /^192\.0\.0\./, // IETF protocol assignments
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
];

function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(':')) {
    // IPv6 (incl. IPv4-mapped)
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return false;
  }
  return PRIVATE_V4.some((re) => re.test(v));
}

export async function safeFetchImageBytes(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<Uint8Array | null> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const maxBytes = opts.maxBytes ?? 12_000_000;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  // Resolve the host and reject any private / internal target.
  try {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) return null;
  } catch {
    return null;
  }

  try {
    const res = await fetch(url, {
      redirect: 'manual', // a 3xx is an allowlist bypass → treat as failure
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (res.status !== 200) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.toLowerCase().startsWith('image/')) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null;
    return bytes;
  } catch {
    return null;
  }
}
