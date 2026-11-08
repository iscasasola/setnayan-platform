/**
 * 🔗 SHARE THE SHOP'S LINK — one implementation (THE ONE BUILD A3 W4): the phone's share sheet (`navigator.share`),
 * else copy. Lifted from Your page's `share` (`website/_components/page-parts.tsx`), which imports it since the
 * integration (8 Nov) — one implementation, two callers (Shop's cover, Your page).
 *
 * Browser-only (called from a click). Answers what happened, so the caller can say "Link copied." or nothing:
 * a closed share sheet is not an error.
 */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

export async function shareShopLink(url: string, title: string): Promise<ShareOutcome> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (err) {
    // The share sheet was closed — nothing to say. Anything else could not share or copy.
    return (err as { name?: string } | null)?.name === 'AbortError' ? 'dismissed' : 'failed';
  }
}

/** The shop's public share card — the 1200×630 PNG every shared link already previews with (`/api/og/v/<slug>`). */
export function shopPhotoCardPath(slug: string): string {
  return `/api/og/v/${encodeURIComponent(slug)}`;
}
