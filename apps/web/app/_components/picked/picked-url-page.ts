/**
 * 🔗 THE PAGE A PICKED URL NAMES — read once after mount by the ONE `PickedShell` (`./picked-shell.tsx`).
 *
 * The picked pages route by `?tab=<page>`. Before that, the workspace routed by `#<page>`, and notifications written then
 * still carry it (`…/vendors/<id>/workspace#payments`). The server never sees a hash, so such a link fell to the menu's
 * first page — Chat — and a "your payment" notice opened on the conversation (live bug, 12 Nov 2026).
 *
 * Rule: `?tab=` wins. Only when it is ABSENT is a legacy `#<page>` honoured, and only when it names a page this menu
 * offers (through the side's own alias table, so `#quotation` → Quotation). Any other hash — a real anchor such as
 * `#promote-coordinator` — is left alone. A page found in the hash is reported `fromHash` so the shell rewrites the URL
 * to `?tab=` (one address per page).
 *
 * 🔒 `legacy-hash-opens-its-page.test.ts`
 */
export type PickedUrlPage<P extends string> = { page: P; fromHash: boolean };

export function pickedPageFromUrl<P extends string>(
  search: string,
  hash: string,
  menuIds: readonly P[],
  pageOf?: (raw: string) => P | null,
): PickedUrlPage<P> | null {
  const resolve = (raw: string): P | null => {
    const t = raw.trim().toLowerCase();
    if (!t) return null;
    const p = pageOf ? pageOf(t) : ((menuIds as readonly string[]).includes(t) ? (t as P) : null);
    return p && menuIds.includes(p) ? p : null;
  };
  const tab = new URLSearchParams(search).get('tab');
  if (tab) {
    const p = resolve(tab);
    return p ? { page: p, fromHash: false } : null;
  }
  let raw = hash.replace(/^#/, '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* a malformed escape is simply not a page */
  }
  const p = resolve(raw);
  return p ? { page: p, fromHash: true } : null;
}
