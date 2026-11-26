/**
 * verify-back.ts — where a /admin/verify press lands (A8·E-9).
 *
 * The verify forms post no tab or shop of their own, and the actions used to
 * redirect to a bare `/admin/verify?approved=1`, which is Applications ›
 * Pending: an admin on Listing visibility, In review or a shop's own address
 * was thrown somewhere else, and "the dossier is on the application card"
 * pointed at a card not on screen. The way back is rebuilt from the page the
 * press came from: its `surface`, `status` and `shop` are kept, the previous
 * press's flash is dropped, and the new flash is added. Only a /admin/verify
 * address is ever followed; anything else falls back to the bare page.
 */
const KEEP = ['surface', 'status', 'shop'] as const;

export function verifyBackHref(referer: string | null | undefined, flash: Record<string, string>): string {
  const out = new URLSearchParams();
  if (referer) {
    try {
      const u = new URL(referer, 'https://setnayan.com');
      if (u.pathname === '/admin/verify') {
        for (const k of KEEP) {
          const v = u.searchParams.get(k);
          if (v && /^[A-Za-z0-9_-]{1,80}$/.test(v)) out.set(k, v);
        }
      }
    } catch {
      // A malformed referer is the bare page.
    }
  }
  for (const [k, v] of Object.entries(flash)) out.set(k, v);
  const q = out.toString();
  return q ? `/admin/verify?${q}` : '/admin/verify';
}
