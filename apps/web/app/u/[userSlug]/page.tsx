import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import {
  resolveProfile as resolveEventTypeProfile,
  surfaceEnabled,
} from '@/lib/event-type-profile';

// Public account profile · setnayan.com/u/[user-slug].
//
// Dispatch (owner ruling 2026-07-01):
//   • exactly 1 ongoing (active + effectively-public) event → redirect straight
//     to /u/[user-slug]/[event-slug] (mirrors the signed-in dashboard's
//     single-active-event auto-jump).
//   • 2+ ongoing events → show a picker.
//   • 0 ongoing events → show the account's public editorials (past public
//     celebrations); empty-state when there are none.
//
// Only surfaces events the /[slug] target would actually render — mirrors BOTH
// gates that page enforces: (a) effectively-public visibility (so 'unlisted' /
// 'private' / pre-STD-launch events never appear), and (b) the event-type
// 'website' surface (generic / simple event types don't enable a public
// website, so listing/redirecting to them would 404). This is a public,
// indexable-adjacent surface — it aggregates only what the couple published.

export const revalidate = 60;

type Props = { params: Promise<{ userSlug: string }> };

type ProfileEvent = {
  event_id: string;
  slug: string | null;
  display_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_type: string | null;
  archived: boolean | null;
  landing_page_visibility: 'public' | 'unlisted' | 'private' | null;
  scheduled_launch_at: string | null;
};

const EVENT_FIELDS =
  'event_id, slug, display_name, event_date, venue_name, event_type, archived, landing_page_visibility, scheduled_launch_at';

// Wrapped in cache() so generateMetadata + the page body share one set of
// queries per request (mirrors fetchEventBySlug on the [slug] page).
const resolveProfile = cache(async function resolveProfile(userSlugRaw: string) {
  const userSlug = userSlugRaw.toLowerCase();
  // A path segment that's a reserved word is never a user profile.
  if (!userSlug || RESERVED_SLUGS.has(userSlug)) return null;

  const admin = createAdminClient();
  const { data: user } = await admin
    .from('users')
    .select('user_id, display_name, slug')
    .ilike('slug', userSlug)
    .maybeSingle();
  if (!user) return null;

  // Events this account owns (couple member), that have a public slug.
  const { data: memberships } = await admin
    .from('event_members')
    .select('event_id')
    .eq('user_id', user.user_id)
    .eq('member_type', 'couple');
  const eventIds = (memberships ?? []).map((m) => m.event_id as string);
  if (eventIds.length === 0) return { user, events: [] as ProfileEvent[] };

  const { data: events } = await admin
    .from('events')
    .select(EVENT_FIELDS)
    .in('event_id', eventIds);

  return { user, events: (events ?? []) as ProfileEvent[] };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userSlug } = await params;
  const resolved = await resolveProfile(userSlug);
  const name = resolved?.user.display_name?.trim() || 'Setnayan';
  return {
    title: `${name} · Setnayan`,
    // Aggregation surface — the individual event pages carry the real SEO. Keep
    // this out of the index to avoid thin-content duplication.
    robots: { index: false, follow: true },
  };
}

export default async function AccountProfilePage({ params }: Props) {
  const { userSlug } = await params;
  const resolved = await resolveProfile(userSlug);
  if (!resolved) notFound();

  const { user, events } = resolved;
  const canonicalSlug = (user.slug as string | null) ?? userSlug;

  const withSlug = events.filter((e): e is ProfileEvent & { slug: string } => !!e.slug);

  // Mirror the /[slug] target's second gate: only event types whose profile
  // enables the public 'website' surface actually render there. Resolve once
  // per distinct event_type (resolveEventTypeProfile is React-cached) so a
  // public generic/simple event is never listed into a 404.
  const websiteByType = new Map<string, boolean>();
  for (const et of new Set(withSlug.map((e) => e.event_type ?? ''))) {
    const profile = await resolveEventTypeProfile(et);
    websiteByType.set(et, surfaceEnabled(profile, 'website'));
  }
  const hasWebsite = (e: ProfileEvent) => websiteByType.get(e.event_type ?? '') ?? false;

  const isPublicWebsite = (e: ProfileEvent) =>
    resolveEffectiveVisibility(e) === 'public' && hasWebsite(e);

  const ongoing = withSlug.filter((e) => !e.archived && isPublicWebsite(e));

  // 1 ongoing → jump straight in.
  if (ongoing.length === 1) {
    redirect(`/u/${canonicalSlug}/${ongoing[0]!.slug}`);
  }

  const displayName = user.display_name?.trim() || 'Their celebrations';

  // 0 ongoing → the couple's published editorials (past public celebrations).
  const editorials = ongoing.length === 0 ? withSlug.filter(isPublicWebsite) : [];

  const listed = ongoing.length >= 2 ? ongoing : editorials;
  const heading = ongoing.length >= 2 ? 'Celebrations' : 'Stories';

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--m-paper, #faf7f2)',
        color: 'var(--m-ink, #1a1a1a)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '4rem 1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 640 }}>
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              opacity: 0.6,
              marginBottom: '0.5rem',
            }}
          >
            Setnayan
          </p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.2 }}>
            {displayName}
          </h1>
        </header>

        {listed.length > 0 ? (
          <>
            <h2
              style={{
                fontSize: '0.8rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                opacity: 0.55,
                marginBottom: '1rem',
              }}
            >
              {heading}
            </h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyle: 'none', padding: 0 }}>
              {listed.map((event) => (
                <li key={event.event_id}>
                  <Link
                    href={`/u/${canonicalSlug}/${event.slug}`}
                    style={{
                      display: 'block',
                      padding: '1.1rem 1.25rem',
                      background: 'var(--m-ivory, #fff)',
                      border: '1px solid var(--m-line, #e7e1d8)',
                      borderRadius: 'var(--m-r-lg, 14px)',
                      boxShadow: 'var(--m-shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 600 }}>
                      {event.display_name?.trim() || 'Celebration'}
                    </span>
                    {(event.venue_name || event.event_date) && (
                      <span style={{ display: 'block', fontSize: '0.85rem', opacity: 0.6, marginTop: '0.2rem' }}>
                        {[event.venue_name, event.event_date].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ textAlign: 'center', opacity: 0.6, fontSize: '0.95rem' }}>
            No public celebrations yet.
          </p>
        )}
      </div>
    </main>
  );
}
