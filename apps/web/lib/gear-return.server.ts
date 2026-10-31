import 'server-only';
import { headers } from 'next/headers';

/**
 * 🏪 A SAVE INSIDE A ⚙ SHEET COMES BACK TO THE SHEET (house rule "a save never resets the screen"; 2026-10-31, the Shop ⚙ —
 * DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"). An editor that also lives on its own page (Helpers) redirects to
 * that page after a save. When the form was sent from a supplier page whose ⚙ was open (`?gear=1` in the page's own
 * address — the Referer of a same-origin form post), it comes back THERE instead, with the sheet still open on the
 * fold it was saved in (`gsec`) and the save's own status (`saved=1`, `error=…`).
 *
 * SAFE BY CONSTRUCTION: only a same-site path under `/vendor-dashboard/` is ever returned (the Referer's PATH, never its
 * host), so a forged header cannot send anyone off the site. Anything else falls back to the editor's own page.
 */
const STATUS_KEYS = ['saved', 'invited', 'error', 'motion', 'voted', 'kept', 'applied', 'ordered', 'gnotice', 'gsec'];

export function gearReturnFrom(referer: string | null, fallback: string, status: string, section: string): string {
  if (referer) {
    try {
      const u = new URL(referer, 'http://x');
      if (u.pathname.startsWith('/vendor-dashboard/') && !u.pathname.includes('//') && u.searchParams.get('gear') === '1') {
        for (const k of STATUS_KEYS) u.searchParams.delete(k);
        new URLSearchParams(status).forEach((v, k) => u.searchParams.set(k, v));
        u.searchParams.set('gsec', section);
        return `${u.pathname}?${u.searchParams.toString()}`;
      }
    } catch {
      /* an unreadable Referer falls back below */
    }
  }
  return `${fallback}?${status}`;
}

export async function gearReturn(fallback: string, status: string, section: string): Promise<string> {
  let referer: string | null = null;
  try {
    referer = (await headers()).get('referer');
  } catch {
    referer = null;
  }
  return gearReturnFrom(referer, fallback, status, section);
}
