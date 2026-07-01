import { redirect } from 'next/navigation';
import Image from 'next/image';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { r2PublicUrl, R2_BUCKETS } from '@/lib/r2';
import {
  fetchVendorReposts,
  type RepostFlagStatus,
  type RepostSurface,
} from '@/lib/vendor-theft-watch';

export const metadata = { title: 'Theft Watch · Vendor' };

const STATUS: Record<RepostFlagStatus, { label: string; className: string }> = {
  open: { label: 'Under review', className: 'bg-amber-500/12 text-amber-700' },
  escalated: { label: 'Escalated to our team', className: 'bg-orange-500/12 text-orange-700' },
  confirmed_theft: { label: 'Confirmed repost', className: 'bg-red-500/12 text-red-700' },
  dismissed: { label: 'Cleared — no theft', className: 'bg-ink/8 text-ink/50' },
};

const SURFACE_LABEL: Record<RepostSurface, string> = {
  service_primary: 'Service cover photo',
  portfolio: 'Portfolio photo',
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

  const reposts = await fetchVendorReposts(profile.vendor_profile_id);

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-ink/70" strokeWidth={1.75} aria-hidden />
          <h1 className="text-lg font-semibold text-ink">Theft Watch</h1>
        </div>
        <p className="text-sm text-ink/55">
          We perceptually fingerprint every photo you upload and scan the marketplace for
          copies. If another listing reposts your work, it&rsquo;s flagged here as yours — our
          team reviews each one.
        </p>
      </header>

      {reposts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.02] px-6 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-600/70" strokeWidth={1.5} aria-hidden />
          <p className="text-sm font-medium text-ink">No reposts flagged — your work is clean.</p>
          <p className="max-w-sm text-xs text-ink/50">
            We&rsquo;ll watch continuously. If a copy of one of your photos shows up on another
            profile, you&rsquo;ll see it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reposts.map((flag) => {
            const status = STATUS[flag.status];
            return (
              <li
                key={flag.publicId}
                className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-3"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                  <Image
                    src={r2PublicUrl(R2_BUCKETS.media, flag.r2Ref)}
                    alt="Your photo that was reposted"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {SURFACE_LABEL[flag.surface]} reposted
                  </p>
                  <p className="text-xs text-ink/45">Flagged {formatDate(flag.createdAt)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-ink/40">
        Only you and our review team can see these flags. We never name another vendor on an
        unconfirmed match — reposts are adjudicated by our team, not automatically.
      </p>
    </section>
  );
}
