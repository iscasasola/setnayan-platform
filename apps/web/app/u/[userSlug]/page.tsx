import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolvePublicProfile } from '@/lib/public-profile';
import { EventMonogram } from '@/app/_components/event-monogram';
import { formatEventDate } from '@/lib/events';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { ProfileShareButton } from '@/app/_components/profile-share-button';
import { CreatorBadge } from '@/app/_components/creator-badge';
import { CHAPTER_KIND_LABEL } from '@/lib/creator-chapters';
import { fetchPublishedChapters, type PublicChapter } from '@/lib/creator-public';
import { formatAudienceCount } from '@/lib/creator-audience';
import { ViewBeacon } from '@/app/u/_components/view-beacon';
import { FollowButton } from '@/app/u/_components/follow-button';

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
// Creator overlay (CP-3; user-native since 2026-07-16): creator is now a
// USER-NATIVE capability — a profile that has published >=1 Adventure Chapter is
// a creator, no is_creator flag. When the account has published chapters, the
// profile ALSO renders a timeline of them (reverse-chronological cards →
// /u/[slug]/c/[id]) plus the gold creator badge, and never auto-redirects into a
// single event — the chapters are the point of the page.
//
// Only surfaces events the /[slug] target would actually render — mirrors BOTH
// gates that page enforces: (a) effectively-public visibility (so 'unlisted' /
// 'private' / pre-STD-launch events never appear), and (b) the event-type
// 'website' surface (generic / simple event types don't enable a public
// website, so listing/redirecting to them would 404). This is a public,
// indexable-adjacent surface — it aggregates only what the couple published.

export const revalidate = 60;

