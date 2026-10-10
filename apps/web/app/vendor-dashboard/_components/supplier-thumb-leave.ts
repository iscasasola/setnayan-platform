/**
 * supplier-thumb-leave.ts — DOES THIS TAP LEAVE THE PAGE? (pure)
 *
 * The supplier's thumb row slides down FIRST when the supplier leaves the page
 * (BUTTON_RULE_2026-10-07 rule 5). The App Router has no "route change started"
 * event, so `SupplierThumbRow` asks this of every link tap: a link to another
 * path of this site leaves; a fragment, a new tab, another site, or a link back
 * to the path you are on does not.
 *
 * A plain module so the guard can run it without a browser or a CSS loader.
 */
export function leavesThePage(href: string | null, target: string | null, here: string, origin: string): boolean {
  if (!href || target === '_blank') return false;
  if (href.startsWith('#')) return false;
  let url: URL;
  try {
    url = new URL(href, origin + here);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  return url.pathname !== here;
}
