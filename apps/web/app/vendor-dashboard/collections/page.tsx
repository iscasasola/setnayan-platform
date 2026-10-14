import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { ShopSegments } from '../shop/_components/shop-segments';
import { GalleryMedia } from '../shop/_components/gallery-media';
import { SupplierThumbRow } from '../_components/supplier-thumb-row';
import { OpenFoldButton } from '../_components/open-fold-button';
import { loadCollectionsData } from './collections-data';
import { CollectionsList } from './_components/collections-list';

export const metadata = { title: 'Your collections' };

// Map the Instagram OAuth-callback error codes to friendly one-line copy for the
// IG card. Mirrors the retired /profile page's IG_ERROR_COPY (2026-07-05); moved here from My Shop with the
// Instagram card (step 5, 2026-10-14) — the OAuth callback now lands on this page.
const IG_ERROR_COPY: Record<string, string> = {
  denied: 'Instagram connection was cancelled.',
  user_denied: 'Instagram connection was cancelled.',
  missing_code_or_state: 'Instagram connection could not be completed. Try again.',
  state_not_found: 'That connection link expired. Try connecting again.',
  state_expired: 'That connection link expired. Try connecting again.',
  not_configured: 'Instagram connect is not available yet.',
  exchange_failed: 'Instagram could not confirm the connection. Try again.',
  profile_fetch_failed:
    'We couldn’t read your Instagram profile. Make sure it’s a Business or Creator account, then try again.',
  encryption_unavailable:
    'Instagram connect is temporarily unavailable. Please try again later.',
  persist_failed: 'Could not save your Instagram connection. Try again.',
};

/**
 * /vendor-dashboard/collections — YOUR COLLECTIONS (simpler supplier dashboard step 5, 2026-10-14; prototype
 * moment 8). Every photo and video the supplier owns, one list — profile picture › Your collections, or Shop › Page ›
 * Photos › Pick from your collections. NEW ROUTE, NO NEW TABLE: each row is a store that already exists, counted
 * where it lives (`collections-data.ts`, `lib/supplier-collections.ts`).
 *
 * "Add photos" is the shipped gallery editors (portfolio photos · featured videos · Instagram), moved here from My
 * Shop's Website tile — `#gallery-media`, which is also where Instagram's OAuth callback lands with its result.
 */
export default async function YourCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ig_connected?: string; ig_error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  // No shop resolved (or the read failed): back to the dashboard, whose layout tells the two apart — never to
  // /open-shop on a read that might simply have failed (`the-open-shop-redirect-is-a-proven-absence`).
  if (!profile) redirect('/vendor-dashboard');

  const [d, sp] = await Promise.all([loadCollectionsData(supabase, profile, user.id), searchParams]);
  const igFlash: { kind: 'ok' | 'error'; message: string } | null = sp.ig_connected
    ? { kind: 'ok', message: 'Instagram connected. Press “Sync now” to pull your posts.' }
    : sp.ig_error
      ? { kind: 'error', message: IG_ERROR_COPY[sp.ig_error] ?? 'Instagram connection could not be completed. Try again.' }
      : null;

  return (
    <>
      <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-collections="">
        <ShopSegments on="page" />
        <h1 className="sn-h1">Your collections</h1>
        <CollectionsList
          vendorId={d.vendorId}
          input={d.input}
          saved={d.saved}
          gallery={
            <GalleryMedia
              vendorProfileId={d.vendorId}
              portfolioRefs={d.portfolioRefs}
              portfolioDisplayMap={d.portfolioDisplayMap}
              portfolioMax={d.portfolioMax}
              galleryVideoLinks={d.galleryVideoLinks}
              igConfigured={d.igConfigured}
              igConnection={d.igConnection}
              igUnavailable={d.igUnavailable}
              igMedia={d.igMedia}
              igFlash={igFlash}
            />
          }
        />
      </section>
      <SupplierThumbRow name="collections" label="Your collections">
        <OpenFoldButton anchor="gallery-media" label="Add photos" icon="photo" />
      </SupplierThumbRow>
    </>
  );
}
