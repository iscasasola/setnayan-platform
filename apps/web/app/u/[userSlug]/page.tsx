import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePublicProfile } from '@/lib/public-profile';
import { resolveRenamedPath } from '@/lib/slug-forwarding';
import { EventMonogram } from '@/app/_components/event-monogram';
import { formatEventDate } from '@/lib/events';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { ProfileShareButton } from '@/app/_components/profile-share-button';
import { CreatorBadge } from '@/app/_components/creator-badge';
import { CreatorTierChip } from '@/app/_components/creator-tier-chip';
import {
  chapterExcerpt,
  CHAPTER_KIND_LABEL,
  EMBED_PROVIDER_LABEL,
  youtubeThumbFromEmbedUrl,
} from '@/lib/creator-chapters';
import {
  fetchPublishedChaptersResult,
  loadChapterEventDays,
  type PublicChapter,
} from '@/lib/creator-public';
import { chronicleDay, groupChronicleByYear } from '@/lib/creator-chronicle';
import { weighYearWithFloor, type ChapterWeight } from '@/lib/chapter-weight';
import { loadChapterPictures, type ChapterPicture } from '@/lib/chapter-picture';
import { loadWhoWasThere, type WhoWasThere } from '@/lib/who-was-there';
import {
  fetchCreatorInfluence,
  type CreatorInfluenceVendor,
} from '@/lib/creator-offers';
import { formatAudienceCount } from '@/lib/creator-audience';
import { fetchCreatorInquiriesDriven } from '@/lib/inquiry-attribution';
import { ViewBeacon } from '@/app/u/_components/view-beacon';
import { FollowButton } from '@/app/u/_components/follow-button';
import { MutualDays } from '@/app/u/_components/mutual-days';

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
      // `absolute` bypasses the root template so this renders exactly
      // "Setnayan" and not "Setnayan · Setnayan". The neutral title is the
      // privacy control here — it must not confirm the slug belongs to anyone.
      title: { absolute: 'Setnayan' },
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
  // Retired-handle forwarding. The handle field on Profile promises the old
  // link keeps working, and every rename writes the ledger row — but NOTHING
  // ANYWHERE READ THOSE ROWS, at any flag setting, so a person who corrected
  // their handle broke every link anyone had already shared. Only on the miss
  // path, so a live profile costs nothing.
  if (!resolved) {
    const movedTo = await resolveRenamedPath(createAdminClient(), userSlug, ['user']);
    if (movedTo) redirect(movedTo);
    notFound();
  }

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
  const chaptersRead = await fetchPublishedChaptersResult(user.user_id);
  const chapters: PublicChapter[] = chaptersRead.items;
  const hasChapters = chapters.length > 0;
  // The chronicle is ordered by the day each celebration HAPPENED, so the
  // timeline needs those days. Only read when there is something to place, and
  // only for chapters that name a celebration.
  const [chapterEventDays, chapterPictures, whoWasThere] = hasChapters
    ? await Promise.all([
        loadChapterEventDays(chapters.map((c) => c.event_id)),
        // The photographs. One snapshot per celebration, not per chapter — see
        // lib/chapter-picture.ts for why that distinction is the whole cost.
        loadChapterPictures(chapters),
        // 🔒 The entourage — ACCEPTED roles only. See lib/who-was-there.ts:
        // being on a guest list is not agreeing to be named in public.
        loadWhoWasThere(
          chapters.map((c) => c.event_id).filter((id): id is string => !!id),
        ),
      ])
    : [
        new Map<string, string>(),
        new Map<string, ChapterPicture>(),
        [] as WhoWasThere[],
      ];

  // Creator "influence" — accepted vendor partnerships (aggregate, public). Only
  // relevant for a creator profile; never exposes the offer terms or the graph,
  // just the fact of a partnership + the vendor's public identity.
  const influenceVendors: CreatorInfluenceVendor[] = hasChapters
    ? await fetchCreatorInfluence(user.user_id)
    : [];

  // "Inquiries driven" (Creator Economy PR-C) — the ONE public influence metric
  // (owner paper-lock: raw integer, the word is "inquiries" never "bookings",
  // renders NOTHING at 0). Aggregate-only: the count of distinct events whose
  // chapter-attributed inquiry a vendor unlocked, self-owned-vendor unlocks
  // excluded. No tiers, no bands.
  const inquiriesDriven = hasChapters
    ? await fetchCreatorInquiriesDriven(user.user_id)
    : 0;

  const ongoing = publicWebsiteEvents.filter((e) => !e.archived);

  // 1 ongoing → jump straight in (skip for the owner previewing their own
  // hidden shell so they actually see the profile page they're checking, and
  // for creators whose profile is the chapter timeline).
  //
  // ⚠ AND NEVER ON A FAILED READ. `hasChapters` is false both when somebody
  // has published nothing and when the chapters query was REFUSED — a rejected
  // Supabase query resolves rather than throwing. Redirecting on the second
  // case sends a visitor who pressed this person's name in a byline onto a
  // WEDDING PAGE instead of the person's own, with nothing on screen wrong.
  // A read that failed knows nothing, so it decides nothing.
  if (ongoing.length === 1 && !isOwnerPreview && !hasChapters && chaptersRead.ok) {
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
              {/* E6 — "N chapters", first in the row (spec order: chapters ·
                  followers · views · inquiries-driven). Presentation-only:
                  `chapters` is already loaded above for the timeline, so this
                  adds ZERO reads, and it counts EXACTLY what the timeline below
                  renders (published AND carrying an embed) — not a DB total, and
                  deliberately not the owner's own draft-inclusive count.

                  HONESTY GATE: `hasChapters` is the only gate, and a FAILED read
                  cannot reach it — fetchPublishedChapters swallows a Supabase
                  error to [], so a broken read renders no badge, no timeline and
                  no stat. There is no path where this prints "0 chapters". */}
              {hasChapters ? (
                <>
                  <span className="uprof-stat">
                    <strong>{formatAudienceCount(chapters.length)}</strong>{' '}
                    {chapters.length === 1 ? 'chapter' : 'chapters'}
                  </span>
                  <span aria-hidden className="uprof-stat-dot">
                    &middot;
                  </span>
                </>
              ) : null}
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
              {/* PR-C — renders NOTHING at 0 (no fake influence). */}
              {inquiriesDriven > 0 ? (
                <>
                  <span aria-hidden className="uprof-stat-dot">
                    &middot;
                  </span>
                  <span className="uprof-stat">
                    <strong>{formatAudienceCount(inquiriesDriven)}</strong>{' '}
                    {inquiriesDriven === 1 ? 'inquiry driven' : 'inquiries driven'}
                    {/* P3 tier band — a rendering of the SAME number, not a
                        second metric; hides at 0 alongside the line itself. */}
                    <CreatorTierChip
                      inquiriesDriven={inquiriesDriven}
                      className="uprof-tier-chip"
                    />
                  </span>
                </>
              ) : null}
              {/* Follow — the client island renders only for a signed-in
                  visitor viewing someone else's profile (never self/signed-out).
                  E6: the one-way note rides INSIDE the island (past its own
                  render gate) so it can never appear without the button. */}
              <FollowButton
                followedUserId={user.user_id}
                className="uprof-follow"
                noteClassName="uprof-follow-note"
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

        {/* "The days you were both there" — a per-VIEWER client island, for the
            same reason FollowButton is one: this page is ISR-cached, and an
            answer that differs per visitor must never enter that cache. It
            renders nothing for a signed-out visitor, nothing on your own
            profile, and nothing while the feature is off. The holder's name is
            passed ONLY where the page already prints it publicly, so the island
            can never become a name oracle for a hidden/empty profile. */}
        {/* ⚠ NOT `displayName` — that variable falls back to the literal
            "Celebrations" when the account has no name set, which would print
            "the next time you and Celebrations are at the same celebration".
            Pass the REAL name or nothing; the island says "them" when it has
            nothing, which is always readable. */}
        <MutualDays
          profileUserId={user.user_id}
          profileName={hasPublicContent ? (user.display_name?.trim() || null) : null}
        />

        {hasChapters ? (
          <>
            <WhoWasThereBand people={whoWasThere} />
            <ChapterTimeline
              chapters={chapters}
              eventDays={chapterEventDays}
              pictures={chapterPictures}
              slug={canonicalSlug}
            />
          </>
        ) : null}

        {influenceVendors.length > 0 ? (
          <CreatorInfluence vendors={influenceVendors} />
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

/**
 * The chapter's day, long form.
 *
 * 🪤 `new Date('2026-12-18')` IS MIDNIGHT UTC — the 17th anywhere west of
 * Greenwich — and this function used to do exactly that. It only ever received
 * a publish TIMESTAMP, where the hour absorbed the shift; it now also receives
 * the celebration's DATE, which is a bare calendar day and would have drifted
 * on the phone of every relative reading from abroad. `formatEventDate` builds
 * the date from its parts for precisely this reason (2026-08-04 sweep, 41 call
 * sites), so this delegates rather than repeating the mistake a third time.
 */
function formatChapterDate(iso: string | null): string | null {
  if (!iso) return null;
  return formatEventDate(iso.slice(0, 10), 'en-PH') || null;
}

// CP-3 — the published-chapter TIMELINE (reverse-chronological, a spine of
// dated cards; deliberately NOT a feed). Each card links to the chapter detail
// view at /u/[slug]/c/[public_id]. The embed itself is NOT mounted here — the
// timeline is lightweight cards; the sandboxed ChapterEmbedFrame lives on the
// detail page.
/**
 * WHO WAS THERE — the band the whole field is missing.
 *
 * 🔒 It renders ONLY people who ACCEPTED a named role (lib/who-was-there.ts).
 * An empty list renders nothing at all: a heading over no names would announce
 * an entourage that either does not exist or did not consent, and both are
 * worse than silence.
 *
 * ⚠ NO GUEST COUNT HERE, deliberately. "+ 42 guests" was in the drawing, and a
 * count is harmless — but it can only be measured from `guests`, and a failed
 * read of that table is indistinguishable from a wedding of nine people. A
 * number nobody can trust does not belong next to names that are true.
 */
function WhoWasThereBand({ people }: { people: WhoWasThere[] }) {
  if (people.length === 0) return null;
  return (
    <section className="uprof-who" aria-label="Who was there">
      <p className="uprof-who-h">Who was there</p>
      <ul className="uprof-who-l">
        {people.map((p) => (
          <li key={`${p.role}-${p.name}`} className="uprof-who-i">
            <span className="uprof-who-n">{p.name}</span>
            <span className="uprof-who-r">{p.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChapterTimeline({
  chapters,
  eventDays,
  pictures,
  slug,
}: {
  chapters: PublicChapter[];
  /** event_id → the day it happened, for the chapters that name a celebration. */
  eventDays: Map<string, string>;
  /** chapter_id → its public-safe photograph. Absent = no picture, which is a
   *  smaller chapter rather than a broken one. */
  pictures: Map<string, ChapterPicture>;
  slug: string;
}) {
  // THE CHRONICLE — the year is the season, the chapter is the episode, and the
  // number restarts inside each year (owner 2026-08-20). The day comes from the
  // author's own answer, then the celebration it is attached to, then — last
  // resort — the publish date.
  //
  // Derived from PARSED DAYS, never from array position: the query orders
  // published_at DESC and Postgres DESC is NULLS FIRST, so `chapters[0]` can be
  // an undated row. Undated rows get no number and can never be "latest".
  const days = chapters.map((c) =>
    chronicleDay({
      happenedOn: c.happened_on,
      eventDate: c.event_id ? eventDays.get(c.event_id) ?? null : null,
      publishedAt: c.published_at,
    }),
  );
  const blocks = groupChronicleByYear(chapters, (_c, i) => days[i] ?? null);
  // The poster + "Latest" belong to the newest DATED chapter in the whole
  // timeline, which is the first entry of the first block that has a year.
  const newestIndex = blocks.find((b) => b.year !== null)?.entries[0]?.index ?? -1;
  const datedCount = days.filter((d) => d !== null).length;
  const showLatest = datedCount > 1;

  return (
    <section className="uprof-tl" aria-label="Chapters">
      {blocks.map((block) => {
        // 🔑 THE SIZE IS DERIVED, NEVER CHOSEN. A wedding takes the width, a
        // Tuesday takes a line — and it happens without anybody art-directing
        // it, which is the only reason it keeps happening after the first week.
        // See lib/chapter-weight.ts.
        const weights = weighYearWithFloor(
          block.entries.map(({ item, index }) => ({
            hasPicture: pictures.has(item.chapter_id),
            hasWriting: !!chapterExcerpt(item.body, 200),
            _i: index,
          })),
        );
        return (
          <div key={block.year ?? 'unplaced'} className="uprof-yr">
            {/* THE YEAR IS THE SEASON, and it is written as its own name.
                ⛔ NEVER as the words "Your year" — that is a DIFFERENT page one
                click away in the same menu, which looks FORWARD at what is
                coming; this looks back at what happened. Same words on two
                things is the failure the Event Hub vocabulary lock exists to
                prevent. */}
            {block.year ? (
              <p className="uprof-yr-mark">
                <span className="uprof-yr-n">{block.year}</span>
                <span aria-hidden className="uprof-yr-rule" />
                <span className="uprof-yr-c">
                  {block.entries.length === 1 ? '1 chapter' : `${block.entries.length} chapters`}
                </span>
              </p>
            ) : null}
            <ol className="uprof-list">
              {block.entries.map(({ item: c, index: i, number: n }, k) => {
                const weight: ChapterWeight = weights[k] ?? 'line';
                // The day the chapter is ABOUT — the celebration's, when it has one.
                const date = formatChapterDate(days[i] ?? c.published_at);
                const isLatest = i === newestIndex && showLatest;
                const pic = pictures.get(c.chapter_id) ?? null;
                const kicker = [
                  n !== null ? `Chapter ${n}` : null,
                  CHAPTER_KIND_LABEL[c.kind],
                  date,
                ]
                  .filter(Boolean)
                  .join(' · ');

                // ── A LINE. No picture, no writing: a title and a date. It is
                // not a lesser chapter, it is a shorter one.
                if (weight === 'line') {
                  return (
                    <li key={c.chapter_id} className="uprof-line">
                      <Link href={`/u/${slug}/c/${c.public_id}`} className="uprof-line-a">
                        <span className="uprof-line-d">{date ?? ''}</span>
                        <span className="uprof-line-t">{c.title}</span>
                      </Link>
                    </li>
                  );
                }

                // ── THE LEAD. A photograph, the title, one sentence.
                // ⚠ ONE SENTENCE, NOT AN ESSAY. The research bride has "two
                // sentences and four hundred photographs" — a slot built for a
                // long read is the slot she is least able to fill, on the most
                // prominent part of her own page.
                if (weight === 'lead') {
                  return (
                    <li key={c.chapter_id} className="uprof-lead">
                      <Link href={`/u/${slug}/c/${c.public_id}`} className="uprof-lead-a">
                        {pic ? (
                          <span className="uprof-lead-img">
                            {/* A dead or expired image cannot be detected
                                server-side without a fetch, so the frame carries
                                its own ground and the img an empty alt: it
                                degrades to a neutral panel, never a broken
                                glyph. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={pic.url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="uprof-img"
                            />
                            {pic.count > 1 ? (
                              <span className="uprof-count">{pic.count} photos</span>
                            ) : null}
                            {c.embed_url ? (
                              <span aria-hidden className="uprof-play">
                                <Play className="uprof-play-i" fill="currentColor" strokeWidth={0} />
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        <span className="uprof-lead-b">
                          <span className="uprof-k">
                            {kicker}
                            {isLatest ? ' · Latest' : ''}
                          </span>
                          <span className="uprof-lead-t">{c.title}</span>
                          <span className="uprof-lead-x">{chapterExcerpt(c.body, 190)}</span>
                          <span className="uprof-cue">
                            {c.embed_url ? 'Watch the chapter' : 'Read the chapter'} &rarr;
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                }

                // ── MEDIUM. A strip: a small picture when there is one, the
                // title, and whichever of the two it actually has.
                return (
                  <li key={c.chapter_id} className="uprof-med">
                    <Link href={`/u/${slug}/c/${c.public_id}`} className="uprof-med-a">
                      {pic ? (
                        <span className="uprof-med-img">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pic.url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="uprof-img"
                          />
                        </span>
                      ) : null}
                      <span className="uprof-med-b">
                        <span className="uprof-k">{kicker}</span>
                        <span className="uprof-med-t">{c.title}</span>
                        {chapterExcerpt(c.body, 110) ? (
                          <span className="uprof-med-x">{chapterExcerpt(c.body, 110)}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

// Creator "influence" — partnered vendors (accepted discount collabs), an
// aggregate social-proof strip. Public + terms-free: it shows WHO the creator
// has partnered with (name/logo → the vendor's 0%-commission public page), never
// the discount terms or the offer graph. Bookings-driven ROI is P2/P3.
function CreatorInfluence({ vendors }: { vendors: CreatorInfluenceVendor[] }) {
  return (
    <section className="uprof-inf" aria-label="Partnered vendors">
      <h2 className="m-serif uprof-inf-head">Partnered with</h2>
      <ul className="uprof-inf-list">
        {vendors.map((v) => (
          <li key={v.slug}>
            <Link href={`/v/${v.slug}`} className="uprof-inf-card">
              {v.logoUrl ? (
                <span className="uprof-inf-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.logoUrl} alt="" loading="lazy" decoding="async" />
                </span>
              ) : (
                <span className="uprof-inf-logo uprof-inf-logo--blank" aria-hidden>
                  {v.name.charAt(0)}
                </span>
              )}
              <span className="uprof-inf-name">{v.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const UPROF_CSS = `
  /* "Days you were both there" — rendered by the MutualDays client island.
     The island is a separate file, so these classes are its only styling; keep
     them here with the rest of the page's CSS rather than shipping a second
     <style> block. */
  .uprof-md { margin-top: clamp(2.5rem, 6vw, 3.75rem); }
  .uprof-md-head {
    font-size: clamp(1.2rem, 3.5vw, 1.6rem);
    text-align: center;
    margin: 0 0 clamp(1.25rem, 3vw, 1.75rem);
    color: var(--m-ink, #1B1A17);
  }
  .uprof-md-invite {
    max-width: 34rem;
    margin: 0 auto;
    text-align: center;
    font-size: 0.95rem;
    line-height: 1.65;
    color: color-mix(in srgb, var(--m-ink, #1B1A17) 62%, transparent);
  }
  .uprof-md-list { list-style: none; margin: 0; padding: 0; }
  .uprof-md-item + .uprof-md-item { margin-top: 0.9rem; }
  .uprof-md-card {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.95rem 1.1rem;
    border: 1px solid color-mix(in srgb, var(--m-ink, #1B1A17) 12%, transparent);
    /* The same token as .uprof-card — a shared day is a card
       in the same stack, so it must not round differently from its neighbours. */
    border-radius: var(--m-r-lg, 22px);
    background: color-mix(in srgb, #FFFFFF 60%, transparent);
    text-decoration: none;
    transition: background-color 200ms, border-color 200ms;
  }
  .uprof-md-card:hover {
    background: #FFFFFF;
    border-color: color-mix(in srgb, var(--m-ink, #1B1A17) 22%, transparent);
  }
  .uprof-md-body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; flex: 1; }
  .uprof-md-title { font-size: 1.02rem; color: var(--m-ink, #1B1A17); }
  .uprof-md-meta {
    font-size: 0.82rem;
    color: color-mix(in srgb, var(--m-ink, #1B1A17) 55%, transparent);
  }
  .uprof-md-chev {
    font-size: 1.35rem;
    line-height: 1;
    color: color-mix(in srgb, var(--m-ink, #1B1A17) 35%, transparent);
  }

  .uprof-inf { margin-top: clamp(2.5rem, 6vw, 3.75rem); }
  .uprof-inf-head {
    font-size: clamp(1.2rem, 3.5vw, 1.6rem);
    text-align: center;
    margin: 0 0 clamp(1.25rem, 3vw, 1.75rem);
    color: var(--m-ink, #1B1A17);
  }
  .uprof-inf-list {
    list-style: none;
    margin: 0 auto;
    padding: 0;
    max-width: 620px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.7rem;
  }
  .uprof-inf-card {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.95rem 0.5rem 0.6rem;
    background: #fff;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-full, 999px);
    box-shadow: var(--m-shadow-sm, 0 1px 2px rgba(30,26,18,.05));
    text-decoration: none;
    color: inherit;
    transition: transform .15s cubic-bezier(.2,.7,.2,1), border-color .15s;
  }
  .uprof-inf-card:hover {
    transform: translateY(-1px);
    border-color: var(--m-orange, #A9834B);
  }
  .uprof-inf-logo {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    border-radius: var(--m-r-full, 999px);
    overflow: hidden;
    background: var(--m-ivory, #EDEAE0);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .uprof-inf-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uprof-inf-logo--blank {
    font-family: var(--font-mono-marketing), ui-monospace, monospace;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--m-orange-2, #8A6B39);
    text-transform: uppercase;
  }
  .uprof-inf-name {
    font-size: 0.86rem;
    font-weight: 500;
    color: var(--m-ink, #1B1A17);
  }

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
  .uprof-tier-chip {
    margin-left: 0.4rem;
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
  /* E6 — the one-way promise. flex-basis:100% breaks it onto its own centered
     line inside the wrapping .uprof-audience row, so it never reads as a fourth
     stat chip.
     CONTRAST, measured not assumed: --m-slate-2 (#6E6A62) on --m-paper
     (#FFFFFF, white since 2026-08-20) = 5.39:1, clears AA. The spec's own 11.5px
     #A09A8E is 2.79:1 and
     was NOT used; --m-slate-3 (#8A857B) is 3.55:1 and also fails. Note that
     lint-label-on-fill-contrast.mjs CANNOT catch a miss here — it reads Tailwind
     class pairs and inline style objects, never this template literal. */
  .uprof-follow-note {
    flex-basis: 100%;
    width: 100%;
    margin: 0.35rem 0 0;
    text-align: center;
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--m-slate-2, #6E6A62);
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

  /* ── WHO WAS THERE ────────────────────────────────────────────────────
     The warm band, and the one thing measured nowhere else in the category:
     every competitor's couple page names exactly two people. Clay ground so the
     page is not one long stretch of cream — the research bride read the
     all-cream draft as a memorial page. */
  .uprof-who {
    background: #A8421C; color: #FCEFE3;
    margin: clamp(1.6rem, 5vw, 2.4rem) 0 0;
    padding: 1.05rem clamp(1rem, 4vw, 1.6rem) 1.15rem;
    border-radius: var(--m-r-md);
  }
  .uprof-who-h {
    margin: 0 0 0.75rem; font-size: 0.66rem; font-weight: 600;
    letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.92;
  }
  .uprof-who-l {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-wrap: wrap; gap: 0.5rem 1.6rem;
  }
  .uprof-who-i { min-width: 0; }
  .uprof-who-n {
    display: block; font-family: var(--font-editorial-display), Georgia, serif;
    font-size: 1.02rem; line-height: 1.2;
  }
  .uprof-who-r {
    display: block; font-size: 0.62rem; letter-spacing: 0.14em;
    text-transform: uppercase; opacity: 0.7; margin-top: 0.1rem;
  }

  /* ── THE CHRONICLE, AT THREE SIZES ────────────────────────────────────
     Scale carries meaning: the chapter with a photograph AND writing takes the
     width, the one with either takes a strip, the one with neither takes a
     line. Derived in lib/chapter-weight.ts, never art-directed — the two
     publications measured with the least per-item authoring both abandoned
     variation entirely rather than decide it by hand.
     Measured against the field: Zola ships 1,618 designs and two layouts;
     Appy Couple's "Stories" is six identical polaroids. Nobody varies. */
  .uprof-yr { max-width: 660px; margin: 0 auto; }
  .uprof-yr-mark {
    display: flex; align-items: center; gap: 12px;
    margin: clamp(1.9rem, 5vw, 2.6rem) 0 1.05rem;
  }
  .uprof-yr-n {
    font-family: var(--font-sans, system-ui), sans-serif;
    font-size: 0.82rem; font-weight: 700; letter-spacing: 0.17em;
    text-transform: uppercase; color: #C24E25;
  }
  .uprof-yr-rule { height: 2px; border-radius: var(--m-r-xs); flex: 1; background: var(--m-line, #E2DED4); }
  .uprof-yr-c {
    font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--m-slate-2, #6A6E76);
  }
  .uprof-list { list-style: none; margin: 0; padding: 0; }

  .uprof-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uprof-k {
    display: block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.14em;
    text-transform: uppercase; color: #8A6B39; margin: 0 0 0.4rem;
  }

  /* THE LEAD */
  .uprof-lead { margin: 0 0 1.15rem; }
  .uprof-lead-a { display: block; text-decoration: none; color: inherit; }
  .uprof-lead-img {
    display: block; position: relative; width: 100%;
    aspect-ratio: 16 / 10; border-radius: var(--m-r-sm); overflow: hidden;
    background: var(--m-ivory, #F6F2EA);
  }
  .uprof-count, .uprof-play {
    position: absolute; background: rgba(20, 14, 10, 0.62); color: #fff;
  }
  .uprof-count {
    right: 10px; bottom: 10px; font-size: 0.62rem; letter-spacing: 0.11em;
    text-transform: uppercase; padding: 4px 9px; border-radius: var(--m-r-full);
  }
  .uprof-play {
    left: 10px; bottom: 10px; width: 30px; height: 30px; border-radius: 50%;
    display: grid; place-items: center;
  }
  .uprof-play-i { width: 12px; height: 12px; margin-left: 1px; }
  .uprof-lead-b { display: block; padding: 0.85rem 0 0; }
  .uprof-lead-t {
    display: block; font-family: var(--font-editorial-display), Georgia, serif;
    font-size: clamp(1.35rem, 4vw, 1.75rem); line-height: 1.12; font-weight: 600;
    color: var(--m-ink, #1B1A17); margin: 0 0 0.45rem;
  }
  .uprof-lead-x {
    display: block; font-size: 0.94rem; line-height: 1.6;
    color: var(--m-slate-1, #4A4740); margin: 0 0 0.55rem;
  }
  .uprof-cue { display: block; font-size: 0.82rem; font-weight: 600; color: #C24E25; }

  /* MEDIUM */
  .uprof-med { border-top: 1px solid var(--m-line, #E2DED4); }
  .uprof-med-a {
    display: flex; gap: 0.85rem; align-items: center; padding: 0.85rem 0;
    text-decoration: none; color: inherit;
  }
  .uprof-med-img {
    display: block; position: relative; width: 104px; height: 74px; flex: none;
    border-radius: var(--m-r-xs); overflow: hidden; background: var(--m-ivory, #F6F2EA);
  }
  .uprof-med-b { display: block; min-width: 0; }
  .uprof-med-t {
    display: block; font-family: var(--font-editorial-display), Georgia, serif;
    font-size: 1.13rem; line-height: 1.2; font-weight: 600; color: var(--m-ink, #1B1A17);
  }
  .uprof-med-x {
    display: block; font-size: 0.8rem; line-height: 1.5;
    color: var(--m-slate-2, #6A6E76); margin: 0.25rem 0 0;
  }

  /* A LINE */
  .uprof-line { border-top: 1px solid var(--m-line, #E2DED4); }
  .uprof-line-a {
    display: flex; gap: 0.9rem; align-items: baseline; padding: 0.7rem 0;
    text-decoration: none; color: inherit;
  }
  .uprof-line-d {
    font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--m-slate-2, #6A6E76); width: 84px; flex: none;
  }
  .uprof-line-t {
    font-family: var(--font-editorial-display), Georgia, serif;
    font-size: 1.02rem; line-height: 1.25; color: var(--m-ink, #1B1A17);
  }

  /* ⛔ THE OLD SPINE IS RETIRED. It gave every chapter the same dot, the same
     card and the same width — the listing shape the owner rejected. Its rules
     are deleted rather than left to rot, so nothing can quietly fall back to
     them. */

  /* CP-3 chapter timeline — a spine of dated cards (not a feed). */
  .uprof-tl { margin-top: clamp(2.5rem, 6vw, 3.75rem); }
  /* THE YEAR — the season heading. It sits ON the spine, so a reader scrolling
     back through a life passes a year the way they pass a chapter break in a
     book. Deliberately quiet: it is furniture, not a title. */
  /* E5 — padding + gap moved to the card body so the latest chapter's
     poster can run full-bleed to the card's rounded edge. EVERY card now wraps
     its text in the body span (poster or not), so the two must never be edited
     apart. overflow:hidden is what clips the poster to the radius. */
  /* Scrim pill. Cream on rgba(44,42,41,.75) composited over the WORST case (a
     pure-white thumbnail) measures 6.20:1 — clears AA with room. */

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
