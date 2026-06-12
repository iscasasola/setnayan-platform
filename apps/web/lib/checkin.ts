/**
 * Day-of check-in helpers — pure functions, shared by the desk page and its
 * client scanner.
 *
 * A guest's printed/branded QR encodes a URL, not a bare token. The two live
 * formats (both carry guests.qr_token, a 32-char lowercase hex string):
 *   - invitation surfaces (lib/qr.ts):        {appUrl}/{slug}?invite={token}
 *   - seating print pack (seating/print):     {appUrl}/{slug}?g={token}
 * Some hand-typed flows may paste the bare token itself.
 */

const HEX32 = /^[0-9a-f]{32}$/i;

/** Extract a guest qr_token from whatever a QR scan (or paste) produced. */
export function parseGuestQrPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (HEX32.test(text)) return text.toLowerCase();
  try {
    const url = new URL(text);
    const token = url.searchParams.get('invite') ?? url.searchParams.get('g');
    if (token && HEX32.test(token)) return token.toLowerCase();
  } catch {
    // not a URL — fall through
  }
  return null;
}

/** Initials for the avatar fallback ("Elena Santos" → "ES"). */
export function guestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}
