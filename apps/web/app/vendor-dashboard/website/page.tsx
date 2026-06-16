/**
 * /vendor-dashboard/website — the vendor's public page, live.
 *
 * WHY: 2026-06-15 nav-tune (owner-picked). The vendor bottom nav gained a
 * "Website" tab; the owner chose "live page preview" — it shows the vendor
 * their public microsite (/v/[slug]) exactly as couples see it, with an Edit
 * entry back to the profile editor and an Open-live link. This is a viewer,
 * not an editor: every field is changed at /vendor-dashboard/profile.
 *
 * The public page is keyed on `business_slug` (a Pro/Enterprise custom-address
 * feature) and only renders for publicly-visible profiles (coming_soon +
 * verified; hidden/archived 404). So the preview degrades gracefully:
 *   - has slug + publicly visible → live iframe preview + Open-live + Edit
 *   - no slug yet                 → "set your public address" state
 *   - slug but not visible        → "not visible yet" state
 *
 * Server Component (auth via cookies). Brand-voice copy only, no dev text,
 * per [[feedback_setnayan_no_dev_text_post_launch]].
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Globe, ExternalLink, SquarePen, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isPubliclyVisible } from '@/lib/vendor-visibility';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your website · Setnayan' };

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
const DISPLAY_HOST = SITE_URL.replace(/^https?:\/\//, '');

export default async function VendorWebsitePreview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let slug: string | null = null;
  let visible = false;
  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    slug = profile?.business_slug ?? null;
    visible = isPubliclyVisible(profile?.public_visibility ?? 'coming_soon');
  } catch {
    // Degrade to the "not visible yet" state rather than crashing the tab.
    slug = null;
    visible = false;
  }

  const previewable = Boolean(slug) && visible;
  const publicPath = slug ? `/v/${slug}` : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
          Vendor dashboard · Public page
        </p>
        <h1 className="m-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your website
        </h1>
        <p className="text-base" style={{ color: 'var(--m-slate)' }}>
          This is your public page — exactly what couples see when they open your
          link on the marketplace. Edit anything from your Profile.
        </p>
      </header>

      {previewable && publicPath ? (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="inline-flex min-w-0 items-center gap-2 font-mono text-sm"
              style={{ color: 'var(--m-slate)' }}
            >
              <Globe aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">
                {DISPLAY_HOST}
                {publicPath}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/vendor-dashboard/profile"
                className="button-secondary inline-flex items-center gap-2"
              >
                <SquarePen aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Edit page
              </Link>
              <a
                href={publicPath}
                target="_blank"
                rel="noreferrer"
                className="button-primary inline-flex items-center gap-2"
              >
                <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Open live
              </a>
            </div>
          </div>

          {/* Faux browser frame around the live iframe so it reads as a
              preview, not part of the dashboard chrome. Same-origin iframe —
              no X-Frame-Options / frame-ancestors set on this app. */}
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              border: '1px solid var(--m-line)',
              boxShadow: 'var(--m-shadow-sm)',
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: 'var(--m-paper)', borderBottom: '1px solid var(--m-line)' }}
            >
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--m-line)' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--m-line)' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--m-line)' }} />
              </span>
              <span
                className="ml-2 truncate font-mono text-xs"
                style={{ color: 'var(--m-slate)' }}
              >
                {DISPLAY_HOST}
                {publicPath}
              </span>
            </div>
            <iframe
              src={publicPath}
              title="Public page preview"
              loading="lazy"
              className="block h-[720px] w-full bg-white"
            />
          </div>

          <p className="mt-3 text-xs" style={{ color: 'var(--m-slate)' }}>
            Changes you save in Profile show up here the next time this page
            reloads.
          </p>
        </>
      ) : (
        <section
          className="space-y-3 rounded-2xl p-6"
          style={{
            background: 'var(--m-paper)',
            border: '1px solid var(--m-line)',
            boxShadow: 'var(--m-shadow-sm)',
          }}
        >
          <p
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em]"
            style={{ color: 'var(--m-slate)' }}
          >
            <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {slug ? 'Not visible yet' : 'No public address yet'}
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {slug
              ? 'Your public page isn’t live yet.'
              : 'Set your public address to get a shareable page.'}
          </h2>
          <p className="max-w-2xl text-sm" style={{ color: 'var(--m-slate)' }}>
            {slug
              ? 'Your page goes live once your profile is published and verification is underway. Until then it stays private to you.'
              : 'Your public page lives at a custom address like ' +
                `${DISPLAY_HOST}/v/your-name` +
                '. Add yours in Profile, then this tab shows a live preview of exactly what couples see.'}
          </p>
          <div className="pt-1">
            <Link
              href="/vendor-dashboard/profile"
              className="button-primary inline-flex items-center gap-2"
            >
              <SquarePen aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {slug ? 'Edit profile' : 'Set up my page'}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
