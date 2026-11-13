import { redirect } from 'next/navigation';
import Image from 'next/image';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { canSeeTheftWatch } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled, resolveVendorTier } from '@/lib/vendor-feature-gate';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { VendorTierGate } from '../_components/tier-gate';
import {
  fetchVendorReposts,
  type RepostFlagStatus,
  type RepostSurface,
} from '@/lib/vendor-theft-watch';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import {
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';

export const metadata = { title: 'Theft Watch · Supplier' };

const STATUS: Record<RepostFlagStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Under review', tone: 'wait' },
  escalated: { label: 'Escalated to our team', tone: 'wait' },
  confirmed_theft: { label: 'Confirmed repost', tone: 'no' },
  dismissed: { label: 'Cleared — no theft', tone: 'quiet' },
};

const SURFACE_LABEL: Record<RepostSurface, string> = {
  service_primary: 'Service cover photo',
  portfolio: 'Portfolio photo',
  moodboard_library: 'Inspiration photo',
  service_showcase: 'Service card photo',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function VendorTheftWatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) redirect('/vendor-dashboard');

  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  if (isVendorFeatureGateEnabled() && !canSeeTheftWatch(tier)) {
    return (
      <VendorTierGate
        feature="Theft Watch"
        requiredTier="pro"
        blurb="We fingerprint every photo you upload and scan the marketplace for copies, flagging reposts as yours. Portfolio protection is a Supplier Pro feature."
        icon={<ShieldAlert aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  const reposts = await fetchVendorReposts(profile.vendor_profile_id);

  return (
    <section className="mx-auto max-w-3xl space-y-2 px-4 py-4">
      {/* Rule 1 — the pinned row names the page; the heading stays for a screen reader only. */}
      <h1 className="sr-only">Theft Watch</h1>

      <TemplateSection
        label="Reposts flagged"
        first
        tip="We fingerprint every photo you upload and scan the marketplace for copies. Our team reviews each match."
      >
        {reposts.length === 0 ? (
          <TemplateEmpty data="theft-watch">
            <ShieldCheck aria-hidden className="mr-1.5 inline-block h-4 w-4 align-[-2px]" style={{ color: 'rgb(var(--color-ok))' }} strokeWidth={1.75} />
            No reposts flagged — your work is clean. We&rsquo;ll keep watching.
          </TemplateEmpty>
        ) : (
          <TemplateRows label="Reposts flagged">
            {reposts.map((flag) => {
              const status = STATUS[flag.status];
              // `source_r2_ref` carries whichever shape its surface stored — an
              // `r2://` ref for a service cover, a portfolio entry for the other.
              // Null means "not addressable"; the tile stays an empty swatch
              // rather than a broken image, and the row still names the flag.
              const thumbUrl = publicUrlForStoredAsset(flag.r2Ref);
              return (
                <TemplateRow
                  key={flag.publicId}
                  data={flag.publicId}
                  lead={
                    <span className="relative block h-12 w-12 overflow-hidden rounded-xl bg-[color:var(--m-paper-2)]">
                      {thumbUrl ? (
                        <Image
                          src={thumbUrl}
                          alt="Your photo that was reposted"
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </span>
                  }
                  title={`${SURFACE_LABEL[flag.surface]} reposted`}
                  line={`Flagged ${formatDate(flag.createdAt)}`}
                  right={<Badge tone={status.tone}>{status.label}</Badge>}
                />
              );
            })}
          </TemplateRows>
        )}
      </TemplateSection>

      <p className={`pt-2 ${TEMPLATE_SUBLINE}`}>
        Only you and our review team can see these flags. We never name another supplier on an
        unconfirmed match — reposts are adjudicated by our team, not automatically.
      </p>
    </section>
  );
}
