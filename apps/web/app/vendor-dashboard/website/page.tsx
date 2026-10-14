import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { DomainManager } from './_domain-manager';
import { loadPageData } from './page-data';
import { PageParts } from './_components/page-parts';
import { ShopSegments } from '../shop/_components/shop-segments';
import { AutoReplySection } from '../shop/_components/autoreply-section';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your page' };

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');
const DISPLAY_HOST = SITE_URL.replace(/^https?:\/\//, '');

/**
 * /vendor-dashboard/website — YOUR PAGE, Shop › Page (simpler supplier dashboard step 5, 2026-10-14).
 *
 * Was: a viewer (the public page in an iframe, "Edit page" sending the supplier back to My Shop's Website tile) plus
 * the custom-domain manager. Now the page is edited HERE, in the order couples scroll it, as a draft that ONE Apply
 * publishes (`_components/page-parts.tsx`). Plan § "`/website` retires into Shop › Page": this address IS Shop › Page,
 * so every old link to it lands on the editor. The domain manager is the "Your web address" part, unchanged.
 */
export default async function YourPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/open-shop');

  const d = await loadPageData(supabase, profile);
  const whereLine = d.city
    ? d.outerRadiusKm
      ? `${d.city} · travels up to ${d.outerRadiusKm} km`
      : d.city
    : 'Not set yet';

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-page="">
      <ShopSegments on="page" />
      <h1 className="sr-only">Your page</h1>
      <PageParts
        d={{
          vendorId: d.vendorId,
          businessName: d.businessName,
          publicPath: d.publicPath,
          displayHost: DISPLAY_HOST,
          live: d.live,
          visible: d.visible,
          isVerified: d.isVerified,
          kindWord: d.kindWord,
          whereLine,
          yearsLabel: d.yearsLabel,
          rating: d.rating,
          reviewCount: d.reviewCount,
          saved: d.saved,
          services: d.services,
          portfolio: d.portfolio,
          photoCount: d.photoCount,
          videoCount: d.videoCount,
          reviews: d.reviews,
          stories: d.stories,
          personalizeAsks: d.personalizeAsks,
          proAsks: d.proAsks,
          storeShell: d.storeShell,
          plans: d.plans,
        }}
        domainBody={
          <>
            {!d.domainsMeasured ? (
              <p role="alert" className="mb-3 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-3 text-sm text-ink/70">
                <strong className="text-ink">We couldn&rsquo;t load your web addresses.</strong> Any domain you already
                connected still points at your page — it is missing from this list, not from your account. Reload before
                adding it again.
              </p>
            ) : null}
            {d.slug ? <DomainManager initial={d.domains} /> : <p className="text-sm text-ink/60">Name your shop first — your address is made from it.</p>}
          </>
        }
        autoReplyBody={vendorAutoReplyEnabled() ? <AutoReplySection vendorProfileId={d.vendorId} /> : null}
      />
    </section>
  );
}
