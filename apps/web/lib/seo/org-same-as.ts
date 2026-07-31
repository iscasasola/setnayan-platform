/**
 * The canonical `Organization.sameAs[]` — verified brand profiles that ground
 * the Setnayan entity for Google/Bing and the AI answer engines.
 *
 * WHY THIS MODULE EXISTS (2026-07-31). The list was hardcoded in `app/layout.tsx`
 * (where it actually ships in the JSON-LD) while the SEO audit read a completely
 * different source — an env var `SETNAYAN_ORG_SAMEAS` that **nothing else in the
 * codebase consumed**. So the audit reported *"empty — create FB Page + LinkedIn"*
 * every day while the Facebook Page already existed AND was already shipping in
 * the emitted JSON-LD. Acting on that warn would have meant creating a Page that
 * was already live.
 *
 * A check pointed at a different source than the thing it describes is worse than
 * no check: it manufactures work. One list, both readers.
 *
 * `SETNAYAN_ORG_SAMEAS` is still honoured as an ADDITIVE override so a profile can
 * be wired without a deploy — but the shipped list is the floor, not the fallback.
 */

/** Profiles that are live and owner-confirmed. Append here when one is created. */
export const ORG_SAME_AS_SHIPPED: readonly string[] = [
  // Facebook Page live + owner-confirmed 2026-07-10.
  'https://www.facebook.com/setnayan',
  // No LinkedIn Company Page yet — append its URL when it exists.
];

/**
 * The effective list: what ships, plus any comma-separated additions from
 * `SETNAYAN_ORG_SAMEAS`. Deduped, order-stable, empty entries dropped.
 */
export function orgSameAs(): string[] {
  const extra = (process.env.SETNAYAN_ORG_SAMEAS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...ORG_SAME_AS_SHIPPED, ...extra])];
}

/**
 * Whether the search engines can verify domain ownership.
 *
 * ⚠ Reads the `NEXT_PUBLIC_`-prefixed names, because those are the ones
 * `app/layout.tsx` actually renders the meta tags from. The audit previously
 * checked the UNPREFIXED `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION`,
 * which nothing renders — so setting the vars that genuinely work would have left
 * the audit warning "not configured" forever, and setting the ones that silenced
 * the audit would have emitted no meta tag. Unprefixed is still accepted so an
 * existing deployment configured the old way does not suddenly regress.
 */
export function siteVerification(): { google?: string; bing?: string } {
  return {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION,
    bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION,
  };
}