type Props = { params: Promise<{ userSlug: string }> };

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// The "who is a public profile / what counts as a public chapter" resolver lives
// in lib/public-profile.ts (resolvePublicProfile, cache()-wrapped) so the page
// body, generateMetadata, the OG route, and the settings share-doorway gate all
// agree on the SAME definition — a name/hero never leaks anywhere one of them
// would have hidden it.

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
  const resolved = await resolvePublicProfile(userSlug);

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
  const canonicalSlug = resolved.user.slug ?? userSlug;
  // Personalized share card (name + most-recent public hero) — item #7c. The OG
  // route re-checks the SAME enabled + ≥1-public-chapter gate before rendering a
  // name-bearing card, and falls back to the brand card otherwise, so this URL is
  // only ever emitted for a genuine public showcase.
  const ogImage = `${SITE_URL}/api/og/u/${canonicalSlug}`;
  return {
    title: `${name} · Setnayan`,
    // Aggregation surface — the individual event pages carry the real SEO. Keep
    // this out of the index to avoid thin-content duplication, but allow follow
    // so the (public) chapter links are crawled.
    robots: { index: false, follow: true },
    openGraph: {
      type: 'profile',
      title: `${name} · Setnayan`,
      siteName: 'Setnayan',
      locale: 'en_PH',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${name} · Setnayan` }],
    },
    twitter: { card: 'summary_large_image' as const },
  };
}

export default async function AccountProfilePage({ params }: Props) {
  const { userSlug } = await params;
  const resolved = await resolvePublicProfile(userSlug);
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

  // Creator "Adventure Chapter" (CP-3; user-native): a profile with published
  // chapters IS a timeline of them, not just an event picker. Creator is now
  // user-native — having >=1 published chapter is what makes the account a
  // creator (no is_creator flag). We're already past the enabled/owner-preview
  // gate, so load the timeline here; when it's non-empty we NEVER auto-redirect
  // into a single event — the chapters are the point of the page.
  const chapters: PublicChapter[] = await fetchPublishedChapters(user.user_id);
  const hasChapters = chapters.length > 0;

  const ongoing = publicWebsiteEvents.filter((e) => !e.archived);

  // 1 ongoing → jump straight in (skip for the owner previewing their own
  // hidden shell so they actually see the profile page they're checking, and
  // for creators whose profile is the chapter timeline).
  if (ongoing.length === 1 && !isOwnerPreview && !hasChapters) {
    redirect(`/u/${canonicalSlug}/${ongoing[0]!.slug}`);
  }

  // ongoing≥2 → the celebrations gallery; ongoing 0 → published stories (past
  // public celebrations, incl. archived); the single-ongoing case only reaches
  // here for the owner preview, where we still list it rather than redirect.
  const listed = ongoing.length >= 2 ? ongoing : publicWebsiteEvents;
  const mode: 'gallery' | 'stories' | 'empty' =
    ongoing.length >= 2 ? 'gallery' : listed.length > 0 ? 'stories' : 'empty';

  // Name-oracle fix: only surface the holder's real display_name when there is
  // public published content (gallery/stories/chapters) — never on the true
  // empty state, where printing it would confirm "this slug exists and belongs
  // to <name>". A creator with a published chapter timeline counts as content.
  const hasPublicContent = mode !== 'empty' || hasChapters;
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

      {/* Audience view beacon — counts a genuinely-public profile view out of
          band (keeps this page ISR-cacheable). No-op on the owner-preview of a
          hidden profile (the RPC self-gates to public_profile_enabled). */}
      {enabled && hasPublicContent ? (
        <ViewBeacon kind="profile" id={user.user_id} />
      ) : null}

      <div className="uprof-inner">
        {isOwnerPreview ? (
          <div className="uprof-preview" role="status">
            Preview · your public profile is <strong>hidden</strong>. Turn it on in
            Profile &amp; settings → URL &amp; handle to share it.
          </div>
        ) : null}
        <header className="uprof-head">
          <h1 className="m-serif uprof-name">{heading}</h1>
          {hasChapters ? (
            <div className="uprof-badge-row">
              <CreatorBadge size="md" />
            </div>
          ) : null}
          {hasPublicContent ? (
            <div className="uprof-audience">
              <span className="uprof-stat">
                <strong>{formatAudienceCount(user.followers_count)}</strong>{' '}
                {user.followers_count === 1 ? 'follower' : 'followers'}
              </span>
              <span aria-hidden className="uprof-stat-dot">
                &middot;
              </span>
              <span className="uprof-stat">
                <strong>{formatAudienceCount(user.profile_view_count)}</strong>{' '}
                {user.profile_view_count === 1 ? 'view' : 'views'}
              </span>
              {/* Follow — the client island renders only for a signed-in
                  visitor viewing someone else's profile (never self/signed-out). */}
              <FollowButton
                followedUserId={user.user_id}
                className="uprof-follow"
              />
            </div>
          ) : null}
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
        ) : hasChapters ? null : (
          <div className="uprof-empty">
            <p className="uprof-empty-title">Nothing public to show yet</p>
            <p className="uprof-empty-sub">
              When a celebration is published, it will appear here.
            </p>
          </div>
        )}

        {hasChapters ? (
          <ChapterTimeline chapters={chapters} slug={canonicalSlug} />
        ) : null}

        {/* Share doorway + report path (#7c). Gated on the profile being a real
            public showcase — opted-in AND has ≥1 public chapter (hasPublicContent).
            Never rendered on the disabled owner-preview or the empty state, so we
            never offer sharing on, or attach a report target to, a non-public
            profile. */}
        {enabled && hasPublicContent ? (
          <div className="uprof-actions">
            <ProfileShareButton
              url={`${SITE_URL}/u/${canonicalSlug}`}
              title={`${displayName} · Setnayan`}
              className="uprof-action-btn"
            />
            <ReportPageButton
              targetType="user_profile"
              targetId={user.user_id}
              label="Report this page"
              className="inline-flex"
            />
          </div>
        ) : null}

        <footer className="uprof-foot">
          <a href="https://www.setnayan.com" className="uprof-foot-link">
            Made with Setnayan
          </a>
        </footer>
      </div>
    </main>
  );
}

function formatChapterDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// CP-3 — the published-chapter TIMELINE (reverse-chronological, a spine of
// dated cards; deliberately NOT a feed). Each card links to the chapter detail
// view at /u/[slug]/c/[public_id]. The embed itself is NOT mounted here — the
// timeline is lightweight cards; the sandboxed ChapterEmbedFrame lives on the
// detail page.
function ChapterTimeline({
  chapters,
  slug,
}: {
  chapters: PublicChapter[];
  slug: string;
}) {
  return (
    <section className="uprof-tl" aria-label="Chapters">
      <h2 className="m-serif uprof-tl-head">Chapters</h2>
      <ol className="uprof-tl-list">
        {chapters.map((c) => {
          const date = formatChapterDate(c.published_at);
          return (
            <li key={c.chapter_id} className="uprof-tl-item">
              <span aria-hidden className="uprof-tl-dot" />
              <Link href={`/u/${slug}/c/${c.public_id}`} className="uprof-tl-card">
                <span className="uprof-tl-kicker">
                  <span className="uprof-tl-kind">{CHAPTER_KIND_LABEL[c.kind]}</span>
                  {date ? <span className="uprof-tl-date">{date}</span> : null}
                  <span className="uprof-tl-views">
                    {formatAudienceCount(c.view_count)}{' '}
                    {c.view_count === 1 ? 'view' : 'views'}
                  </span>
                </span>
                <span className="m-serif uprof-tl-title">{c.title}</span>
                <span className="uprof-tl-cue">
                  Watch the chapter
                  <span aria-hidden className="uprof-tl-chev">
                    &rsaquo;
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
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
  .uprof-badge-row {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }
  .uprof-audience {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.7rem;
    margin-top: 1rem;
  }
  .uprof-stat {
    font-size: 0.9rem;
    color: var(--m-slate, #4F535B);
  }
  .uprof-stat strong {
    color: var(--m-ink, #1B1A17);
    font-weight: 600;
  }
  .uprof-stat-dot {
    color: var(--m-slate-2, #6A6E76);
    opacity: 0.6;
  }
  .uprof-follow {
    margin-left: 0.3rem;
    display: inline-flex;
    align-items: center;
    padding: 0.34rem 0.95rem;
    border: 1px solid var(--m-orange, #A9834B);
    border-radius: var(--m-r-full, 999px);
    background: var(--m-orange, #A9834B);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform .15s cubic-bezier(.2,.7,.2,1), opacity .15s, background .15s, color .15s;
  }
  .uprof-follow:hover { transform: translateY(-1px); }
  .uprof-follow:disabled { opacity: 0.6; cursor: default; transform: none; }
  .uprof-follow[data-following='1'] {
    background: #fff;
    color: var(--m-ink, #1B1A17);
    border-color: var(--m-line, #E2DED4);
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

  /* CP-3 chapter timeline — a spine of dated cards (not a feed). */
  .uprof-tl { margin-top: clamp(2.5rem, 6vw, 3.75rem); }
  .uprof-tl-head {
    font-size: clamp(1.4rem, 4vw, 1.9rem);
    text-align: center;
    margin: 0 0 clamp(1.5rem, 4vw, 2.25rem);
    color: var(--m-ink, #1B1A17);
  }
  .uprof-tl-list {
    list-style: none;
    margin: 0 auto;
    padding: 0;
    max-width: 620px;
    position: relative;
  }
  .uprof-tl-list::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 6px;
    bottom: 6px;
    width: 1px;
    background: linear-gradient(var(--m-line, #E2DED4), transparent);
  }
  .uprof-tl-item {
    position: relative;
    padding-left: 1.9rem;
  }
  .uprof-tl-item + .uprof-tl-item { margin-top: 0.9rem; }
  .uprof-tl-dot {
    position: absolute;
    left: 0;
    top: 1.35rem;
    width: 11px;
    height: 11px;
    border-radius: 999px;
    background: var(--m-paper, #FBFBFA);
    border: 2px solid var(--m-orange, #A9834B);
  }
  .uprof-tl-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 1.1rem 1.25rem;
    background: #fff;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-lg, 22px);
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    text-decoration: none;
    color: inherit;
    transition: transform .18s cubic-bezier(.2,.7,.2,1), border-color .18s, box-shadow .18s;
  }
  .uprof-tl-card:hover {
    transform: translateY(-2px);
    border-color: var(--m-orange, #A9834B);
    box-shadow: 0 10px 30px -12px rgba(30,26,18,.18);
  }
  .uprof-tl-kicker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  .uprof-tl-kind {
    font-family: var(--font-mono-marketing), 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--m-orange-2, #8A6B39);
  }
  .uprof-tl-date {
    font-size: 0.78rem;
    color: var(--m-slate-2, #6A6E76);
  }
  .uprof-tl-views {
    font-size: 0.72rem;
    color: var(--m-slate-2, #6A6E76);
    opacity: 0.85;
  }
  .uprof-tl-title {
    font-size: clamp(1.15rem, 3vw, 1.4rem);
    line-height: 1.2;
    color: var(--m-ink, #1B1A17);
  }
  .uprof-tl-cue {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.82rem;
    color: var(--m-slate, #4F535B);
  }
  .uprof-tl-chev {
    font-size: 1.15rem;
    line-height: 1;
    color: var(--m-orange, #A9834B);
    transition: transform .18s cubic-bezier(.2,.7,.2,1);
  }
  .uprof-tl-card:hover .uprof-tl-chev { transform: translateX(3px); }

  .uprof-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem 1.4rem;
    margin-top: clamp(2rem, 5vw, 3rem);
  }
  .uprof-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-full, 999px);
    background: #fff;
    color: var(--m-ink, #1B1A17);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    transition: border-color .15s, transform .15s cubic-bezier(.2,.7,.2,1);
  }
  .uprof-action-btn:hover {
    border-color: var(--m-orange, #A9834B);
    transform: translateY(-1px);
  }

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
