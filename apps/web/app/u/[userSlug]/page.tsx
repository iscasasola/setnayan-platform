import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import {
  resolveProfile as resolveEventTypeProfile,
  surfaceEnabled,
} from '@/lib/event-type-profile';
import { EventMonogram } from '@/app/_components/event-monogram';
import { formatEventDate } from '@/lib/events';

// Public account profile · setnayan.com/u/[user-slug].
//
// Doubles as the account's public website (owner 2026-07-04): the same surface
// that lets a signed-out visitor pick among the couple's celebrations IS their
// personal web presence. The signed-in dashboard keeps its own simple picker +
// auto-jump (owner ruling 2026-07-04 "keep auto-jump, hub reachable"); this
// page is the polished public-facing counterpart.
//
// Dispatch (owner ruling 2026-07-01):
//   • exactly 1 ongoing (active + effectively-public) event → redirect straight
//     to /u/[user-slug]/[event-slug] (mirrors the signed-in dashboard's
//     single-active-event auto-jump).
//   • 2+ ongoing events → show the celebrations gallery.
//   • 0 ongoing events → show the account's published stories (past public
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
  landing_page_hero_image_url: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_style: string | null;
  monogram_font_key: string | null;
  monogram_frame_key: string | null;
  monogram_custom_svg: string | null;
};

const EVENT_FIELDS =
  'event_id, slug, display_name, event_date, venue_name, event_type, archived, landing_page_visibility, scheduled_launch_at, landing_page_hero_image_url, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_custom_svg';

// Wrapped in cache() so generateMetadata + the page body share one set of
// queries per request (mirrors fetchEventBySlug on the [slug] page).
const resolveProfile = cache(async function resolveProfile(userSlugRaw: string) {
  const userSlug = userSlugRaw.toLowerCase();
  // A path segment that's a reserved word is never a user profile.
  if (!userSlug || RESERVED_SLUGS.has(userSlug)) return null;

  const admin = createAdminClient();
  const { data: user } = await admin
    .from('users')
    .select('user_id, display_name, slug, public_profile_enabled')
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
  const { data: events } =
    eventIds.length === 0
      ? { data: [] }
      : await admin.from('events').select(EVENT_FIELDS).in('event_id', eventIds);

  const all = (events ?? []) as ProfileEvent[];
  const withSlug = all.filter((e): e is ProfileEvent & { slug: string } => !!e.slug);

  // Mirror the /[slug] target's second gate: only event types whose profile
  // enables the public 'website' surface actually render there. Resolve once
  // per distinct event_type (resolveEventTypeProfile is React-cached) so a
  // public generic/simple event is never listed into a 404.
  const websiteByType = new Map<string, boolean>();
  for (const et of new Set(withSlug.map((e) => e.event_type ?? ''))) {
    const profile = await resolveEventTypeProfile(et);
    websiteByType.set(et, surfaceEnabled(profile, 'website'));
  }
  const isPublicWebsite = (e: ProfileEvent) =>
    resolveEffectiveVisibility(e) === 'public' &&
    (websiteByType.get(e.event_type ?? '') ?? false);

  // The single list of events this profile is ever allowed to surface — the
  // effectively-public + website-enabled ones. Computed here so the page body
  // AND generateMetadata agree on "has ≥1 public chapter" without recomputing.
  const publicWebsiteEvents = withSlug.filter(isPublicWebsite);

  return { user, publicWebsiteEvents };
});

// Owner-preview probe. Only ever called on the DORMANT path (profile disabled),
// so the common enabled+public render never reads cookies and stays cacheable
// under `revalidate`. The signed-in holder may preview their own hidden shell;
// everyone else 404s.
async function isSignedInHolder(ownerUserId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user && user.id === ownerUserId;
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userSlug } = await params;
  const resolved = await resolveProfile(userSlug);

  // Neutral, name-free metadata unless the profile is BOTH opted-in AND has at
  // least one public chapter. This keeps the account holder's real name out of
  // the <title> for any enumerable slug (the name/existence oracle) and honors
  // the noindex-unless-published rule.
  const enabled = resolved?.user.public_profile_enabled === true;
  const hasPublic = (resolved?.publicWebsiteEvents.length ?? 0) > 0;
  if (!resolved || !enabled || !hasPublic) {
    return {
      title: 'Setnayan',
      robots: { index: false, follow: false },
    };
  }

  const name = resolved.user.display_name?.trim() || 'Setnayan';
  return {
    title: `${name} · Setnayan`,
    // Aggregation surface — the individual event pages carry the real SEO. Keep
    // this out of the index to avoid thin-content duplication, but allow follow
    // so the (public) chapter links are crawled.
    robots: { index: false, follow: true },
  };
}

