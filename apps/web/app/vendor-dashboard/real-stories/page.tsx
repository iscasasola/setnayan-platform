import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sparkles, ExternalLink } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';

export const metadata = { title: 'Real Stories · Vendor' };

/**
 * Vendor "Featured in Real Stories" — the weddings this vendor helped create
 * that the couple has published to the public showcase (/realstories), each
 * ready to SHARE to the vendor's Facebook Page.
 *
 * WHY (owner 2026-06-14 · the vendor half of the Real-Stories featuring loop):
 * vendors have Facebook business Pages with real audiences and love posting
 * "we did this wedding" — a one-click share turns every published editorial
 * into free reach back to Setnayan, and the editorial credits the vendor's
 * profile, so the loop closes both ways.
 *
 * Read-only + ownership-scoped: the list is the vendor's OWN booked events
 * (fetchVendorPoolBookings) intersected with the public-showcase consent gate
 * (loadVendorFeaturedStories). Pre-launch it's empty (no consented editorials
 * exist yet) → a tasteful "coming" state, never a broken page.
 */

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

export default async function VendorRealStoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const bookings = await fetchVendorPoolBookings(
    supabase,
    profile.vendor_profile_id,
  );
  const stories = await loadVendorFeaturedStories(
    bookings.map((b) => b.eventId),
  );

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Featured in Real Stories
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          When a couple you worked with publishes their wedding to{' '}
          <Link href="/realstories" className="font-medium text-terracotta underline">
            Real Stories
          </Link>
          , it shows up here — with your profile credited in the story. Share it
          to your Facebook Page in one tap: it&rsquo;s real proof of your work,
          and the share carries a beautiful preview straight back to the couple&rsquo;s
          editorial.
        </p>
      </header>

      {stories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-8 text-center sm:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Coming soon
          </p>
          <p className="mx-auto mt-3 max-w-md text-base font-medium text-ink">
            Your featured weddings will appear here.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
            Once a couple you helped create their day publishes it to Real
            Stories, you&rsquo;ll find it here — ready to share to your Page. Real
            couple editorials begin publishing with the wedding season ahead.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {stories.map((s) => {
            const editorialUrl = `${SITE_URL}/${s.slug}`;
            const ogImage = `${SITE_URL}/api/og/realstory-slug/${s.slug}`;
            const meta = [s.city, s.dateLabel].filter(Boolean).join(' · ');
            return (
              <li
                key={s.eventId}
                className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                    Featured in Real Stories
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold leading-snug text-ink">
                    {s.coupleNames}
                  </h2>
                  {meta ? <p className="mt-0.5 text-sm text-ink/55">{meta}</p> : null}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Link
                    href={`/${s.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-sm font-medium text-terracotta underline-offset-4 hover:underline"
                  >
                    View the story
                    <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Link>
                  <ShareButtons
                    url={editorialUrl}
                    title={`${s.coupleNames} — a wedding we helped create, on Setnayan`}
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
