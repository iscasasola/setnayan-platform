import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sparkles, ExternalLink } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorRecaps } from '@/lib/recap-vendor';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';

export const metadata = { title: 'Recaps · Vendor' };

/**
 * Vendor "Recaps" — the weddings this vendor helped create whose couple has
 * published their Auto-Recap. Read-only + ownership-scoped (the vendor's OWN
 * booked events ∩ published recaps). Each is ready to SHARE to the vendor's
 * Facebook Page — the recap is a beautiful, public proof of the day they helped
 * make. Pre-launch it's empty (no published recaps yet) → a tasteful "coming"
 * state, never a broken page.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

export default async function VendorRecapsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);
  const recaps = await loadVendorRecaps(bookings.map((b) => b.eventId));

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Recaps</h1>
        <p className="max-w-prose text-base text-ink/65">
          When a couple you worked with publishes their wedding recap, it shows up here — the day
          you helped make, as a living page. Share it to your Facebook Page in one tap: it&rsquo;s
          real proof of your work, with a beautiful preview straight back to the couple&rsquo;s
          recap.
        </p>
      </header>

      {recaps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-8 text-center sm:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Coming soon
          </p>
          <p className="mx-auto mt-3 max-w-md text-base font-medium text-ink">
            Your couples&rsquo; recaps will appear here.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
            Once a couple you helped publishes their wedding recap, you&rsquo;ll find it here — ready
            to share to your Page.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {recaps.map((r) => {
            const recapUrl = `${SITE_URL}/${r.slug}/recap`;
            const ogImage = `${SITE_URL}/api/og/recap/${r.slug}`;
            const meta = [r.city, r.dateLabel].filter(Boolean).join(' · ');
            return (
              <li
                key={r.eventId}
                className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                    Published recap
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold leading-snug text-ink">
                    {r.coupleNames}
                  </h2>
                  {meta ? <p className="mt-0.5 text-sm text-ink/55">{meta}</p> : null}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Link
                    href={`/${r.slug}/recap`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm font-medium text-terracotta underline-offset-4 hover:underline"
                  >
                    View the recap
                    <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Link>
                  <ShareButtons
                    url={recapUrl}
                    title={`${r.coupleNames} — a wedding we helped create, on Setnayan`}
                    image={ogImage}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
