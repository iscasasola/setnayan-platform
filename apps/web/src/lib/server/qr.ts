/**
 * Server-side QR code generation.
 *
 * Renders a guest's QR as inline SVG containing the HTTPS fallback URL
 * (`https://tayo.app/[event-slug]?invite=[qr_token]`). The encoded URL is the
 * cross-surface entry point — phone cameras and OS scanners route to the
 * personal invitation site; native apps with Universal/App Links registered
 * intercept the URL and route to the in-app handler.
 *
 * Caching: in-memory LRU map keyed by `(event_id, guest_id, qr_token)` so
 * regenerating the same QR within a request lifecycle is instant. Per the work
 * order, the next iteration migrates this cache to R2 (key
 * `qr/[event_id]/[guest_id].svg`); until then in-memory is fine for dev.
 */

import "server-only";
import QRCode from "qrcode";

interface CacheKey {
  event_id: string;
  guest_id: string;
  qr_token: string;
}

const cache = new Map<string, string>();

function key(k: CacheKey): string {
  return `${k.event_id}:${k.guest_id}:${k.qr_token}`;
}

export function buildInviteUrl(input: {
  origin: string; // e.g., "https://tayo.app" or "http://localhost:3000"
  event_slug: string;
  qr_token: string;
}): string {
  // Use `?invite=` so the URL behaves identically when scanned vs pasted.
  const url = new URL(`/${input.event_slug}`, input.origin);
  url.searchParams.set("invite", input.qr_token);
  return url.toString();
}

export async function generateGuestQrSvg(input: {
  origin: string;
  event_id: string;
  event_slug: string;
  guest_id: string;
  qr_token: string;
  size?: number; // pixel hint; SVG scales infinitely but margin/quiet-zone respects it
}): Promise<string> {
  const k = key({ event_id: input.event_id, guest_id: input.guest_id, qr_token: input.qr_token });
  const cached = cache.get(k);
  if (cached) return cached;

  const url = buildInviteUrl({
    origin: input.origin,
    event_slug: input.event_slug,
    qr_token: input.qr_token,
  });

  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: {
      // Tayo terracotta on cream — matches the brand. Browsers / scanners are
      // tolerant to non-pure-black QR foregrounds at error-correction M.
      dark: "#1A1A1A",
      light: "#00000000", // transparent so the host card's background shows through
    },
    width: input.size ?? 256,
  });

  cache.set(k, svg);
  // Keep the cache from unbounded growth in long-running dev sessions.
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  return svg;
}

/** Drop a cached QR after the guest's token rotates. */
export function invalidateGuestQrCache(input: {
  event_id: string;
  guest_id: string;
  qr_token: string;
}): void {
  cache.delete(key(input));
}
