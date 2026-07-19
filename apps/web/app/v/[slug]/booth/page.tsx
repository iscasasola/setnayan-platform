/**
 * /v/[slug]/booth — "Walk into my booth", the public 3D booth showcase for one
 * vendor (3D Booth Ads · Part C). A shareable link to the vendor's OWN branded
 * 3D booth (chassis + mascot staff + Pro logo sign) in a small orbitable room.
 *
 * Gates (public-facing, graceful — never a raw notFound for a real vendor unless
 * they're not publicly visible at all):
 *   · not publicly visible / unverified → notFound (same as /v/[slug]).
 *   · not Pro/Enterprise (the entitlement) OR a category with no booth →
 *     a soft "3D booth isn't set up yet" card + a link to their profile.
 * Otherwise: the Canvas showcase.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPubliclyVisible, type VendorPublicVisibility } from '@/lib/vendor-visibility';
import { boothCanBrand, type Lab3DBooth } from '@/lib/seating-3d';
import { resolveVendorCategory } from '@/lib/vendor-packages';
import { boothTemplateFor } from '@/app/_components/plan3d/kit/booth-templates';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { BoothShowcaseLoader } from './booth-showcase-loader';

export const dynamic = 'force-dynamic';

/** Flag-gated (off by default) — the public showcase route doesn't exist until
 *  the owner has eyeballed the WebGL booth. Exported so /v/[slug] hides its
 *  "Walk into my booth" link in lock-step. */
export const PLAN3D_BOOTH_SHOWCASE_ENABLED = process.env.NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE === 'true';

type Props = { params: Promise<{ slug: string }> };

type BoothVendorRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  services: string[] | null;
  location_city: string | null;
  logo_url: string | null;
  tier_state: string | null;
  public_visibility: VendorPublicVisibility;
  verification_state: string | null;
  name_revealed_at: string | null;
  screen_name: string | null;
};

async function fetchBoothVendor(slug: string): Promise<BoothVendorRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, business_name, business_slug, services, location_city, logo_url, tier_state, public_visibility, verification_state, name_revealed_at, screen_name',
    )
    .ilike('business_slug', slug)
    .maybeSingle();
  return (data as BoothVendorRow | null) ?? null;
}

/** The ANONYMITY-SAFE display name — same resolver the main profile uses, so a
 *  non-name-revealed tier (free/verified) shows its screen-name placeholder, not
 *  the real business_name. (Pro/Enterprise reveal day-1, so the Canvas path — Pro
 *  only — shows the real name unchanged.) NEVER use raw business_name here. */
function boothDisplayName(vendor: BoothVendorRow): string {
  return resolveVendorDisplayName({
    business_name: vendor.business_name,
    name_revealed_at: vendor.name_revealed_at,
    primary_canonical_service: vendor.services?.[0] ?? null,
    location_city: vendor.location_city,
    services: vendor.services ?? null,
    screen_name: vendor.screen_name ?? null,
    isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
  });
}

/** The vendor's booth category (first service that maps to a booth), or null. */
function boothCategoryFor(services: string[] | null): ReturnType<typeof resolveVendorCategory> | null {
  for (const s of services ?? []) {
    const c = resolveVendorCategory(s);
    if (c !== 'misc') return c;
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await fetchBoothVendor(slug);
  // Only title with a name when the route is actually reachable AND the vendor is
  // public + verified — otherwise a generic title (never fetch-and-name an
  // ungated vendor). Always via the anonymity-safe resolver.
  const eligible =
    PLAN3D_BOOTH_SHOWCASE_ENABLED &&
    !!vendor &&
    isPubliclyVisible(vendor.public_visibility) &&
    vendor.verification_state === 'verified';
  const name = eligible ? boothDisplayName(vendor) : 'a vendor';
  const title = eligible ? `Walk into ${name}'s booth · Setnayan` : 'Vendor booth · Setnayan';
  const description = eligible
    ? `Step inside ${name}'s 3D booth — a walk-around preview on Setnayan.`
    : 'A 3D booth showcase on Setnayan.';
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function SoftGate({ slug, name, message }: { slug: string; name: string; message: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#efe9dd] p-6 text-center">
      <div className="max-w-sm">
        <p className="text-lg font-medium text-[#1a1a1a]">{name}</p>
        <p className="mt-2 text-sm text-black/60">{message}</p>
        <Link
          href={`/v/${slug}`}
          className="mt-5 inline-block rounded-xl bg-black/[0.06] px-4 py-2 text-sm text-[#1a1a1a] hover:bg-black/10"
        >
          View {name}&rsquo;s profile →
        </Link>
      </div>
    </main>
  );
}

export default async function VendorBoothShowcasePage({ params }: Props) {
  if (!PLAN3D_BOOTH_SHOWCASE_ENABLED) notFound();
  const { slug } = await params;
  const vendor = await fetchBoothVendor(slug);

  // Same public gate as the profile page — an unlisted/unverified vendor 404s.
  if (!vendor || !isPubliclyVisible(vendor.public_visibility) || vendor.verification_state !== 'verified') {
    notFound();
  }

  // Anonymity-safe name (never raw business_name). Pro/Enterprise reveal day-1,
  // so the Canvas path (Pro-gated below) shows the real name; a non-Pro vendor
  // that only reaches the SoftGate stays anonymized.
  const name = boothDisplayName(vendor);

  // Entitlement: the 3D booth showcase is a Pro/Enterprise perk (same gate that
  // brands a booth). A non-Pro vendor gets a soft card, not a broken canvas.
  if (!boothCanBrand(vendor.tier_state)) {
    return <SoftGate slug={slug} name={name} message="A 3D booth showcase is a Pro feature — this vendor hasn't set theirs up yet." />;
  }

  const category = boothCategoryFor(vendor.services);
  if (!category) {
    return <SoftGate slug={slug} name={name} message="This vendor's service doesn't have a 3D booth yet." />;
  }

  // Build the synthetic booth (centre-back so it faces the camera) + resolve the
  // logo so the Pro sign brands. If the category has no booth template, soft-gate.
  const booth: Lab3DBooth = {
    id: vendor.vendor_profile_id,
    kind: 'custom',
    label: '',
    xPct: 50,
    yPct: 42,
    vendor: {
      name,
      category,
      // Guard: a logo-signing failure (e.g. R2 unset on a preview env) degrades
      // to an unbranded booth, never a 500 on the public page.
      logoUrl: vendor.logo_url ? await displayUrlForStoredAsset(vendor.logo_url).catch(() => null) : null,
      tier: vendor.tier_state,
      slug: vendor.business_slug,
      bookable: true,
    },
  };
  if (!boothTemplateFor(booth)) {
    return <SoftGate slug={slug} name={name} message="This vendor's service doesn't have a 3D booth yet." />;
  }

  return <BoothShowcaseLoader booth={booth} vendorName={name} />;
}
