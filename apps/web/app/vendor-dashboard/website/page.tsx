/**
 * /vendor-dashboard/website — the vendor's public page, live.
 *
 * WHY: 2026-06-15 nav-tune (owner-picked). The vendor bottom nav gained a
 * "Website" tab; the owner chose "live page preview" — it shows the vendor
 * their public microsite (/v/[slug]) exactly as couples see it, with an Edit
 * entry back to My Shop and an Open-live link. This is a viewer, not an editor:
 * every field is changed at /vendor-dashboard/shop (My Shop → Website Editor).
 *
 * The public page is keyed on `business_slug`. EVERY shop holds one on EVERY
 * plan — it is minted from the business name the moment the shop is named
 * (migration 20271117527966); Pro/Enterprise only buys the right to CHANGE it.
 * (Until 2026-08-06 nothing minted a default and only Pro+ could set one, so a
 * Free shop's page had no address at all.) The page renders only for
 * publicly-visible profiles — `verified` alone, since `coming_soon` was retired
 * on 2026-07-27; hidden/archived 404. So the preview degrades gracefully:
 *   - has slug + publicly visible → live iframe preview + Open-live + Edit
 *   - no slug yet (unnamed shop)  → "name your shop" state
 *   - slug but not visible        → "not visible yet" state
 *
 * Server Component (auth via cookies). Brand-voice copy only, no dev text,
 * per [[feedback_setnayan_no_dev_text_post_launch]].
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Globe, ExternalLink, SquarePen, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isPubliclyVisible } from '@/lib/vendor-visibility';
import { DomainManager } from './_domain-manager';
import type { DomainRow } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your website' };

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
  let domains: DomainRow[] = [];
  let domainsMeasured = true;
  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    slug = profile?.business_slug ?? null;
    visible = isPubliclyVisible(profile?.public_visibility ?? 'coming_soon');
    // The vendor's own custom domains (RLS scopes this to their vendor profile).
    const { data: domainRows, error: domainRowsError } = await supabase
      .from('custom_domains')
      .select('domain_id, domain, verified_at')
      .eq('owner_type', 'vendor')
      .order('created_at', { ascending: true });
    // ⚠ THE CUSTOM DOMAINS THEY HAVE SET UP. Refused, `?? []` renders the tab
    // ⚠ as though no domain was ever connected — while the domain itself keeps
    // ⚠ working — so the obvious response is to add it a second time.
    if (domainRowsError) {
      logQueryError('VendorWebsitePreview.domains', domainRowsError, {}, 'graceful_degrade');
    }
    domainsMeasured = !domainRowsError && domainRows !== null;
    domains = (domainRows ?? []).map((d) => ({
      domain_id: d.domain_id as string,
      domain: d.domain as string,
      verified: Boolean(d.verified_at),
    }));
  } catch {
    // Degrade to the "not visible yet" state rather than crashing the tab.
    slug = null;
    visible = false;
  }

  const previewable = Boolean(slug) && visible;
  const publicPath = slug ? `/v/${slug}` : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="sn-eye" style={{ color: 'var(--m-orange-2)' }}>
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
                href="/vendor-dashboard/shop"
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
            {slug ? 'Not visible yet' : 'Name your shop first'}
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {slug
              ? 'Your public page isn’t live yet.'
              : 'Name your shop and we’ll give you your web address.'}
          </h2>
          {/* The no-slug branch is now only an UNNAMED shop. Every named shop
              gets its address automatically (migration 20271117527966) — the
              old copy here told the vendor to go buy one, which was the paywall
              wording of a defect, not a real Pro benefit. */}
          <p className="max-w-2xl text-sm" style={{ color: 'var(--m-slate)' }}>
            {slug
              ? 'Your page goes live once your profile is published and verification is underway. Until then it stays private to you.'
              : `Add your shop name in My Shop and your page address — something like ${DISPLAY_HOST}/your-name — is set up for you. This tab then shows a live preview of exactly what couples see.`}
          </p>
          <div className="pt-1">
            <Link
              href="/vendor-dashboard/shop"
              className="button-primary inline-flex items-center gap-2"
            >
              <SquarePen aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {slug ? 'Edit in My Shop' : 'Name my shop'}
            </Link>
          </div>
        </section>
      )}

      {/* Custom domain — available once the vendor has a public address (a
          custom domain resolves to /v/[slug], so it needs a slug to point at). */}
      {!domainsMeasured ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-3 text-sm text-ink/70"
        >
          <strong className="text-ink">We couldn&rsquo;t load your custom domains.</strong>{' '}
          Any domain you have already connected is still connected and still
          pointing at your page — it is missing from this list, not from your
          account. Reload before adding it again.
        </p>
      ) : null}
      {slug && <DomainManager initial={domains} />}
    </div>
  );
}
