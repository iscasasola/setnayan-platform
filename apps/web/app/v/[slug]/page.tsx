import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone, Globe, MapPin } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayServiceLabel } from '@/lib/vendors';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

type PublicVendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_published: boolean;
};

async function fetchVendor(slug: string): Promise<PublicVendorRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,business_slug,tagline,logo_url,services,location_city,website,contact_email,contact_phone,is_published',
    )
    .ilike('business_slug', slug)
    .maybeSingle();
  return (data ?? null) as PublicVendorRow | null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const vendor = await fetchVendor(slug);
  if (!vendor || !vendor.is_published) {
    return { title: 'Setnayan vendor' };
  }
  return {
    title: `${vendor.business_name} · Setnayan vendor`,
    description: vendor.tagline ?? `${vendor.business_name} on Setnayan.`,
  };
}

export default async function PublicVendorPage({ params }: Props) {
  const { slug } = await params;
  const vendor = await fetchVendor(slug);
  if (!vendor || !vendor.is_published) notFound();

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta font-semibold text-cream"
            >
              S
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
              Setnayan
            </span>
          </Link>
          <Link
            href="/signup"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Plan with Setnayan
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section className="flex flex-col items-start gap-6 border-b border-ink/10 pb-8 sm:flex-row">
          <Logo logoUrl={vendor.logo_url} name={vendor.business_name} />
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Setnayan vendor
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {vendor.business_name}
            </h1>
            {vendor.tagline ? (
              <p className="text-base text-ink/70">{vendor.tagline}</p>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              {vendor.location_city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.location_city}
                </span>
              ) : null}
              {vendor.contact_email ? (
                <a
                  href={`mailto:${vendor.contact_email}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_email}
                </a>
              ) : null}
              {vendor.contact_phone ? (
                <a
                  href={`tel:${vendor.contact_phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Phone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {vendor.contact_phone}
                </a>
              ) : null}
              {vendor.website ? (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Globe aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Website
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {vendor.services.length > 0 ? (
          <section className="space-y-3 border-b border-ink/10 py-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Services offered
            </h2>
            <ul className="flex flex-wrap gap-2">
              {vendor.services.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-terracotta/10 px-3 py-1 text-sm text-terracotta-700"
                >
                  {displayServiceLabel(s)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-4 py-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Get in touch
          </h2>
          <p className="max-w-2xl text-sm text-ink/65">
            {vendor.contact_email ? (
              <>
                Already a Setnayan couple? Start a thread directly with{' '}
                <span className="font-medium text-ink">{vendor.business_name}</span> from your
                dashboard using the contact email above. Identity stays masked until you
                choose to share.
              </>
            ) : (
              <>
                {vendor.business_name} is on Setnayan but hasn&rsquo;t published a contact
                email yet. Check back soon.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="button-primary">
              Plan with Setnayan
            </Link>
            <Link href="/" className="button-secondary">
              Back to home
            </Link>
          </div>
        </section>

        <footer className="border-t border-ink/10 pt-6 text-xs text-ink/50">
          <p>Vendor ID · <span className="font-mono">{vendor.public_id}</span></p>
        </footer>
      </article>
    </main>
  );
}

function Logo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <span className="inline-flex h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}
