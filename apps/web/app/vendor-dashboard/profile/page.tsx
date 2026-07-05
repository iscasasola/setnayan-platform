import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/profile — RETIRED 2026-07-05.
 *
 * The vendor profile editor (identity fields) and the three media editors
 * (portfolio photos, featured videos, Instagram) were consolidated onto the
 * current surface: My Shop → Website Editor (`/vendor-dashboard/shop`). Profile
 * identity already edits inline there (ProfileChecklistEditor); the media
 * editors moved into the Website Editor's "Gallery & media" section.
 *
 * This route now permanently redirects to My Shop so old bookmarks, nav links,
 * and the many `?saved=1` / `?error=` / `?ig_connected=` redirect targets that
 * still point here land on the live surface instead of a dead page. The
 * Instagram OAuth callback was repointed to /vendor-dashboard/shop directly.
 *
 * `redirect()` also forwards any query string implicitly is NOT true — so we
 * preserve the incoming search params (e.g. a legacy `?saved=1`) by appending
 * them to the target.
 */
export default async function VendorProfileRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const query = qs.toString();
  redirect(`/vendor-dashboard/shop${query ? `?${query}` : ''}`);
}