export default async function AccountProfilePage({ params }: Props) {
  const { userSlug } = await params;
  const resolved = await resolveProfile(userSlug);
  if (!resolved) notFound();

  const { user, publicWebsiteEvents } = resolved;
  const canonicalSlug = (user.slug as string | null) ?? userSlug;

  // #7b — per-account public/hidden gate. DORMANT by default: while the account
  // hasn't opted in, the /u shell 404s for strangers so it's neither a public
  // page nor a name/existence oracle. Only the signed-in holder may preview
  // their own hidden shell (this is the ONLY branch that reads auth, so the
  // opted-in public render stays cacheable under `revalidate`).
  const enabled = user.public_profile_enabled === true;
  const isOwnerPreview = enabled ? false : await isSignedInHolder(user.user_id);
  if (!enabled && !isOwnerPreview) notFound();

  const ongoing = publicWebsiteEvents.filter((e) => !e.archived);

  // 1 ongoing → jump straight in (skip for the owner previewing their own
  // hidden shell so they actually see the profile page they're checking).
  if (ongoing.length === 1 && !isOwnerPreview) {
    redirect(`/u/${canonicalSlug}/${ongoing[0]!.slug}`);
  }

  // ongoing≥2 → the celebrations gallery; ongoing 0 → published stories (past
  // public celebrations, incl. archived); the single-ongoing case only reaches
  // here for the owner preview, where we still list it rather than redirect.
  const listed = ongoing.length >= 2 ? ongoing : publicWebsiteEvents;
  const mode: 'gallery' | 'stories' | 'empty' =
    ongoing.length >= 2 ? 'gallery' : listed.length > 0 ? 'stories' : 'empty';

  // Name-oracle fix: only surface the holder's real display_name when there is
  // public published content (gallery/stories) — never on the empty state,
  // where printing it would confirm "this slug exists and belongs to <name>".
  const hasPublicContent = mode !== 'empty';
  const displayName = user.display_name?.trim() || 'Celebrations';
  const heading = hasPublicContent ? displayName : 'A Setnayan profile';

  const subtitle =
    mode === 'gallery'
      ? 'A collection of celebrations.'
      : mode === 'stories'
        ? 'Stories from celebrations past.'
        : null;

  return (
    <main className="uprof">
      <style>{UPROF_CSS}</style>

      <div className="uprof-inner">
        {isOwnerPreview ? (
          <div className="uprof-preview" role="status">
            Preview · your public profile is <strong>hidden</strong>. Turn it on in
            Profile &amp; settings → URL &amp; handle to share it.
          </div>
        ) : null}
        <header className="uprof-head">
          <h1 className="m-serif uprof-name">{heading}</h1>
          <span aria-hidden className="uprof-rule" />
          {subtitle ? <p className="uprof-sub">{subtitle}</p> : null}
        </header>

        {listed.length > 0 ? (
          <ul className="uprof-grid">
            {listed.map((event) => {
              const meta = [event.venue_name, formatEventDate(event.event_date)]
                .filter(Boolean)
                .join(' · ');
              const hero = event.landing_page_hero_image_url?.trim();
              return (
                <li key={event.event_id}>
                  <Link href={`/u/${canonicalSlug}/${event.slug}`} className="uprof-card">
                    {hero ? (
                      <span className="uprof-cover">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={hero}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="uprof-cover-img"
                        />
                      </span>
                    ) : (
                      <span className="uprof-mark">
                        <EventMonogram event={event} size="lg" />
                      </span>
                    )}
                    <span className="uprof-body">
                      <span className="m-serif uprof-title">
                        {event.display_name?.trim() || 'Celebration'}
                      </span>
                      {meta ? <span className="uprof-meta">{meta}</span> : null}
                    </span>
                    <span aria-hidden className="uprof-chev">
                      &rsaquo;
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="uprof-empty">
            <p className="uprof-empty-title">Nothing public to show yet</p>
            <p className="uprof-empty-sub">
              When a celebration is published, it will appear here.
            </p>
          </div>
        )}

        <footer className="uprof-foot">
          <a href="https://www.setnayan.com" className="uprof-foot-link">
            Made with Setnayan
          </a>
        </footer>
      </div>
    </main>
  );
}

const UPROF_CSS = `
  .uprof {
    min-height: 100dvh;
    background: var(--m-paper, #FBFBFA);
    color: var(--m-ink, #1B1A17);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(3rem, 9vw, 6rem) 1.5rem clamp(2.5rem, 6vw, 4rem);
  }
  .uprof-inner { width: 100%; max-width: 760px; }

  .uprof-preview {
    margin: 0 0 1.5rem;
    padding: 0.7rem 1rem;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-md, 14px);
    background: var(--m-ivory, #EDEAE0);
    color: var(--m-slate, #4F535B);
    font-size: 0.85rem;
    text-align: center;
  }

  .uprof-head { text-align: center; margin-bottom: clamp(2.25rem, 5vw, 3.25rem); }
  .uprof-name {
    font-size: clamp(2.4rem, 7vw, 4rem);
    line-height: 1.04;
    margin: 0;
    color: var(--m-ink, #1B1A17);
  }
  .uprof-rule {
    display: block;
    width: 44px;
    height: 1px;
    margin: 1.25rem auto 0;
    background: var(--m-orange, #A9834B);
  }
  .uprof-sub {
    margin: 1rem 0 0;
    font-size: 0.98rem;
    color: var(--m-slate, #4F535B);
  }

  .uprof-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.9rem;
  }
  @media (min-width: 640px) {
    .uprof-grid { grid-template-columns: 1fr 1fr; gap: 1.1rem; }
  }

  .uprof-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 100%;
    padding: 1.1rem 1.2rem;
    background: #fff;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-lg, 22px);
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    text-decoration: none;
    color: inherit;
    transition: transform .18s cubic-bezier(.2,.7,.2,1), border-color .18s, box-shadow .18s;
  }
  .uprof-card:hover {
    transform: translateY(-2px);
    border-color: var(--m-orange, #A9834B);
    box-shadow: 0 10px 30px -12px rgba(30,26,18,.18);
  }

  .uprof-cover {
    flex: 0 0 auto;
    width: 68px;
    height: 68px;
    border-radius: var(--m-r-md, 14px);
    overflow: hidden;
    background: var(--m-ivory, #EDEAE0);
  }
  .uprof-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uprof-mark { flex: 0 0 auto; display: inline-flex; }

  .uprof-body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; flex: 1 1 auto; }
  .uprof-title {
    font-size: 1.3rem;
    line-height: 1.15;
    color: var(--m-ink, #1B1A17);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .uprof-meta {
    font-size: 0.85rem;
    color: var(--m-slate-2, #6A6E76);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .uprof-chev {
    flex: 0 0 auto;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--m-slate-2, #6A6E76);
    opacity: .5;
    transition: transform .18s cubic-bezier(.2,.7,.2,1), color .18s, opacity .18s;
  }
  .uprof-card:hover .uprof-chev {
    transform: translateX(3px);
    color: var(--m-orange, #A9834B);
    opacity: 1;
  }

  .uprof-empty {
    text-align: center;
    border: 1px dashed var(--m-line, #E2DED4);
    border-radius: var(--m-r-lg, 22px);
    padding: 2.75rem 1.5rem;
    background: #fff;
  }
  .uprof-empty-title { margin: 0; font-size: 1.05rem; font-weight: 600; color: var(--m-ink, #1B1A17); }
  .uprof-empty-sub { margin: 0.5rem 0 0; font-size: 0.9rem; color: var(--m-slate-2, #6A6E76); }

  .uprof-foot { margin-top: clamp(2.5rem, 7vw, 4rem); text-align: center; }
  .uprof-foot-link {
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    color: var(--m-slate-2, #6A6E76);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: color .15s, border-color .15s;
  }
  .uprof-foot-link:hover { color: var(--m-ink, #1B1A17); border-color: var(--m-orange, #A9834B); }
`;
