import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { saveUnclaimedVendorProfile } from '../../actions';

export const metadata = {
  title: 'Edit unclaimed vendor · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ vendorProfileId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

/**
 * Admin-side editor for an UNCLAIMED vendor profile (user_id IS NULL).
 *
 * Surfaces the "bare essentials" admins need to pre-stage a vendor
 * before they claim:
 *   - business name, tagline
 *   - location_city, hq_address (auto-geocoded on save)
 *   - contact email + phone
 *   - services (comma-separated)
 *   - is_published toggle (drops it into the public marketplace)
 *
 * Portfolio, compat tags, event_types, monogram — those stay for the
 * vendor to fill in via the full /vendor-dashboard after they claim.
 *
 * Access gate is admin-only via the requireAdmin in
 * `saveUnclaimedVendorProfile` PLUS a redirect on the page itself when
 * the visitor isn't admin (so the form never renders without
 * permission). The vendor_profiles row is fetched via the
 * service-role admin client because vendor's own RLS policies won't
 * match a NULL user_id.
 */
export default async function AdminEditUnclaimedVendorPage({
  params,
  searchParams,
}: Props) {
  const { vendorProfileId } = await params;
  const search = await searchParams;

  // Admin-only gate — block the route entirely for non-admins.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, public_id, user_id, business_name, tagline, location_city, hq_address, hq_latitude, hq_longitude, contact_email, contact_phone, services, is_published, public_visibility',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!profile) notFound();

  // If the vendor has already claimed (user_id set), bounce admin to
  // the regular /admin/vendors roster — there's no longer an unclaimed
  // row to edit here. Admin should use the vendor's own dashboard tools
  // or the moderation surfaces for already-claimed vendors.
  if (profile.user_id) {
    redirect('/admin/vendors');
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin/vendors"
        className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to vendors
      </Link>

      <header className="mb-6 space-y-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-900">
          Unclaimed
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit unclaimed vendor
        </h1>
        <p className="text-sm text-ink/60">
          You&rsquo;re editing this vendor as a temporary owner. The vendor will
          take it over the moment they sign up via the claim link. Publish
          when you want it to appear in the marketplace.
        </p>
      </header>

      {search.saved === '1' ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-2 text-sm text-emerald-900"
        >
          Saved. Geocoding ran in the background — refresh to see updated coordinates.
        </p>
      ) : null}

      <form
        action={async (formData) => {
          'use server';
          await saveUnclaimedVendorProfile(formData);
          redirect(`/admin/vendors/${vendorProfileId}/edit?saved=1`);
        }}
        className="space-y-5 rounded-2xl border border-ink/10 bg-cream p-5"
      >
        <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />

        <Field label="Business name" htmlFor="business_name" required>
          <input
            id="business_name"
            name="business_name"
            type="text"
            maxLength={128}
            required
            defaultValue={profile.business_name ?? ''}
            className="input-field"
          />
        </Field>

        <Field label="Tagline" htmlFor="tagline">
          <input
            id="tagline"
            name="tagline"
            type="text"
            maxLength={200}
            defaultValue={profile.tagline ?? ''}
            placeholder="One sentence that captures what this vendor does well."
            className="input-field"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location (city)" htmlFor="location_city">
            <input
              id="location_city"
              name="location_city"
              type="text"
              maxLength={64}
              defaultValue={profile.location_city ?? ''}
              placeholder="Quezon City"
              className="input-field"
            />
          </Field>
          <Field label="HQ address (auto-geocoded)" htmlFor="hq_address">
            <input
              id="hq_address"
              name="hq_address"
              type="text"
              maxLength={500}
              defaultValue={profile.hq_address ?? ''}
              placeholder="123 Katipunan Ave, Quezon City"
              className="input-field"
            />
          </Field>
          <Field label="Contact email" htmlFor="contact_email">
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={profile.contact_email ?? ''}
              className="input-field"
            />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone">
            <input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              defaultValue={profile.contact_phone ?? ''}
              className="input-field"
            />
          </Field>
        </div>

        <Field label="Services (comma-separated)" htmlFor="services">
          <input
            id="services"
            name="services"
            type="text"
            defaultValue={(profile.services ?? []).join(', ')}
            placeholder="catering, photographer, mobile_bar"
            className="input-field"
          />
          <p className="mt-1 text-xs text-ink/55">
            Use canonical_service slugs (lowercase + underscores).
          </p>
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={profile.is_published}
            className="h-4 w-4 cursor-pointer accent-terracotta"
          />
          Publish to marketplace
        </label>

        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {profile.public_id}
          </p>
          <SubmitButton className="button-primary" pendingLabel="Saving…">
            Save changes
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}
